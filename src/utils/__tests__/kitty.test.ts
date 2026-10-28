import { describe, expect, it } from 'vitest';
import { calculateLedger, calculateSettlement } from '../kitty';
import { newEvent } from '../storage';
import { Expense, PaidRecord, User } from '../../types';

const squad: User[] = [
  { id: 'a', name: 'Ann', emo: '🍺', loc: '', mode: 'Train', pay: '' },
  { id: 'b', name: 'Ben', emo: '🍻', loc: '', mode: 'Train', pay: '' },
  { id: 'c', name: 'Cal', emo: '🍹', loc: '', mode: 'Train', pay: '' },
];

const ev = (exp: Expense[], paid: PaidRecord[] = []) => newEvent({ exp, paid });
const sum = (r: Record<string, number>) => Object.values(r).reduce((x, y) => x + y, 0);

describe('calculateLedger', () => {
  it('splits an expense evenly across the whole squad by default', () => {
    const { bal, share, tot } = calculateLedger(ev([{ id: 'e1', ttl: 'Round', amt: 30, by: 'Ann', byId: 'a' }]), squad);
    expect(tot).toBe(30);
    expect(share).toEqual({ a: 10, b: 10, c: 10 });
    expect(bal).toEqual({ a: 20, b: -10, c: -10 });
  });

  it('splits only between the people ticked in "for"', () => {
    const { bal } = calculateLedger(
      ev([{ id: 'e1', ttl: 'Uber', amt: 20, by: 'Ben', byId: 'b', for: { b: 1, c: 1 } }]),
      squad
    );
    expect(bal).toEqual({ a: 0, b: 10, c: -10 });
  });

  it('falls back to matching the payer by name for old expenses', () => {
    const { bal } = calculateLedger(ev([{ id: 'e1', ttl: 'Tickets', amt: 9, by: 'Cal' }]), squad);
    expect(bal.c).toBeCloseTo(6);
  });

  it('ignores expenses whose payer has left the squad', () => {
    const { tot, bal } = calculateLedger(ev([{ id: 'e1', ttl: 'Ghost', amt: 50, by: 'Zed', byId: 'z' }]), squad);
    expect(tot).toBe(0);
    expect(bal).toEqual({ a: 0, b: 0, c: 0 });
  });

  it('applies recorded payments to balances', () => {
    const { bal } = calculateLedger(
      ev([{ id: 'e1', ttl: 'Round', amt: 30, by: 'Ann', byId: 'a' }], [{ id: 'p1', from: 'b', to: 'a', amt: 10, at: 1 }]),
      squad
    );
    expect(bal).toEqual({ a: 10, b: 0, c: -10 });
  });

  it('always balances to zero', () => {
    const { bal } = calculateLedger(
      ev([
        { id: 'e1', ttl: 'A', amt: 10, by: 'Ann', byId: 'a' },
        { id: 'e2', ttl: 'B', amt: 7.5, by: 'Ben', byId: 'b', for: { a: 1, b: 1 } },
      ]),
      squad
    );
    expect(sum(bal)).toBeCloseTo(0, 10);
  });
});

describe('calculateSettlement', () => {
  it('returns nothing when everyone is square', () => {
    expect(calculateSettlement(ev([]), squad)).toEqual([]);
    expect(calculateSettlement(null, squad)).toEqual([]);
  });

  it('pays the creditor back with the fewest transfers', () => {
    const out = calculateSettlement(ev([{ id: 'e1', ttl: 'Round', amt: 30, by: 'Ann', byId: 'a' }]), squad);
    expect(out).toEqual([
      { from: 'b', to: 'a', amt: 10 },
      { from: 'c', to: 'a', amt: 10 },
    ]);
  });

  it('rounds awkward thirds to pennies without losing money', () => {
    const out = calculateSettlement(ev([{ id: 'e1', ttl: 'Pizza', amt: 10, by: 'Ann', byId: 'a' }]), squad);
    expect(out.map((s) => s.amt)).toEqual([3.33, 3.33]);
    out.forEach((s) => expect(s.to).toBe('a'));
  });

  it('settles a chain of debts', () => {
    const out = calculateSettlement(
      ev([
        { id: 'e1', ttl: 'Train', amt: 60, by: 'Ann', byId: 'a' },
        { id: 'e2', ttl: 'Food', amt: 30, by: 'Ben', byId: 'b' },
      ]),
      squad
    );
    // Each owes 30: Ann +30, Ben 0, Cal -30
    expect(out).toEqual([{ from: 'c', to: 'a', amt: 30 }]);
  });
});
