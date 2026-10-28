// Checks database.rules.json against the Realtime Database emulator: run with `npm run test:rules`.
const NS = 'demo-pintdr';
const BASE = `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000'}`;
const ROOM = 'squad-epic-curry-x7k2ab9q';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (uid) => `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: uid, user_id: uid, aud: NS, iss: `https://securetoken.google.com/${NS}`, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, firebase: { sign_in_provider: 'anonymous' } })}.`;
const url = (path, uid) => `${BASE}/${path}.json?ns=${NS}${uid ? `&auth=${token(uid)}` : ''}`;
const req = async (method, path, body, uid) => (await fetch(url(path, uid), { method, body: body === undefined ? undefined : JSON.stringify(body) })).status;
let fails = 0;
const expect = async (name, p, want) => {
  const got = (await p) === 200;
  if (got !== want) fails++;
  console.log(got === want ? 'ok  ' : 'FAIL', want ? 'allowed' : 'denied ', '-', name);
};
const room = (p = '') => `v2/rooms/${ROOM}${p}`;

await fetch(`${BASE}/.settings/rules.json?ns=${NS}`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: (await import('fs')).readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8') });
await fetch(`${BASE}/.json?ns=${NS}`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });

await expect('signed-out write', req('PATCH', room(), { 'ban/x': { name: 'Spoons' } }), false);
await expect('create a new room', req('PUT', room(), { ver: 3, board: { a: 1 } }, 'ben'), true);
await expect('overwrite an existing room wholesale', req('PUT', room(), { ver: 3 }, 'sam'), false);
await expect('room code too short', req('PUT', 'v2/rooms/short', { ver: 3 }, 'ben'), false);
await expect('anyone can read with the link', req('GET', room()), true);

await expect('Ben adds himself as owner', req('PATCH', room(), { 'squad/ben': { name: 'Ben', owner: 'ben', sort: '11-11-11', acc: '11111111' } }, 'ben'), true);
await expect('Sam creates a profile owned by Ben', req('PATCH', room(), { 'squad/fake': { name: 'Ben', owner: 'ben' } }, 'sam'), false);
await expect("Sam changes Ben's sort code", req('PATCH', room(), { 'squad/ben/sort': '99-99-99' }, 'sam'), false);
await expect("Sam changes Ben's pay link", req('PATCH', room(), { 'squad/ben/payLink': 'monzo.me/sam' }, 'sam'), false);
await expect("Sam takes over Ben's ownership", req('PATCH', room(), { 'squad/ben/owner': 'sam' }, 'sam'), false);
await expect("Sam removes Ben's ownership", req('PATCH', room(), { 'squad/ben/owner': null }, 'sam'), false);
await expect("Sam deletes Ben's profile", req('PATCH', room(), { 'squad/ben': null }, 'sam'), false);
await expect("Sam sneaks Ben's account into a mixed update", req('PATCH', room(), { 'squad/ben/emo': '🎯', 'squad/ben/acc': '99999999' }, 'sam'), false);
await expect('Ben changes his own account number', req('PATCH', room(), { 'squad/ben/acc': '22222222', 'squad/ben/payAt': 1, 'squad/ben/payBy': 'ben' }, 'ben'), true);
await expect("Sam edits Ben's emoji / town (non-pay)", req('PATCH', room(), { 'squad/ben/emo': '🎯', 'squad/ben/loc': 'Rochester' }, 'sam'), true);
await expect('Sam votes, adds bans, changes the theme', req('PATCH', room(), { 'events/ev1/venues/v1/votes/sam': 'k', 'ban/b1/name': 'Spoons', 'theme/id': 'mono', 'board/sam/r': 1 }, 'sam'), true);
await expect('Sam lowers the room version', req('PATCH', room(), { ver: 1 }, 'sam'), false);

await expect('Ben adds a mate (no owner yet)', req('PATCH', room(), { 'squad/sam': { name: 'Sam' } }, 'ben'), true);
await expect('Sam claims his own profile', req('PATCH', room(), { 'squad/sam/owner': 'sam', 'squad/sam/claimedAt': 1 }, 'sam'), true);
await expect("Ben now edits Sam's bank details", req('PATCH', room(), { 'squad/sam/sort': '33-33-33' }, 'ben'), false);
await expect('Sam adds his own bank details', req('PATCH', room(), { 'squad/sam/sort': '33-33-33', 'squad/sam/acc': '33333333' }, 'sam'), true);
await expect('Ben deletes an unowned mate', (async () => { await req('PATCH', room(), { 'squad/temp': { name: 'Temp' } }, 'ben'); return req('PATCH', room(), { 'squad/temp': null }, 'sam'); })(), true);
await expect('Ben deletes his own profile', req('PATCH', room(), { 'squad/ben': null }, 'ben'), true);

// Old-format room upgrade (ver < 3) can still be rewritten once
await fetch(`${BASE}/${room().replace(ROOM, 'squad-old-room-abcd1234')}.json?ns=${NS}`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: JSON.stringify({ ver: 2, squad: [{ name: 'Old' }] }) });
await expect('upgrade an old-format room', req('PUT', 'v2/rooms/squad-old-room-abcd1234', { ver: 3, squad: { u1: { name: 'Old' } } }, 'sam'), true);

console.log(fails ? `\n${fails} FAILED` : '\nall rules behave as intended');
process.exit(fails ? 1 : 0);
