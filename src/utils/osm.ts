import { Venue, OutingEvent, User, Midpoint, BanItem, VenueStop } from '../types';
import { getStorage, setStorage, isBanned, normName, safeUrl } from './storage';
import { parseWhen } from './dates';
import { getLocalCuratedIdeas } from './localPlaces';

export const miles = (a: { lat: number; lon: number }, b: { lat: number; lon: number }): number => {
  const r = (x: number) => (x * Math.PI) / 180;
  const dLa = r(b.lat - a.lat);
  const dLo = r(b.lon - a.lon);
  const h =
    Math.sin(dLa / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
};

const KNOWN_UK_CENTRES: Record<string, { lat: number; lon: number }> = {
  rochester: { lat: 51.3889, lon: 0.5056 },
  chatham: { lat: 51.3833, lon: 0.5283 },
  medway: { lat: 51.3889, lon: 0.5056 },
  gillingham: { lat: 51.3853, lon: 0.5498 },
  maidstone: { lat: 51.272, lon: 0.523 },
  canterbury: { lat: 51.2802, lon: 1.0789 },
  london: { lat: 51.5074, lon: -0.1278 },
  manchester: { lat: 53.4808, lon: -2.2426 },
  birmingham: { lat: 52.4862, lon: -1.8904 },
  bristol: { lat: 51.4545, lon: -2.5879 },
  leeds: { lat: 53.8008, lon: -1.5491 },
  liverpool: { lat: 53.4084, lon: -2.9916 },
  newcastle: { lat: 54.9783, lon: -1.6178 },
  brighton: { lat: 50.8225, lon: -0.1372 },
  'tunbridge wells': { lat: 51.132, lon: 0.263 },
};

const geoCache: Record<string, { lat: number; lon: number }> = (() => {
  try {
    return { ...KNOWN_UK_CENTRES, ...JSON.parse(getStorage('geo', '{}')) };
  } catch (e) {
    return { ...KNOWN_UK_CENTRES };
  }
})();

let lastGeo = 0;

async function osmFetch(url: string, timeoutMs = 3500): Promise<any> {
  const wait = 1100 - (Date.now() - lastGeo);
  if (wait > 0) await new Promise((r) => setTimeout(r, Math.min(wait, 400)));
  lastGeo = Date.now();

  const ac = new AbortController();
  const tm = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      signal: ac.signal,
      headers: {
        'Accept-Language': 'en-GB',
        'User-Agent': 'NotTheGreedyBanker/3.0 (UK Outing Squad App)',
      },
    });
    if (!r.ok) throw new Error('Map lookup failed (' + r.status + ')');
    return await r.json();
  } finally {
    clearTimeout(tm);
  }
}

export async function geocode(q: string): Promise<{ lat: number; lon: number } | null> {
  const k = String(q || '').toLowerCase().trim();
  if (!k) return null;
  if (geoCache[k]) return geoCache[k];

  // Check prefix match in known centres
  for (const [name, coord] of Object.entries(KNOWN_UK_CENTRES)) {
    if (k.includes(name) || name.includes(k)) {
      geoCache[k] = coord;
      return coord;
    }
  }

  try {
    const j = await osmFetch(
      'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=gb&q=' +
        encodeURIComponent(q),
      3500
    );
    if (!j[0]) return null;
    geoCache[k] = { lat: +j[0].lat, lon: +j[0].lon };
    setStorage('geo', JSON.stringify(geoCache));
    return geoCache[k];
  } catch {
    // Return default Rochester/Kent center if network fails so flow never crashes
    return { lat: 51.3889, lon: 0.5056 };
  }
}

export async function placeName(lat: number, lon: number): Promise<string> {
  const j = await osmFetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&lat=${lat}&lon=${lon}`
  );
  const a = j.address || {};
  return a.town || a.city || a.village || a.suburb || a.county || j.name || 'the middle';
}

export async function calculateMidpoint(
  squad: User[],
  winningVenue: Venue | null
): Promise<{ midpoint: Midpoint; lost: string[] }> {
  const pts: Record<string, { lat: number; lon: number }> = {};
  const lost: string[] = [];

  for (const u of squad) {
    const p = await geocode(u.loc);
    if (p) pts[u.id] = p;
    else lost.push(u.name);
  }

  const ps = Object.values(pts);
  if (!ps.length) {
    throw new Error("Couldn't find anyone's station on the map");
  }

  const c = {
    lat: ps.reduce((a, p) => a + p.lat, 0) / ps.length,
    lon: ps.reduce((a, p) => a + p.lon, 0) / ps.length,
  };

  const name = await placeName(c.lat, c.lon);
  let vp: { lat: number; lon: number } | null = null;
  if (winningVenue) {
    vp = (await geocode(`${winningVenue.name}, ${winningVenue.loc}`)) || (await geocode(winningVenue.loc));
  }

  const locsKey = squad.map((u) => u.id + ':' + u.loc).join('|');
  const midpoint: Midpoint = {
    ...c,
    name,
    pts,
    locs: locsKey,
    vid: winningVenue ? winningVenue.id : null,
    v: vp,
  };

  return { midpoint, lost };
}

// Categories for OpenStreetMap search
export interface OsmCategory {
  k: string;
  t: 'act' | 'food' | 'drink';
  e: string;
  l: string;
  w: RegExp;
  q: string[];
  m: (tags: Record<string, any>) => boolean;
}

export const CATS: OsmCategory[] = [
  { k: 'axe', t: 'act', e: '🪓', l: 'Axe throwing', w: /axe|throw|competit/, q: ['"sport"="axe_throwing"'], m: (t) => t.sport === 'axe_throwing' },
  { k: 'bowl', t: 'act', e: '🎳', l: 'Bowling', w: /bowl|competit/, q: ['"leisure"="bowling_alley"'], m: (t) => t.leisure === 'bowling_alley' },
  { k: 'escape', t: 'act', e: '🔐', l: 'Escape room', w: /escape|puzzle|brain/, q: ['"leisure"="escape_game"'], m: (t) => t.leisure === 'escape_game' },
  { k: 'golf', t: 'act', e: '⛳', l: 'Crazy golf / driving range', w: /golf|putt|competit/, q: ['"leisure"="miniature_golf"', '"golf"="driving_range"'], m: (t) => t.leisure === 'miniature_golf' || t.golf === 'driving_range' },
  { k: 'kart', t: 'act', e: '🏎️', l: 'Go-karting', w: /kart|rac|speed|competit/, q: ['"sport"="karting"'], m: (t) => t.sport === 'karting' },
  { k: 'laser', t: 'act', e: '🔫', l: 'Laser tag / paintball', w: /laser|paintball|airsoft|shoot|competit/, q: ['"sport"="paintball"', '"sport"="laser_tag"', '"leisure"="laser_tag"'], m: (t) => /paintball|laser_tag/.test(t.sport || '') || t.leisure === 'laser_tag' },
  { k: 'climb', t: 'act', e: '🧗', l: 'Climbing', w: /climb|boulder|active/, q: ['"sport"="climbing"'], m: (t) => t.sport === 'climbing' },
  { k: 'tramp', t: 'act', e: '🤸', l: 'Trampoline park', w: /trampoline|bounce|jump|active/, q: ['"leisure"="trampoline_park"'], m: (t) => t.leisure === 'trampoline_park' },
  { k: 'arcade', t: 'act', e: '🕹️', l: 'Arcade', w: /arcade|retro|gam/, q: ['"leisure"="amusement_arcade"'], m: (t) => t.leisure === 'amusement_arcade' },
  { k: 'karaoke', t: 'act', e: '🎤', l: 'Karaoke', w: /karaoke|sing/, q: ['"amenity"="karaoke_box"'], m: (t) => t.amenity === 'karaoke_box' },
  { k: 'pool', t: 'act', e: '🎱', l: 'Pool / snooker / darts', w: /pool|snooker|dart|billiard/, q: ['"sport"="billiards"', '"sport"="snooker"', '"sport"="darts"'], m: (t) => /billiards|snooker|darts/.test(t.sport || '') },
  { k: 'ice', t: 'act', e: '⛸️', l: 'Ice skating', w: /ice|skat/, q: ['"leisure"="ice_rink"'], m: (t) => t.leisure === 'ice_rink' },
  { k: 'cinema', t: 'act', e: '🎬', l: 'Cinema', w: /cinema|film|movie/, q: ['"amenity"="cinema"'], m: (t) => t.amenity === 'cinema' },
  { k: 'theatre', t: 'act', e: '🎭', l: 'Theatre / comedy', w: /theat|comed|show|stand.?up/, q: ['"amenity"="theatre"', '"amenity"="arts_centre"'], m: (t) => t.amenity === 'theatre' || t.amenity === 'arts_centre' },
  { k: 'music', t: 'act', e: '🎶', l: 'Live music / club', w: /gig|music|band|live|dj|club|danc/, q: ['"amenity"="music_venue"', '"amenity"="nightclub"'], m: (t) => t.amenity === 'music_venue' || t.amenity === 'nightclub' },
  { k: 'museum', t: 'act', e: '🏛️', l: 'Museum / attraction', w: /museum|histor|culture|castle|attraction|day/, q: ['"tourism"="museum"', '"historic"="castle"'], m: (t) => t.tourism === 'museum' || t.historic === 'castle' },
  { k: 'water', t: 'act', e: '🚣', l: 'Water sports', w: /water|kayak|paddle|boat|sail|swim/, q: ['"sport"="canoe"', '"sport"="sailing"', '"leisure"="water_park"'], m: (t) => /canoe|sailing/.test(t.sport || '') || t.leisure === 'water_park' },
  { k: 'curry', t: 'food', e: '🍛', l: 'Curry', w: /curry|indian|spice/, q: ['"amenity"="restaurant"]["cuisine"~"indian|nepalese|bangladeshi|pakistani|sri_lankan"'], m: (t) => t.amenity === 'restaurant' && /indian|nepalese|bangladeshi|pakistani|sri_lankan/.test(t.cuisine || '') },
  { k: 'pizza', t: 'food', e: '🍕', l: 'Pizza', w: /pizza|italian/, q: ['"amenity"="restaurant"]["cuisine"~"pizza|italian"'], m: (t) => t.amenity === 'restaurant' && /pizza|italian/.test(t.cuisine || '') },
  { k: 'asian', t: 'food', e: '🍜', l: 'Asian', w: /thai|chinese|japan|sushi|ramen|korean|viet|asian/, q: ['"amenity"="restaurant"]["cuisine"~"thai|chinese|japanese|sushi|ramen|korean|vietnamese"'], m: (t) => t.amenity === 'restaurant' && /thai|chinese|japanese|sushi|ramen|korean|vietnamese/.test(t.cuisine || '') },
  { k: 'grill', t: 'food', e: '🍔', l: 'Burgers / BBQ', w: /burger|bbq|barbecue|steak|grill|wings/, q: ['"amenity"="restaurant"]["cuisine"~"burger|barbecue|steak_house|american|wings"'], m: (t) => t.amenity === 'restaurant' && /burger|barbecue|steak|american|wings/.test(t.cuisine || '') },
  { k: 'mex', t: 'food', e: '🌮', l: 'Mexican / tapas', w: /mexic|taco|tapas|spanish/, q: ['"amenity"="restaurant"]["cuisine"~"mexican|tapas|spanish"'], m: (t) => t.amenity === 'restaurant' && /mexican|tapas|spanish/.test(t.cuisine || '') },
  { k: 'brew', t: 'drink', e: '🍺', l: 'Taproom / brewery', w: /tap|brew|craft|beer|ale/, q: ['"craft"="brewery"', '"microbrewery"="yes"'], m: (t) => t.craft === 'brewery' || t.microbrewery === 'yes' },
  { k: 'bar', t: 'drink', e: '🍸', l: 'Bar', w: /cocktail|bar|gin|rum|wine/, q: ['"amenity"="bar"'], m: (t) => t.amenity === 'bar' },
  { k: 'food', t: 'food', e: '🍽️', l: 'Food', w: /food|eat|dinner|restaurant/, q: [], m: (t) => t.amenity === 'restaurant' },
];

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function overpass(q: string): Promise<any[]> {
  return new Promise((resolve) => {
    let next = 0;
    let done = 0;
    let failed = 0;
    const ctrls: AbortController[] = [];

    const launch = () => {
      if (done || next >= OVERPASS.length) return;
      const u = OVERPASS[next++];
      const ac = new AbortController();
      const tm = setTimeout(() => ac.abort(), 3500);
      const slow = setTimeout(launch, 1200);
      ctrls.push(ac);

      (async () => {
        try {
          const r = await fetch(u, {
            method: 'POST',
            signal: ac.signal,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'data=' + encodeURIComponent(q),
          });
          if (!r.ok) throw new Error('busy (' + r.status + ')');
          const j = await r.json();
          if (!j.elements || (!j.elements.length && /error|timed out|memory/i.test(j.remark || ''))) {
            throw new Error('overloaded');
          }
          if (!done) {
            done = 1;
            ctrls.forEach((c) => c !== ac && c.abort());
            resolve(j.elements);
          }
        } catch {
          if (done) return;
          clearTimeout(slow);
          if (++failed >= OVERPASS.length) {
            resolve([]);
          } else {
            launch();
          }
        } finally {
          clearTimeout(tm);
        }
      })();
    };
    launch();
  });
}

async function centresFor(where: string): Promise<Array<{ lat: number; lon: number; name: string }>> {
  const parts = where
    .split(/\s*(?:,|\bor\b|\band\b|&|\/)\s*/i)
    .filter(Boolean)
    .slice(0, 3);
  const out: Array<{ lat: number; lon: number; name: string }> = [];

  for (const p of parts) {
    const g = await geocode(p);
    if (g) out.push({ ...g, name: p });
  }
  if (!out.length) {
    const g = await geocode(where);
    if (g) out.push({ ...g, name: where });
  }
  return out;
}

function osmFilters(cats: OsmCategory[]): string[] {
  const byKey: Record<string, string[]> = {};
  const out: string[] = [];
  cats
    .flatMap((c) => c.q)
    .forEach((f) => {
      const m = f.match(/^"([^"]+)"="([^"]+)"$/);
      if (m) {
        byKey[m[1]] = byKey[m[1]] || [];
        byKey[m[1]].push(m[2]);
      } else {
        out.push(f);
      }
    });
  return [
    ...Object.entries(byKey).map(([k, v]) => `"${k}"~"^(${[...new Set(v)].join('|')})$"`),
    ...out,
  ];
}

function bbox(cs: Array<{ lat: number; lon: number }>, km: number): string {
  const b = [90, 180, -90, -180];
  cs.forEach((p) => {
    const dl = km / 111;
    const dn = km / (111 * Math.cos((p.lat * Math.PI) / 180));
    b[0] = Math.min(b[0], p.lat - dl);
    b[1] = Math.min(b[1], p.lon - dn);
    b[2] = Math.max(b[2], p.lat + dl);
    b[3] = Math.max(b[3], p.lon + dn);
  });
  return b.map((x) => x.toFixed(4)).join(',');
}

async function photonPlaces(
  cs: Array<{ lat: number; lon: number; name: string }>,
  cats: OsmCategory[],
  vibe: string
): Promise<any[]> {
  const v = vibe.toLowerCase();
  const ordered = [
    ...cats.filter((c) => c.w.test(v)),
    ...shuffle(cats.filter((c) => !c.w.test(v))),
  ];
  const pairs = [
    ...new Set(
      ordered
        .flatMap((c) => c.q)
        .map((f) => (f.match(/^"([^"]+)"="([^"]+)"/) || []).slice(1, 3).join(':'))
        .filter(Boolean)
    ),
  ].slice(0, 14);

  if (!pairs.includes('amenity:restaurant')) pairs.push('amenity:restaurant');
  if (!pairs.includes('amenity:bar')) pairs.push('amenity:bar');

  const out: any[] = [];
  const c = cs[0];
  let i = 0;
  let ok = 0;

  const work = async () => {
    while (i < pairs.length) {
      const tag = pairs[i++];
      try {
        const r = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(c.name)}&osm_tag=${tag}&lat=${c.lat}&lon=${c.lon}&limit=10&lang=en`
        );
        if (!r.ok) continue;
        ok++;
        const j = await r.json();
        (j.features || []).forEach((f: any) => {
          const p = f.properties || {};
          const [lon, lat] = f.geometry?.coordinates || [];
          if (p.name && lat != null) {
            out.push({
              type: p.osm_type,
              id: p.osm_id,
              lat,
              lon,
              tags: {
                name: p.name,
                [p.osm_key]: p.osm_value,
                'addr:street': p.street,
                'addr:town': p.city || p.district || p.county,
              },
            });
          }
        });
      } catch (e) {}
    }
  };

  await Promise.all([work(), work(), work(), work()]);
  if (!ok) throw new Error('the backup map service is busy too');
  return out.filter((e) => miles(c, e) <= 12);
}

const shuffle = <T>(a: T[]): T[] => {
  const res = [...a];
  for (let i = res.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [res[i], res[j]] = [res[j], res[i]];
  }
  return res;
};

const THEMES = [
  'The {a} Gauntlet',
  'Operation Not-The-Pub',
  'The {a} Grand Tour',
  'Triple Threat',
  'The Anti-Default Triathlon',
  'Mission: {a}',
  'The Long Way Round',
  'Default Destroyer',
  'The {a} Crawl (No Banker)',
  'Side Quest Saturday',
];

function placeLoc(p: any, area: string): string {
  const t = p.t || {};
  const town = t['addr:town'] || t['addr:city'] || t['addr:suburb'] || area;
  return (t['addr:street'] ? t['addr:street'] + ', ' : '') + town;
}

export interface PlacesPool {
  cs: Array<{ lat: number; lon: number; name: string }>;
  places: any[];
}

export async function fetchPlaces(
  where: string,
  vibe: string,
  banList: BanItem[],
  onProgress?: (msg: string) => void
): Promise<PlacesPool> {
  let cs = await centresFor(where);
  if (!cs.length) {
    cs = [{ lat: 51.3889, lon: 0.5056, name: where || 'Rochester' }];
  }

  const hit = (c: OsmCategory) => c.w.test(vibe.toLowerCase());
  const pickC = (t: 'act' | 'food' | 'drink') => {
    const all = CATS.filter((c) => c.t === t && c.q.length);
    const m = all.filter(hit);
    return m.length ? m : all;
  };

  const acts = CATS.filter((c) => c.t === 'act');
  const eats = [...pickC('food'), ...CATS.filter((c) => c.t === 'drink')];
  const st = (cats: OsmCategory[]) => osmFilters(cats).map((f) => `nwr[${f}]["name"];`).join('');

  let places: any[] = [];

  for (const km of [6]) {
    let els: any[] = [];
    try {
      els = await overpass(
        `[out:json][timeout:4][bbox:${bbox(cs, km)}];(${st(acts)})->.a;.a out center tags 200;(${st(eats)})->.f;.f out center tags 200;`
      );
    } catch {
      if (onProgress) onProgress('Checking local knowledge base...');
    }

    if (!els.length) {
      try {
        els = await photonPlaces(cs, [...acts, ...eats], vibe);
      } catch {}
    }

    const seen = new Set<string>();
    places = [];

    els.forEach((e: any) => {
      const t = e.tags || {};
      const c = CATS.find((cat) => cat.m(t));
      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      if (!c || !t.name || lat == null || isBanned(t.name, banList) || (c.t !== 'act' && t.brand) || seen.has(normName(t.name))) {
        return;
      }
      seen.add(normName(t.name));
      places.push({ id: (e.type || 'n') + e.id, name: t.name, lat, lon, c, t, hit: hit(c) ? 1 : 0 });
    });

    if (places.filter((p) => p.c.t === 'act').length >= 4) break;
  }

  // Instant resilience: If live map servers returned few or no spots, enrich with curated UK places
  if (places.length < 4) {
    const existing = new Set<string>(places.map((p) => normName(p.name)));
    const curated = getLocalCuratedIdeas(where, vibe, banList, existing, 6);
    curated.forEach((cItem, i) => {
      if (cItem.name && !existing.has(normName(cItem.name))) {
        existing.add(normName(cItem.name));
        places.push({
          id: `local_curated_${Date.now()}_${i}`,
          name: cItem.name,
          lat: cs[0]?.lat || 51.3889,
          lon: cs[0]?.lon || 0.5056,
          c: {
            k: cItem.kind === 'combo' ? 'combo' : 'activity',
            t: cItem.kind === 'spot' ? 'act' : 'food',
            e: cItem.kind === 'combo' ? '🔀' : '🎯',
            l: cItem.kind === 'combo' ? 'Combo Route' : 'Activity',
            w: /.*/,
            q: [],
            m: () => true,
          },
          t: {
            name: cItem.name,
            'addr:town': cItem.loc || where,
            website: cItem.url,
            desc: cItem.desc,
          },
          hit: 1,
          steps: cItem.steps,
          cost: cItem.cost,
          when: cItem.when,
        });
      }
    });
  }

  return { places, cs };
}

export function makeIdeas(pool: PlacesPool, area: string, event: OutingEvent, seenSet: Set<string>): Partial<Venue>[] {
  const have = new Set(event.venues.map((v) => normName(v.name)));
  const fresh = (p: any) => !have.has(normName(p.name)) && !seenSet.has(p.id);
  const use = (p: any) => seenSet.add(p.id);

  const near = (from: any, list: any[], max: number) =>
    list
      .filter((p) => fresh(p) && miles(from, p) <= max)
      .sort((a, b) => b.hit - a.hit || miles(from, a) - miles(from, b))[0];

  let acts = shuffle(pool.places.filter((p) => p.c.t === 'act' && fresh(p))).sort((a, b) => b.hit - a.hit);
  if (!acts.length) {
    acts = shuffle(pool.places.filter((p) => p.c.t === 'food' && p.hit && fresh(p)));
  }

  const spots: any[] = [];
  const cats = new Set<string>();

  for (const p of acts) {
    if (spots.length >= 3) break;
    if (!cats.has(p.c.k) || acts.length < 6) {
      spots.push(p);
      cats.add(p.c.k);
      use(p);
    }
  }

  const food = pool.places.filter((p) => p.c.t === 'food');
  const drink = pool.places.filter((p) => p.c.t === 'drink');
  const combos: any[] = [];

  const parsed = parseWhen(event.when);
  const day = (parsed || { getHours: () => 19 }).getHours() < 15;
  const times = day ? ['1pm', '3pm', '5pm'] : ['6pm', '8pm', '9:30pm'];

  for (const a of acts.filter((p) => p.c.t === 'act' && fresh(p))) {
    if (combos.length >= 2) break;
    const f = near(a, food, 1.5);
    const d = near(f || a, drink.filter((x) => x !== f), 1.2);
    if (!f && !d) continue;

    [a, f, d].forEach((x) => x && use(x));

    const stopsList: VenueStop[] = [
      {
        name: a.name,
        loc: placeLoc(a, area),
        time: times[0],
        category: `${a.c.e} ${a.c.l}`,
        lat: a.lat,
        lon: a.lon,
        url: safeUrl(a.t?.website || a.t?.['contact:website']),
      },
      f
        ? {
            name: f.name,
            loc: placeLoc(f, area),
            time: times[1],
            category: `${f.c.e} ${f.c.l}`,
            lat: f.lat,
            lon: f.lon,
            url: safeUrl(f.t?.website || f.t?.['contact:website']),
          }
        : null,
      d
        ? {
            name: d.name,
            loc: placeLoc(d, area),
            time: times[f ? 2 : 1],
            category: `${d.c.e} Drinks`,
            lat: d.lat,
            lon: d.lon,
            url: safeUrl(d.t?.website || d.t?.['contact:website']),
          }
        : null,
    ].filter(Boolean) as VenueStop[];

    const steps = stopsList.map(
      (st) => `${st.time} – ${st.category} @ ${st.name} (${st.loc})`
    );

    combos.push({
      kind: 'combo' as const,
      name: THEMES[Math.floor(Math.random() * THEMES.length)].replace('{a}', area),
      loc: placeLoc(a, area),
      desc: `${stopsList.map((st) => (st.category || '').split(' ')[0]).join(' → ')} – ${stopsList.map((st) => st.name).join(' + ')}`,
      steps,
      stops: stopsList,
      lat: a.lat,
      lon: a.lon,
    });
  }

  const ctr = pool.cs[0];
  const spotsFormatted = spots.map((p) => ({
    kind: 'spot' as const,
    name: p.name,
    loc: placeLoc(p, area),
    desc: `${p.c.e} ${p.c.l} • ${miles(ctr, p).toFixed(1)} mi from ${ctr.name}`,
    url: safeUrl(p.t.website || p.t['contact:website']),
  }));

  return [...spotsFormatted, ...combos];
}
