import { describe, expect, it } from 'vitest';
import { diff, fromDb, toDb } from '../firebase';
import { newEvent } from '../storage';
import { AppState } from '../../types';

const state = (): AppState => ({
  ver: 3,
  squad: [
    { id: 'u1', name: 'Ann', emo: '🍺', loc: 'Rochester', mode: 'Train', pay: 'Monzo' },
    { id: 'u2', name: 'Ben', emo: '🍻', loc: 'Chatham', mode: 'Walk', pay: 'PayPal' },
  ],
  ban: [{ id: 'b1', name: 'Spoons' }],
  board: { u1: { r: 1, m: 0 } },
  events: [
    newEvent({
      id: 'ev1',
      name: 'Friday',
      created: 1,
      venues: [
        { id: 'v1', name: 'Tap Room', loc: 'Rochester', desc: '', votes: { u1: 'k', u2: 'p' } },
        { id: 'v2', name: 'Axe Bar', loc: 'Chatham', desc: '' },
      ],
      slots: [{ id: 's1', lbl: 'Fri 7pm', av: { u1: 1 } }],
      exp: [{ id: 'e1', ttl: 'Round', amt: 12.5, by: 'Ann', byId: 'u1' }],
    }),
  ],
  theme: { id: 'midnight', bg: '#0b1020', surface: '#141a2e', text: '#eef1ff', primary: '#7c9cff' },
});

describe('Firebase round trip', () => {
  it('keeps the room intact through toDb → fromDb', () => {
    const s = state();
    const back = fromDb(JSON.parse(JSON.stringify(toDb(s))));
    expect(back.squad.map((u) => u.name)).toEqual(['Ann', 'Ben']);
    expect(back.events[0].venues.map((v) => v.name)).toEqual(['Tap Room', 'Axe Bar']);
    expect(back.events[0].venues[0].votes).toEqual({ u1: 'k', u2: 'p' });
    expect(back.events[0].exp[0].amt).toBe(12.5);
    expect(back.events[0].slots[0].av).toEqual({ u1: 1 });
    expect(back.theme).toEqual(s.theme);
    expect(back.ban.map((b) => b.name)).toEqual(['Spoons']);
  });

  it('stores lists keyed by id so concurrent edits do not clobber each other', () => {
    const db = toDb(state());
    expect(Object.keys(db.squad)).toEqual(['u1', 'u2']);
    expect(Object.keys(db.events.ev1.venues)).toEqual(['v1', 'v2']);
  });

  it('drops list items that are missing their required field', () => {
    const db = toDb(state());
    db.events.ev1.venues.junk = { loc: 'nowhere' };
    expect(fromDb(db).events[0].venues).toHaveLength(2);
  });

  it('sends only what changed', () => {
    const a = state();
    const b = state();
    b.events[0].venues[1].votes = { u2: 'k' };
    expect(diff(toDb(a), toDb(b), '', {})).toEqual({ 'events/ev1/venues/v2/votes': { u2: 'k' } });
  });

  it('deletes removed fields with null', () => {
    const a = state();
    const b = state();
    b.events[0].venues = b.events[0].venues.slice(0, 1);
    delete b.theme;
    expect(diff(toDb(a), toDb(b), '', {})).toEqual({ 'events/ev1/venues/v2': null, theme: null });
  });
});
