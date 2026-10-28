import { describe, expect, it } from 'vitest';
import {
  BOUNTY_MS,
  TRAITOR_TAX,
  addUnvoted,
  hideBounty,
  liveBountiesFor,
  rankVenues,
  removeVenue,
  shortlist,
  swipeRight,
  toggleVote,
  toggleWinner,
  trimSoloPitches,
  vetoWinner,
  vetoesLeft,
  visibleBounties,
} from '../eventActions';
import { MAX_VETOES, newEvent } from '../storage';
import { OutingEvent, User, Venue } from '../../types';

const u = (id: string, name: string): User => ({ id, name, emo: '🍺', loc: '', mode: 'Train', pay: '' });
const ann = u('a', 'Ann');
const ben = u('b', 'Ben');
const cal = u('c', 'Cal');
const squad = [ann, ben, cal];
const NOW = 1_000_000;

const venue = (id: string, name: string, votes: Venue['votes'] = {}): Venue => ({ id, name, loc: 'Rochester', desc: '', votes });
const plan = (o: Partial<OutingEvent> = {}) => newEvent({ id: 'ev', name: 'Friday', ...o });
const frozen = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

describe('voting', () => {
  it('toggles keen on and off', () => {
    const ev = plan({ venues: [venue('v1', 'Tap Room')] });
    const on = toggleVote(ev, 'v1', ann, 'k')!;
    expect(on.on).toBe(true);
    expect(on.event.venues[0].votes).toEqual({ a: 'k' });
    const off = toggleVote(on.event, 'v1', ann, 'k')!;
    expect(off.on).toBe(false);
    expect(off.event.venues[0].votes).toEqual({ a: null });
  });

  it('switches from keen to pass', () => {
    const ev = plan({ venues: [venue('v1', 'Tap Room', { a: 'k' })] });
    expect(toggleVote(ev, 'v1', ann, 'p')!.event.venues[0].votes).toEqual({ a: 'p' });
  });

  it('charges the traitor tax for going keen on The Greedy Banker, once per vote', () => {
    const ev = plan({ venues: [venue('v1', 'The Greedy Banker')] });
    const res = toggleVote(ev, 'v1', ann, 'k')!;
    expect(res.taxed).toBe(true);
    expect(res.event.exp).toHaveLength(1);
    expect(res.event.exp[0]).toMatchObject({ amt: TRAITOR_TAX, byId: 'a' });
    expect(res.event.traitors).toEqual(['a']);
    // removing the vote does not charge again
    expect(toggleVote(res.event, 'v1', ann, 'k')!.event.exp).toHaveLength(1);
  });

  it('never edits the event it was given', () => {
    const ev = plan({ venues: [venue('v1', 'Tap Room')] });
    const before = frozen(ev);
    toggleVote(ev, 'v1', ann, 'k');
    expect(ev).toEqual(before);
  });

  it('ignores unknown venues', () => {
    expect(toggleVote(plan(), 'nope', ann, 'k')).toBeNull();
  });
});

describe('ranking', () => {
  it('puts the winner first, then by net score, and sorts into tiers', () => {
    const ev = plan({
      win: 'w',
      venues: [
        venue('solo', 'Solo', { a: 'k' }),
        venue('cold', 'Cold', { a: 'p', b: 'p' }),
        venue('hot', 'Hot', { a: 'k', b: 'k' }),
        venue('w', 'Winner'),
      ],
    });
    const r = rankVenues(ev, squad);
    expect(r.sorted.map((v) => v.id)).toEqual(['w', 'hot', 'solo', 'cold']);
    expect(r.top.map((v) => v.id)).toEqual(['w', 'hot']);
    expect(r.solo.map((v) => v.id)).toEqual(['solo']);
    expect(r.cold.map((v) => v.id)).toEqual(['cold']);
  });

  it('ignores votes from people no longer in the squad', () => {
    const ev = plan({ venues: [venue('v', 'Ghosted', { z: 'k', y: 'k' })] });
    expect(rankVenues(ev, squad).solo.map((v) => v.id)).toEqual(['v']);
  });
});

describe('winner and vetoes', () => {
  it('picks and unpicks the winner', () => {
    const ev = plan({ venues: [venue('v1', 'Tap Room')] });
    const picked = toggleWinner(ev, 'v1');
    expect(picked).toMatchObject({ picked: true, event: { win: 'v1' } });
    expect(toggleWinner(picked.event, 'v1')).toMatchObject({ picked: false, event: { win: null } });
  });

  it('vetoing the decided plan costs a token, unlocks it and starts a bounty clock', () => {
    const ev = plan({ win: 'v1', locked: 1, venues: [venue('v1', 'Tap Room', { a: 'k' })] });
    const after = vetoWinner(ev, ev.venues[0], 'a', NOW);
    expect(after.win).toBeNull();
    expect(after.locked).toBeNull();
    expect(after.venues[0].votes).toEqual({ a: 'p' });
    expect(after.bounties[0]).toMatchObject({ uid: 'a', vid: 'v1', vname: 'Tap Room', until: NOW + BOUNTY_MS });
    expect(vetoesLeft(after, 'a')).toBe(MAX_VETOES - 1);
    expect(liveBountiesFor(after, 'a', NOW + 1)).toHaveLength(1);
    expect(liveBountiesFor(after, 'a', NOW + BOUNTY_MS)).toHaveLength(0);
  });

  it('shows others your running clock, and everyone an expired unpaid one until hidden', () => {
    const ev = vetoWinner(plan({ venues: [venue('v1', 'Tap Room')] }), venue('v1', 'Tap Room'), 'a', NOW);
    expect(visibleBounties(ev, 'a', NOW + 1)).toHaveLength(0);
    expect(visibleBounties(ev, 'b', NOW + 1)).toHaveLength(1);
    expect(visibleBounties(ev, 'a', NOW + BOUNTY_MS)).toHaveLength(1);
    const hidden = hideBounty(ev, ev.bounties[0].id);
    expect(visibleBounties(hidden, 'a', NOW + BOUNTY_MS)).toHaveLength(0);
  });
});

describe('shortlisting', () => {
  it('adds every idea when shortlisting several at once', () => {
    const res = shortlist(plan(), ann, [{ name: 'One' }, { name: 'Two' }, { name: 'Three' }], NOW);
    expect(res.event.venues.map((v) => v.name)).toEqual(['One', 'Two', 'Three']);
    res.event.venues.forEach((v) => expect(v.votes).toEqual({ a: 'k' }));
  });

  it('replaces a same-named venue but keeps its earlier votes', () => {
    const ev = plan({ venues: [venue('old', 'The Tap Room', { b: 'k', c: 'p' })] });
    const res = shortlist(ev, ann, [{ name: 'Tap Room', desc: 'fresh' }], NOW);
    expect(res.event.venues).toHaveLength(1);
    expect(res.event.venues[0].votes).toEqual({ b: 'k', c: 'p', a: 'k' });
  });

  it('redeems a running veto bounty without editing the original', () => {
    const vetoed = vetoWinner(plan({ venues: [venue('v1', 'Spoons')] }), venue('v1', 'Spoons'), 'a', NOW);
    const before = frozen(vetoed);
    const res = shortlist(vetoed, ann, [{ name: 'Axe Bar' }], NOW + 10);
    expect(res.redeemed).toHaveLength(1);
    expect(res.event.bounties[0]).toMatchObject({ done: 1, with: 'Axe Bar' });
    expect(res.event.venues[0].desc).toMatch(/Veto Bounty replacement for Spoons/);
    expect(vetoed).toEqual(before);
  });

  it('can make the new venue the winner', () => {
    const res = shortlist(plan(), ann, [{ name: 'Superlike' }], NOW, { makeWinner: true });
    expect(res.event.win).toBe(res.added[0].id);
  });

  it('adds map rolls with no votes and no traitor tax', () => {
    const res = addUnvoted(plan(), ann, [{ name: 'The Greedy Banker' }, { name: 'Brewery' }], NOW);
    expect(res.event.venues.map((v) => v.votes)).toEqual([{}, {}]);
    expect(res.event.exp).toHaveLength(0);
  });
});

describe('swiping right', () => {
  it('goes straight on the list in a solo room', () => {
    const res = swipeRight(plan(), ann, { name: 'Tap Room' }, { roomSize: 1, now: NOW });
    expect(res.outcome).toBe('shortlisted');
    expect(res.event.venues[0].name).toBe('Tap Room');
  });

  it('waits in the pool for a second like, then lands with both votes', () => {
    const first = swipeRight(plan(), ann, { name: 'Tap Room', votes: { a: 'k' } }, { roomSize: 3, now: NOW });
    expect(first.outcome).toBe('pooled');
    expect(first.event.venues).toHaveLength(0);
    expect(swipeRight(first.event, ann, { name: 'Tap Room' }, { roomSize: 3, now: NOW }).outcome).toBe('already');

    const match = swipeRight(first.event, ben, { name: 'Tap Room', votes: { b: 'k' } }, { roomSize: 3, now: NOW });
    expect(match.outcome).toBe('match');
    expect(match.event.venues[0].votes).toEqual({ a: 'k', b: 'k' });
    expect(match.event.swipePool).toEqual({});
    expect(rankVenues(match.event, squad).top).toHaveLength(1);
  });

  it('a superlike shortlists and crowns it immediately', () => {
    const res = swipeRight(plan(), ann, { name: 'Wow' }, { roomSize: 3, makeWinner: true, now: NOW });
    expect(res.outcome).toBe('shortlisted');
    expect(res.event.win).toBe(res.venue!.id);
  });
});

describe('tidying', () => {
  it('removes a venue and clears it as winner', () => {
    const ev = plan({ win: 'v1', venues: [venue('v1', 'A'), venue('v2', 'B')] });
    const after = removeVenue(ev, 'v1');
    expect(after.venues.map((v) => v.id)).toEqual(['v2']);
    expect(after.win).toBeNull();
  });

  it('trims seconder-less pitches but keeps the winner and backed ones', () => {
    const ev = plan({
      win: 'w',
      venues: [venue('w', 'Winner'), venue('solo', 'Solo', { a: 'k' }), venue('two', 'Two', { a: 'k', b: 'k' }), venue('none', 'None')],
    });
    const res = trimSoloPitches(ev);
    expect(res.removed).toBe(2);
    expect(res.event.venues.map((v) => v.id)).toEqual(['w', 'two']);
  });
});
