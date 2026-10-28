// Pure plan mutations: each takes the current event and returns a new one, never
// editing the original. Components decide what to show the user from the result.
import { Bounty, OutingEvent, User, Venue } from '../types';
import { MAX_VETOES, normName } from './storage';

export const TRAITOR_TAX = 5;
export const BOUNTY_MS = 60000;

export const isTraitorPick = (name?: string): boolean => /greedy\s*banker/i.test(name || '');

export const newId = (prefix = 'v'): string => prefix + Date.now() + Math.random().toString(36).slice(2, 6);

type VoteMark = 'k' | 'p' | 'v' | null;

// ---------- Reading ----------

export const vetoesUsed = (event: OutingEvent, uid?: string): number =>
  uid
    ? Math.max(event.planVetoes?.[uid] || 0, (event.bounties || []).filter((b) => b.uid === uid).length)
    : 0;

export const vetoesLeft = (event: OutingEvent, uid?: string): number =>
  Math.max(0, MAX_VETOES - vetoesUsed(event, uid));

export const liveBountiesFor = (event: OutingEvent, uid: string | undefined, now: number): Bounty[] =>
  (event.bounties || []).filter((b) => uid && b.uid === uid && !b.done && now < b.until);

// Bounties other people can see: someone else's running clock, or anyone's that ran out unredeemed
export const visibleBounties = (event: OutingEvent, uid: string | undefined, now: number): Bounty[] =>
  (event.bounties || []).filter(
    (b) => (!b.done && now < b.until && b.uid !== uid) || (!b.done && now >= b.until && !b.hide)
  );

export interface VenueScores {
  keenCount: number;
  passCount: number;
  netScore: number;
}

export const venueScores = (v: Venue, squad: User[]): VenueScores => {
  const vt = v.votes || {};
  const keenCount = squad.filter((u) => vt[u.id] === 'k').length;
  const passCount = squad.filter((u) => vt[u.id] === 'p' || vt[u.id] === 'v').length;
  return { keenCount, passCount, netScore: keenCount - passCount };
};

export interface RankedVenues {
  sorted: Venue[]; // winner first, then net score, then keen count
  cold: Venue[]; // 0 keen and 2+ passes
  active: Venue[]; // everything not cold
  top: Venue[]; // winner or 2+ keen
  solo: Venue[]; // active with fewer than 2 keen
}

export function rankVenues(event: OutingEvent, squad: User[]): RankedVenues {
  const score = new Map(event.venues.map((v) => [v.id, venueScores(v, squad)]));
  const s = (v: Venue) => score.get(v.id)!;
  const sorted = [...event.venues].sort((a, b) => {
    const aWin = event.win === a.id ? 1 : 0;
    const bWin = event.win === b.id ? 1 : 0;
    if (aWin !== bWin) return bWin - aWin;
    if (s(a).netScore !== s(b).netScore) return s(b).netScore - s(a).netScore;
    return s(b).keenCount - s(a).keenCount;
  });
  const cold = sorted.filter((v) => event.win !== v.id && s(v).keenCount === 0 && s(v).passCount >= 2);
  const active = sorted.filter((v) => !cold.includes(v));
  const top = active.filter((v) => event.win === v.id || s(v).keenCount >= 2);
  const solo = active.filter((v) => !top.includes(v));
  return { sorted, cold, active, top, solo };
}

// ---------- Building blocks ----------

// Picking The Greedy Banker marks you a traitor and logs a £5 round on your tab.
function traitorTax(event: OutingEvent, user: User, name?: string) {
  if (!isTraitorPick(name)) return { exp: event.exp || [], traitors: event.traitors || [], taxed: false };
  return {
    exp: [
      ...(event.exp || []),
      { id: newId('exp_'), ttl: '🐍 Traitor Tax (The Greedy Banker)', amt: TRAITOR_TAX, by: user.name, byId: user.id },
    ],
    traitors: Array.from(new Set([...(event.traitors || []), user.id])),
    taxed: true,
  };
}

// Pitching anything while your veto clock runs redeems your bounty.
function redeem(event: OutingEvent, uid: string, now: number, withName: string) {
  const live = new Set(liveBountiesFor(event, uid, now).map((b) => b.id));
  const redeemed: Bounty[] = [];
  const bounties = (event.bounties || []).map((b) => {
    if (!live.has(b.id)) return b;
    const done = { ...b, done: 1, with: withName };
    redeemed.push(done);
    return done;
  });
  return { bounties, redeemed };
}

const bountyDesc = (redeemed: Bounty[]) => `🎯 Veto Bounty replacement for ${redeemed[0]?.vname}`;

// ---------- Votes & winner ----------

export interface VoteResult {
  event: OutingEvent;
  on: boolean; // the vote is now set (false = removed)
  taxed: boolean;
  venue: Venue;
}

export function toggleVote(event: OutingEvent, venueId: string, user: User, type: 'k' | 'p'): VoteResult | null {
  const venue = event.venues.find((v) => v.id === venueId);
  if (!venue) return null;
  const current = (venue.votes || {})[user.id];
  const on = type === 'k' ? current !== 'k' : current !== 'p' && current !== 'v';
  const tax = type === 'k' && on ? traitorTax(event, user, venue.name) : traitorTax(event, user);
  const mark: VoteMark = on ? type : null;
  return {
    event: {
      ...event,
      venues: event.venues.map((v) => (v.id === venueId ? { ...v, votes: { ...(v.votes || {}), [user.id]: mark } } : v)),
      exp: tax.exp,
      traitors: tax.traitors,
    },
    on,
    taxed: tax.taxed,
    venue,
  };
}

export function toggleWinner(event: OutingEvent, venueId: string): { event: OutingEvent; picked: boolean } {
  const picked = event.win !== venueId;
  return { event: { ...event, win: picked ? venueId : null }, picked };
}

// Spending a veto on the decided plan: costs a token, dethrones it and starts your bounty clock.
export function vetoWinner(event: OutingEvent, venue: Venue, uid: string, now: number): OutingEvent {
  return {
    ...event,
    win: null,
    locked: null,
    venues: event.venues.map((v) => (v.id === venue.id ? { ...v, votes: { ...(v.votes || {}), [uid]: 'p' } } : v)),
    bounties: [...(event.bounties || []), { id: newId('bty_'), uid, vid: venue.id, vname: venue.name, until: now + BOUNTY_MS }],
    planVetoes: { ...(event.planVetoes || {}), [uid]: vetoesUsed(event, uid) + 1 },
  };
}

export const hideBounty = (event: OutingEvent, id: string): OutingEvent => ({
  ...event,
  bounties: (event.bounties || []).map((b) => (b.id === id ? { ...b, hide: 1 } : b)),
});

// ---------- Adding & removing venues ----------

export function removeVenue(event: OutingEvent, venueId: string): OutingEvent {
  return {
    ...event,
    venues: event.venues.filter((v) => v.id !== venueId),
    win: event.win === venueId ? null : event.win,
  };
}

export interface AddResult {
  event: OutingEvent;
  added: Venue[];
  redeemed: Bounty[];
  taxed: boolean;
}

// Shortlist one or more ideas in a single update (so "Shortlist all" keeps every idea).
// The user is recorded as keen; same-named venues already on the list are replaced.
export function shortlist(
  event: OutingEvent,
  user: User,
  ideas: Partial<Venue>[],
  now: number,
  opts: { dedupe?: boolean; makeWinner?: boolean; votes?: Record<string, VoteMark>; plain?: boolean } = {}
): AddResult {
  // plain: map rolls – nobody voted, so no traitor tax and no bounty wording on the card
  const named = ideas.filter((i) => i.name);
  if (!named.length) return { event, added: [], redeemed: [], taxed: false };
  const { bounties, redeemed } = redeem(event, user.id, now, named[0].name!);
  let exp = event.exp || [];
  let traitors = event.traitors || [];
  let taxed = false;
  const dedupe = opts.dedupe !== false;
  const existing = new Map(event.venues.map((v) => [normName(v.name), v]));
  const added = named.map((idea, i) => {
    if (!opts.plain) {
      const t = traitorTax({ ...event, exp, traitors }, user, idea.name);
      exp = t.exp;
      traitors = t.traitors;
      taxed = taxed || t.taxed;
    }
    // Re-adding a venue already on the list keeps everyone's earlier votes
    const prior = dedupe ? existing.get(normName(idea.name!)) : undefined;
    return {
      ...idea,
      id: newId(),
      name: idea.name!,
      loc: idea.loc || '',
      kind: idea.kind || 'spot',
      desc: redeemed.length && i === 0 && !opts.plain ? bountyDesc(redeemed) : idea.desc || '',
      votes: { ...(prior?.votes || {}), ...(opts.votes || { [user.id]: 'k' }) },
    } as Venue;
  });
  const names = new Set(added.map((v) => normName(v.name)));
  const kept = dedupe ? event.venues.filter((v) => !names.has(normName(v.name))) : event.venues;
  return {
    event: {
      ...event,
      venues: [...added, ...kept],
      win: opts.makeWinner ? added[0].id : event.win,
      bounties,
      exp,
      traitors,
    },
    added,
    redeemed,
    taxed,
  };
}

// Map rolls go on the list with no votes yet.
export function addUnvoted(event: OutingEvent, user: User, venues: Partial<Venue>[], now: number): AddResult {
  return shortlist(event, user, venues, now, { dedupe: false, votes: {}, plain: true });
}

export type SwipeOutcome = 'shortlisted' | 'match' | 'pooled' | 'already';

export interface SwipeResult {
  event: OutingEvent;
  outcome: SwipeOutcome;
  venue?: Venue;
  taxed: boolean;
}

// Swipe right: solo rooms and superlikes go straight on the list; otherwise a venue
// waits in the swipe pool until a second squad member likes it too.
export function swipeRight(
  event: OutingEvent,
  user: User,
  data: Partial<Venue>,
  opts: { roomSize: number; makeWinner?: boolean; now: number }
): SwipeResult {
  if (opts.roomSize < 2 || opts.makeWinner) {
    const res = shortlist(event, user, [{ src: data.live ? undefined : 'osm', ...data }], opts.now, {
      makeWinner: opts.makeWinner,
    });
    return { event: res.event, outcome: 'shortlisted', venue: res.added[0], taxed: res.taxed };
  }

  const key = normName(data.name || '');
  const pool = { ...(event.swipePool || {}) };
  const waiting = pool[key];

  if (!waiting) {
    const t = traitorTax(event, user, data.name);
    pool[key] = { venue: data, likes: [user.id], timestamp: opts.now };
    return { event: { ...event, swipePool: pool, exp: t.exp, traitors: t.traitors }, outcome: 'pooled', taxed: t.taxed };
  }
  if ((waiting.likes || []).includes(user.id)) return { event, outcome: 'already', taxed: false };

  // Squad match: everyone who liked it is keen
  delete pool[key];
  const votes: Record<string, VoteMark> = {};
  [...(waiting.likes || []), user.id].forEach((uid) => (votes[uid] = 'k'));
  const res = shortlist({ ...event, swipePool: pool }, user, [{ src: 'osm', ...waiting.venue, ...data }], opts.now, { votes });
  return { event: res.event, outcome: 'match', venue: res.added[0], taxed: res.taxed };
}

// Drop seconder-less pitches (1 keen or fewer, no vetoes), keeping the winner.
export function trimSoloPitches(event: OutingEvent): { event: OutingEvent; removed: number } {
  const remove = new Set(
    event.venues
      .filter((v) => {
        if (v.id === event.win) return false;
        const marks = Object.values(v.votes || {});
        return marks.filter((x) => x === 'k').length <= 1 && !marks.includes('v');
      })
      .map((v) => v.id)
  );
  return { event: { ...event, venues: event.venues.filter((v) => !remove.has(v.id)) }, removed: remove.size };
}
