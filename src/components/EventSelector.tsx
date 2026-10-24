import React, { useState } from 'react';
import { OutingEvent, User } from '../types';
import { copyStr } from '../utils/storage';
import { fmtWhen, parseWhen, whenOf } from '../utils/dates';

interface EventSelectorProps {
  events: OutingEvent[];
  currentEvent: OutingEvent | null;
  onSelectEvent: (id: string) => void;
  onNewEvent: (data: { name: string; where: string; vibe: string; when: string; rollFree: boolean }) => void;
  onLockEvent: (id: string) => void;
  onUnlockEvent: (id: string) => void;
  onDeleteEvent: (id: string) => void;
  squad: User[];
  currentUser: User | null;
  configDb: string;
  configRm: string;
}

const VIBES = [
  '🪓 Competitive',
  '🍛 Curry',
  '🍺 Taproom',
  '🎤 Karaoke',
  '🎳 Bowling',
  '🔐 Escape room',
  '🎭 Comedy',
  '🎶 Live music',
  '🕹️ Arcade',
  '🏎️ Karting',
  '🧗 Climbing',
  '⛳ Crazy golf',
  '🍕 Pizza',
  '🍸 Cocktails',
];

export const EventSelector: React.FC<EventSelectorProps> = ({
  events,
  currentEvent,
  onSelectEvent,
  onNewEvent,
  onLockEvent,
  onUnlockEvent,
  onDeleteEvent,
  squad,
  currentUser,
  configDb,
  configRm,
}) => {
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [name, setName] = useState('');
  const [where, setWhere] = useState('');
  const [vibe, setVibe] = useState('');
  const [when, setWhen] = useState('');
  const [rollFree, setRollFree] = useState(true);
  const [newMsg, setNewMsg] = useState('');
  const [shareMsg, setShareMsg] = useState('');

  const winVenue = currentEvent
    ? currentEvent.venues.find((v) => v.id === currentEvent.win) || currentEvent.venues[0]
    : null;

  const evWhen = (e: OutingEvent): string => {
    const s = e.slots.find(
      (x) => squad.length > 0 && squad.every((u) => x.av && x.av[u.id])
    );
    if (s) {
      const w = whenOf(s);
      return w ? fmtWhen(w) : s.lbl;
    }
    return e.when || '';
  };

  const handleOpenNew = () => {
    if (!currentUser) {
      alert('👆 Tap your profile first (or + New Profile)');
      return;
    }
    setWhere(where || currentUser.loc || '');
    setIsNewOpen(true);
    setNewMsg('');
  };

  const handleAddVibe = (v: string) => {
    const label = v.split(' ').slice(1).join(' ');
    if (!vibe.toLowerCase().includes(label.toLowerCase())) {
      setVibe(vibe.trim() ? `${vibe.trim()}, ${label}` : label);
    }
  };

  const handleCreate = () => {
    if (!name.trim()) {
      setNewMsg('⚠️ Give the event a name');
      return;
    }
    onNewEvent({
      name: name.trim(),
      where: where.trim(),
      vibe: vibe.trim(),
      when: when.trim(),
      rollFree,
    });
    setName('');
    setVibe('');
    setWhen('');
    setIsNewOpen(false);
  };

  const handleShare = async () => {
    if (!currentEvent) return;
    const link =
      `${window.location.origin}${window.location.pathname}` +
      (configDb
        ? `?db=${encodeURIComponent(configDb)}&room=${encodeURIComponent(
            configRm
          )}&ev=${encodeURIComponent(currentEvent.id)}`
        : '');

    const text = `🍻 ${currentEvent.name} – come and vote on the plan`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Not The Greedy Banker', text, url: link });
        setShareMsg('✅ Shared event link!');
        return;
      } catch (e: any) {
        if (e.name === 'AbortError') return;
      }
    }

    const copied = await copyStr(`${text}\n${link}`);
    setShareMsg(copied ? '📋 Event link copied to clipboard!' : "❌ Couldn't copy link");
  };

  const whenStr = currentEvent ? evWhen(currentEvent) : '';

  return (
    <div className="bg-[#17171a] border border-[#ff6b57] rounded-2xl p-3.5 mb-3">
      <div className="flex items-center gap-2">
        <select
          value={currentEvent?.id || ''}
          onChange={(e) => onSelectEvent(e.target.value)}
          disabled={!events.length}
          className="flex-1 bg-[#212124] text-[#f4f4f5] px-3 py-2 rounded-xl text-sm font-bold font-display cursor-pointer outline-none border border-transparent focus:border-[#ff6b57]"
        >
          {events.length ? (
            events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.locked ? '🔒' : '🟡'} {e.name}
                {e.locked ? ' – locked in' : ''}
              </option>
            ))
          ) : (
            <option>No events yet</option>
          )}
        </select>
        <button
          type="button"
          onClick={handleOpenNew}
          className="cursor-pointer bg-[#ff6b57] text-[#1a0703] font-semibold text-xs px-3.5 py-2 rounded-xl hover:brightness-105 active:scale-95 transition whitespace-nowrap"
        >
          ➕ New event
        </button>
      </div>

      {currentEvent && (
        <div className="mt-2">
          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#cfcfd4]">
            {currentEvent.where && <span>📍 {currentEvent.where}</span>}
            {currentEvent.where && (currentEvent.vibe || whenStr) && <span>•</span>}
            {currentEvent.vibe && <span>✨ {currentEvent.vibe}</span>}
            {currentEvent.vibe && whenStr && <span>•</span>}
            {whenStr && <span>🗓️ {whenStr}</span>}
          </div>

          {/* Locked state banner */}
          {currentEvent.locked && (
            <div className="bg-[rgba(198,255,61,0.12)] border border-[#c6ff3d] rounded-xl p-2.5 mt-2">
              <div className="font-bold text-[#c6ff3d] text-xs">
                🔒 Locked in: {winVenue ? winVenue.name : 'TBC'}
                {whenStr ? ` – ${whenStr}` : ''}
              </div>
              <div className="text-[11px] text-[#8d8d94] mt-0.5">
                Voting's closed. The kitty stays open for settling up.
              </div>
            </div>
          )}

          {/* Event action buttons */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {currentEvent.locked ? (
              <button
                type="button"
                onClick={() => onUnlockEvent(currentEvent.id)}
                className="cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] font-semibold text-xs px-3 py-1.5 rounded-xl hover:border-[#3b3b40] transition"
              >
                🔓 Unlock
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onLockEvent(currentEvent.id)}
                className="cursor-pointer bg-[#c6ff3d] text-[#141a03] font-semibold text-xs px-3 py-1.5 rounded-xl hover:brightness-105 transition"
              >
                🔒 Lock it in
              </button>
            )}
            <button
              type="button"
              onClick={handleShare}
              className="cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] font-semibold text-xs px-3 py-1.5 rounded-xl hover:border-[#3b3b40] transition"
            >
              💬 Share event
            </button>
            <button
              type="button"
              onClick={() => onDeleteEvent(currentEvent.id)}
              className="cursor-pointer bg-[rgba(255,107,87,0.13)] text-[#ff6b57] font-semibold text-xs px-3 py-1.5 rounded-xl hover:bg-[rgba(255,107,87,0.2)] transition"
            >
              🗑️ Delete event
            </button>
          </div>

          {shareMsg && <div className="text-xs text-[#c6ff3d] mt-1.5">{shareMsg}</div>}
        </div>
      )}

      {/* New Event Drawer */}
      {isNewOpen && (
        <div className="mt-3 bg-[#212124] border border-[#2b2b2f] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-[#ff6b57]">➕ New event</div>
            <button
              type="button"
              onClick={() => setIsNewOpen(false)}
              className="text-xs text-[#8d8d94] hover:text-[#f4f4f5] cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What's the occasion? (e.g. Ben's birthday, Payday bash)"
              className="w-full bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                value={where}
                onChange={(e) => setWhere(e.target.value)}
                placeholder="Where (e.g. Rochester, Chatham)"
                className="w-full bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
              />
              <input
                value={vibe}
                onChange={(e) => setVibe(e.target.value)}
                placeholder="Vibe (e.g. competitive, curry, live music)"
                className="w-full bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
              />
            </div>
            <input
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              placeholder="When, roughly (optional, e.g. Sat 14 Nov 7pm)"
              className="w-full bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />

            {/* Quick vibe tags */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {VIBES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => handleAddVibe(v)}
                  className="cursor-pointer border border-[#2b2b2f] bg-[#17171a] text-[#cfcfd4] text-[11px] px-2.5 py-1 rounded-full hover:border-[#3b3b40] transition"
                >
                  {v}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-xs text-[#8d8d94] pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={rollFree}
                onChange={(e) => setRollFree(e.target.checked)}
                className="accent-[#ff6b57]"
              />
              <span>🎲 Start with free ideas from the map (no AI key needed)</span>
            </label>

            {newMsg && <div className="text-xs text-[#ff6b57]">{newMsg}</div>}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleCreate}
                className="cursor-pointer bg-[rgba(198,255,61,0.12)] text-[#c6ff3d] font-semibold text-xs px-3.5 py-2 rounded-xl hover:bg-[rgba(198,255,61,0.2)] active:scale-95 transition"
              >
                🚀 Create event
              </button>
              <button
                type="button"
                onClick={() => setIsNewOpen(false)}
                className="cursor-pointer border border-[#2b2b2f] bg-transparent text-[#8d8d94] font-semibold text-xs px-3 py-2 rounded-xl hover:text-[#f4f4f5] transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
