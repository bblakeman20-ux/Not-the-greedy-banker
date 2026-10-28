import React, { useState } from 'react';
import { AppConfig, OutingEvent, Slot, User } from '../../types';
import { downloadIcs, fmtWhen, getGoogleCalendarUrl, isoLocal, parseWhen, whenOf } from '../../utils/dates';
import {
  CalendarDay,
  extractDatesWithGemini,
  fmtDayLabel,
  fromDateStr,
  getCalendarGrid,
  toDateStr,
} from '../../utils/calendar';
import { ChevronLeft, ChevronRight, Sparkles, Calendar as CalendarIcon, Clock, Trash2, Check, UserCheck } from 'lucide-react';
import confetti from 'canvas-confetti';

interface DatesTabProps {
  event: OutingEvent;
  squad: User[];
  currentUser: User | null;
  config: AppConfig;
  onUpdateEvent: (ev: OutingEvent) => void;
  onOpenSetup: () => void;
  onShowToast?: (msg: string) => void;
}

export const DatesTab: React.FC<DatesTabProps> = ({
  event,
  squad,
  currentUser,
  config,
  onUpdateEvent,
  onOpenSetup,
  onShowToast,
}) => {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Natural Language Date Extractor state
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMsg, setAiMsg] = useState('');

  // Exact time dialog
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [exactTimeInput, setExactTimeInput] = useState('');

  const isLocked = Boolean(event.locked);
  const me = currentUser;

  const notify = (msg: string) => {
    if (onShowToast) onShowToast(msg);
  };

  const allIn = (av?: Record<string, number | null>): boolean =>
    squad.length > 0 && squad.every((u) => av && av[u.id]);

  // Navigate months
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  // Find slot for a given dateStr 'YYYY-MM-DD'
  const findSlotForDate = (dateStr: string): Slot | undefined => {
    return event.slots.find((s) => {
      if (s.date === dateStr) return true;
      if (s.at && s.at.startsWith(dateStr)) return true;
      const w = whenOf(s);
      if (w && toDateStr(w) === dateStr) return true;
      return false;
    });
  };

  // Tap date on calendar grid -> toggle availability for active user
  const handleTapDate = (dateStr: string) => {
    if (isLocked) {
      notify('🔒 This event is locked in – tap 🔓 Unlock to change dates');
      return;
    }
    if (!me) {
      notify('👆 Tap your profile first in the squad bar above (or + New Profile)');
      return;
    }

    const existingSlot = findSlotForDate(dateStr);
    let slots: Slot[];

    if (existingSlot) {
      // Toggle vote on existing slot
      const av = { ...(existingSlot.av || {}) };
      const wasAll = allIn(av);
      av[me.id] = av[me.id] ? null : 1;
      const isNowAll = allIn(av);

      if (!wasAll && isNowAll) {
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      }

      // Check if slot has no votes left, keep it or remove
      slots = event.slots.map((s) =>
        s.id === existingSlot.id ? { ...s, av } : s
      );
    } else {
      // Create new date slot with 1 vote from current user
      const lbl = fmtDayLabel(dateStr);
      const newSlot: Slot = {
        id: 's_' + dateStr.replace(/-/g, '_'),
        lbl,
        date: dateStr,
        at: `${dateStr}T19:00`,
        av: { [me.id]: 1 },
      };

      if (squad.length === 1) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      }

      slots = [...event.slots, newSlot];
    }

    onUpdateEvent({ ...event, slots });
  };

  // Direct toggle on tally chart row
  const handleToggleSlotVote = (slotId: string) => {
    if (isLocked) return;
    if (!me) {
      notify('👆 Tap your profile first in the squad bar above (or + New Profile)');
      return;
    }

    const slots = event.slots.map((s) => {
      if (s.id !== slotId) return s;
      const av = { ...(s.av || {}) };
      const wasAll = allIn(av);
      av[me.id] = av[me.id] ? null : 1;
      const isNowAll = allIn(av);

      if (!wasAll && isNowAll) {
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      }
      return { ...s, av };
    });

    onUpdateEvent({ ...event, slots });
  };

  const handleDeleteSlot = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isLocked) return;
    const s = event.slots.find((x) => x.id === id);
    if (s) {
      const slots = event.slots.filter((x) => x.id !== id);
      onUpdateEvent({ ...event, slots });
      notify(`🗑️ Removed date "${s.lbl}"`);
    }
  };

  const handleOpenExactTime = (slot: Slot, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isLocked) return;
    setEditingSlotId(slot.id);
    const d = whenOf(slot);
    setExactTimeInput(d ? fmtWhen(d) : slot.lbl);
  };

  const handleSaveExactTime = () => {
    if (!editingSlotId) return;
    const d = parseWhen(exactTimeInput);
    if (!d) {
      notify("🤔 Couldn't read that date – try '7 Nov 7:30pm'");
      return;
    }
    const slots = event.slots.map((s) =>
      s.id === editingSlotId
        ? {
            ...s,
            at: isoLocal(d),
            date: toDateStr(d),
            time: `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`,
            lbl: fmtWhen(d),
          }
        : s
    );
    onUpdateEvent({ ...event, slots });
    setEditingSlotId(null);
  };

  // Handle AI Natural Language Extraction
  const handleExtractDatesAI = async () => {
    if (!aiText.trim()) return;

    setAiLoading(true);
    setAiMsg('🤖 Gerg AI is reading your text and mapping days...');

    try {
      const extracted = await extractDatesWithGemini(config, aiText, squad);
      if (!extracted.length) {
        setAiMsg("🤷 Couldn't find specific dates in that text – try mentioning days like 'next Sat' or 'Nov 14th'.");
        return;
      }

      let updatedSlots = [...event.slots];
      const newlyMappedLabels: string[] = [];

      extracted.forEach((item) => {
        const targetUserId = item.matchedMemberId || me?.id;
        if (!targetUserId) return;

        const existing = updatedSlots.find(
          (s) => s.date === item.date || (s.at && s.at.startsWith(item.date))
        );

        if (existing) {
          existing.av = { ...(existing.av || {}), [targetUserId]: 1 };
          newlyMappedLabels.push(existing.lbl);
        } else {
          const newSlot: Slot = {
            id: 's_' + item.date.replace(/-/g, '_'),
            date: item.date,
            lbl: item.label || fmtDayLabel(item.date),
            time: item.time,
            at: item.time ? `${item.date}T${item.time}` : `${item.date}T19:00`,
            av: { [targetUserId]: 1 },
          };
          updatedSlots.push(newSlot);
          newlyMappedLabels.push(newSlot.lbl);
        }
      });

      onUpdateEvent({ ...event, slots: updatedSlots });
      setAiMsg(`✅ Mapped ${extracted.length} date${extracted.length > 1 ? 's' : ''}: ${newlyMappedLabels.join(', ')}`);
      setAiText('');

      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    } catch (e: any) {
      setAiMsg(`❌ ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Calendar grid calculation
  const calendarDays = getCalendarGrid(viewYear, viewMonth);
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  // Tally Chart ranking calculation
  const rankedSlots = [...event.slots]
    .map((s) => {
      const voters = squad.filter((u) => s.av && s.av[u.id]);
      const isAligned = allIn(s.av);
      return { slot: s, voters, isAligned, count: voters.length };
    })
    .sort((a, b) => b.count - a.count);

  const winVenue = event.venues.find((v) => v.id === event.win) || event.venues[0] || null;

  return (
    <div className="space-y-5">
      {/* Interactive Calendar Card */}
      <div className="bg-card border border-line rounded-2xl p-5 space-y-4">
        {/* Calendar Header with Month Controls */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-primary" />
              <span className="font-display font-extrabold text-base text-ink">
                {monthName}
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Tap any day you're free — dates count up to show squad overlap
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToday}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-card2 text-muted hover:text-ink border border-line transition cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl bg-card2 text-ink2 hover:text-ink border border-line transition cursor-pointer"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl bg-card2 text-ink2 hover:text-ink border border-line transition cursor-pointer"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold text-muted">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span className="text-primary">Sat</span>
          <span className="text-primary">Sun</span>
        </div>

        {/* Calendar Days Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {calendarDays.map((day, idx) => {
            const slot = findSlotForDate(day.dateStr);
            const av = slot?.av || {};
            const voters = squad.filter((u) => av[u.id]);
            const isAligned = voters.length === squad.length && squad.length > 0;
            const isMyVote = me && av[me.id];

            let cellBg = 'bg-card2 border-line text-ink2';
            if (isAligned) {
              cellBg =
                'bg-[color-mix(in_oklab,var(--good)_22%,transparent)] border-secondary shadow-[0_0_10px_color-mix(in_oklab,var(--good)_25%,transparent)] text-ink';
            } else if (voters.length > 1) {
              cellBg =
                'bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] border-primary text-ink';
            } else if (voters.length === 1) {
              cellBg = 'bg-card2 border-line2 text-ink';
            }

            if (!day.isCurrentMonth) {
              cellBg = 'bg-card border-transparent opacity-30 text-muted';
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleTapDate(day.dateStr)}
                disabled={isLocked || !day.isCurrentMonth}
                className={`relative min-h-[60px] p-2 rounded-xl border flex flex-col justify-between transition cursor-pointer select-none text-left ${cellBg} ${
                  isMyVote ? 'ring-1 ring-primary' : ''
                } hover:scale-[1.02] active:scale-95`}
              >
                {/* Top row: Day number and overlap count */}
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs font-semibold ${
                      day.isToday ? 'text-primary underline font-bold' : ''
                    }`}
                  >
                    {day.dayNum}
                  </span>
                  {voters.length > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1 rounded-md ${
                        isAligned
                          ? 'bg-secondary text-secondary-ink'
                          : 'bg-primary text-primary-ink'
                      }`}
                    >
                      {voters.length}/{squad.length}
                    </span>
                  )}
                </div>

                {/* Bottom row: Squad emoji chips */}
                {voters.length > 0 ? (
                  <div className="flex items-center -space-x-1 overflow-hidden mt-1">
                    {voters.map((u) => (
                      <span
                        key={u.id}
                        className="text-xs leading-none"
                        title={`${u.name} is free`}
                      >
                        {u.emo}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="h-3" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Overlap Tally Chart */}
      <div className="bg-card border border-line rounded-2xl p-5 space-y-4">
        <div>
          <div className="text-sm font-bold text-ink font-display">
            📊 Date Overlap & Tally Ranking
          </div>
          <div className="text-xs text-muted mt-0.5">
            Dates sorted by highest squad overlap. Tap any row to toggle your availability.
          </div>
        </div>

        {rankedSlots.length === 0 ? (
          <div className="bg-card2 border border-line rounded-xl text-center py-6 text-xs text-muted">
            No dates marked yet. Tap dates on the calendar above or extract availability below!
          </div>
        ) : (
          <div className="space-y-3">
            {rankedSlots.map(({ slot, voters, isAligned, count }) => {
              const d = whenOf(slot);
              const isMyVote = me && slot.av?.[me.id];
              const percent = squad.length > 0 ? Math.round((count / squad.length) * 100) : 0;
              const googleUrl = isAligned && d ? getGoogleCalendarUrl(slot, winVenue, config) : '';

              return (
                <div
                  key={slot.id}
                  onClick={() => handleToggleSlotVote(slot.id)}
                  className={`bg-card2 border rounded-xl p-4 transition cursor-pointer hover:border-line2 space-y-2.5 ${
                    isAligned
                      ? 'border-secondary bg-[color-mix(in_oklab,var(--good)_6%,transparent)]'
                      : isMyVote
                      ? 'border-primary'
                      : 'border-line'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-ink">
                          {slot.lbl}
                        </span>
                        {isAligned && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-secondary text-secondary-ink">
                            🎉 100% ALIGNED
                          </span>
                        )}
                      </div>
                      {d && (
                        <div className="text-xs text-muted mt-0.5">
                          🗓️ {fmtWhen(d)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSlotVote(slot.id);
                        }}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                          isMyVote
                            ? 'bg-secondary text-secondary-ink'
                            : 'bg-card border border-line text-ink2 hover:text-ink'
                        }`}
                      >
                        {isMyVote ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Free
                          </>
                        ) : (
                          "+ I'm Free"
                        )}
                      </button>
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSlot(slot.id, e)}
                          className="text-xs text-muted hover:text-primary p-1.5 cursor-pointer"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Overlap Tally Progress Bar */}
                  <div className="w-full bg-card h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isAligned ? 'bg-secondary' : 'bg-primary'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  {/* Voters List */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                    <span>
                      {count}/{squad.length} available ({percent}%) ·{' '}
                      {voters.map((u) => `${u.emo} ${u.name}`).join(', ') || 'None yet'}
                    </span>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={(e) => handleOpenExactTime(slot, e)}
                        className="text-[11px] text-ink2 hover:text-primary flex items-center gap-1 cursor-pointer"
                      >
                        <Clock className="w-3 h-3" />
                        {d ? 'Change time' : 'Set time'}
                      </button>
                    )}
                  </div>

                  {/* Aligned Calendar Export Action */}
                  {isAligned && d && (
                    <div
                      className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-line"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => downloadIcs(slot, winVenue, config)}
                        className="cursor-pointer bg-primary text-primary-ink font-semibold text-xs px-3 py-1.5 rounded-lg hover:brightness-105 transition"
                      >
                        📅 Download .ics
                      </button>
                      <a
                        href={googleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cursor-pointer border border-line bg-card text-ink font-semibold text-xs px-3 py-1.5 rounded-lg hover:border-line2 transition"
                      >
                        Google Calendar ↗
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Gemini AI Natural Language Date Extractor Card */}
      {!isLocked && (
        <div className="bg-card border border-line rounded-2xl p-5 space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <div className="text-sm font-bold text-ink font-display">
                Extract Dates with Gerg AI
              </div>
            </div>
            <div className="text-xs text-muted mt-0.5">
              Paste group chat availability or type naturally (e.g. <i>"Free next Fri after 6pm, Sat 14th, or any weekend in Nov"</i>)
            </div>
          </div>

          <textarea
            rows={2}
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder="Paste text from WhatsApp, Messenger, or type your availability..."
            className="w-full bg-card2 border border-line focus:border-primary text-ink p-3.5 rounded-xl text-xs outline-none leading-relaxed resize-none"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={aiLoading || !aiText.trim()}
              onClick={handleExtractDatesAI}
              className="cursor-pointer bg-primary text-primary-ink font-semibold text-xs px-4 py-2.5 rounded-xl hover:brightness-105 active:scale-95 transition disabled:opacity-50 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {aiLoading ? 'Extracting dates...' : '✨ Map to Calendar & Tallies'}
            </button>
            {aiText && (
              <button
                type="button"
                onClick={() => setAiText('')}
                className="text-xs text-muted hover:text-ink px-2.5 py-1.5"
              >
                Clear
              </button>
            )}
          </div>

          {aiMsg && <div className="text-xs text-ink2 whitespace-pre-line">{aiMsg}</div>}
        </div>
      )}

      {/* Exact Time Modal */}
      {editingSlotId && (
        <div className="bg-card border border-primary rounded-2xl p-5 space-y-3">
          <div className="text-xs font-bold text-primary">
            Set exact time for calendar export
          </div>
          <input
            value={exactTimeInput}
            onChange={(e) => setExactTimeInput(e.target.value)}
            placeholder='e.g. "Sat 14 Nov 7:30pm" or "2026-11-14 19:30"'
            className="w-full bg-card2 border border-line focus:border-primary text-ink px-3.5 py-2.5 rounded-xl text-xs outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveExactTime}
              className="cursor-pointer bg-secondary text-secondary-ink font-semibold text-xs px-3.5 py-2 rounded-xl"
            >
              Save Time
            </button>
            <button
              type="button"
              onClick={() => setEditingSlotId(null)}
              className="cursor-pointer text-xs text-muted hover:text-ink px-2.5 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
