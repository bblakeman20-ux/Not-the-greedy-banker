import { AppConfig, AppState, OutingEvent, User, BanItem } from '../types';

const mem: Record<string, string> = {};

export const getStorage = (k: string, d: string = ''): string => {
  try {
    return localStorage.getItem(k) ?? d;
  } catch (e) {
    return mem[k] ?? d;
  }
};

export const setStorage = (k: string, v: string): void => {
  try {
    localStorage.setItem(k, v);
  } catch (e) {
    mem[k] = v;
  }
};

export const APP_VER = 3;
export const MAX_VETOES = 2;
export const BOUNTY_MS = 60000;

export const newEvent = (o: Partial<OutingEvent> = {}): OutingEvent => ({
  id: 'ev' + Date.now() + Math.random().toString(36).slice(2, 6),
  name: 'New event',
  where: '',
  vibe: '',
  when: '',
  created: Date.now(),
  locked: null,
  win: null,
  mid: null,
  venues: [],
  slots: [],
  exp: [],
  bounties: [],
  paid: [],
  ...o,
});

export const getSavedUserProfile = (): User | null => {
  try {
    const raw = getStorage('user_profile', '');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.name) return parsed;
    }
  } catch (e) {}
  return null;
};

export const saveUserProfile = (user: User): void => {
  try {
    setStorage('user_profile', JSON.stringify(user));
  } catch (e) {}
};

export const getInitialDemoState = (): AppState => {
  const profile = getSavedUserProfile();
  const squad: User[] = profile ? [{ ...profile, id: profile.id || 'u1' }] : [];

  return {
    ver: APP_VER,
    squad,
    ban: [],
    board: {},
    events: [],
  };
};

export const DEFAULT_FIREBASE_DB = (
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_FIREBASE_DATABASE_URL || import.meta.env.VITE_DEFAULT_FIREBASE_DB || '')
    : ''
).replace(/\/$/, '');

export const DEFAULT_GEMINI_KEY =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_DEFAULT_GEMINI_KEY || '')
    : '';

export const generateRoomCode = (): string => {
  const adjectives = [
    'epic', 'legendary', 'proper', 'classic', 'mega', 'friday', 'weekend', 'secret', 'great', 'ace', 'craft', 'golden'
  ];
  const nouns = [
    'squad', 'outing', 'pub-crawl', 'session', 'curry', 'darts', 'crew', 'rally', 'round', 'roast', 'lanes', 'night'
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const rand = Math.random().toString(36).slice(2, 6);
  return `squad-${adj}-${noun}-${rand}`;
};

export const getRecentRooms = (): string[] => {
  try {
    const raw = getStorage('recent_rooms', '[]');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

export const saveRecentRoom = (room: string): void => {
  if (!room || !room.trim()) return;
  const clean = room.trim();
  const current = getRecentRooms().filter((r) => r !== clean);
  const updated = [clean, ...current].slice(0, 6);
  setStorage('recent_rooms', JSON.stringify(updated));
};

export const removeRecentRoom = (room: string): string[] => {
  const current = getRecentRooms().filter((r) => r !== room);
  setStorage('recent_rooms', JSON.stringify(current));
  return current;
};

export const clearRecentRooms = (): void => {
  setStorage('recent_rooms', JSON.stringify([]));
};

export const freshRoomState = (creator?: User | null): AppState => {
  const profile = creator || getSavedUserProfile();
  const squad: User[] = profile ? [{ ...profile, id: profile.id || 'u1' }] : [];

  return {
    ver: APP_VER,
    squad,
    ban: [],
    board: {},
    events: [],
  };
};

export const loadInitialConfig = (): AppConfig => {
  const p = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const dbParam = p.get('db');
  const db = (dbParam || getStorage('db', DEFAULT_FIREBASE_DB)).replace(/\/$/, '');
  
  let rmParam = p.get('room');

  if (!rmParam) {
    // Visiting root link without a room -> automatically provision a fresh room!
    rmParam = generateRoomCode();
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('room', rmParam);
      window.history.replaceState({}, '', newUrl.pathname + newUrl.search + newUrl.hash);
    }
  }

  const rm = rmParam;
  saveRecentRoom(rm);

  let md = getStorage('md', 'gemini-flash-latest');
  // Auto-upgrade and purge legacy models from browser storage
  if (!md || /^gemini-(?:1\.5|2\.0|2\.5)/.test(md)) {
    md = 'gemini-flash-latest';
    setStorage('md', md);
  }
  const key = getStorage('key', DEFAULT_GEMINI_KEY);
  const savedProfile = getSavedUserProfile();
  const u = getStorage('u', savedProfile ? (savedProfile.id || 'u1') : '');
  const evKey = 'ev:' + (db ? rm.replace(/\W/g, '') : 'local');
  const ev = p.get('ev') || getStorage(evKey, '');

  if (dbParam) setStorage('db', db);
  setStorage('rm', rm);
  if (p.get('ev')) setStorage(evKey, ev);

  return { u, db, rm, md, key, ev };
};

export const gbp = (n: number | string): string => '£' + (+n || 0).toFixed(2);

export const normName = (n: string): string =>
  String(n || '')
    .toLowerCase()
    .replace(/\bthe\b/g, '')
    .replace(/[^a-z0-9]/g, '');

export const words = (n: string): string =>
  ' ' +
  String(n || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bthe\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() +
  ' ';

export const isBanned = (name: string, banList: BanItem[]): boolean => {
  if (/greedy\s*banker/i.test(name)) return false;
  return banList.some((b) => {
    if (/greedy\s*banker/i.test(b.name)) return false;
    const w = words(b.name);
    return Boolean(w.trim() && (words(name).includes(w) || normName(name) === normName(b.name)));
  });
};

export const safeUrl = (u?: string | null): string => {
  if (!u) return '';
  try {
    const x = new URL(String(u));
    return /^https?:$/.test(x.protocol) ? x.href : '';
  } catch (e) {
    return '';
  }
};

export const payUrl = (u: Partial<User>, amt?: number): string => {
  let l = String(u.payLink || '').trim();
  if (!l) return '';
  if (!/^[a-z]+:/i.test(l)) l = 'https://' + l;
  try {
    const x = new URL(l);
    if (!/^https?:$/.test(x.protocol)) return '';
    const h = x.hostname.replace(/^www\./, '');
    const one = x.pathname.split('/').filter(Boolean).length === 1;
    const p = x.pathname.replace(/\/$/, '');
    if (amt && one && h === 'monzo.me') x.pathname = p + '/' + amt.toFixed(2);
    if (amt && one && h === 'paypal.me') x.pathname = p + '/' + amt.toFixed(2) + 'GBP';
    return x.href;
  } catch (e) {
    return '';
  }
};

export const mailOk = (u: Partial<User>): boolean =>
  /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(u.payMail || '');

export const hasBank = (u: Partial<User>): boolean => Boolean(u.sort && u.acc);
export const hasPay = (u: Partial<User>): boolean => Boolean(u.payLink || u.payMail || hasBank(u));

export const copyStr = async (s: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch (e) {
    const t = document.createElement('textarea');
    t.value = s;
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  }
};
