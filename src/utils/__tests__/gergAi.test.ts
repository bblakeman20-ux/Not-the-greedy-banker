import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askGergAI } from '../gemini';
import { forgetIdeas, rememberIdeas, seenIdeas } from '../ideaMemory';
import { newEvent } from '../storage';
import { AppConfig } from '../../types';

const cfg: AppConfig = { u: '', db: '', rm: 'room', md: 'gemini-flash-latest', key: '', ev: '' };
const ev = newEvent({ id: 'ev1', name: 'Friday', where: 'Rochester', vibe: 'Craft beer' });

// A server-sent-events body like /api/gemini/ideas returns
const sse = (chunks: object[]) =>
  new Response(chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n', { status: 200 });

const ask = (avoid: string[] = [], count = 6) =>
  askGergAI(cfg, 'gems', [], ev, [], 'Rochester', 'Craft beer', '', '', () => {}, undefined, true, count, avoid);

let sentPrompt = '';
beforeEach(() => {
  sentPrompt = '';
  forgetIdeas('ev1');
});
afterEach(() => vi.unstubAllGlobals());

describe('Gerg AI requests', () => {
  it('asks for the requested number, without a conflicting "3"', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: any) => {
      sentPrompt = JSON.parse(init.body).prompt;
      return sse([{ text: '[{"name":"A","kind":"spot","loc":"x","desc":"d"}]' }]);
    }));
    await ask([], 6);
    expect(sentPrompt).toMatch(/suggest 6 distinct ideas/);
    expect(sentPrompt).toMatch(/JSON array of 6 objects/);
    expect(sentPrompt).not.toMatch(/\b3 specific|\b3 real|\b3 creative|\b3 wildcard/);
  });

  it('tells Gemini what was already shown and drops repeats it sends anyway', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: any) => {
      sentPrompt = JSON.parse(init.body).prompt;
      return sse([{ text: '[{"name":"Old Brewery","kind":"spot","loc":"x","desc":"d"},{"name":"New Arcade","kind":"spot","loc":"x","desc":"d"}]' }]);
    }));
    const res = await ask(['Old Brewery', 'Axe Club']);
    expect(sentPrompt).toMatch(/do NOT suggest them again[^\n]*Old Brewery; Axe Club/);
    expect(res.ideas.map((i) => i.name)).toEqual(['New Arcade']);
  });

  it('falls back to curated spots it has not shown yet, and says why', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sse([{ error: 'Project prepayment credits depleted' }])));
    const first = await ask([], 3);
    expect(first.fallbackReason).toMatch(/credits are depleted/);
    expect(first.ideas).toHaveLength(3);
    const second = await ask(first.ideas.map((i) => i.name!), 3);
    const overlap = second.ideas.filter((i) => first.ideas.some((f) => f.name === i.name));
    expect(overlap).toHaveLength(0);
  });
});

describe('idea memory', () => {
  it('remembers per plan, de-duplicates and caps the list', () => {
    rememberIdeas('ev1', ['A', 'B']);
    rememberIdeas('ev1', ['b', 'C', undefined, '']);
    expect(seenIdeas('ev1')).toEqual(['A', 'b', 'C']);
    expect(seenIdeas('other')).toEqual([]);
    rememberIdeas('ev1', Array.from({ length: 100 }, (_, i) => `Idea ${i}`));
    expect(seenIdeas('ev1')).toHaveLength(80);
    expect(seenIdeas('ev1').at(-1)).toBe('Idea 99');
  });
});
