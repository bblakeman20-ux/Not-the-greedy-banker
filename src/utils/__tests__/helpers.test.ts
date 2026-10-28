import { describe, expect, it } from 'vitest';
import { isBanned, normName, payUrl, realPlace, safeUrl } from '../storage';
import { extractCompletedObjects, friendlyAiError } from '../gemini';

describe('ban matching', () => {
  const ban = [{ id: '1', name: 'Wetherspoons' }, { id: '2', name: 'The Crown' }];
  it('matches whole names, ignoring "the" and punctuation', () => {
    expect(isBanned('Wetherspoons', ban)).toBe(true);
    expect(isBanned('Crown', ban)).toBe(true);
    expect(isBanned('The Crown Inn', ban)).toBe(true);
    expect(isBanned('Crowne Plaza', ban)).toBe(false);
  });
  it('never bans The Greedy Banker – it is the trap card', () => {
    expect(isBanned('The Greedy Banker', [{ id: '3', name: 'Greedy Banker' }])).toBe(false);
  });
  it('normalises names for de-duplication', () => {
    expect(normName('The Tap-Room!')).toBe('taproom');
  });
});

describe('links', () => {
  it('only allows http(s) links', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(safeUrl('not a url')).toBe('');
  });
  it('adds the amount to Monzo and PayPal.me links', () => {
    expect(payUrl({ payLink: 'monzo.me/ann' }, 12.5)).toBe('https://monzo.me/ann/12.50');
    expect(payUrl({ payLink: 'https://paypal.me/ben' }, 7)).toBe('https://paypal.me/ben/7.00GBP');
    expect(payUrl({ payLink: 'javascript:alert(1)' }, 7)).toBe('');
  });
  it('treats "Local" as no place', () => {
    expect(realPlace('Local')).toBe('');
    expect(realPlace(' local ')).toBe('');
    expect(realPlace('Rochester')).toBe('Rochester');
    expect(realPlace(undefined)).toBe('');
  });
});

describe('Gerg AI streaming', () => {
  it('pulls out each finished object from a half-streamed JSON array', () => {
    const partial = '[{"name":"A","desc":"has } brace"},{"name":"B"},{"name":"C","desc":"unfin';
    expect(extractCompletedObjects(partial).map((o) => o.name)).toEqual(['A', 'B']);
  });
  it('explains failures in plain English', () => {
    expect(friendlyAiError(new Error('GEMINI_API_KEY is not configured on the server'))).toMatch(/no Gemini API key/);
    expect(friendlyAiError(new Error('API key not valid. Please pass a valid API key.'))).toMatch(/rejected/);
    expect(friendlyAiError(new Error('429 RESOURCE_EXHAUSTED quota'))).toMatch(/usage limit/);
    expect(friendlyAiError(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toMatch(/too long/);
    expect(friendlyAiError(new Error('Failed to fetch'))).toMatch(/connection/);
  });
});
