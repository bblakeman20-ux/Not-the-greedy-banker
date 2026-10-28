import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { icsEsc, parseWhen } from '../dates';

// Wednesday 28 October 2026, 10:00 local time
const NOW = new Date(2026, 9, 28, 10, 0, 0);

const ymdhm = (d: Date | null) =>
  d && [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()];

describe('parseWhen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('returns null for empty or unrecognised text', () => {
    expect(parseWhen('')).toBeNull();
    expect(parseWhen('whenever')).toBeNull();
  });

  it('reads ISO dates and defaults to 7pm', () => {
    expect(ymdhm(parseWhen('2026-11-14'))).toEqual([2026, 11, 14, 19, 0]);
  });

  it('reads day-month and month-day text with times', () => {
    expect(ymdhm(parseWhen('14th Nov 8pm'))).toEqual([2026, 11, 14, 20, 0]);
    expect(ymdhm(parseWhen('Nov 14 at 18:30'))).toEqual([2026, 11, 14, 18, 30]);
  });

  it('rolls past dates into next year', () => {
    expect(ymdhm(parseWhen('3 Jan'))).toEqual([2027, 1, 3, 19, 0]);
  });

  it('reads UK-style numeric dates as day/month', () => {
    expect(ymdhm(parseWhen('5/12'))).toEqual([2026, 12, 5, 19, 0]);
    expect(ymdhm(parseWhen('5/12/27'))).toEqual([2027, 12, 5, 19, 0]);
  });

  it('understands tomorrow and tonight', () => {
    expect(ymdhm(parseWhen('tomorrow 7:30pm'))).toEqual([2026, 10, 29, 19, 30]);
    expect(ymdhm(parseWhen('tonight'))).toEqual([2026, 10, 28, 19, 0]);
  });

  it('picks the coming weekday, and "next" means the following week', () => {
    expect(ymdhm(parseWhen('Fri'))).toEqual([2026, 10, 30, 19, 0]);
    expect(ymdhm(parseWhen('Sat noon'))).toEqual([2026, 10, 31, 12, 0]);
    expect(ymdhm(parseWhen('next Fri'))).toEqual([2026, 11, 6, 19, 0]);
  });

  it('moves a weekday already passed today on to next week', () => {
    // Wednesday 9am has gone by 10am
    expect(ymdhm(parseWhen('Wed 9am'))).toEqual([2026, 11, 4, 9, 0]);
  });
});

describe('icsEsc', () => {
  it('escapes calendar special characters', () => {
    expect(icsEsc('Pub; then, bar\\club\nhome')).toBe('Pub\\; then\\, bar\\\\club\\nhome');
  });
});
