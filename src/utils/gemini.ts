import { AppConfig, BanItem, OutingEvent, User, Venue } from '../types';
import { isBanned, normName, safeUrl } from './storage';
import { fmtWhen, whenOf } from './dates';

export const AI_TIMEOUT = 15000;

export interface AiModeConfig {
  lbl: string;
  sub: string;
  search: boolean;
  ask: string;
}

export const MODES: Record<string, AiModeConfig> = {
  gems: {
    lbl: 'Hidden gems',
    sub: 'Unusual local spots – not the obvious default',
    search: false,
    ask: '3 specific, real, bookable venues or activities in or near the area that a group would never default to: independent, unusual, newly opened or under-the-radar. Skip anything generic.',
  },
  events: {
    lbl: "What's on",
    sub: 'Real, dated events checked on live Google Search',
    search: true,
    ask: '3 real events happening on or close to the date, in or within easy train reach of the area: gigs, comedy, festivals, markets, live sport, pop-ups, quizzes, tastings, club nights, screenings. Use Google Search to confirm each is really on, give its date and time, and an official or ticket link.',
  },
  combo: {
    lbl: 'Combo night',
    sub: 'Creative multi-stop plans that chain activities together',
    search: false,
    ask: '3 creative combo plans that chain 2-4 different activities into one outing with a theme (e.g. competitive thing, then food, then a late spot; or a daytime challenge into a night out). Use real venues close to each other, rough times, and make each plan feel distinct.',
  },
  wild: {
    lbl: 'Surprise me',
    sub: 'One event, one combo, one total wildcard',
    search: true,
    ask: '3 wildcard ideas: one real dated event (confirm with Google Search), one creative multi-stop combo, and one unusual one-off experience (workshop, challenge, themed night, day trip by train, something they would never think of).',
  },
};

const DEFAULT_FAST_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

export async function liveModels(_key?: string): Promise<string[]> {
  return DEFAULT_FAST_MODELS;
}

/**
 * Robust JSON stream scanner: extracts complete JSON objects from an in-progress array stream [ { ... }, { ... } ]
 */
export function extractCompletedObjects(rawText: string): any[] {
  const objects: any[] = [];
  const start = rawText.indexOf('[');
  if (start < 0) return objects;

  let inString = false;
  let escape = false;
  let depth = 0;
  let objStart = -1;

  for (let i = start + 1; i < rawText.length; i++) {
    const ch = rawText[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (ch === '{') {
        if (depth === 0) {
          objStart = i;
        }
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && objStart >= 0) {
          const candidate = rawText.slice(objStart, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object') {
              objects.push(parsed);
            }
          } catch (e) {
            // Incomplete or invalid JSON object chunk
          }
          objStart = -1;
        }
      }
    }
  }

  return objects;
}

export function squadBrief(
  squad: User[],
  event: OutingEvent,
  banList: BanItem[],
  customLoc: string,
  customVib: string,
  customWhen: string,
  customBud: string
): string {
  const allInSlot = event.slots.find(
    (s) => squad.length > 0 && squad.every((u) => s.av && s.av[u.id])
  );
  const liked: string[] = [];
  const vetoed: string[] = [];

  event.venues.forEach((v) => {
    const vs = Object.values(v.votes || {});
    if (vs.includes('v')) vetoed.push(v.name);
    else if (vs.filter((x) => x === 'k').length >= 2) liked.push(v.name);
  });

  const whenStr =
    customWhen.trim() ||
    (allInSlot ? (whenOf(allInSlot) ? fmtWhen(whenOf(allInSlot)!) : allInSlot.lbl) : 'this coming weekend');

  return [
    `Group: ${squad.length} mates, travelling from ${squad
      .map((u) => `${u.name} (${u.loc}, ${u.mode})`)
      .join('; ')}.`,
    `Today is ${new Date().toDateString()}. The outing is: ${whenStr}.`,
    `Area: ${customLoc.trim() || (event.mid ? event.mid.name : 'Medway, Kent')}${
      event.mid ? ` (fair midpoint for the group: ${event.mid.name})` : ''
    }.`,
    `Vibe: ${customVib.trim() || 'surprise us'}.`,
    `Budget: ${
      customBud.trim()
        ? 'about £' + customBud.trim().replace(/[^\d.]/g, '') + ' per head'
        : 'flexible'
    }.`,
    liked.length ? `They were keen on: ${liked.join(', ')}.` : '',
    vetoed.length ? `They vetoed (avoid similar): ${vetoed.join(', ')}.` : '',
    `Already on the list, do not repeat: ${event.venues.map((v) => v.name).join(', ') || 'nothing yet'}.`,
    banList.length
      ? `Never suggest: ${banList.map((b) => b.name).join(', ')}.`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// A Builder Admin can set their own Gemini key on this device; the server uses it instead of its own.
export const aiHeaders = (cfg: AppConfig): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(cfg.key ? { 'x-gemini-key': cfg.key } : {}),
});

// Turn raw server / network errors into something the squad can act on.
export function friendlyAiError(err: any): string {
  const msg = String(err?.message || err || '');
  if (err?.name === 'AbortError') return 'Gerg AI took too long to answer – give it another go.';
  if (/not valid|invalid|PERMISSION_DENIED|403/i.test(msg)) return "Gerg AI's Gemini API key was rejected – it needs a valid key.";
  if (/not configured|API_KEY/i.test(msg)) return "Gerg AI isn't switched on – the server has no Gemini API key.";
  if (/429|quota|rate|exhausted/i.test(msg)) return 'Gerg AI has hit its usage limit for now – try again later.';
  if (/Failed to fetch|NetworkError|HTTP 5\d\d/i.test(msg)) return "Couldn't reach Gerg AI – check your connection and try again.";
  if (/not found|404|model/i.test(msg)) return 'Gerg AI model is unavailable – the server model list needs updating.';
  return `Gerg AI is unavailable right now (${msg.slice(0, 120)}).`;
}

export interface GergAiResult {
  ideas: Partial<Venue>[];
  duration: number;
  usedModel: string;
  sources: Array<{ title: string; uri: string }>;
  searchAttempted: boolean;
  searchSuccess: boolean;
}

export async function askGergAI(
  cfg: AppConfig,
  modeKey: string,
  squad: User[],
  event: OutingEvent,
  banList: BanItem[],
  customLoc: string,
  customVib: string,
  customWhen: string,
  customBud: string,
  onStatus: (msg: string) => void,
  onStreamIdea?: (idea: Partial<Venue>, index: number) => void,
  fastMode: boolean = true,
  count: number = 3
): Promise<GergAiResult> {
  const mode = MODES[modeKey] || MODES.gems;
  const t0 = Date.now();

  const allowSearch = fastMode ? modeKey === 'events' : mode.search;

  onStatus(
    allowSearch
      ? "🤖 Gerg AI is searching what's on..."
      : '⚡ Gerg AI is generating ideas instantly...'
  );

  const shape =
    'Each object has keys: "name" (punchy title), "kind" ("spot", "event" or "combo"), "loc" (town or area), "when" (date and time for events, else ""), "cost" (rough £ per head, e.g. "£25"), "desc" (max 20 words: why it beats the default for this group), "steps" (for combos: 2-4 short strings like "6pm – crazy golf @ Venue", else []), "url" (official or ticket link if known, else "").';

  const vibeInstruction = customVib.trim()
    ? `CRITICAL THEME / VIBE MANDATE: Every single suggestion MUST strictly match the requested theme/vibe: "${customVib.trim()}". For example, if the vibe is "Wine", suggest real wine bars, vineyards, cellars, tasting rooms, or wine bistros. If "Axe throwing", suggest axe throwing / target sport venues. If "Taproom", suggest microbreweries and craft beer houses. NEVER fall back to generic high street pubs unless the vibe explicitly requests it.`
    : '';

  const prompt = `You are Gerg AI, the anti-default outing planner for a UK group of mates who always end up in the same pub.\n${squadBrief(
    squad,
    event,
    banList,
    customLoc,
    customVib,
    customWhen,
    customBud
  )}\n\n${vibeInstruction}\nTask: suggest ${count} distinct ideas matching "${customVib.trim() || 'anti-default fun'}". ${mode.ask}\nMake the ideas fit the group: easy to reach from their stations, in budget, and genuinely more fun than the default.\nReturn ONLY a JSON array of ${count} objects, no other text. ${shape}`;

  const have = new Set(event.venues.map((v) => normName(v.name)));
  const streamedIdeas: Partial<Venue>[] = [];
  const streamedNames = new Set<string>();
  let emittedCount = 0;
  let usedModel = cfg.md || 'gemini-flash-latest';
  const sources: Array<{ title: string; uri: string }> = [];

  const handleChunkText = (accumulatedText: string) => {
    const rawObjects = extractCompletedObjects(accumulatedText);
    for (let i = emittedCount; i < rawObjects.length; i++) {
      const raw = rawObjects[i];
      if (raw && raw.name) {
        const norm = normName(raw.name);
        if (!isBanned(raw.name, banList) && !have.has(norm) && !streamedNames.has(norm)) {
          streamedNames.add(norm);
          const formatted: Partial<Venue> = {
            name: String(raw.name),
            loc: String(raw.loc || customLoc || 'Local'),
            desc: String(raw.desc || ''),
            kind: ['spot', 'event', 'combo'].includes(raw.kind) ? raw.kind : ('spot' as const),
            when: String(raw.when || ''),
            cost: String(raw.cost || ''),
            url: safeUrl(raw.url),
            steps: Array.isArray(raw.steps) ? raw.steps.slice(0, 4).map(String) : [],
            live: allowSearch ? 1 : 0,
          };
          streamedIdeas.push(formatted);
          if (onStreamIdea) {
            onStreamIdea(formatted, streamedIdeas.length - 1);
          }
          const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
          onStatus(`⚡ Gerg AI streamed idea ${streamedIdeas.length} of ${count} (${elapsed}s)...`);
        }
      }
    }
    emittedCount = rawObjects.length;
  };

  const ac = new AbortController();
  const tm = setTimeout(() => ac.abort(), 35000);
  let failure: any = null;

  try {
    const response = await fetch('/api/gemini/ideas', {
      method: 'POST',
      headers: aiHeaders(cfg),
      signal: ac.signal,
      body: JSON.stringify({
        prompt,
        model: cfg.md || 'gemini-flash-latest',
        search: allowSearch,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to reach Gerg AI server`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response stream unavailable');

    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let newlineIdx: number;

      while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);

        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;

        try {
          const parsed = JSON.parse(payload);
          if (parsed.error) {
            throw new Error(parsed.error);
          }
          if (parsed.model) {
            usedModel = parsed.model;
          }
          if (parsed.text) {
            accumulatedText += parsed.text;
            handleChunkText(accumulatedText);
          }
          if (parsed.grounding?.groundingChunks) {
            parsed.grounding.groundingChunks.forEach((c: any) => {
              if (c.web?.uri && safeUrl(c.web.uri)) {
                sources.push({ title: c.web.title || 'source', uri: safeUrl(c.web.uri) });
              }
            });
          }
        } catch (err: any) {
          if (err.message && !err.message.includes('JSON')) {
            throw err;
          }
        }
      }
    }

    // Final pass if objects were not parsed incrementally
    if (streamedIdeas.length === 0 && accumulatedText) {
      try {
        let parsedFinal: any[] = [];
        try {
          parsedFinal = JSON.parse(accumulatedText);
        } catch {
          const i = accumulatedText.indexOf('[');
          const j = accumulatedText.lastIndexOf(']');
          if (i >= 0 && j > i) {
            parsedFinal = JSON.parse(accumulatedText.slice(i, j + 1));
          }
        }
        if (Array.isArray(parsedFinal)) {
          parsedFinal.forEach((raw) => {
            if (raw && raw.name && !isBanned(raw.name, banList)) {
              streamedIdeas.push({
                name: String(raw.name),
                loc: String(raw.loc || customLoc || 'Local'),
                desc: String(raw.desc || ''),
                kind: ['spot', 'event', 'combo'].includes(raw.kind) ? raw.kind : ('spot' as const),
                when: String(raw.when || ''),
                cost: String(raw.cost || ''),
                url: safeUrl(raw.url),
                steps: Array.isArray(raw.steps) ? raw.steps.slice(0, 4).map(String) : [],
                live: allowSearch ? 1 : 0,
              });
            }
          });
        }
      } catch {}
    }
  } catch (err: any) {
    console.warn('Gerg AI request encountered issue:', err.message);
    failure = err;
  } finally {
    clearTimeout(tm);
  }

  if (streamedIdeas.length === 0) {
    throw new Error(
      failure
        ? friendlyAiError(failure)
        : "Gerg AI came back empty-handed – try a different vibe or area."
    );
  }

  return {
    ideas: streamedIdeas,
    duration: Math.max(0.5, (Date.now() - t0) / 1000),
    usedModel,
    sources: sources.slice(0, 4),
    searchAttempted: mode.search,
    searchSuccess: sources.length > 0,
  };
}
