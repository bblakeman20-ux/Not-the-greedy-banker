// Pay details live in shared room data that anyone with the link can edit, so a
// change is stamped and flagged: a quietly swapped account number is the scam to
// guard against.
import { User } from '../types';

export const PAY_WARNING_MS = 48 * 3600e3;

const FIELDS = ['payLink', 'payMail', 'acn', 'sort', 'acc'] as const;

export const paySignature = (u?: Partial<User> | null): string =>
  FIELDS.map((k) => String(u?.[k] || '').trim()).join('|');

const hasAnyPay = (u?: Partial<User> | null): boolean => paySignature(u).replace(/\|/g, '') !== '';

// Stamp who changed the pay details and when. Adding your own details for the
// first time isn't flagged; changing existing ones, or anyone else's, is.
export function stampPayChange(prev: User | undefined, next: User, editorId: string | undefined, now = Date.now()): User {
  if (paySignature(prev) === paySignature(next)) return next;
  if (!hasAnyPay(prev) && editorId === next.id) return next;
  return { ...next, payAt: now, payBy: editorId || '' };
}

export interface PayChange {
  at: number;
  byOther: boolean; // edited by someone other than the account holder
  editorName?: string;
}

export function recentPayChange(u: User, squad: User[], now = Date.now()): PayChange | null {
  if (!u.payAt || now - u.payAt > PAY_WARNING_MS) return null;
  const byOther = Boolean(u.payBy && u.payBy !== u.id);
  return { at: u.payAt, byOther, editorName: byOther ? squad.find((x) => x.id === u.payBy)?.name || 'someone else' : undefined };
}

const ago = (ms: number): string => {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return `${h} hour${h === 1 ? '' : 's'} ago`;
};

export function payChangeNote(u: User, squad: User[], now = Date.now()): string | null {
  const c = recentPayChange(u, squad, now);
  if (!c) return null;
  const who = c.byOther ? ` by ${c.editorName}` : '';
  return `${u.name}'s pay details changed ${ago(now - c.at)}${who} – check with ${u.name} before paying.`;
}
