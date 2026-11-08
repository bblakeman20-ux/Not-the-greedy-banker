// Names of ideas this device has already been shown for a plan, so Gerg AI and the
// curated fallback can move on to new ones instead of repeating themselves.
import { getStorage, normName, setStorage } from './storage';

const MAX = 80;
const key = (eventId: string) => `seen:${eventId}`;

export const seenIdeas = (eventId: string): string[] => {
  try {
    const v = JSON.parse(getStorage(key(eventId), '[]'));
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

// Newest last; oldest names drop off once the list is full so it can't grow forever.
export const rememberIdeas = (eventId: string, names: Array<string | undefined>): void => {
  const fresh = names.filter((n): n is string => Boolean(n && n.trim()));
  if (!fresh.length) return;
  const seen = new Set(fresh.map(normName));
  const kept = seenIdeas(eventId).filter((n) => !seen.has(normName(n)));
  setStorage(key(eventId), JSON.stringify([...kept, ...fresh].slice(-MAX)));
};

export const forgetIdeas = (eventId: string): void => setStorage(key(eventId), '[]');
