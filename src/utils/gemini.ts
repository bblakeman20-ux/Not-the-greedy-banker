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
    lbl: '💎 Hidden gems',
    sub: 'Unusual local spots – not the obvious default',
    search: false,
    ask: '3 specific, real, bookable venues or activities in or near the area that a group would never default to: independent, unusual, newly opened or under-the-radar. Skip anything generic.',
  },
  events: {
    lbl: "🎟️ What's on",
    sub: 'Real, dated events checked on live Google Search',
    search: true,
    ask: '3 real events happening on or close to the date, in or within easy train reach of the area: gigs, comedy, festivals, markets, live sport, pop-ups, quizzes, tastings, club nights, screenings. Use Google Search to confirm each is really on, give its date and time, and an official or ticket link.',
  },
  combo: {
    lbl: '🔀 Combo night',
    sub: 'Creative multi-stop plans that chain activities together',
    search: false,
    ask: '3 creative combo plans that chain 2-4 different activities into one outing with a theme (e.g. competitive thing, then food, then a late spot; or a daytime challenge into a night out). Use real venues close to each other, rough times, and make each plan feel distinct.',
  },
  wild: {
    lbl: '🎲 Surprise me',
    sub: 'One event, one combo, one total wildcard',
    search: true,
    ask: '3 wildcard ideas: one real dated event (confirm with Google Search), one creative multi-stop combo, and one unusual one-off experience (workshop, challenge, themed night, day trip by train, something they would never think of).',
  },
};

export const thinkCfg = (m: string) => {
  // Only gemini-3.1-flash-lite supports the MINIMAL thinking level tier
  if (m === 'gemini-3.1-flash-lite' || m.includes('flash-lite')) {
    return { thinkingLevel: 'MINIMAL' };
  }
  // gemini-flash-latest and gemini-3.8-flash decide reasoning automatically without thinkingLevel
  return null;
};

const DEFAULT_FAST_MODELS = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
let keyModelsCache: string[] | null = null;

export async function liveModels(key: string): Promise<string[]> {
  if (keyModelsCache) return keyModelsCache;
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
      { headers: { 'x-goog-api-key': key } }
    );
    const j = await res.json();
    if (j.models) {
      keyModelsCache = j.models
        .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m: any) => m.name.replace(/^models\//, ''));
    }
  } catch (e) {}
  return keyModelsCache || DEFAULT_FAST_MODELS;
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

function backups(list: string[], currentModel: string): string[] {
  const v = (n: string) => {
    if (n === 'gemini-flash-latest') return 999;
    const m = n.match(/^gemini-(\d+(?:\.\d+)?)-flash(-lite)?$/);
    // Exclude deprecated models (< 3.0)
    if (m && +m[1] < 3) return -1;
    return m ? +m[1] - (m[2] ? 0.001 : 0) : -1;
  };
  return list
    .filter((n) => v(n) > 0 && n !== currentModel)
    .sort((a, b) => v(b) - v(a))
    .slice(0, 2);
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
    `Never suggest: ${banList.map((b) => b.name).join(', ')}, or any generic chain pub or default local.`,
  ]
    .filter(Boolean)
    .join('\n');
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
  fastMode: boolean = true
): Promise<GergAiResult> {
  const mode = MODES[modeKey] || MODES.gems;
  const t0 = Date.now();

  // If fastMode is enabled, disable Google Search tool overhead unless mode is specifically 'events'
  const allowSearch = fastMode ? modeKey === 'events' : mode.search;

  onStatus(
    allowSearch
      ? "🤖 Gerg AI is searching what's on..."
      : '⚡ Gerg AI is generating ideas instantly...'
  );

  const shape =
    'Each object has keys: "name" (punchy title), "kind" ("spot", "event" or "combo"), "loc" (town or area), "when" (date and time for events, else ""), "cost" (rough £ per head, e.g. "£25"), "desc" (max 20 words: why it beats the default for this group), "steps" (for combos: 2-4 short strings like "6pm – crazy golf @ Venue", else []), "url" (official or ticket link if known, else "").';
  const prompt = `You are Gerg AI, the anti-default outing planner for a UK group of mates who always end up in the same pub.\n${squadBrief(
    squad,
    event,
    banList,
    customLoc,
    customVib,
    customWhen,
    customBud
  )}\n\nTask: suggest ${mode.ask}\nMake the ideas fit the group: easy to reach from their stations, in budget, and genuinely more fun than the default.\nReturn ONLY a JSON array of 3 objects, no other text. ${shape}`;

  const str = { type: 'STRING' };
  const schema = {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: {
        name: str,
        kind: { type: 'STRING', enum: ['spot', 'event', 'combo'] },
        loc: str,
        when: str,
        cost: str,
        desc: str,
        steps: { type: 'ARRAY', items: str },
        url: str,
      },
      required: ['name', 'kind', 'loc', 'desc'],
    },
  };

  const have = new Set(event.venues.map((v) => normName(v.name)));
  const streamedIdeas: Partial<Venue>[] = [];
  const streamedNames = new Set<string>();
  let emittedCount = 0;

  const handleChunkText = (accumulatedText: string, currentModel: string) => {
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
          onStatus(`⚡ Gerg AI streamed idea ${streamedIdeas.length} of 3 (${elapsed}s)...`);
        }
      }
    }
    emittedCount = rawObjects.length;
  };

  const call = async (
    m: string,
    think: any,
    search: boolean,
    strict = true
  ): Promise<any> => {
    const first = search ? AI_TIMEOUT * 1.6 : AI_TIMEOUT;
    const ac = new AbortController();
    const gen: any = search || !strict
      ? {}
      : { responseMimeType: 'application/json', responseSchema: schema };

    const body: any = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: gen,
    };
    if (think) gen.thinkingConfig = think;
    if (search) body.tools = [{ googleSearch: {} }];

    let got = false;
    const tm = setTimeout(() => ac.abort(), first);
    const cap = setTimeout(() => ac.abort(), 90000);

    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          m
        )}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          signal: ac.signal,
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cfg.key,
          },
          body: JSON.stringify(body),
        }
      );

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        return {
          error: {
            code: j.error?.code || r.status,
            message: j.error?.message || 'HTTP ' + r.status,
          },
        };
      }

      const rd = r.body?.getReader();
      if (!rd) throw new Error('Response stream unavailable');

      const dec = new TextDecoder();
      let buf = '';
      let text = '';
      let meta: any = null;
      let fbk: any = null;

      for (;;) {
        const { done, value } = await rd.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line.startsWith('data:')) continue;
          const j = JSON.parse(line.slice(5));
          if (j.error) return { error: j.error };
          const c = j.candidates?.[0];
          (c?.content?.parts || []).forEach((p: any) => {
            if (p.text && !p.thought) text += p.text;
          });
          if (c?.groundingMetadata) meta = c.groundingMetadata;
          if (j.promptFeedback) fbk = j.promptFeedback;
          if (!got) {
            got = true;
            clearTimeout(tm);
            const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
            onStatus(`⚡ Gerg AI is streaming answers (${elapsed}s)...`);
          }
          // Incremental real-time streaming check
          handleChunkText(text, m);
        }
      }
      return {
        candidates: [{ content: { parts: [{ text }] }, groundingMetadata: meta }],
        promptFeedback: fbk,
      };
    } catch (e: any) {
      return {
        error: {
          message:
            e.name === 'AbortError'
              ? got
                ? `${m} stopped mid-answer after 90s`
                : `${m} didn't start answering within ${Math.round(first / 1000)}s`
              : e.message,
        },
      };
    } finally {
      clearTimeout(tm);
      clearTimeout(cap);
    }
  };

  // Avoid blocking network call to list 200 models before generating
  const list = keyModelsCache || DEFAULT_FAST_MODELS;
  if (!keyModelsCache) {
    liveModels(cfg.key).catch(() => {});
  }

  const fails: string[] = [];
  let d: any;
  let used = cfg.md || 'gemini-flash-latest';
  let search = allowSearch;
  let models = [used, ...backups(list, used)];

  if (keyModelsCache && !keyModelsCache.includes(used) && models.length > 1) {
    fails.push(`${used}: not in cached model list`);
    models = models.slice(1);
  }

  for (const m of models) {
    used = m;
    let think = thinkCfg(m);
    if (m !== cfg.md) onStatus(`🤖 Gerg AI is trying backup brain (${m})...`);

    d = await call(m, think, search, true);
    if (d.error && d.error.code === 400 && think) {
      think = null;
      d = await call(m, null, search, true);
    }
    if (d.error && d.error.code === 400 && !search) {
      d = await call(m, null, false, false);
    }
    if (d.error && d.error.code === 400 && search) {
      search = false;
      d = await call(m, null, false, false);
    }
    if (!d.error) break;
    fails.push(`${m}: ${d.error.message}`);
  }

  if (d.error) {
    throw new Error(
      fails.join('\n• ') +
        (list.length ? '' : "\n(Couldn't connect to Gemini – check the API key in Setup)")
    );
  }

  const txt = (d.candidates?.[0]?.content?.parts || [])
    .filter((p: any) => p.text && !p.thought)
    .map((p: any) => p.text)
    .join('');

  if (!txt && streamedIdeas.length === 0) {
    throw new Error(d.promptFeedback?.blockReason || 'Gerg AI came back empty');
  }

  let finalIdeas: any[] = [];
  if (streamedIdeas.length >= 1) {
    finalIdeas = streamedIdeas;
  } else {
    try {
      finalIdeas = JSON.parse(txt);
    } catch (e) {
      const i = txt.indexOf('[');
      const j = txt.lastIndexOf(']');
      if (i >= 0 && j > i) {
        try {
          finalIdeas = JSON.parse(txt.slice(i, j + 1));
        } catch (err) {}
      }
    }

    if (!Array.isArray(finalIdeas)) {
      finalIdeas = Object.values(finalIdeas).find(Array.isArray) || [];
    }

    finalIdeas = finalIdeas
      .filter((x: any) => x && x.name && !isBanned(x.name, banList) && !have.has(normName(x.name)))
      .slice(0, 3)
      .map((x: any) => ({
        name: String(x.name),
        loc: String(x.loc || customLoc || 'Local'),
        desc: String(x.desc || ''),
        kind: ['spot', 'event', 'combo'].includes(x.kind) ? x.kind : ('spot' as const),
        when: String(x.when || ''),
        cost: String(x.cost || ''),
        url: safeUrl(x.url),
        steps: Array.isArray(x.steps) ? x.steps.slice(0, 4).map(String) : [],
        live: search ? 1 : 0,
      }));
  }

  if (!finalIdeas.length) {
    throw new Error('Gerg AI only came up with banned or repeat ideas – try another vibe');
  }

  const sources: Array<{ title: string; uri: string }> = (
    d.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  )
    .map((c: any) => c.web)
    .filter((w: any) => w && safeUrl(w.uri))
    .slice(0, 4)
    .map((w: any) => ({ title: w.title || 'source', uri: safeUrl(w.uri) }));

  return {
    ideas: finalIdeas,
    duration: (Date.now() - t0) / 1000,
    usedModel: used,
    sources,
    searchAttempted: mode.search,
    searchSuccess: search,
  };
}
