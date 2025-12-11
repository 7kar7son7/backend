#!/usr/bin/env tsx
import { fetch } from 'undici';
import { XMLParser } from 'fast-xml-parser';
import { DateTime } from 'luxon';
import { gunzipSync } from 'node:zlib';

async function main() {
  const url = process.argv[2] || 'https://epg.ovh/pl.xml';
  console.log(`🔍 Sprawdzam źródło EPG: ${url}\n`);

  try {
    // Pobierz XML
    console.log('📥 Pobieram XML...');
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EPG-Importer/1.0)',
        'Accept': 'application/xml, text/xml, application/gzip, */*',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Sprawdź czy odpowiedź jest skompresowana gzip
    const contentType = response.headers.get('content-type') || '';
    const contentEncoding = response.headers.get('content-encoding') || '';
    const isGzip = url.endsWith('.gz') || 
                   contentType.includes('gzip') || 
                   contentEncoding.includes('gzip') ||
                   contentType.includes('application/gzip');
    
    let xml: string;
    if (isGzip) {
      console.log('📦 Wykryto plik gzip, dekompresuję...');
      const buffer = await response.arrayBuffer();
      const decompressed = gunzipSync(Buffer.from(buffer));
      xml = decompressed.toString('utf-8');
      console.log(`✅ Zdekompresowano gzip (${xml.length} znaków)\n`);
    } else {
      xml = await response.text();
      console.log(`✅ Pobrano XML (${xml.length} znaków)\n`);
    }

    // Parsuj XML
    console.log('🔄 Parsuję XML...');
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const parsed = parser.parse(xml);
    
    if (!parsed?.tv) {
      throw new Error('Brak elementu <tv> w XML');
    }

    const channels = Array.isArray(parsed.tv.channel) ? parsed.tv.channel : [parsed.tv.channel].filter(Boolean);
    const programmes = Array.isArray(parsed.tv.programme) ? parsed.tv.programme : [parsed.tv.programme].filter(Boolean);

    console.log(`✅ Sparsowano: ${channels.length} kanałów, ${programmes.length} programów\n`);

    // Sprawdź daty programów
    console.log('📅 Analizuję daty programów...\n');
    
    const now = DateTime.utc();
    const today = now.startOf('day');
    const tomorrow = today.plus({ days: 1 });
    const nextWeek = today.plus({ days: 7 });

    const dates: string[] = [];
    let todayCount = 0;
    let futureCount = 0;
    let pastCount = 0;

    for (const programme of programmes.slice(0, 1000)) {
      const startStr = programme['@_start'];
      if (!startStr) continue;

      // Parsuj datę (format: yyyyMMddHHmmss +0000)
      let dt = DateTime.fromFormat(startStr, 'yyyyLLddHHmmss ZZZ', { setZone: true });
      if (!dt.isValid) {
        const withoutOffset = startStr.split(' ')[0] ?? startStr;
        dt = DateTime.fromFormat(withoutOffset, 'yyyyLLddHHmmss', { zone: 'UTC' });
      }

      if (!dt.isValid) {
        console.warn(`⚠️  Nie można sparsować daty: ${startStr}`);
        continue;
      }

      const dateStr = dt.toFormat('yyyy-MM-dd');
      if (!dates.includes(dateStr)) {
        dates.push(dateStr);
      }

      const programDay = dt.startOf('day');
      if (programDay.equals(today)) {
        todayCount++;
      } else if (dt > now) {
        futureCount++;
      } else {
        pastCount++;
      }
    }

    dates.sort();
    console.log(`📊 Statystyki dat:`);
    console.log(`  • Programy z dzisiaj (${today.toFormat('yyyy-MM-dd')}): ${todayCount}`);
    console.log(`  • Programy z przyszłości: ${futureCount}`);
    console.log(`  • Programy z przeszłości: ${pastCount}`);
    console.log(`\n📅 Znalezione daty (pierwsze 20):`);
    dates.slice(0, 20).forEach((date) => {
      const isToday = date === today.toFormat('yyyy-MM-dd');
      const marker = isToday ? '⭐ DZISIAJ' : '';
      console.log(`  • ${date} ${marker}`);
    });

    // Sprawdź przykładowe programy z dzisiaj
    console.log(`\n📺 Przykładowe programy z dzisiaj:`);
    const channelIds = new Set<string>();
    let foundToday = 0;
    for (const programme of programmes) {
      if (foundToday >= 10) break;

      const startStr = programme['@_start'];
      if (!startStr) continue;

      let dt = DateTime.fromFormat(startStr, 'yyyyLLddHHmmss ZZZ', { setZone: true });
      if (!dt.isValid) {
        const withoutOffset = startStr.split(' ')[0] ?? startStr;
        dt = DateTime.fromFormat(withoutOffset, 'yyyyLLddHHmmss', { zone: 'UTC' });
      }

      if (!dt.isValid) continue;

      const programDay = dt.startOf('day');
      if (programDay.equals(today)) {
        const title = typeof programme.title === 'string' 
          ? programme.title 
          : (programme.title?.['#text'] ?? programme.title?.[0]?.['#text'] ?? 'Brak tytułu');
        const channel = programme['@_channel'] ?? 'unknown';
        channelIds.add(channel);
        console.log(`  • ${channel}: ${title} (${dt.toFormat('HH:mm')})`);
        foundToday++;
      }
    }
    
    console.log(`\n🔍 ID kanałów z programami z dzisiaj (${channelIds.size} unikalnych):`);
    Array.from(channelIds).slice(0, 20).forEach((id) => {
      console.log(`  • ${id}`);
    });
    
    // Sprawdź czy nasze wybrane kanały pasują
    const selectedIds = process.env.IPTV_ORG_SELECTED_IDS?.split(',') || [];
    console.log(`\n🔍 Porównanie z wybranymi kanałami (${selectedIds.length}):`);
    selectedIds.slice(0, 10).forEach((id) => {
      const trimmed = id.trim();
      const found = Array.from(channelIds).some((cid) => cid.includes(trimmed) || trimmed.includes(cid));
      console.log(`  • ${trimmed}: ${found ? '✅' : '❌'}`);
    });

    if (foundToday === 0) {
      console.log(`  ⚠️  BRAK PROGRAMÓW Z DZISIAJ W XML!`);
      console.log(`  💡 Możliwe przyczyny:`);
      console.log(`     - Źródło nie jest aktualizowane codziennie`);
      console.log(`     - Format daty jest inny`);
      console.log(`     - Programy są w innej strefie czasowej`);
    }

    // Sprawdź format daty
    console.log(`\n🔍 Przykładowe formaty dat z XML:`);
    const sampleDates = programmes.slice(0, 5).map((p: any) => p['@_start']).filter(Boolean);
    sampleDates.forEach((dateStr: string) => {
      console.log(`  • ${dateStr}`);
    });

  } catch (error) {
    console.error('❌ Błąd:', error);
    process.exit(1);
  }
}

void main();

