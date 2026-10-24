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
    if (!config.key) {
      onOpenSetup();
      setAiMsg('⚠️ Paste your Gemini API key in ⚙️ Setup first to use AI date extraction.');
      return;
    }
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
    <div className="space-y-3">
      {/* Interactive Calendar Card */}
      <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-4">
        {/* Calendar Header with Month Controls */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-[#ff6b57]" />
            <span className="font-display font-extrabold text-base text-[#f4f4f5]">
              {monthName}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToday}
              className="text-xs font-semibold px-2 py-1 rounded-lg bg-[#212124] text-[#8d8d94] hover:text-[#f4f4f5] border border-[#2b2b2f] transition cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg bg-[#212124] text-[#cfcfd4] hover:text-[#f4f4f5] border border-[#2b2b2f] transition cursor-pointer"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg bg-[#212124] text-[#cfcfd4] hover:text-[#f4f4f5] border border-[#2b2b2f] transition cursor-pointer"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="text-xs text-[#8d8d94] mb-2.5">
          👉 <b>Tap tap tap</b> any day you're free. Dates count up to show squad overlap!
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-[#8d8d94] mb-1">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span className="text-[#ff6b57]">Sat</span>
          <span className="text-[#ff6b57]">Sun</span>
        </div>

        {/* Calendar Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, idx) => {
            const slot = findSlotForDate(day.dateStr);
            const av = slot?.av || {};
            const voters = squad.filter((u) => av[u.id]);
            const isAligned = voters.length === squad.length && squad.length > 0;
            const isMyVote = me && av[me.id];

            let cellBg = 'bg-[#212124] border-[#2b2b2f] text-[#cfcfd4]';
            if (isAligned) {
              cellBg =
                'bg-[rgba(198,255,61,0.22)] border-[#c6ff3d] shadow-[0_0_10px_rgba(198,255,61,0.25)] text-[#f4f4f5]';
            } else if (voters.length > 1) {
              cellBg =
                'bg-[rgba(255,107,87,0.18)] border-[#ff6b57] text-[#f4f4f5]';
            } else if (voters.length === 1) {
              cellBg = 'bg-[#212124] border-[#3b3b40] text-[#f4f4f5]';
            }

            if (!day.isCurrentMonth) {
              cellBg = 'bg-[#17171a] border-transparent opacity-30 text-[#8d8d94]';
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleTapDate(day.dateStr)}
                disabled={isLocked || !day.isCurrentMonth}
                className={`relative min-h-[58px] p-1.5 rounded-xl border flex flex-col justify-between transition cursor-pointer select-none text-left ${cellBg} ${
                  isMyVote ? 'ring-1 ring-[#ff6b57]' : ''
                } hover:scale-[1.02] active:scale-95`}
              >
                {/* Top row: Day number and overlap count */}
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs font-semibold ${
                      day.isToday ? 'text-[#ff6b57] underline font-bold' : ''
                    }`}
                  >
                    {day.dayNum}
                  </span>
                  {voters.length > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1 rounded-md ${
                        isAligned
                          ? 'bg-[#c6ff3d] text-[#141a03]'
                          : 'bg-[#ff6b57] text-[#1a0703]'
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
      <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-sm font-bold text-[#f4f4f5]">
              📊 Date Overlap & Tally Ranking
            </div>
            <div className="text-xs text-[#8d8d94]">
              Dates sorted by highest squad overlap. Tap any row to toggle your vote!
            </div>
          </div>
        </div>

        {rankedSlots.length === 0 ? (
          <div className="text-center py-6 text-xs text-[#8d8d94]">
            No dates marked yet. Tap dates on the calendar above or use Gerg AI below!
          </div>
        ) : (
          <div className="space-y-2 mt-3">
            {rankedSlots.map(({ slot, voters, isAligned, count }) => {
              const d = whenOf(slot);
              const isMyVote = me && slot.av?.[me.id];
              const percent = squad.length > 0 ? Math.round((count / squad.length) * 100) : 0;
              const googleUrl = isAligned && d ? getGoogleCalendarUrl(slot, winVenue, config) : '';

              return (
                <div
                  key={slot.id}
                  onClick={() => handleToggleSlotVote(slot.id)}
                  className={`bg-[#212124] border rounded-2xl p-3.5 transition cursor-pointer hover:border-[#3b3b40] ${
                    isAligned
                      ? 'border-[#c6ff3d] bg-[rgba(198,255,61,0.06)]'
                      : isMyVote
                      ? 'border-[#ff6b57]'
                      : 'border-[#2b2b2f]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#f4f4f5]">
                          {slot.lbl}
                        </span>
                        {isAligned && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#c6ff3d] text-[#141a03]">
                            🎉 100% ALIGNED!
                          </span>
                        )}
                      </div>
                      {d && (
                        <div className="text-xs text-[#8d8d94] mt-0.5">
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
                        className={`text-xs font-semibold px-2.5 py-1 rounded-xl transition cursor-pointer flex items-center gap-1 ${
                          isMyVote
                            ? 'bg-[#c6ff3d] text-[#141a03]'
                            : 'bg-[#17171a] border border-[#2b2b2f] text-[#cfcfd4] hover:text-[#f4f4f5]'
                        }`}
                      >
                        {isMyVote ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Free
                          </>
                        ) : (
                          '+ I\'m Free'
                        )}
                      </button>
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSlot(slot.id, e)}
                          className="text-xs text-[#8d8d94] hover:text-[#ff6b57] p-1 cursor-pointer"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Overlap Tally Progress Bar */}
                  <div className="w-full bg-[#17171a] h-2.5 rounded-full overflow-hidden my-2">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isAligned ? 'bg-[#c6ff3d]' : 'bg-[#ff6b57]'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  {/* Voters List */}
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-[#8d8d94]">
                    <span>
                      {count} of {squad.length} squad members available ({percent}%):
                      {' '}{voters.map((u) => `${u.emo} ${u.name}`).join(', ') || 'None yet'}
                    </span>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={(e) => handleOpenExactTime(slot, e)}
                        className="text-[11px] text-[#cfcfd4] hover:text-[#ff6b57] flex items-center gap-1 cursor-pointer"
                      >
                        <Clock className="w-3 h-3" />
                        {d ? 'Change time' : 'Set time'}
                      </button>
                    )}
                  </div>

                  {/* Aligned Calendar Export Action */}
                  {isAligned && d && (
                    <div
                      className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-[#2b2b2f]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => downloadIcs(slot, winVenue, config)}
                        className="cursor-pointer bg-[#ff6b57] text-[#1a0703] font-semibold text-xs px-3 py-1.5 rounded-xl hover:brightness-105 transition"
                      >
                        📅 Add to Calendar (.ics)
                      </button>
                      <a
                        href={googleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cursor-pointer border border-[#2b2b2f] bg-[#17171a] text-[#f4f4f5] font-semibold text-xs px-3 py-1.5 rounded-xl hover:border-[#3b3b40] transition"
                      >
                        Google Calendar
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
        <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-[#ff6b57]" />
            <div className="text-xs font-bold text-[#f4f4f5]">
              Extract Dates with Gerg AI (Gemini)
            </div>
          </div>
          <div className="text-xs text-[#8d8d94] mb-2">
            Paste group chat availability or speak naturally (e.g. <i>"Free next Fri after 6pm, Sat 14th, or any weekend in Nov"</i>):
          </div>

          <textarea
            rows={2}
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder="Paste text from WhatsApp, Messenger, or type your availability..."
            className="w-full bg-[#212124] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] p-3 rounded-xl text-xs outline-none leading-relaxed resize-none"
          />

          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              disabled={aiLoading || !aiText.trim()}
              onClick={handleExtractDatesAI}
              className="cursor-pointer bg-[#ff6b57] text-[#1a0703] font-semibold text-xs px-3.5 py-2 rounded-xl hover:brightness-105 active:scale-95 transition disabled:opacity-50 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {aiLoading ? 'Extracting dates...' : '✨ Map to Calendar & Tallies'}
            </button>
            {aiText && (
              <button
                type="button"
                onClick={() => setAiText('')}
                className="text-xs text-[#8d8d94] hover:text-[#f4f4f5] px-2 py-1"
              >
                Clear
              </button>
            )}
          </div>

          {aiMsg && <div className="text-xs text-[#cfcfd4] mt-2 whitespace-pre-line">{aiMsg}</div>}
        </div>
      )}

      {/* Exact Time Modal */}
      {editingSlotId && (
        <div className="bg-[#212124] border border-[#ff6b57] rounded-2xl p-3.5">
          <div className="text-xs font-bold text-[#ff6b57] mb-1.5">
            Set exact time for calendar export
          </div>
          <input
            value={exactTimeInput}
            onChange={(e) => setExactTimeInput(e.target.value)}
            placeholder='e.g. "Sat 14 Nov 7:30pm" or "2026-11-14 19:30"'
            className="w-full bg-[#17171a] border border-[#2b2b2f] focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={handleSaveExactTime}
              className="cursor-pointer bg-[#c6ff3d] text-[#141a03] font-semibold text-xs px-3 py-1.5 rounded-xl"
            >
              Save Time
            </button>
            <button
              type="button"
              onClick={() => setEditingSlotId(null)}
              className="cursor-pointer text-xs text-[#8d8d94] hover:text-[#f4f4f5] px-2 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
