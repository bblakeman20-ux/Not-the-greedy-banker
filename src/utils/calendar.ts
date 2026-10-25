import { AppConfig, Slot, User } from '../types';
import { fmtWhen, pad } from './dates';

export interface CalendarDay {
  dateStr: string; // 'YYYY-MM-DD'
  dayNum: number;
  month: number; // 0-indexed
  year: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
}

export const toDateStr = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromDateStr = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};

export const fmtDayLabel = (dateStr: string): string => {
  const d = fromDateStr(dateStr);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

export function getCalendarGrid(year: number, month: number): CalendarDay[] {
  const today = new Date();
  const todayStr = toDateStr(today);
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);

  // Day of week: 0 = Sun, 1 = Mon ... We want Monday = 0
  let startDay = startOfMonth.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const totalDays = endOfMonth.getDate();
  const days: CalendarDay[] = [];

  // Previous month trailing days
  const prevMonthEnd = new Date(year, month, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    const d = prevMonthEnd - i;
    const date = new Date(year, month - 1, d);
    const dateStr = toDateStr(date);
    days.push({
      dateStr,
      dayNum: d,
      month: month - 1,
      year: month === 0 ? year - 1 : year,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isPast: date < new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    });
  }

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, month, d);
    const dateStr = toDateStr(date);
    days.push({
      dateStr,
      dayNum: d,
      month,
      year,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      isPast: date < new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    });
  }

  // Next month leading days to complete the 35 or 42 grid cells
  const remaining = (7 - (days.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const date = new Date(year, month + 1, d);
    const dateStr = toDateStr(date);
    days.push({
      dateStr,
      dayNum: d,
      month: month + 1,
      year: month === 11 ? year + 1 : year,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isPast: false,
    });
  }

  return days;
}

export interface ExtractedDateResult {
  date: string; // 'YYYY-MM-DD'
  label: string; // 'Sat 14 Nov'
  time?: string; // '19:30'
  matchedMemberId?: string;
}

export async function extractDatesWithGemini(
  cfg: AppConfig,
  text: string,
  squad: User[]
): Promise<ExtractedDateResult[]> {
  const now = new Date();
  const todayStr = toDateStr(now);
  const dayOfWeek = now.toLocaleDateString('en-GB', { weekday: 'long' });

  const prompt = `You are a smart date extractor for a group outing organizer in the UK.
Current date reference: Today is ${dayOfWeek}, ${todayStr} (Year: ${now.getFullYear()}).
Squad members: ${squad.map((u) => `${u.name} (id: ${u.id})`).join(', ')}.

Input text from group chat or user:
"""
${text}
"""

Task: Extract all dates (and optional times) mentioned or implied in the text.
Rules:
1. Resolve relative dates like "next Friday", "this Saturday", "tomorrow", "any weekend in November" relative to today (${todayStr}).
2. Format each extracted date strictly as "YYYY-MM-DD".
3. Provide a friendly UK label like "Sat 14 Nov".
4. If a time is mentioned (e.g. "7pm", "after 6", "14:30"), extract time as "HH:MM".
5. If the text mentions which squad member can make it (e.g. "Ben: Fri or Sat", "Sherlock says 14th"), set "matchedMemberId" to their corresponding squad id. Otherwise leave it null.
6. Return ONLY a valid JSON array of objects conforming to:
[
  {
    "date": "YYYY-MM-DD",
    "label": "Sat 14 Nov",
    "time": "19:00",
    "matchedMemberId": "u1"
  }
]
`;

  const model = cfg.md || 'gemini-flash-latest';
  const res = await fetch('/api/gemini/dates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const json = await res.json();
  const rawText = json.text || '';
  if (!rawText) return [];

  try {
    const parsed = JSON.parse(rawText);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    const start = rawText.indexOf('[');
    const end = rawText.lastIndexOf(']');
    if (start >= 0 && end > start) {
      return JSON.parse(rawText.slice(start, end + 1));
    }
    return [];
  }
}
