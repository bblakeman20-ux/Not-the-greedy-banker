import { BanItem, OutingEvent, Venue } from '../types';
import { fetchPlaces, miles } from './osm';
import { getLocalCuratedIdeas } from './localPlaces';
import { isBanned, normName, safeUrl } from './storage';

export interface MapRoll {
  venues: Partial<Venue>[];
  curated: boolean; // map unreachable – these came from the hand-checked UK list
}

// Up to `count` real venues near `where` that aren't banned or already on the plan.
export async function rollMapSpots(
  event: OutingEvent,
  banList: BanItem[],
  where: string,
  vibe: string,
  onProgress?: (msg: string) => void,
  count = 3
): Promise<MapRoll> {
  const existing = new Set(event.venues.map((v) => normName(v.name)));
  try {
    const pool = await fetchPlaces(where, vibe, banList, onProgress);
    const area = where.split(/\s*(?:,|\bor\b|&)\s*/i)[0].replace(/\b\w/g, (c) => c.toUpperCase());
    const center = pool.cs[0];
    const picked = pool.places
      .filter((p) => p.name && !isBanned(p.name, banList) && !existing.has(normName(p.name)))
      .slice(0, count);

    const venues = picked.map((p) => {
      const street = p.t['addr:street'];
      const house = p.t['addr:housenumber'] || p.t['addr:housename'];
      const town = p.t['addr:town'] || p.t['addr:city'] || p.t['addr:suburb'] || area;
      const streetPart = house && street ? `${house} ${street}` : street || '';
      const dist = center ? miles(center, p) : undefined;
      const details = [
        p.c.l,
        p.t.brewery ? `Brewery: ${p.t.brewery}` : '',
        p.t.cuisine ? `Cuisine: ${p.t.cuisine.replace(/;/g, ', ')}` : '',
        p.t.outdoor_seating === 'yes' ? 'Beer garden' : '',
        dist != null ? `${dist.toFixed(1)} mi from ${area}` : '',
      ]
        .filter(Boolean)
        .join(' • ');
      return {
        name: p.name,
        loc: [streetPart, town, p.t['addr:postcode']].filter(Boolean).join(', ') || area,
        desc: `${p.c.e} ${details}`,
        kind: 'spot' as const,
        url: safeUrl(p.t.website || p.t['contact:website']),
        lat: p.lat,
        lon: p.lon,
        src: 'osm',
      };
    });
    return { venues, curated: false };
  } catch {
    // Offline / rate-limited: fall back to the curated list of real UK spots
    const venues = getLocalCuratedIdeas(where, vibe, banList, existing, count).map((x) => ({
      name: x.name || 'Venue',
      loc: x.loc || '',
      desc: x.desc || '',
      kind: x.kind || 'spot',
      steps: x.steps,
      url: x.url,
      src: 'osm',
    }));
    return { venues, curated: true };
  }
}
