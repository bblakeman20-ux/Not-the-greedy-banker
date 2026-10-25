import { Slot, Venue, AppConfig } from '../types';
import { sid } from './firebase';

export const pad = (n: number): string => String(n).padStart(2, '0');

export const isoLocal = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const fmtWhen = (d: Date): string =>
  d.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

export function parseWhen(t: string): Date | null {
  t = String(t || '')
    .toLowerCase()
    .replace(/(\d)t(\d)/, '$1 $2');
  if (!t.trim()) return null;

  const now = new Date();
  const today = () => new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const MON = 'janfebmaraprmayjunjulaugsepoctnovdec';
  let d: Date | null = null;
  let m: RegExpMatchArray | null;
  let wk = 0;

  const ahead = (x: Date) => {
    if (x < today()) x.setFullYear(x.getFullYear() + 1);
    return x;
  };

  if ((m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) {
    d = new Date(+m[1], +m[2] - 1, +m[3]);
  } else if ((m = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/))) {
    d = ahead(new Date(now.getFullYear(), MON.indexOf(m[2]) / 3, +m[1]));
  } else if ((m = t.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/))) {
    d = ahead(new Date(now.getFullYear(), MON.indexOf(m[1]) / 3, +m[2]));
  } else if ((m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
    d = m[3]
      ? new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1])
      : ahead(new Date(now.getFullYear(), +m[2] - 1, +m[1]));
  } else if (/\btomorrow\b/.test(t)) {
    d = today();
    d.setDate(d.getDate() + 1);
  } else if (/\b(today|tonight)\b/.test(t)) {
    d = today();
  } else if ((m = t.match(/\b(next\s+)?(sun|mon|tue|wed|thu|fri|sat)/))) {
    const day = 'sunmontuewedthufrisat'.indexOf(m[2]) / 3;
    d = today();
    if (m[1]) {
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 7 + ((day + 6) % 7));
    } else {
      d.setDate(d.getDate() + ((day - d.getDay() + 7) % 7));
      wk = 1;
    }
  }

  if (!d || isNaN(d.getTime())) return null;
  if (m) t = t.replace(m[0], ' ');

  let h = 19;
  let mi = 0;
  if ((m = t.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/))) {
    h = (+m[1] % 12) + (m[3] === 'pm' ? 12 : 0);
    mi = +(m[2] || 0);
  } else if ((m = t.match(/\b(\d{1,2})[:.](\d{2})\b/))) {
    h = +m[1];
    mi = +m[2];
  } else if (/\bnoon\b/.test(t)) {
    h = 12;
  }

  d.setHours(h, mi, 0, 0);
  if (wk && d < now) d.setDate(d.getDate() + 7);
  return d;
}

export const whenOf = (s?: Slot | null): Date | null => (s && s.at ? new Date(s.at) : null);

export const icsStamp = (d: Date): string => isoLocal(d).replace(/[-:]/g, '') + '00';
export const icsEsc = (s: string): string =>
  String(s || '')
    .replace(/[\\;,]/g, '\\$&')
    .replace(/\n/g, '\\n');

export function calInfo(s: Slot, venue: Venue | null, cfg: AppConfig) {
  const d = whenOf(s);
  if (!d) return null;
  const e = new Date(d.getTime() + 3 * 3600e3);
  const title = '🍻 ' + (venue ? venue.name : 'Squad outing');
  const loc = venue ? venue.loc : '';
  const groupUrl = `${window.location.origin}${window.location.pathname}${
    cfg.db ? `?db=${encodeURIComponent(cfg.db)}&room=${encodeURIComponent(cfg.rm)}` : ''
  }`;
  const desc = 'Planned on Pintdr' + (cfg.db ? ' – ' + groupUrl : '');
  return { s, d, e, title, loc, desc };
}

export function downloadIcs(s: Slot, venue: Venue | null, cfg: AppConfig): void {
  const c = calInfo(s, venue, cfg);
  if (!c) return;
  const txt = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pintdr//EN',
    'BEGIN:VEVENT',
    'UID:' + sid(c.s.id) + '-' + sid(cfg.rm) + '@ntgb',
    'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''),
    'DTSTART:' + icsStamp(c.d),
    'DTEND:' + icsStamp(c.e),
    'SUMMARY:' + icsEsc(c.title),
    'LOCATION:' + icsEsc(c.loc),
    'DESCRIPTION:' + icsEsc(c.desc),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([txt], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'squad-plan.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function getGoogleCalendarUrl(s: Slot, venue: Venue | null, cfg: AppConfig): string {
  const c = calInfo(s, venue, cfg);
  if (!c) return '';
  return (
    'https://calendar.google.com/calendar/render?action=TEMPLATE&' +
    new URLSearchParams({
      text: c.title,
      dates: icsStamp(c.d) + '/' + icsStamp(c.e),
      ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      location: c.loc,
      details: c.desc,
    }).toString()
  );
}
