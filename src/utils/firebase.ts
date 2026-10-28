import { AppState, OutingEvent } from '../types';
import { APP_VER, getStorage, setStorage, freshRoomState } from './storage';
import { dbUsesSignIn, getIdToken } from './auth';
import { sanitizeTheme } from './theme';

const EV_LISTS = ['venues', 'slots', 'exp', 'bounties', 'paid'] as const;

export const sid = (s?: string | number): string => String(s ?? '').replace(/[^\w-]/g, '');

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

// Mirror Firebase: nulls and empty objects/arrays don't exist there
function fb(x: any): any {
  if (Array.isArray(x)) {
    const a = x.map(fb).filter((v) => v != null);
    return a.length ? a : null;
  }
  if (x && typeof x === 'object') {
    const o: Record<string, any> = {};
    for (const [k, v] of Object.entries(x)) {
      const y = fb(v);
      if (y != null) o[k] = y;
    }
    return Object.keys(o).length ? o : null;
  }
  return x === undefined ? null : x;
}

function listTo(a?: any[] | null, k?: string, conv: (x: any) => any = (x) => x) {
  if (!a || !a.length) return null;
  const o: Record<string, any> = {};
  a.forEach((x, i) => {
    o[sid(x.id) || (k || 'item') + i] = fb({ ...conv(x), o: i });
  });
  return o;
}

export function toDb(s: AppState): any {
  const o = fb({ ...s, squad: null, ban: null, events: null }) || {};
  o.squad = listTo(s.squad, 'squad');
  o.ban = listTo(s.ban, 'ban');
  o.events = listTo(s.events, 'ev', (e: OutingEvent) => {
    const x: any = { ...e };
    EV_LISTS.forEach((k) => {
      x[k] = listTo(e[k], k);
    });
    return x;
  });
  ['squad', 'ban', 'events'].forEach((k) => {
    if (o[k] == null) delete o[k];
  });
  return o;
}

const REQ: Record<string, string> = {
  squad: 'name',
  ban: 'name',
  events: 'name',
  venues: 'name',
  slots: 'lbl',
  exp: 'ttl',
  bounties: 'uid',
  paid: 'from',
};

function listFrom(v: any, k: string): any[] {
  if (!v) return [];
  const arr = Array.isArray(v)
    ? v.filter(Boolean)
    : Object.entries(v)
        .map(([id, x]: [string, any]) => ({ ...x, id: x.id || id }))
        .sort((a, b) => (a.o ?? 0) - (b.o ?? 0));
  return arr.filter((x) => x && typeof x === 'object' && x[REQ[k]] != null);
}

export function fromDb(d: any): AppState {
  const o: any = { ...d };
  ['squad', 'ban', ...EV_LISTS].forEach((k) => {
    o[k] = listFrom(d[k], k);
  });
  o.events = listFrom(d.events, 'events').map((e: any) => {
    const x: any = { ...e };
    EV_LISTS.forEach((k) => {
      x[k] = listFrom(e[k], k);
    });
    x.slots = (x.slots || []).map((s: any) => ({ ...s, av: s.av || {} }));
    return x;
  });
  return normState(o);
}

export const normState = (d: any): AppState => ({
  ver: +d.ver || APP_VER,
  squad: d.squad || [],
  ban: (d.ban || []).filter((b: any) => !/greedy\s*banker/i.test(b?.name || '')),
  board: d.board || {},
  events: d.events || [],
  theme: sanitizeTheme(d.theme),
});

export function upgradeOldFormat(d: any): AppState {
  const plan = EV_LISTS.some((k) => (d[k] || []).length) || d.win;
  return {
    ...normState(d),
    ver: APP_VER,
    events: plan
      ? [
          {
            id: 'ev1',
            name: 'Our first plan',
            where: '',
            vibe: '',
            when: '',
            created: Date.now(),
            locked: null,
            win: d.win || null,
            mid: d.mid || null,
            venues: d.venues || [],
            slots: (d.slots || []).map((s: any) => ({ ...s, av: s.av || {} })),
            exp: d.exp || [],
            bounties: d.bounties || [],
            paid: d.paid || [],
          },
        ]
      : [],
  };
}

export function setPath(root: any, parts: string[], v: any): any {
  parts = parts.filter(Boolean);
  if (!parts.length) return v;
  root = root && typeof root === 'object' ? root : {};
  let o = root;
  parts.slice(0, -1).forEach((p) => {
    if (!o[p] || typeof o[p] !== 'object') o[p] = {};
    o = o[p];
  });
  const last = parts[parts.length - 1];
  if (v == null) delete o[last];
  else o[last] = v;
  return root;
}

export function diff(a: any, b: any, p: string, out: Record<string, any>): Record<string, any> {
  const obj = (x: any) => x && typeof x === 'object' && !Array.isArray(x);
  if (obj(a) && obj(b)) {
    new Set([...Object.keys(a),...Object.keys(b)]).forEach((k) =>
      diff(a[k], b[k], p + '/' + k, out)
    );
  } else if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) {
    out[p.slice(1)] = b ?? null;
  }
  return out;
}

export class FirebaseSync {
  private db: string;
  private rm: string;
  private onStateChange: (state: AppState) => void;
  private onStatusChange: (status: { ok: boolean | number; streaming: boolean; text: string }) => void;
  private es: EventSource | null = null;
  private serverMirror: any = null;
  private busy = 0;
  private touched = 0;
  private streaming = false;
  private skew = 0;
  private frozen = false;
  private streamGen = 0;
  private creating: Promise<void> | null = null;
  private renewTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    db: string,
    rm: string,
    onStateChange: (state: AppState) => void,
    onStatusChange: (status: { ok: boolean | number; streaming: boolean; text: string }) => void
  ) {
    this.db = db.replace(/\/$/, '');
    this.rm = rm;
    this.onStateChange = onStateChange;
    this.onStatusChange = onStatusChange;
  }

  public updateConfig(db: string, rm: string) {
    this.stop();
    this.db = db.replace(/\/$/, '');
    this.rm = rm;
    this.serverMirror = null;
    this.frozen = false;
    if (this.db) {
      this.syncClock();
      this.startStream();
      this.pull();
    }
  }

  public getSkew(): number {
    return this.skew;
  }

  public now(): number {
    return Date.now() + this.skew;
  }

  private roomKey(): string {
    return this.rm.replace(/\W/g, '');
  }

  private dbUrl(): string | null {
    return this.db ? `${this.db}/v2/rooms/${this.roomKey()}.json` : null;
  }

  private async authed(u: string): Promise<string> {
    if (!dbUsesSignIn(this.db)) return u;
    const token = await getIdToken();
    return token ? `${u}?auth=${encodeURIComponent(token)}` : u;
  }

  private oldUrl(): string | null {
    return this.db ? `${this.db}/rooms/${this.roomKey()}.json` : null;
  }

  private notifyStatus(ok: boolean | number) {
    if (this.frozen) return;
    const denied = ok === 401 || ok === 403;
    let text = '';
    if (ok === 1 || ok === true) {
      text = (this.streaming ? '⚡ Live: ' : '🟢 Live: ') + this.rm;
    } else if (denied) {
      text =
        this.roomKey().length < 12
          ? '🔒 Room code too short for your database rules – tap 🎲 in Setup'
          : '🔒 Database said no – check the rules in Firebase';
    } else {
      text = "🔴 Can't reach the database – retrying";
    }
    this.onStatusChange({ ok, streaming: this.streaming, text });
  }

  public async syncClock(): Promise<void> {
    if (!this.db) return;
    let dev = getStorage('dev', '');
    if (!dev) {
      dev = Math.random().toString(36).slice(2, 12);
      setStorage('dev', dev);
    }
    const u = `${this.db}/v2/clock/${dev}.json`;
    try {
      const t0 = Date.now();
      const r = await fetch(u, { method: 'PUT', body: '{\".sv\":\"timestamp\"}' });
      const t1 = Date.now();
      let v = await r.json();
      if (typeof v !== 'number') v = await (await fetch(u)).json();
      if (typeof v === 'number') this.skew = Math.round(v - (t0 + t1) / 2);
    } catch (e) {
      // ignore
    }
  }

  public async pull(): Promise<void> {
    const u = this.dbUrl();
    if (!u) return;
    const t0 = Date.now();
    try {
      const r = await fetch(await this.authed(u));
      if (!r.ok) return this.notifyStatus(r.status);
      const d = await r.json();
      if (this.busy || this.touched > t0) return;
      this.serverMirror = d;
      this.applyRemote();
      this.notifyStatus(1);
    } catch (e) {
      this.notifyStatus(0);
    }
  }

  public async startStream(): Promise<void> {
    this.stop();
    const u = this.dbUrl();
    if (!u || typeof window === 'undefined' || !window.EventSource) return;

    const gen = ++this.streamGen;
    const src = await this.authed(u);
    if (gen !== this.streamGen) return; // stopped or restarted while signing in
    this.es = new EventSource(src);
    // Sign-in tokens last an hour: reconnect with a fresh one before it runs out
    this.renewTimer = setTimeout(() => this.startStream(), 50 * 60 * 1000);
    const onEvt = (e: MessageEvent, isPatch: boolean) => {
      try {
        const { path, data } = JSON.parse(e.data);
        const base = String(path).split('/').filter(Boolean);
        this.streaming = true;
        if (isPatch) {
          Object.entries(data || {}).forEach(([k, v]) => {
            this.serverMirror = setPath(this.serverMirror, [...base, ...k.split('/').filter(Boolean)], v);
          });
        } else {
          this.serverMirror = setPath(this.serverMirror, base, data);
        }
        this.applyRemote();
        this.notifyStatus(1);
      } catch (err) {
        // ignore
      }
    };

    this.es.addEventListener('put', (e) => onEvt(e, false));
    this.es.addEventListener('patch', (e) => onEvt(e, true));
    this.es.addEventListener('cancel', () => this.stop());
    this.es.addEventListener('auth_revoked', () => this.startStream());
    this.es.onerror = () => {
      this.streaming = false;
      this.notifyStatus(0);
    };
  }

  public stop(): void {
    this.streamGen++;
    if (this.renewTimer) clearTimeout(this.renewTimer);
    this.renewTimer = null;
    if (this.es) {
      this.es.close();
      this.es = null;
    }
    this.streaming = false;
  }

  public async push(state: AppState, full = false): Promise<boolean> {
    this.touched = Date.now();
    const u = this.dbUrl();
    if (!u || this.frozen) return false;

    // Send changes rather than the whole room: once the room exists, the rules only accept field updates
    if (!full && !this.serverMirror) await this.pull();

    const dbData = toDb(state);
    let method = 'PATCH';
    let body: any;

    if (full || !this.serverMirror || ['squad', 'ban'].some((k) => Array.isArray(this.serverMirror[k]))) {
      method = 'PUT';
      body = dbData;
      this.serverMirror = clone(dbData);
    } else {
      // In a room with no squad yet, still add members one by one (squad/<id>): the rules
      // check each member's owner, so a write of the whole squad list is refused
      const mirror = this.serverMirror.squad || !dbData.squad ? this.serverMirror : { ...this.serverMirror, squad: {} };
      body = diff(mirror, dbData, '', {});
      if (!Object.keys(body).length) return true;
      Object.entries(body).forEach(([p, v]) => {
        this.serverMirror = setPath(this.serverMirror, p.split('/').filter(Boolean), v);
      });
    }

    this.busy++;
    try {
      const r = await fetch(await this.authed(u), { method, body: JSON.stringify(body) });
      // A refused room create is handled by createRoom (someone else got there first)
      if (r.ok || !full) this.notifyStatus(r.ok ? 1 : r.status);
      return r.ok;
    } catch (e) {
      this.notifyStatus(0);
      return false;
    } finally {
      this.busy--;
      if (!this.busy) this.applyRemote();
    }
  }

  private async applyRemote() {
    if (this.busy) return;
    if (!this.serverMirror) {
      return this.initRoom();
    }
    if ((+this.serverMirror.ver || 0) > APP_VER) {
      this.frozen = true;
      this.onStatusChange({ ok: false, streaming: false, text: '⬆️ New version out – reload the page' });
      return;
    }
    const d = fromDb(clone(this.serverMirror));
    if ((+this.serverMirror.ver || 0) < APP_VER) {
      const upgraded = upgradeOldFormat(d);
      this.onStateChange(upgraded);
      return this.push(upgraded, true);
    }
    const state = normState(d);
    this.onStateChange(state);
    try {
      setStorage('snap', JSON.stringify({ room: this.roomKey(), S: state }));
    } catch (e) {}
  }

  // Several start-up reads can find the room missing at once: create it only once
  private initRoom(): Promise<void> {
    if (!this.creating) this.creating = this.createRoom().finally(() => (this.creating = null));
    return this.creating;
  }

  private async createRoom() {
    let old: any = null;
    const oldEndpoint = this.oldUrl();
    if (oldEndpoint) {
      try {
        const r = await fetch(oldEndpoint);
        if (r.ok) old = await r.json();
      } catch (e) {}
    }

    const initial = old && old.squad ? upgradeOldFormat(fromDb(old)) : freshRoomState();
    this.onStateChange(initial);
    const ok = await this.push(initial, true);
    // Another phone created the room first: the rules refuse a second create, so load theirs
    if (!ok) {
      this.serverMirror = null;
      await this.pull();
    }
  }
}
