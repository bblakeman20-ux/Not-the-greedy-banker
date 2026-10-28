export interface User {
  id: string;
  name: string;
  emo: string;
  loc: string;
  mode: string; // 'Train' | 'Uber Split' | 'Driver' | 'Walk'
  pay: string;
  payLink?: string;
  payMail?: string;
  acn?: string;
  sort?: string;
  acc?: string;
  tx?: string;
  payAt?: number; // when pay details last changed (see utils/payDetails)
  payBy?: string; // who changed them
  offersHouse?: boolean;
  houseNote?: string;
  isTraitor?: boolean;
  claimedDeviceId?: string;
  claimedAt?: number;
}

export interface BanItem {
  id: string;
  name: string;
  lock?: number; // 1 for eternal lock
}

export interface VenueStop {
  name: string;
  loc: string;
  time?: string;
  category?: string;
  lat?: number;
  lon?: number;
  url?: string;
}

export interface Venue {
  id: string;
  name: string;
  loc: string;
  desc: string;
  kind?: 'spot' | 'event' | 'combo';
  when?: string;
  cost?: string;
  url?: string;
  steps?: string[];
  stops?: VenueStop[];
  lat?: number;
  lon?: number;
  live?: number;
  src?: string;
  votes?: Record<string, 'k' | 'p' | 'v' | null>;
}

export interface Slot {
  id: string;
  lbl: string;
  at?: string | null;
  date?: string; // "YYYY-MM-DD"
  time?: string; // "HH:MM"
  av?: Record<string, number | null>;
}

export interface Expense {
  id: string;
  ttl: string;
  amt: number;
  by: string;
  byId?: string;
  for?: Record<string, number>;
}

export interface Bounty {
  id: string;
  uid: string;
  vid?: string;
  vname?: string;
  until: number;
  done?: number;
  with?: string;
  hide?: number;
}

export interface PaidRecord {
  id: string;
  from: string;
  to: string;
  amt: number;
  at: number;
}

export interface Midpoint {
  lat: number;
  lon: number;
  name: string;
  pts?: Record<string, { lat: number; lon: number }>;
  locs?: string;
  vid?: string | null;
  v?: { lat: number; lon: number } | null;
}

export interface OutingEvent {
  id: string;
  name: string;
  where: string;
  vibe: string;
  when: string;
  budget?: string;
  created: number;
  locked: number | null;
  win: string | null;
  mid: Midpoint | null;
  venues: Venue[];
  slots: Slot[];
  exp: Expense[];
  bounties: Bounty[];
  paid: PaidRecord[];
  by?: string;
  traitors?: string[];
  swipePool?: Record<string, { venue: Partial<Venue>; likes: string[]; timestamp: number }>;
  planVetoes?: Record<string, number>;
}

export interface RoomTheme {
  id: string; // preset id, or 'custom'
  bg: string;
  surface: string;
  text: string;
  primary: string;
  secondary?: string; // optional 5th colour; falls back to primary
  font?: 'pixel'; // optional heading style
  by?: string; // name of whoever last changed it
  at?: number;
}

export interface AppState {
  ver: number;
  squad: User[];
  ban: BanItem[];
  board: Record<string, { r: number; m: number }>;
  events: OutingEvent[];
  theme?: RoomTheme;
}

// local: no database configured · live: synced · error: database unreachable or refused
export type SyncState = 'local' | 'live' | 'error';

export interface AppConfig {
  u: string;
  db: string;
  rm: string;
  md: string;
  key: string;
  ev: string;
}
