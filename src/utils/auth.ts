// Anonymous Firebase sign-in over the REST API (no SDK). Each device gets a hidden
// account; the database rules use its uid so only you can change your pay details.
import { DEFAULT_FIREBASE_DB, getStorage, setStorage } from './storage';

// Public project identifier – safe in client code (not a secret)
export const FIREBASE_API_KEY = 'AIzaSyDPBrp78L7yIlqg027Li1ZH6igJJGPEdv0';

// Our own database (or a local emulator) checks sign-in; a custom database URL may belong
// to another project, so it is used without one.
export const dbUsesSignIn = (db: string): boolean =>
  db === DEFAULT_FIREBASE_DB || /^http:\/\/([\w-]+\.)*(localhost|127\.0\.0\.1)(:\d+)?$/.test(db);

interface Session {
  uid: string;
  idToken: string;
  refreshToken: string;
  exp: number; // ms epoch when idToken expires
}

const KEY = 'fbAuth';
let session: Session | null = null;
let pending: Promise<Session | null> | null = null;

const load = (): Session | null => {
  try {
    const s = JSON.parse(getStorage(KEY, 'null'));
    return s && s.uid && s.refreshToken ? s : null;
  } catch {
    return null;
  }
};

const save = (s: Session) => {
  session = s;
  setStorage(KEY, JSON.stringify(s));
};

async function signUp(): Promise<Session> {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!r.ok) throw new Error(`Anonymous sign-in failed (${r.status})`);
  const j = await r.json();
  return { uid: j.localId, idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + +j.expiresIn * 1000 };
}

async function refresh(s: Session): Promise<Session> {
  const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(s.refreshToken)}`,
  });
  if (!r.ok) throw Object.assign(new Error(`Token refresh failed (${r.status})`), { status: r.status });
  const j = await r.json();
  return { uid: j.user_id, idToken: j.id_token, refreshToken: j.refresh_token, exp: Date.now() + +j.expires_in * 1000 };
}

// A valid ID token for this device, signing in or refreshing as needed. Null if offline.
export async function getIdToken(): Promise<string | null> {
  session = session || load();
  if (session && session.exp - 60_000 > Date.now()) return session.idToken;
  if (!pending) {
    pending = (async () => {
      try {
        // Keep the same account (and uid) whenever possible: only start a new one when there's
        // no session or the old one is truly gone (400), never on a network blip
        save(
          session
            ? await refresh(session).catch((e) => (e.status === 400 ? signUp() : Promise.reject(e)))
            : await signUp()
        );
        return session;
      } catch (e) {
        console.warn('Firebase auth unavailable:', e);
        return null;
      } finally {
        pending = null;
      }
    })();
  }
  return (await pending)?.idToken || null;
}

// This device's account id, once signed in
export const getUid = (): string | null => (session || load())?.uid || null;
