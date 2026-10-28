import { describe, expect, it } from 'vitest';
import { PAY_WARNING_MS, payChangeNote, recentPayChange, stampPayChange } from '../payDetails';
import { generateRoomCode, humanizeRoomCode, withRandomPart } from '../storage';
import { User } from '../../types';

const ben: User = { id: 'b', name: 'Ben', emo: '🍻', loc: '', mode: 'Train', pay: 'Monzo' };
const sam: User = { id: 's', name: 'Sam', emo: '🍺', loc: '', mode: 'Train', pay: 'Monzo' };
const NOW = 10_000_000;

describe('pay detail changes', () => {
  it("doesn't flag adding your own details for the first time", () => {
    const next = stampPayChange(ben, { ...ben, sort: '12-34-56', acc: '12345678' }, 'b', NOW);
    expect(next.payAt).toBeUndefined();
  });

  it('flags changing existing bank details, even your own', () => {
    const before = { ...ben, sort: '12-34-56', acc: '12345678' };
    const next = stampPayChange(before, { ...before, acc: '87654321' }, 'b', NOW);
    expect(next).toMatchObject({ payAt: NOW, payBy: 'b' });
    expect(payChangeNote(next, [next, sam], NOW + 2 * 3600e3)).toBe(
      "Ben's pay details changed 2 hours ago – check with Ben before paying."
    );
  });

  it('flags anyone editing someone else’s details, and names them', () => {
    const next = stampPayChange(ben, { ...ben, sort: '99-99-99', acc: '11112222' }, 's', NOW);
    expect(next).toMatchObject({ payAt: NOW, payBy: 's' });
    expect(recentPayChange(next, [next, sam], NOW)?.byOther).toBe(true);
    expect(payChangeNote(next, [next, sam], NOW + 5 * 60000)).toBe(
      "Ben's pay details changed 5 min ago by Sam – check with Ben before paying."
    );
  });

  it('ignores saves that leave pay details untouched', () => {
    const before = { ...ben, payLink: 'monzo.me/ben' };
    expect(stampPayChange(before, { ...before, emo: '🎯' }, 's', NOW).payAt).toBeUndefined();
  });

  it('stops warning after 48 hours', () => {
    const next = stampPayChange({ ...ben, acc: '1' }, { ...ben, acc: '2' }, 'b', NOW);
    expect(payChangeNote(next, [next], NOW + PAY_WARNING_MS - 1)).not.toBeNull();
    expect(payChangeNote(next, [next], NOW + PAY_WARNING_MS + 1)).toBeNull();
  });
});

describe('room codes', () => {
  it('end in 8 random characters and are not repeated', () => {
    const codes = new Set(Array.from({ length: 200 }, generateRoomCode));
    expect(codes.size).toBe(200);
    codes.forEach((c) => expect(c).toMatch(/^squad-[a-z]+-[a-z-]+-[a-z0-9]{8}$/));
  });

  it('give custom names a random tail once', () => {
    const c = withRandomPart('friday-pints');
    expect(c).toMatch(/^friday-pints-[a-z0-9]{8}$/);
    expect(withRandomPart(c)).toBe(c);
  });

  it('still show friendly names for old and new codes', () => {
    expect(humanizeRoomCode('squad-epic-curry-x7k2')).toBe('Epic Curry');
    expect(humanizeRoomCode('squad-epic-curry-x7k2ab9q')).toBe('Epic Curry');
    expect(humanizeRoomCode(withRandomPart('friday-pints'))).toBe('Friday Pints');
  });
});
