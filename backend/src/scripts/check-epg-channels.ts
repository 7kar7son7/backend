#!/usr/bin/env tsx
import { fetch } from 'undici';
import { XMLParser } from 'fast-xml-parser';

async function main() {
  const url = 'https://epg.ovh/pl.xml';
  console.log(`🔍 Sprawdzam kanały w XML z epg.ovh...\n`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const xml = await response.text();
    
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const parsed = parser.parse(xml);
    
    if (!parsed?.tv) {
      throw new Error('Brak elementu <tv>');
    }

    const channels = Array.isArray(parsed.tv.channel) ? parsed.tv.channel : [parsed.tv.channel].filter(Boolean);
    
    console.log(`📺 Znaleziono ${channels.length} kanałów\n`);
    console.log(`📋 Przykładowe ID kanałów (pierwsze 30):\n`);
    
    const channelIds: string[] = [];
    for (const channel of channels.slice(0, 50)) {
      const id = channel['@_id'] ?? 'unknown';
      const name = typeof channel['display-name'] === 'string' 
        ? channel['display-name']
        : (channel['display-name']?.['#text'] ?? channel['display-name']?.[0]?.['#text'] ?? 'Brak nazwy');
      
      channelIds.push(id);
      console.log(`  • ID: "${id}" | Nazwa: "${name}"`);
    }
    
    // Sprawdź które z naszych wybranych kanałów pasują
    const selectedIds = process.env.IPTV_ORG_SELECTED_IDS?.split(',') || [];
    console.log(`\n🔍 Porównanie z wybranymi kanałami (${selectedIds.length}):\n`);
    
    const found: string[] = [];
    const notFound: string[] = [];
    
    for (const selectedId of selectedIds.slice(0, 20)) {
      const trimmed = selectedId.trim().toLowerCase();
      const match = channelIds.find((cid) => {
        const cidLower = cid.toLowerCase();
        return cidLower.includes(trimmed) || trimmed.includes(cidLower) || 
               cidLower.replace(/[^a-z0-9]/g, '') === trimmed.replace(/[^a-z0-9]/g, '');
      });
      
      if (match) {
        found.push(selectedId);
        console.log(`  ✅ ${selectedId} → pasuje do "${match}"`);
      } else {
        notFound.push(selectedId);
        console.log(`  ❌ ${selectedId} → NIE ZNALEZIONO`);
      }
    }
    
    console.log(`\n📊 Podsumowanie:`);
    console.log(`  • Znaleziono: ${found.length}/${selectedIds.length}`);
    console.log(`  • Nie znaleziono: ${notFound.length}/${selectedIds.length}`);
    
    if (notFound.length > 0) {
      console.log(`\n💡 Sugestia: epg.ovh używa innych ID kanałów niż iptv-org.`);
      console.log(`   Rozważ usunięcie IPTV_ORG_SELECTED_IDS aby importować wszystkie kanały z prefiksem pl/`);
    }

  } catch (error) {
    console.error('❌ Błąd:', error);
    process.exit(1);
  }
}

void main();

