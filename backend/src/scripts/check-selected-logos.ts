import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SELECTED_CHANNELS = [
  'pl/tvp1', 'pl/tvp2', 'pl/tvpinfo', 'pl/tvpsport', 'pl/tvpseriale',
  'pl/tvn', 'pl/tvn24', 'pl/tvn7', 'pl/tvnstyl', 'pl/polsat',
  'pl/polsatnews', 'pl/polsatsport', 'pl/tv4', 'pl/tvpuls', 'pl/tvphistoria',
  'pl/ttv', 'pl/canalplus', 'pl/canalplusfilm', 'pl/canalplussport',
  'pl/eleven1', 'pl/eleven2', 'pl/discoverychannel', 'pl/discoverylife',
  'pl/nationalgeographic', 'pl/animalplanet', 'pl/bbcbrit', 'pl/bbcearth',
  'pl/hbo', 'pl/hbo2', 'pl/hbo3', 'pl/cinemax', 'pl/axn', 'pl/minimini',
  'pl/disneychannel', 'pl/nickelodeon', 'pl/cartoonnetwork', 'pl/eskatv',
  'pl/4fundance', 'pl/fokustv'
];

async function main() {
  console.log('\n📺 Sprawdzam logotypy dla wybranych 39 kanałów:\n');
  
  let withLogos = 0;
  let withoutLogos = 0;
  const withoutLogosList: string[] = [];

  // Pobierz wszystkie kanały i dopasuj do wybranych
  const allChannels = await prisma.channel.findMany({
    select: {
      id: true,
      name: true,
      logoUrl: true,
    },
  });

  for (const channelId of SELECTED_CHANNELS) {
    // Kanały z open-epg.com mają ID typu "TVP 1.pl" zamiast "pl/tvp1"
    const searchKey = channelId.replace('pl/', '').toLowerCase();
    
    const channel = allChannels.find((ch) => {
      const chId = ch.id.toLowerCase();
      const chName = ch.name.toLowerCase();
      return chId.includes(searchKey) || 
             chName.includes(searchKey) ||
             chId.endsWith(`${searchKey}.pl`) ||
             chId === searchKey;
    });

    if (channel) {
      if (channel.logoUrl) {
        console.log(`✅ ${channel.name} (${channel.id}): ${channel.logoUrl}`);
        withLogos++;
      } else {
        console.log(`❌ ${channel.name} (${channel.id}): BRAK LOGOTYPU`);
        withoutLogos++;
        withoutLogosList.push(channel.name);
      }
    } else {
      console.log(`⚠️  ${channelId}: KANAŁ NIE ZNALEZIONY W BAZIE`);
    }
  }

  console.log(`\n📊 Podsumowanie:`);
  console.log(`✅ Z logotypami: ${withLogos}`);
  console.log(`❌ Bez logotypów: ${withoutLogos}`);
  if (withoutLogosList.length > 0) {
    console.log(`\n📋 Kanały bez logotypów:`);
    withoutLogosList.forEach(name => console.log(`   - ${name}`));
  }
  console.log();

  await prisma.$disconnect();
}

main().catch(console.error);

