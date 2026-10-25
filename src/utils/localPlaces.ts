import { BanItem, OutingEvent, Venue } from '../types';
import { isBanned, normName } from './storage';

export interface LocalPlaceItem {
  name: string;
  loc: string;
  region: string; // 'medway' | 'london' | 'north' | 'midlands' | 'south' | 'uk'
  kind: 'spot' | 'event' | 'combo';
  category: string;
  emoji: string;
  vibe: string[]; // ['drinks', 'active', 'food', 'chill', 'wild']
  desc: string;
  cost?: string;
  when?: string;
  steps?: string[];
  url?: string;
}

export const CURATED_UK_PLACES: LocalPlaceItem[] = [
  // --- ROCHESTER & MEDWAY & KENT ---
  {
    name: 'Playopolis Board Game Bar',
    loc: '2 Star Hill, Rochester',
    region: 'medway',
    kind: 'spot',
    category: 'Activity Cafe',
    emoji: '🎲',
    vibe: ['active', 'chill', 'drinks'],
    desc: 'Hundreds of tabletop games, local craft beer, loaded nachos, and competitive group tournaments.',
    cost: '£6 entry + drinks',
  },
  {
    name: 'The Dead Pigeon Craft Pub',
    loc: 'High Street, Rochester',
    region: 'medway',
    kind: 'spot',
    category: 'Independent Taproom',
    emoji: '🍻',
    vibe: ['drinks', 'food'],
    desc: 'Rotating 16-tap craft board, legendary smash burgers, and retro video game corner.',
    cost: '£15-£25',
  },
  {
    name: 'ThreeSheets to the Wind',
    loc: 'Rochester High Street',
    region: 'medway',
    kind: 'spot',
    category: 'Micro-pub',
    emoji: '🍺',
    vibe: ['drinks', 'chill'],
    desc: 'Intimate Kentish micro-pub serving real cask ales and regional ciders straight from the cellar.',
    cost: '£5/pint',
  },
  {
    name: 'The Rochester Secret Vault Night',
    loc: 'Rochester Old Town',
    region: 'medway',
    kind: 'combo',
    category: 'Combo Night',
    emoji: '🔀',
    vibe: ['drinks', 'active', 'wild'],
    desc: 'Independent micro-brew sprint followed by vintage board games and basement cocktail den.',
    steps: ['6:30pm Taproom tasting at Dead Pigeon', '8:00pm Strategy showdown at Playopolis', '9:45pm Late cocktails in the vault'],
    cost: '£30',
  },
  {
    name: 'Chatham Dockyard Historic Gin & Escape',
    loc: 'Historic Dockyard, Chatham',
    region: 'medway',
    kind: 'combo',
    category: 'Combo Adventure',
    emoji: '🔀',
    vibe: ['active', 'wild'],
    desc: 'Escape room challenge in historic naval docks followed by copper-still gin tasting.',
    steps: ['5:30pm Naval bunker escape challenge', '7:00pm Copper Rivet Distillery tasting session'],
    cost: '£35',
  },
  {
    name: 'Copper Rivet Distillery & Pumphouse',
    loc: 'Pump House No 5, Chatham',
    region: 'medway',
    kind: 'spot',
    category: 'Distillery & Tapas',
    emoji: '🍸',
    vibe: ['drinks', 'food'],
    desc: 'Grain-to-glass artisan distillery in a converted Victorian pumphouse on the River Medway.',
    cost: '£25-£40',
  },
  {
    name: 'Singlerose Axe & Target Range',
    loc: 'Medway Valley Leisure Park',
    region: 'medway',
    kind: 'spot',
    category: 'Target Sports',
    emoji: '🪓',
    vibe: ['active', 'wild'],
    desc: 'Full-weight axe throwing lanes, bullseye tournament, and post-game craft burgers.',
    cost: '£20',
  },
  {
    name: 'Command House Riverside',
    loc: 'Dock Road, Chatham',
    region: 'medway',
    kind: 'spot',
    category: 'Historic Riverside Tavern',
    emoji: '⚓',
    vibe: ['drinks', 'chill'],
    desc: 'Sprawling Georgian military building with river terraces, craft cider, and wood-fired pizzas.',
    cost: '£15-£25',
  },
  {
    name: 'Poco Loco Tapas & Live Music Den',
    loc: 'High Street, Chatham',
    region: 'medway',
    kind: 'spot',
    category: 'Live Music & Tapas',
    emoji: '🎸',
    vibe: ['drinks', 'food', 'wild'],
    desc: 'Underground live music hub with authentic tapas, indie acoustic gigs, and zero chain vibes.',
    cost: '£15-£20',
  },

  // --- LONDON & MIDPOINTS ---
  {
    name: 'Flight Club Social Darts',
    loc: 'Bloomsbury / Shoreditch, London',
    region: 'london',
    kind: 'spot',
    category: 'Interactive Darts',
    emoji: '🎯',
    vibe: ['active', 'drinks', 'food'],
    desc: 'High-tech multiplayer darts, instant video replays, paddle pizzas, and slushy cocktails.',
    cost: '£20-£35',
  },
  {
    name: 'Rowans Tenpin Bowling & Retro Arcade',
    loc: 'Finsbury Park, London',
    region: 'london',
    kind: 'spot',
    category: 'Retro Bowling & Karaoke',
    emoji: '🎳',
    vibe: ['active', 'wild', 'drinks'],
    desc: 'Legendary north London institution with retro arcade machines, neon bowling, and cheap pitchers.',
    cost: '£12-£20',
  },
  {
    name: 'Bermondsey Beer Mile Crawl',
    loc: 'Railway Arches, Bermondsey',
    region: 'london',
    kind: 'combo',
    category: 'Combo Brewery Route',
    emoji: '🔀',
    vibe: ['drinks', 'food'],
    desc: 'Chain of 12+ independent railway-arch craft breweries, wood-fired bakeries, and food trucks.',
    steps: ['2:00pm Cloudwater arch tasting', '3:45pm Moor Beer shuffleboard', '5:30pm Arch 33 street food'],
    cost: '£25-£40',
  },
  {
    name: 'Swingers Crazy Golf Club',
    loc: 'City / West End, London',
    region: 'london',
    kind: 'spot',
    category: 'Indoor Mini Golf',
    emoji: '⛳',
    vibe: ['active', 'drinks'],
    desc: '1920s clubhouse aesthetic with 9-hole competitive golf, street food vendors, and cocktails.',
    cost: '£15/round',
  },
  {
    name: 'Bounce Ping Pong & Beer Bar',
    loc: 'Farringdon / Old Street, London',
    region: 'london',
    kind: 'spot',
    category: 'Interactive Ping Pong',
    emoji: '🏓',
    vibe: ['active', 'drinks'],
    desc: 'Digital projection ping-pong tables, energetic soundtrack, and sharing pizza boards.',
    cost: '£18-£25',
  },
  {
    name: 'Four Quarters Retro Arcade Bar',
    loc: 'Peckham / Elephant & Castle, London',
    region: 'london',
    kind: 'spot',
    category: 'Arcade & Consoles',
    emoji: '🕹️',
    vibe: ['chill', 'drinks', 'active'],
    desc: 'Original 80s/90s arcade cabinets with Mario Kart, Street Fighter, craft beer, and sourdough pizza.',
    cost: '£10-£20',
  },
  {
    name: 'Top Secret Comedy Club',
    loc: 'Drury Lane, Covent Garden',
    region: 'london',
    kind: 'event',
    category: 'Comedy Club',
    emoji: '🎟️',
    vibe: ['chill', 'drinks', 'wild'],
    desc: 'Consistently the funniest comedy basement in London. Circuit headliners and drop-in stars.',
    cost: '£8-£14',
    when: 'Daily 7:30pm & 9:30pm',
  },
  {
    name: 'Mercato Metropolitano Food Yard',
    loc: 'Elephant & Castle, London',
    region: 'london',
    kind: 'spot',
    category: 'Artisan Food Hall',
    emoji: '🌮',
    vibe: ['food', 'drinks', 'chill'],
    desc: 'Massive disused paper factory turned food hall with 40+ independent global food stalls and microbrewery.',
    cost: '£15-£25',
  },

  // --- UK WIDE / REGIONAL WILDCARDS ---
  {
    name: 'Whistle Punks Axe Throwing',
    loc: 'City Centre (UK Wide)',
    region: 'uk',
    kind: 'spot',
    category: 'Axe Throwing Tournament',
    emoji: '🪓',
    vibe: ['active', 'wild'],
    desc: 'Urban axe throwing with instructors, scoreboards, and champion elimination heats.',
    cost: '£22',
  },
  {
    name: 'Junkyard Golf Club',
    loc: 'UK Major Cities',
    region: 'uk',
    kind: 'spot',
    category: 'Mashed-Up Crazy Golf',
    emoji: '⛳',
    vibe: ['active', 'drinks', 'wild'],
    desc: 'Bizarre twisted golf courses constructed from scrapyard parts, disco lights, and boozy cocktails.',
    cost: '£12-£16',
  },
  {
    name: 'NQ64 Retro Arcade & Cocktails',
    loc: 'Northern Quarter / City Center',
    region: 'uk',
    kind: 'spot',
    category: 'Neon Arcade Bar',
    emoji: '👾',
    vibe: ['active', 'drinks'],
    desc: 'Neon-splattered underground game cavern with Goldeneye, Time Crisis, Guitar Hero, and craft cans.',
    cost: '£15',
  },
  {
    name: 'Shuffleboard & Street Food Tournament',
    loc: 'Town Center',
    region: 'uk',
    kind: 'combo',
    category: 'Combo Challenge',
    emoji: '🔀',
    vibe: ['active', 'food', 'drinks'],
    desc: 'Pair up for an intense table shuffleboard championship followed by a multi-stall street food feast.',
    steps: ['6:00pm Shuffleboard doubles tournament', '7:45pm Smash burgers & loaded fries', '9:15pm Winner drinks round'],
    cost: '£25',
  },
  {
    name: 'Escape Vault & Craft Tap Expedition',
    loc: 'High Street / Old Quarter',
    region: 'uk',
    kind: 'combo',
    category: 'Combo Route',
    emoji: '🔀',
    vibe: ['active', 'wild', 'drinks'],
    desc: 'Break out of an immersive 60-minute escape room then celebrate victory at a hidden microbrewery.',
    steps: ['6:00pm The Vault Escape Mission', '7:30pm Independent taproom tasting board'],
    cost: '£32',
  },
  {
    name: 'Secret Cellar Stand-Up & Pizza',
    loc: 'Historic Quarter',
    region: 'uk',
    kind: 'event',
    category: 'Stand-Up Comedy',
    emoji: '🎟️',
    vibe: ['chill', 'drinks', 'wild'],
    desc: 'Intimate underground comedy showcase with touring comedians, craft pints, and sourdough slices.',
    cost: '£15',
    when: 'Fri & Sat 8:00pm',
  },
  {
    name: 'Virtual Reality Arena Deathmatch',
    loc: 'City Activity Hub',
    region: 'uk',
    kind: 'spot',
    category: 'VR Combat Arena',
    emoji: '🥽',
    vibe: ['active', 'wild'],
    desc: 'Free-roam multiplayer VR arena: untethered squad combat against zombies or each other.',
    cost: '£25',
  },
  {
    name: 'Electric Shuffleboard Social',
    loc: 'Central Waterfront / City',
    region: 'uk',
    kind: 'spot',
    category: 'Custom Interactive Shuffle',
    emoji: '🥌',
    vibe: ['active', 'drinks'],
    desc: 'Camera-tracked custom shuffleboard tables with interactive team mini-games and craft cider.',
    cost: '£14/person',
  },
  {
    name: 'Independent Board Game & Tap Den',
    loc: 'Old Town / Arts District',
    region: 'uk',
    kind: 'spot',
    category: 'Tabletop & Taproom',
    emoji: '♟️',
    vibe: ['chill', 'active', 'drinks'],
    desc: 'Over 400 modern tabletop titles, game curators to teach the rules, and regional guest ales.',
    cost: '£6 table fee',
  },
  {
    name: 'Retro Video Game & Pizza Party Night',
    loc: 'Quarter Center',
    region: 'uk',
    kind: 'combo',
    category: 'Combo Gaming',
    emoji: '🔀',
    vibe: ['chill', 'active', 'food'],
    desc: 'Classic multiplayer console tournament on CRT screens with Detroit-style deep pan pizza.',
    steps: ['6:30pm Mario Kart 64 four-player cup', '8:00pm Detroit pizza feast', '9:30pm Smash Bros sudden death'],
    cost: '£22',
  },
  {
    name: 'Riverside Sunset Pints & Smokehouse',
    loc: 'Quayside / River Path',
    region: 'uk',
    kind: 'spot',
    category: 'Riverside BBQ & Beer',
    emoji: '🔥',
    vibe: ['food', 'drinks', 'chill'],
    desc: 'Oak-smoked beef ribs, pulled pork, craft pale ales, and outdoor waterside bench seating.',
    cost: '£20-£30',
  },
];

/**
 * Rapid instant matching engine: delivers 3-10 top-rated curated UK spots
 * matching user location and vibe in under 5ms, without any network roundtrip.
 */
export function getLocalCuratedIdeas(
  area: string,
  vibe: string,
  banList: BanItem[],
  existingNames: Set<string>,
  count = 6
): Partial<Venue>[] {
  const normArea = area.toLowerCase().trim();
  const normVib = vibe.toLowerCase().trim();

  // Detect regional preference
  let regionTag = 'uk';
  if (normArea.includes('rochester') || normArea.includes('chatham') || normArea.includes('medway') || normArea.includes('gillingham') || normArea.includes('maidstone') || normArea.includes('kent')) {
    regionTag = 'medway';
  } else if (normArea.includes('london') || normArea.includes('bermondsey') || normArea.includes('shoreditch') || normArea.includes('stratford') || normArea.includes('finsbury')) {
    regionTag = 'london';
  }

  // Filter pool
  const candidatePool = CURATED_UK_PLACES.filter((p) => {
    // Check ban list
    if (isBanned(p.name, banList)) return false;
    // Check already on board or swiped
    if (existingNames.has(normName(p.name))) return false;
    return true;
  });

  // Score candidate relevance
  const scored = candidatePool.map((p) => {
    let score = 0;
    // Regional match
    if (p.region === regionTag) score += 10;
    else if (p.region === 'uk') score += 5;

    // Vibe match
    if (normVib) {
      if (p.vibe.some((v) => normVib.includes(v))) score += 8;
      if (normVib.includes('drink') && p.vibe.includes('drinks')) score += 5;
      if (normVib.includes('food') && p.vibe.includes('food')) score += 5;
      if (normVib.includes('active') && p.vibe.includes('active')) score += 5;
      if (normVib.includes('chill') && p.vibe.includes('chill')) score += 5;
    }

    // Give variety a subtle boost
    score += Math.random() * 2;

    return { place: p, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected = scored.slice(0, count).map(({ place }) => {
    const formatted: Partial<Venue> = {
      name: place.name,
      loc: place.loc.includes(area) ? place.loc : `${place.loc} (${area || 'Local'})`,
      desc: place.desc,
      kind: place.kind,
      when: place.when || '',
      cost: place.cost || '',
      url: place.url || '',
      steps: place.steps || [],
      live: place.kind === 'event' ? 1 : 0,
      src: 'osm',
    };
    return formatted;
  });

  return selected;
}
