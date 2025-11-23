import { XMLParser } from 'fast-xml-parser';
import { fetch } from 'undici';
import { gunzipSync } from 'node:zlib';

async function main() {
  const url = 'https://www.open-epg.com/files/poland1.xml.gz';
  
  console.log(`📡 Pobieram EPG z ${url}...`);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; EPG-Importer/1.0)',
      Accept: 'application/xml, text/xml, application/gzip, */*',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const data = Buffer.from(buffer);
  const decompressed = gunzipSync(data);
  const xml = decompressed.toString('utf-8');

  console.log(`✅ Pobrano i zdekompresowano XML (${xml.length} znaków)`);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
  });

  const parsed = parser.parse(xml);
  const channels = parsed.tv?.channel || [];

  console.log(`\n📺 Sprawdzam logotypy w XML dla ${channels.length} kanałów...\n`);

  let withIcons = 0;
  let withoutIcons = 0;

  for (const channel of channels.slice(0, 20)) {
    const name = Array.isArray(channel['display-name'])
      ? channel['display-name'][0]?.['#text'] ?? channel['display-name'][0]
      : typeof channel['display-name'] === 'object'
        ? channel['display-name']?.['#text']
        : channel['display-name'] ?? channel['@_id'];

    const icon = channel.icon;
    let iconUrl: string | undefined;

    if (icon) {
      if (Array.isArray(icon)) {
        iconUrl = icon[0]?.['@_src'];
      } else if (typeof icon === 'object' && '@_src' in icon) {
        iconUrl = icon['@_src'];
      } else if (typeof icon === 'string') {
        iconUrl = icon;
      }
    }

    if (iconUrl) {
      console.log(`✅ ${name}: ${iconUrl}`);
      withIcons++;
    } else {
      console.log(`❌ ${name}: BRAK IKONY W XML`);
      withoutIcons++;
    }
  }

  // Sprawdź wszystkie
  let totalWithIcons = 0;
  let totalWithoutIcons = 0;

  for (const channel of channels) {
    const icon = channel.icon;
    let iconUrl: string | undefined;

    if (icon) {
      if (Array.isArray(icon)) {
        iconUrl = icon[0]?.['@_src'];
      } else if (typeof icon === 'object' && '@_src' in icon) {
        iconUrl = icon['@_src'];
      } else if (typeof icon === 'string') {
        iconUrl = icon;
      }
    }

    if (iconUrl) {
      totalWithIcons++;
    } else {
      totalWithoutIcons++;
    }
  }

  console.log(`\n📊 Podsumowanie dla pierwszych 20: ${withIcons} z ikonami, ${withoutIcons} bez ikon`);
  console.log(`📊 Podsumowanie dla wszystkich ${channels.length}: ${totalWithIcons} z ikonami, ${totalWithoutIcons} bez ikon\n`);
}

main().catch(console.error);

