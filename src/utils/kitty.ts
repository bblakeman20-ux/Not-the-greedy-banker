import { Expense, OutingEvent, User } from '../types';

export const who = (id: string, squad: User[]): User | undefined => squad.find((x) => x.id === id);

export const payerOf = (e: Expense, squad: User[]): string | undefined =>
  (who(e.byId || '', squad) || squad.find((u) => u.name === e.by) || {}).id;

export const splitOf = (e: Expense, squad: User[]): string[] => {
  const f = Object.keys(e.for || {}).filter((i) => e.for?.[i] && who(i, squad));
  return f.length ? f : squad.map((u) => u.id);
};

export interface LedgerResult {
  bal: Record<string, number>;
  share: Record<string, number>;
  tot: number;
}

export function calculateLedger(event: OutingEvent | null, squad: User[]): LedgerResult {
  const bal: Record<string, number> = {};
  const share: Record<string, number> = {};
  let tot = 0;

  squad.forEach((u) => {
    bal[u.id] = 0;
    share[u.id] = 0;
  });

  if (!event) return { bal, share, tot };

  event.exp.forEach((e) => {
    const p = payerOf(e, squad);
    const a = +e.amt || 0;
    if (!p) return;
    tot += a;
    bal[p] += a;
    const f = splitOf(e, squad);
    f.forEach((i) => {
      bal[i] -= a / f.length;
      share[i] = (share[i] || 0) + a / f.length;
    });
  });

  (event.paid || []).forEach((x) => {
    if (who(x.from, squad) && who(x.to, squad)) {
      bal[x.from] += +x.amt || 0;
      bal[x.to] -= +x.amt || 0;
    }
  });

  return { bal, share, tot };
}

export interface Settlement {
  from: string;
  to: string;
  amt: number;
}

export function calculateSettlement(event: OutingEvent | null, squad: User[]): Settlement[] {
  if (!event) return [];
  const { bal } = calculateLedger(event, squad);

  const cr = squad
    .filter((u) => bal[u.id] > 0.005)
    .map((u) => ({ id: u.id, a: bal[u.id] }));

  const db = squad
    .filter((u) => bal[u.id] < -0.005)
    .map((u) => ({ id: u.id, a: -bal[u.id] }));

  const out: Settlement[] = [];

  while (cr.length && db.length) {
    const c = cr[0];
    const d = db[0];
    const a = Math.min(c.a, d.a);
    if (a >= 0.01) {
      out.push({
        from: d.id,
        to: c.id,
        amt: Math.round(a * 100) / 100,
      });
    }
    c.a -= a;
    d.a -= a;
    if (c.a < 0.005) cr.shift();
    if (d.a < 0.005) db.shift();
  }

  return out;
}
