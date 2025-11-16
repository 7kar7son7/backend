#!/usr/bin/env ts-node
import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

type ProgramSeed = {
  title: string;
  description: string;
  offsetMinutes: number;
  durationMinutes: number;
  tags?: string[];
};

type ChannelSeed = {
  externalId: string;
  name: string;
  description?: string;
  category?: string;
  logoUrl?: string;
  programs: ProgramSeed[];
};

const prisma = new PrismaClient();

const CHANNELS: ChannelSeed[] = [
  {
    externalId: 'pl/tvp1',
    name: 'TVP 1',
    category: 'Publiczny',
    programs: [
      {
        title: 'Teleexpress',
        description: 'Serwis informacyjny ze skrótem najważniejszych wydarzeń dnia.',
        offsetMinutes: 17 * 60,
        durationMinutes: 25,
        tags: ['news'],
      },
      {
        title: 'Wiadomości',
        description: 'Najważniejsze informacje z kraju i ze świata.',
        offsetMinutes: 19 * 60,
        durationMinutes: 30,
        tags: ['news', 'live'],
      },
      {
        title: 'Korona Królów',
        description: 'Historyczna opowieść o dynastii Piastów.',
        offsetMinutes: 20 * 60 + 5,
        durationMinutes: 55,
        tags: ['drama', 'history'],
      },
    ],
  },
  {
    externalId: 'pl/tvp2',
    name: 'TVP 2',
    category: 'Publiczny',
    programs: [
      {
        title: 'Pytanie na Śniadanie – wieczorne wydanie',
        description: 'Prowadzący podsumowują najciekawsze tematy dnia.',
        offsetMinutes: 17 * 60 + 30,
        durationMinutes: 60,
        tags: ['lifestyle', 'talk-show'],
      },
      {
        title: 'Panorama',
        description: 'Wiadomości z regionów i całej Polski.',
        offsetMinutes: 19 * 60 + 30,
        durationMinutes: 30,
        tags: ['news'],
      },
      {
        title: 'The Voice of Poland',
        description: 'Najlepsze głosy w Polsce walczą o uznanie trenerów.',
        offsetMinutes: 20 * 60,
        durationMinutes: 90,
        tags: ['music', 'talent-show'],
      },
    ],
  },
  {
    externalId: 'pl/tvpinfo',
    name: 'TVP Info',
    category: 'Informacyjny',
    programs: [
      {
        title: 'Serwis Wieczorny',
        description: 'Przegląd najnowszych wydarzeń politycznych i społecznych.',
        offsetMinutes: 18 * 60,
        durationMinutes: 30,
        tags: ['news'],
      },
      {
        title: 'Minęła Dwudziesta',
        description: 'Debata publicystyczna z udziałem ekspertów.',
        offsetMinutes: 20 * 60,
        durationMinutes: 60,
        tags: ['news', 'debate'],
      },
      {
        title: 'Raport Dnia',
        description: 'Szczegółowe podsumowanie najważniejszych wydarzeń.',
        offsetMinutes: 21 * 60,
        durationMinutes: 45,
        tags: ['news', 'analysis'],
      },
    ],
  },
  {
    externalId: 'pl/tvpsport',
    name: 'TVP Sport',
    category: 'Sport',
    programs: [
      {
        title: 'Studio Sport',
        description: 'Wieczorne wydanie magazynu sportowego.',
        offsetMinutes: 18 * 60,
        durationMinutes: 60,
        tags: ['sport', 'magazine'],
      },
      {
        title: 'Piłkarska Liga Mistrzów – skróty',
        description: 'Najważniejsze akcje z ostatniej kolejki Champions League.',
        offsetMinutes: 19 * 60,
        durationMinutes: 60,
        tags: ['sport', 'football'],
      },
      {
        title: 'Sportowy Wieczór',
        description: 'Komentarze ekspertów i najciekawsze materiały dnia.',
        offsetMinutes: 21 * 60,
        durationMinutes: 45,
        tags: ['sport'],
      },
    ],
  },
  {
    externalId: 'pl/tvpseriale',
    name: 'TVP Seriale',
    category: 'Seriale',
    programs: [
      {
        title: 'Ranczo',
        description: 'Kultowa komedia o mieszkańcach Wilkowyj.',
        offsetMinutes: 17 * 60,
        durationMinutes: 50,
        tags: ['comedy', 'series'],
      },
      {
        title: 'Ojciec Mateusz',
        description: 'Ksiądz-detektyw rozwiązuje kolejną kryminalną zagadkę.',
        offsetMinutes: 18 * 60,
        durationMinutes: 60,
        tags: ['crime', 'series'],
      },
      {
        title: 'M Jak Miłość – wydanie specjalne',
        description: 'Wspomnienia bohaterów popularnej telenoweli.',
        offsetMinutes: 19 * 60,
        durationMinutes: 60,
        tags: ['drama', 'series'],
      },
    ],
  },
  {
    externalId: 'pl/tvn',
    name: 'TVN',
    category: 'Komercyjny',
    programs: [
      {
        title: 'Fakty',
        description: 'Najchętniej oglądany serwis informacyjny.',
        offsetMinutes: 18 * 60 + 30,
        durationMinutes: 30,
        tags: ['news'],
      },
      {
        title: 'Uwaga!',
        description: 'Reportaże o sprawach ważnych społecznie.',
        offsetMinutes: 19 * 60,
        durationMinutes: 45,
        tags: ['reportage'],
      },
      {
        title: 'Kuchenne Rewolucje',
        description: 'Magda Gessler odmienia polskie restauracje.',
        offsetMinutes: 20 * 60,
        durationMinutes: 75,
        tags: ['reality', 'food'],
      },
    ],
  },
  {
    externalId: 'pl/tvn24',
    name: 'TVN 24',
    category: 'Informacyjny',
    programs: [
      {
        title: 'Fakty po Faktach',
        description: 'Rozmowy z politykami i ekspertami.',
        offsetMinutes: 19 * 60,
        durationMinutes: 50,
        tags: ['news', 'talk-show'],
      },
      {
        title: 'Czarno na Białym',
        description: 'Analizy i dziennikarstwo śledcze.',
        offsetMinutes: 20 * 60,
        durationMinutes: 55,
        tags: ['investigation'],
      },
      {
        title: 'Szkło Kontaktowe',
        description: 'Satyryczne podsumowanie bieżących wydarzeń.',
        offsetMinutes: 21 * 60,
        durationMinutes: 55,
        tags: ['satire'],
      },
    ],
  },
  {
    externalId: 'pl/tvn7',
    name: 'TVN 7',
    category: 'Seriale i filmy',
    programs: [
      {
        title: 'Prawo Agaty',
        description: 'Prawnicza produkcja z Agnieszką Dygant.',
        offsetMinutes: 18 * 60,
        durationMinutes: 60,
        tags: ['drama', 'series'],
      },
      {
        title: 'Arrow',
        description: 'Mściciel z Starling City staje przed nowym wyzwaniem.',
        offsetMinutes: 19 * 60,
        durationMinutes: 55,
        tags: ['action', 'series'],
      },
      {
        title: 'Legacies',
        description: 'Magiczny internat i nowe pokolenie bohaterów.',
        offsetMinutes: 20 * 60,
        durationMinutes: 55,
        tags: ['fantasy', 'series'],
      },
    ],
  },
  {
    externalId: 'pl/tvnstyl',
    name: 'TVN Style',
    category: 'Lifestyle',
    programs: [
      {
        title: 'Co za tydzień',
        description: 'Modowe trendy i wydarzenia z show-biznesu.',
        offsetMinutes: 17 * 60 + 30,
        durationMinutes: 45,
        tags: ['lifestyle'],
      },
      {
        title: 'Ewa gotuje',
        description: 'Kulinarne inspiracje Ewy Wachowicz.',
        offsetMinutes: 18 * 60 + 30,
        durationMinutes: 40,
        tags: ['food'],
      },
      {
        title: 'Miasto Kobiet',
        description: 'Rozmowy bez tabu o sprawach kobiet.',
        offsetMinutes: 20 * 60,
        durationMinutes: 55,
        tags: ['talk-show'],
      },
    ],
  },
  {
    externalId: 'pl/polsat',
    name: 'Polsat',
    category: 'Komercyjny',
    programs: [
      {
        title: 'Wydarzenia',
        description: 'Serwis informacyjny Polsatu.',
        offsetMinutes: 18 * 60 + 50,
        durationMinutes: 30,
        tags: ['news'],
      },
      {
        title: 'Interwencja',
        description: 'Reporterzy pomagają widzom w trudnych sytuacjach.',
        offsetMinutes: 19 * 60 + 30,
        durationMinutes: 30,
        tags: ['reportage'],
      },
      {
        title: 'Nasz Nowy Dom',
        description: 'Ekipy remontowe odmieniają życie rodzin w potrzebie.',
        offsetMinutes: 20 * 60,
        durationMinutes: 75,
        tags: ['reality'],
      },
    ],
  },
  {
    externalId: 'pl/polsatnews',
    name: 'Polsat News',
    category: 'Informacyjny',
    programs: [
      {
        title: 'Informacje Dnia',
        description: 'Podsumowanie najważniejszych informacji.',
        offsetMinutes: 18 * 60,
        durationMinutes: 45,
        tags: ['news'],
      },
      {
        title: 'Debata Dnia',
        description: 'Politycy i eksperci komentują bieżące wydarzenia.',
        offsetMinutes: 19 * 60,
        durationMinutes: 55,
        tags: ['debate'],
      },
      {
        title: 'Sport Raport',
        description: 'Przegląd wydarzeń sportowych.',
        offsetMinutes: 21 * 60,
        durationMinutes: 30,
        tags: ['sport'],
      },
    ],
  },
  {
    externalId: 'pl/polsatsport',
    name: 'Polsat Sport',
    category: 'Sport',
    programs: [
      {
        title: 'Cafe Futbol Extra',
        description: 'Analiza piłkarskich wydarzeń tygodnia.',
        offsetMinutes: 17 * 60 + 30,
        durationMinutes: 60,
        tags: ['sport', 'football'],
      },
      {
        title: 'Siatkarskie ABC',
        description: 'Magazyn z ligowych parkietów.',
        offsetMinutes: 18 * 60 + 45,
        durationMinutes: 60,
        tags: ['sport', 'volleyball'],
      },
      {
        title: 'Studio Sportowe',
        description: 'Komentatorzy podsumowują dzień.',
        offsetMinutes: 20 * 60,
        durationMinutes: 75,
        tags: ['sport'],
      },
    ],
  },
  {
    externalId: 'pl/tv4',
    name: 'TV4',
    category: 'Ogólnotematyczny',
    programs: [
      {
        title: 'Polskie Drogi',
        description: 'Serial sensacyjny w odświeżonej wersji.',
        offsetMinutes: 17 * 60 + 45,
        durationMinutes: 55,
        tags: ['drama'],
      },
      {
        title: 'Galileo',
        description: 'Popularnonaukowy program odkrywający ciekawostki świata.',
        offsetMinutes: 18 * 60 + 45,
        durationMinutes: 60,
        tags: ['science'],
      },
      {
        title: 'Turbulencje',
        description: 'Zagadka lotu 828 powraca.',
        offsetMinutes: 20 * 60,
        durationMinutes: 60,
        tags: ['thriller', 'series'],
      },
    ],
  },
  {
    externalId: 'pl/tvpuls',
    name: 'TV Puls',
    category: 'Ogólnotematyczny',
    programs: [
      {
        title: 'Lombard. Życie pod zastaw',
        description: 'Historie klientów i pracowników lombardu.',
        offsetMinutes: 18 * 60,
        durationMinutes: 55,
        tags: ['drama'],
      },
      {
        title: 'To był dzień',
        description: 'Magazyn podsumowujący wydarzenia z Polski.',
        offsetMinutes: 19 * 60,
        durationMinutes: 45,
        tags: ['magazine'],
      },
      {
        title: 'Ukryta Prawda',
        description: 'Historie oparte na prawdziwych wydarzeniach.',
        offsetMinutes: 20 * 60,
        durationMinutes: 55,
        tags: ['docudrama'],
      },
    ],
  },
  {
    externalId: 'pl/tvphistoria',
    name: 'TVP Historia',
    category: 'Historyczny',
    programs: [
      {
        title: 'Sensacje XX wieku',
        description: 'Dokumentalne śledztwa Bogusława Wołoszańskiego.',
        offsetMinutes: 17 * 60 + 30,
        durationMinutes: 55,
        tags: ['history', 'documentary'],
      },
      {
        title: 'Historia Polski w pigułce',
        description: 'Seria edukacyjna dla całej rodziny.',
        offsetMinutes: 18 * 60 + 45,
        durationMinutes: 45,
        tags: ['education'],
      },
      {
        title: 'Tajemnice Państwa Podziemnego',
        description: 'Dokument o Armii Krajowej.',
        offsetMinutes: 20 * 60,
        durationMinutes: 60,
        tags: ['history'],
      },
    ],
  },
  {
    externalId: 'pl/ttv',
    name: 'TTV',
    category: 'Reportaże i reality',
    programs: [
      {
        title: 'Uwaga! Po Uwadze',
        description: 'Kontynuacja głośnych reportaży.',
        offsetMinutes: 18 * 60,
        durationMinutes: 45,
        tags: ['reportage'],
      },
      {
        title: 'Gogglebox. Przed telewizorem',
        description: 'Komentarze widzów do programów telewizyjnych.',
        offsetMinutes: 19 * 60,
        durationMinutes: 55,
        tags: ['reality', 'comedy'],
      },
      {
        title: 'DeFacto',
        description: 'Popularnonaukowy magazyn reporterski.',
        offsetMinutes: 21 * 60,
        durationMinutes: 45,
        tags: ['science', 'magazine'],
      },
    ],
  },
  {
    externalId: 'pl/canalplus',
    name: 'Canal+ Premium',
    category: 'Premium',
    programs: [
      {
        title: 'Szybcy i wściekli 9',
        description: 'Vin Diesel powraca w pełnym akcji sequelu.',
        offsetMinutes: 19 * 60,
        durationMinutes: 120,
        tags: ['movie', 'action'],
      },
      {
        title: 'Magazyn Canal+ Sport',
        description: 'Eksperci analizują wydarzenia ze świata sportu.',
        offsetMinutes: 18 * 60,
        durationMinutes: 50,
        tags: ['sport'],
      },
      {
        title: 'Serial Premium: The Offer',
        description: 'Historia powstania Ojca Chrzestnego.',
        offsetMinutes: 21 * 60,
        durationMinutes: 60,
        tags: ['drama', 'series'],
      },
    ],
  },
  {
    externalId: 'pl/canalplusfilm',
    name: 'Canal+ Film',
    category: 'Filmy',
    programs: [
      {
        title: 'Wieczór kinomana',
        description: 'Przegląd nagradzanych europejskich filmów.',
        offsetMinutes: 18 * 60 + 30,
        durationMinutes: 120,
        tags: ['movie'],
      },
      {
        title: 'Making of: Polska kinematografia',
        description: 'Zakulisowe historie polskich produkcji.',
        offsetMinutes: 20 * 60 + 30,
        durationMinutes: 45,
        tags: ['documentary'],
      },
      {
        title: 'Klub filmowy Canal+',
        description: 'Dyskusja krytyków i filmowych pasjonatów.',
        offsetMinutes: 22 * 60,
        durationMinutes: 55,
        tags: ['talk-show'],
      },
    ],
  },
  {
    externalId: 'pl/canalplussport',
    name: 'Canal+ Sport',
    category: 'Sport',
    programs: [
      {
        title: 'Liga Angielska – skróty kolejki',
        description: 'Gol za golem, wszystkie mecze w jednym programie.',
        offsetMinutes: 18 * 60,
        durationMinutes: 70,
        tags: ['sport', 'football'],
      },
      {
        title: 'Basket Live',
        description: 'Analiza meczów Energa Basket Ligi.',
        offsetMinutes: 19 * 60 + 30,
        durationMinutes: 60,
        tags: ['sport', 'basketball'],
      },
      {
        title: 'Studio Golf',
        description: 'Podsumowanie turniejów PGA.',
        offsetMinutes: 21 * 60,
        durationMinutes: 45,
        tags: ['sport', 'golf'],
      },
    ],
  },
  {
    externalId: 'pl/eleven1',
    name: 'Eleven Sports 1',
    category: 'Sport',
    programs: [
      {
        title: 'Serie A Highlights',
        description: 'Najlepsze akcje z włoskich boisk.',
        offsetMinutes: 18 * 60,
        durationMinutes: 60,
        tags: ['sport', 'football'],
      },
      {
        title: 'F1 – Magazyn Pit Stop',
        description: 'Analiza ostatniego Grand Prix.',
        offsetMinutes: 19 * 60,
        durationMinutes: 60,
        tags: ['sport', 'motorsport'],
      },
      {
        title: 'Magazyn LaLiga',
        description: 'Hiszpańska ekstraklasa w pigułce.',
        offsetMinutes: 20 * 60,
        durationMinutes: 60,
        tags: ['sport', 'football'],
      },
    ],
  },
  {
    externalId: 'pl/eleven2',
    name: 'Eleven Sports 2',
    category: 'Sport',
    programs: [
      {
        title: 'Bundesliga Highlights',
        description: 'Skróty z niemieckiej Bundesligi.',
        offsetMinutes: 18 * 60 + 30,
        durationMinutes: 60,
        tags: ['sport', 'football'],
      },
      {
        title: 'Speedway Total',
        description: 'Polska Liga Żużlowa pod lupą.',
        offsetMinutes: 19 * 60 + 30,
        durationMinutes: 55,
        tags: ['sport', 'speedway'],
      },
      {
        title: 'NFL Game Pass',
        description: 'Amerykański futbol z najlepszymi akcjami kolejki.',
        offsetMinutes: 21 * 60,
        durationMinutes: 60,
        tags: ['sport', 'football-american'],
      },
    ],
  },
  {
    externalId: 'pl/discoverychannel',
    name: 'Discovery Channel',
    category: 'Dokument',
    programs: [
      {
        title: 'Jadąc przez Polskę',
        description: 'Polskie drogi i ich niezwykli bohaterowie.',
        offsetMinutes: 17 * 60 + 30,
        durationMinutes: 50,
        tags: ['documentary', 'travel'],
      },
      {
        title: 'Jak to jest zrobione?',
        description: 'Kulisy powstawania przedmiotów codziennego użytku.',
        offsetMinutes: 18 * 60 + 30,
        durationMinutes: 45,
        tags: ['science'],
      },
      {
        title: 'Starożytni kosmici – Polska',
        description: 'Teorie o tajemniczych konstrukcjach w Polsce.',
        offsetMinutes: 20 * 60,
        durationMinutes: 60,
        tags: ['mystery', 'documentary'],
      },
    ],
  },
  {
    externalId: 'pl/discoverylife',
    name: 'Discovery Life',
    category: 'Zdrowie',
    programs: [
      {
        title: 'Szpital 24h',
        description: 'Historie lekarzy i pacjentów z polskich szpitali.',
        offsetMinutes: 17 * 60 + 45,
        durationMinutes: 55,
        tags: ['docudrama'],
      },
      {
        title: 'Medycyna Ekstremalna',
        description: 'Jak ratownicy medyczni działają w trudnych warunkach.',
        offsetMinutes: 19 * 60,
        durationMinutes: 45,
        tags: ['documentary'],
      },
      {
        title: 'Życie bez cenzury',
        description: 'Poruszające historie pacjentów.',
        offsetMinutes: 20 * 60,
        durationMinutes: 55,
        tags: ['docudrama'],
      },
    ],
  },
  {
    externalId: 'pl/nationalgeographic',
    name: 'National Geographic',
    category: 'Przyrodniczy',
    programs: [
      {
        title: 'Dzika Polska',
        description: 'Niezwykłe miejsca natury w naszym kraju.',
        offsetMinutes: 18 * 60,
        durationMinutes: 50,
        tags: ['nature'],
      },
      {
        title: 'Katastrofy w przestworzach',
        description: 'Analiza wypadków lotniczych.',
        offsetMinutes: 19 * 60,
        durationMinutes: 50,
        tags: ['documentary'],
      },
      {
        title: 'Geniusz: Maria Skłodowska-Curie',
        description: 'Biograficzny dokument o polskiej noblistce.',
        offsetMinutes: 20 * 60,
        durationMinutes: 60,
        tags: ['biography'],
      },
    ],
  },
  {
    externalId: 'pl/animalplanet',
    name: 'Animal Planet',
    category: 'Przyrodniczy',
    programs: [
      {
        title: 'Polskie schroniska',
        description: 'Historie adopcji zwierząt z naszego kraju.',
        offsetMinutes: 17 * 60 + 30,
        durationMinutes: 55,
        tags: ['nature', 'documentary'],
      },
      {
        title: 'Weterynarze na ratunek',
        description: 'Ratowanie dzikich i domowych zwierząt.',
        offsetMinutes: 18 * 60 + 45,
        durationMinutes: 50,
        tags: ['documentary'],
      },
      {
        title: 'Dzika Wisła',
        description: 'Opowieść o największej polskiej rzece i jej mieszkańcach.',
        offsetMinutes: 20 * 60,
        durationMinutes: 60,
        tags: ['nature'],
      },
    ],
  },
  {
    externalId: 'pl/bbcbrit',
    name: 'BBC Brit',
    category: 'Rozrywka',
    programs: [
      {
        title: 'Top Gear Polska',
        description: 'Polscy prowadzący testują samochody.',
        offsetMinutes: 18 * 60,
        durationMinutes: 65,
        tags: ['motoring'],
      },
      {
        title: 'Świat według Borgiów',
        description: 'Historyczna opowieść z nowoczesnym komentarzem.',
        offsetMinutes: 19 * 60 + 30,
        durationMinutes: 55,
        tags: ['history', 'series'],
      },
      {
        title: 'QI – Najbardziej ciekawskie show',
        description: 'Brytyjski humor i ciekawostki.',
        offsetMinutes: 21 * 60,
        durationMinutes: 40,
        tags: ['comedy', 'quiz'],
      },
    ],
  },
  {
    externalId: 'pl/bbcearth',
    name: 'BBC Earth',
    category: 'Przyrodniczy',
    programs: [
      {
        title: 'Planeta Polska',
        description: 'Spektakularne zdjęcia polskiej natury.',
        offsetMinutes: 17 * 60 + 45,
        durationMinutes: 60,
        tags: ['nature'],
      },
      {
        title: 'Planeta Ziemia II',
        description: 'Klasyczny dokument Davida Attenborough.',
        offsetMinutes: 19 * 60,
        durationMinutes: 60,
        tags: ['nature'],
      },
      {
        title: 'Sylwetki badaczy – Maria Czaplicka',
        description: 'Opowieść o polskiej etnografce.',
        offsetMinutes: 21 * 60,
        durationMinutes: 45,
        tags: ['biography'],
      },
    ],
  },
  {
    externalId: 'pl/hbo',
    name: 'HBO Polska',
    category: 'Filmy i seriale',
    programs: [
      {
        title: 'Diuna',
        description: 'Epicka ekranizacja powieści Franka Herberta.',
        offsetMinutes: 19 * 60,
        durationMinutes: 155,
        tags: ['movie', 'scifi'],
      },
      {
        title: 'Ostre przedmioty',
        description: 'Thriller psychologiczny na podstawie powieści Gillian Flynn.',
        offsetMinutes: 22 * 60 + 40,
        durationMinutes: 60,
        tags: ['thriller', 'series'],
      },
      {
        title: 'Gra o tron – najlepsze momenty',
        description: 'Podsumowanie kultowej serii.',
        offsetMinutes: 24 * 60,
        durationMinutes: 40,
        tags: ['fantasy'],
      },
    ],
  },
  {
    externalId: 'pl/hbo2',
    name: 'HBO 2',
    category: 'Filmy',
    programs: [
      {
        title: 'Liga Sprawiedliwości',
        description: 'Superbohaterowie DC łączą siły.',
        offsetMinutes: 18 * 60 + 30,
        durationMinutes: 150,
        tags: ['movie', 'action'],
      },
      {
        title: 'Mrok nad miastem',
        description: 'Kryminał osadzony w polskich realiach.',
        offsetMinutes: 21 * 60 + 10,
        durationMinutes: 55,
        tags: ['crime', 'movie'],
      },
      {
        title: 'Nocne kino HBO',
        description: 'Pakiet krótkich polskich produkcji.',
        offsetMinutes: 22 * 60 + 15,
        durationMinutes: 60,
        tags: ['movie'],
      },
    ],
  },
  {
    externalId: 'pl/hbo3',
    name: 'HBO 3',
    category: 'Seriale',
    programs: [
      {
        title: 'Czarnobyl',
        description: 'Mini serial HBO nagrodzony Emmy.',
        offsetMinutes: 19 * 60,
        durationMinutes: 65,
        tags: ['drama', 'history'],
      },
      {
        title: 'Sukcesja',
        description: 'Rodzina Royów i ich medialne imperium.',
        offsetMinutes: 20 * 60 + 15,
        durationMinutes: 65,
        tags: ['drama'],
      },
      {
        title: 'Jak zostać Bogiem w centralnej Florydzie',
        description: 'Czarna komedia o marketingu wielopoziomowym.',
        offsetMinutes: 21 * 60 + 30,
        durationMinutes: 55,
        tags: ['comedy', 'drama'],
      },
    ],
  },
  {
    externalId: 'pl/cinemax',
    name: 'Cinemax',
    category: 'Filmy',
    programs: [
      {
        title: 'Parasite',
        description: 'Oscerowy hit w reżyserii Bong Joon-ho.',
        offsetMinutes: 18 * 60 + 45,
        durationMinutes: 135,
        tags: ['movie', 'thriller'],
      },
      {
        title: 'Toni Erdmann',
        description: 'Niemiecka tragikomedia z polskimi akcentami.',
        offsetMinutes: 21 * 60 + 15,
        durationMinutes: 70,
        tags: ['movie', 'comedy'],
      },
      {
        title: 'Krótkie metraże',
        description: 'Polski seans krótkometrażowy.',
        offsetMinutes: 22 * 60 + 40,
        durationMinutes: 55,
        tags: ['movie'],
      },
    ],
  },
  {
    externalId: 'pl/axn',
    name: 'AXN Polska',
    category: 'Seriale akcji',
    programs: [
      {
        title: 'Hawaii 5.0',
        description: 'Zespół rozwiązuje zagadkę uprowadzenia.',
        offsetMinutes: 18 * 60,
        durationMinutes: 55,
        tags: ['action', 'series'],
      },
      {
        title: 'CSI: Kryminalne zagadki Nowego Jorku',
        description: 'Dowody dna prowadzą do szokującego odkrycia.',
        offsetMinutes: 19 * 60,
        durationMinutes: 55,
        tags: ['crime', 'series'],
      },
      {
        title: 'Strike Back',
        description: 'Oddział 20 wyrusza z tajną misją.',
        offsetMinutes: 20 * 60,
        durationMinutes: 55,
        tags: ['action'],
      },
    ],
  },
  {
    externalId: 'pl/minimini',
    name: 'MiniMini+',
    category: 'Dzieci',
    programs: [
      {
        title: 'Rodzina Treflików',
        description: 'Animowany serial dla najmłodszych.',
        offsetMinutes: 17 * 60,
        durationMinutes: 25,
        tags: ['kids', 'animation'],
      },
      {
        title: 'Bob Budowniczy',
        description: 'Czy Bob poradzi sobie z nową budową?',
        offsetMinutes: 17 * 60 + 30,
        durationMinutes: 30,
        tags: ['kids'],
      },
      {
        title: 'Marta mówi',
        description: 'Piesek, który potrafi mówić, znów rozwiązuje zagadkę.',
        offsetMinutes: 18 * 60,
        durationMinutes: 25,
        tags: ['kids'],
      },
    ],
  },
  {
    externalId: 'pl/disneychannel',
    name: 'Disney Channel Polska',
    category: 'Dzieci i młodzież',
    programs: [
      {
        title: 'Miraculous: Biedronka i Czarny Kot',
        description: 'Bohaterowie ratują Paryż przed Hawk Mothem.',
        offsetMinutes: 18 * 60,
        durationMinutes: 25,
        tags: ['kids', 'animation'],
      },
      {
        title: 'Kim Kolwiek',
        description: 'Kim stawia czoła nowemu złoczyńcy.',
        offsetMinutes: 18 * 60 + 30,
        durationMinutes: 30,
        tags: ['kids'],
      },
      {
        title: 'Violetta',
        description: 'Nastolatka odnajduje swoją pasję w muzyce.',
        offsetMinutes: 19 * 60,
        durationMinutes: 55,
        tags: ['teen', 'music'],
      },
    ],
  },
  {
    externalId: 'pl/nickelodeon',
    name: 'Nickelodeon Polska',
    category: 'Dzieci',
    programs: [
      {
        title: 'SpongeBob Kanciastoporty',
        description: 'Przygody SpongeBoba i przyjaciół z Bikini Bottom.',
        offsetMinutes: 17 * 60 + 30,
        durationMinutes: 25,
        tags: ['animation'],
      },
      {
        title: 'iCarly',
        description: 'Carly przygotowuje specjalny odcinek programu.',
        offsetMinutes: 18 * 60,
        durationMinutes: 25,
        tags: ['teen', 'comedy'],
      },
      {
        title: 'Henry Danger',
        description: 'Superbohaterskie szkolenia Henry’ego.',
        offsetMinutes: 19 * 60,
        durationMinutes: 30,
        tags: ['action', 'kids'],
      },
    ],
  },
  {
    externalId: 'pl/cartoonnetwork',
    name: 'Cartoon Network Polska',
    category: 'Dzieci',
    programs: [
      {
        title: 'Pora na przygodę!',
        description: 'Finn i Jake trafiają do magicznego labiryntu.',
        offsetMinutes: 17 * 60,
        durationMinutes: 25,
        tags: ['animation'],
      },
      {
        title: 'Ben 10',
        description: 'Ben musi uratować ziemię przed obcym zagrożeniem.',
        offsetMinutes: 17 * 60 + 30,
        durationMinutes: 25,
        tags: ['animation', 'action'],
      },
      {
        title: 'Steven Universe',
        description: 'Steven zgłębia tajemnice Klejnotów.',
        offsetMinutes: 18 * 60,
        durationMinutes: 25,
        tags: ['animation', 'fantasy'],
      },
    ],
  },
  {
    externalId: 'pl/eskatv',
    name: 'Eska TV',
    category: 'Muzyka',
    programs: [
      {
        title: 'Gorąca 20 Eski',
        description: 'Najpopularniejsze hity z polskich stacji radiowych.',
        offsetMinutes: 18 * 60,
        durationMinutes: 60,
        tags: ['music', 'chart'],
      },
      {
        title: 'Hity na czasie',
        description: 'Klipy, o których mówi cała Polska.',
        offsetMinutes: 19 * 60,
        durationMinutes: 60,
        tags: ['music'],
      },
      {
        title: 'Weekend z gwiazdą: Dawid Podsiadło',
        description: 'Najlepsze teledyski artysty.',
        offsetMinutes: 20 * 60,
        durationMinutes: 60,
        tags: ['music'],
      },
    ],
  },
  {
    externalId: 'pl/4fundance',
    name: '4Fun Dance',
    category: 'Muzyka',
    programs: [
      {
        title: 'Dance Party',
        description: 'Energetyczne hity do tańca.',
        offsetMinutes: 18 * 60,
        durationMinutes: 60,
        tags: ['music', 'dance'],
      },
      {
        title: 'Polskie Imprezowe',
        description: 'Najlepsze polskie kawałki imprezowe.',
        offsetMinutes: 19 * 60,
        durationMinutes: 60,
        tags: ['music'],
      },
      {
        title: 'Retro Dance',
        description: 'Klasyki z lat 90. i 2000.',
        offsetMinutes: 20 * 60,
        durationMinutes: 60,
        tags: ['music', 'classic'],
      },
    ],
  },
  {
    externalId: 'pl/fokustv',
    name: 'Fokus TV',
    category: 'Popularnonaukowy',
    programs: [
      {
        title: 'Wojny magazynowe – Polska',
        description: 'Poszukiwanie skarbów w magazynach.',
        offsetMinutes: 18 * 60,
        durationMinutes: 45,
        tags: ['reality'],
      },
      {
        title: 'Stołeczna Straż',
        description: 'Służby miejskie na pierwszej linii frontu.',
        offsetMinutes: 18 * 60 + 45,
        durationMinutes: 45,
        tags: ['documentary'],
      },
      {
        title: 'Wielkie konstrukcje: Polska 2050',
        description: 'Plany futurystycznej infrastruktury.',
        offsetMinutes: 20 * 60,
        durationMinutes: 60,
        tags: ['science', 'technology'],
      },
    ],
  },
];

const _logoLabels: Record<string, string> = {
  'pl/tvp1': 'TVP 1',
  'pl/tvp2': 'TVP 2',
  'pl/tvpinfo': 'TVP Info',
  'pl/tvpsport': 'TVP Sport',
  'pl/tvpseriale': 'TVP Seriale',
  'pl/tvn': 'TVN',
  'pl/tvn24': 'TVN 24',
  'pl/tvn7': 'TVN 7',
  'pl/tvnstyl': 'TVN Style',
  'pl/polsat': 'Polsat',
  'pl/polsatnews': 'Polsat News',
  'pl/polsatsport': 'Polsat Sport',
  'pl/tv4': 'TV4',
  'pl/tvpuls': 'TV Puls',
  'pl/tvphistoria': 'TVP Historia',
  'pl/ttv': 'TTV',
  'pl/canalplus': 'Canal+',
  'pl/canalplusfilm': 'Canal+ Film',
  'pl/canalplussport': 'Canal+ Sport',
  'pl/eleven1': 'Eleven 1',
  'pl/eleven2': 'Eleven 2',
  'pl/discoverychannel': 'Discovery',
  'pl/discoverylife': 'Discovery Life',
  'pl/nationalgeographic': 'Nat Geo',
  'pl/animalplanet': 'Animal Planet',
  'pl/bbcbrit': 'BBC Brit',
  'pl/bbcearth': 'BBC Earth',
  'pl/hbo': 'HBO',
  'pl/hbo2': 'HBO 2',
  'pl/hbo3': 'HBO 3',
  'pl/cinemax': 'Cinemax',
  'pl/axn': 'AXN',
  'pl/minimini': 'MiniMini+',
  'pl/disneychannel': 'Disney Ch.',
  'pl/nickelodeon': 'Nickelodeon',
  'pl/cartoonnetwork': 'Cartoon',
  'pl/eskatv': 'Eska TV',
  'pl/4fundance': '4Fun Dance',
  'pl/fokustv': 'Fokus TV',
};

async function main() {
  console.log('🌐 Rozpoczynam seed polskich kanałów...');
  const keepExternalIds = new Set(CHANNELS.map((channel) => channel.externalId));

  const existingChannels = await prisma.channel.findMany({
    select: { id: true, externalId: true },
  });

  const removable = existingChannels.filter((channel) => !keepExternalIds.has(channel.externalId));
  if (removable.length > 0) {
    const removableIds = removable.map((channel) => channel.id);
    console.log(`🧹 Usuwam ${removableIds.length} kanałów spoza listy seed.`);
    await prisma.program.deleteMany({ where: { channelId: { in: removableIds } } });
    await prisma.channel.deleteMany({ where: { id: { in: removableIds } } });
  }

  const todayBase = DateTime.now().setZone('Europe/Warsaw').startOf('day');
  let programCounter = 0;

  for (const channel of CHANNELS) {
    const existingChannel = await prisma.channel.findUnique({
      where: { externalId: channel.externalId },
      select: { logoUrl: true },
    });

    const effectiveLogo =
      existingChannel?.logoUrl && !existingChannel.logoUrl.includes('placehold.co')
        ? existingChannel.logoUrl
        : channel.logoUrl ?? buildLogoUrl(channel.externalId, channel.name);

    const channelRecord = await prisma.channel.upsert({
      where: { externalId: channel.externalId },
      update: {
        name: channel.name,
        description: channel.description ?? null,
        logoUrl: effectiveLogo,
        category: channel.category ?? null,
        countryCode: 'PL',
      },
      create: {
        externalId: channel.externalId,
        name: channel.name,
        description: channel.description ?? null,
        logoUrl: effectiveLogo,
        category: channel.category ?? null,
        countryCode: 'PL',
      },
    });

    await prisma.program.deleteMany({ where: { channelId: channelRecord.id } });

    const programs = buildPrograms(channelRecord.id, channel.externalId, todayBase, channel.programs);
    if (programs.length > 0) {
      await prisma.program.createMany({ data: programs, skipDuplicates: true });
      programCounter += programs.length;
    }
  }

  console.log(`✅ Seed zakończony. Kanały: ${CHANNELS.length}, programy: ${programCounter}.`);
}

function buildPrograms(
  channelId: string,
  externalId: string,
  baseDay: DateTime,
  definitions: ProgramSeed[],
) {
  const now = DateTime.now().setZone('Europe/Warsaw');

  return definitions.map((definition) => {
    let start = baseDay.plus({ minutes: definition.offsetMinutes });
    if (start < now.minus({ hours: 3 })) {
      start = start.plus({ days: 1 });
    }
    const end = start.plus({ minutes: definition.durationMinutes });

    return {
      channelId,
      externalId: `${externalId}-${start.toISO({ suppressMilliseconds: true })}`,
      title: definition.title,
      description: definition.description,
      startsAt: start.toUTC().toJSDate(),
      endsAt: end.toUTC().toJSDate(),
      tags: definition.tags ?? [],
    };
  });
}

function buildLogoUrl(externalId: string, fallbackName: string): string | null {
  const label = (_logoLabels[externalId] ?? fallbackName).trim();
  if (label.length === 0) {
    return null;
  }
  const encoded = encodeURIComponent(label);
  return `https://placehold.co/160x160/png?text=${encoded}&font=source-sans-pro&weight=700`;
}

void main()
  .catch((error) => {
    console.error('❌ Seed zakończony błędem', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


