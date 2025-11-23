#!/usr/bin/env tsx
import { fetch } from 'undici';
import { XMLParser } from 'fast-xml-parser';
import { DateTime } from 'luxon';
import { gunzipSync } from 'node:zlib';

const EPG_SOURCES = [
  'https://epg.ovh/pl.xml',
  'https://epgshare01.online/epg/epg.xml.gz',
  'https://epgshare02.online/epg/epg.xml.gz',
  'https://epgshare03.online/epg/epg.xml.gz',
  'https://epg.best/epg.xml.gz',
  'https://raw.githubusercontent.com/iptv-org/epg/master/guides/pl/pl.xml',
  'https://iptv-org.github.io/epg/guides/pl/pl.xml',
];

interface TestResult {
  url: string;
  accessible: boolean;
  hasData: boolean;
  channels: number;
  programmes: number;
  hasTodayPrograms: boolean;
  todayProgramsCount: number;
  error?: string;
  responseTime?: number;
}

async function testSource(url: string): Promise<TestResult> {
  const result: TestResult = {
    url,
    accessible: false,
    hasData: false,
    channels: 0,
    programmes: 0,
    hasTodayPrograms: false,
    todayProgramsCount: 0,
  };

  const startTime = Date.now();

  try {
    console.log(`\n🔍 Testuję: ${url}`);
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(120000), // 2 minuty timeout (duże pliki EPG)
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EPG-Tester/1.0)',
        'Accept': 'application/xml, text/xml, application/gzip, */*',
      },
    });

    result.responseTime = Date.now() - startTime;

    if (!response.ok) {
      result.error = `HTTP ${response.status}: ${response.statusText}`;
      console.log(`  ❌ ${result.error}`);
      return result;
    }

    result.accessible = true;
    console.log(`  ✅ Dostępne (${result.responseTime}ms)`);

    // Sprawdź czy to gzip
    const contentType = response.headers.get('content-type') || '';
    const contentEncoding = response.headers.get('content-encoding') || '';
    const isGzip = url.endsWith('.gz') || 
                   contentType.includes('gzip') || 
                   contentEncoding.includes('gzip') ||
                   contentType.includes('application/gzip');

    let xml: string;
    if (isGzip) {
      console.log(`  📦 Dekompresuję gzip...`);
      const buffer = await response.arrayBuffer();
      const decompressed = gunzipSync(Buffer.from(buffer));
      xml = decompressed.toString('utf-8');
    } else {
      xml = await response.text();
    }

    if (xml.length === 0) {
      result.error = 'Pusta odpowiedź';
      console.log(`  ❌ ${result.error}`);
      return result;
    }

    console.log(`  📥 Pobrano ${xml.length} znaków`);

    // Parsuj XML
    console.log(`  🔄 Parsuję XML...`);
    const parser = new XMLParser({ 
      ignoreAttributes: false, 
      attributeNamePrefix: '@_',
      parseAttributeValue: false,
      trimValues: true,
    });
    
    const parsed = parser.parse(xml);

    if (!parsed?.tv) {
      result.error = 'Brak elementu <tv> w XML';
      console.log(`  ❌ ${result.error}`);
      return result;
    }

    const channels = Array.isArray(parsed.tv.channel) 
      ? parsed.tv.channel 
      : [parsed.tv.channel].filter(Boolean);
    const programmes = Array.isArray(parsed.tv.programme) 
      ? parsed.tv.programme 
      : [parsed.tv.programme].filter(Boolean);

    result.hasData = true;
    result.channels = channels.length;
    result.programmes = programmes.length;

    console.log(`  📺 Kanały: ${result.channels}, Programy: ${result.programmes}`);

    // Sprawdź programy z dzisiaj
    const now = DateTime.utc();
    const today = now.startOf('day');

    let todayCount = 0;
    const plChannels = new Set<string>();

    for (const programme of programmes.slice(0, 10000)) {
      const startStr = programme['@_start'];
      if (!startStr) continue;

      const channelId = programme['@_channel'] || '';
      if (channelId.startsWith('pl/')) {
        plChannels.add(channelId);
      }

      // Parsuj datę
      let dt = DateTime.fromFormat(startStr, 'yyyyLLddHHmmss ZZZ', { setZone: true });
      if (!dt.isValid) {
        const withoutOffset = startStr.split(' ')[0] ?? startStr;
        dt = DateTime.fromFormat(withoutOffset, 'yyyyLLddHHmmss', { zone: 'UTC' });
      }

      if (!dt.isValid) continue;

      const programDay = dt.startOf('day');
      if (programDay.equals(today)) {
        todayCount++;
      }
    }

    result.hasTodayPrograms = todayCount > 0;
    result.todayProgramsCount = todayCount;

    console.log(`  📅 Programy z dzisiaj: ${todayCount}`);
    console.log(`  🇵🇱 Polskie kanały (pl/): ${plChannels.size}`);

    if (result.hasTodayPrograms) {
      console.log(`  ✅ MA AKTUALNE PROGRAMY`);
    } else {
      console.log(`  ⚠️  BRAK PROGRAMÓW Z DZISIAJ`);
    }

  } catch (error) {
    result.responseTime = Date.now() - startTime;
    result.error = error instanceof Error ? error.message : String(error);
    console.log(`  ❌ Błąd: ${result.error}`);
  }

  return result;
}

async function main() {
  console.log('🧪 Testuję wszystkie źródła EPG...\n');
  console.log(`📅 Dzisiaj: ${DateTime.utc().startOf('day').toFormat('yyyy-MM-dd')}\n`);

  const results: TestResult[] = [];

  for (const url of EPG_SOURCES) {
    const result = await testSource(url);
    results.push(result);
    
    // Małe opóźnienie między requestami
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Podsumowanie
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 PODSUMOWANIE');
  console.log('='.repeat(80) + '\n');

  const working = results.filter(r => r.accessible && r.hasData);
  const withTodayPrograms = results.filter(r => r.hasTodayPrograms);

  console.log(`✅ Działające źródła: ${working.length}/${EPG_SOURCES.length}`);
  console.log(`📅 Z programami z dzisiaj: ${withTodayPrograms.length}/${EPG_SOURCES.length}\n`);

  console.log('📋 Szczegóły:\n');
  for (const result of results) {
    const status = result.hasTodayPrograms ? '✅' : result.accessible && result.hasData ? '⚠️' : '❌';
    console.log(`${status} ${result.url}`);
    if (result.accessible && result.hasData) {
      console.log(`   Kanały: ${result.channels}, Programy: ${result.programmes}, Dzisiaj: ${result.todayProgramsCount}`);
    } else if (result.error) {
      console.log(`   Błąd: ${result.error}`);
    }
    if (result.responseTime) {
      console.log(`   Czas odpowiedzi: ${result.responseTime}ms`);
    }
    console.log();
  }

  // Rekomendacja
  console.log('\n💡 REKOMENDACJA:\n');
  if (withTodayPrograms.length > 0) {
    const sorted = withTodayPrograms.sort((a, b) => b.todayProgramsCount - a.todayProgramsCount);
    const best = sorted[0];
    if (best) {
      console.log(`✅ Najlepsze źródło: ${best.url}`);
      console.log(`   Programy z dzisiaj: ${best.todayProgramsCount}`);
      console.log(`   Kanały: ${best.channels}, Programy: ${best.programmes}`);
    }
  } else {
    console.log('⚠️  Żadne źródło nie ma programów z dzisiaj!');
    console.log('   Sprawdź czy wszystkie źródła są aktualizowane codziennie.');
  }

  // Lista do użycia w kodzie
  console.log('\n📝 Lista działających źródeł do użycia w kodzie:\n');
  const workingUrls = working.map(r => r.url);
  console.log('const EPG_SOURCES = [');
  for (const url of workingUrls) {
    const hasToday = results.find(r => r.url === url)?.hasTodayPrograms;
    const marker = hasToday ? ' // ✅ MA AKTUALNE PROGRAMY' : ' // ⚠️';
    console.log(`  '${url}',${marker}`);
  }
  console.log('] as const;');
}

void main();

