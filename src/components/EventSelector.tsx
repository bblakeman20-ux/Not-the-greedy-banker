import React, { useState, useEffect } from 'react';
import { OutingEvent, User } from '../types';
import { fmtWhen, whenOf } from '../utils/dates';
import {
  MapPin,
  Sparkles,
  Calendar,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Coins,
  Check,
  X,
  Pencil,
} from 'lucide-react';

interface EventSelectorProps {
  events: OutingEvent[];
  currentEvent: OutingEvent | null;
  onSelectEvent: (id: string) => void;
  onNewEvent: (data: { name: string; where: string; vibe: string; when: string; rollFree: boolean }) => void;
  onLockEvent: (id: string) => void;
  onUnlockEvent: (id: string) => void;
  onDeleteEvent: (id: string) => void;
  onUpdateEvent?: (ev: OutingEvent) => void;
  squad: User[];
  currentUser: User | null;
  configDb: string;
  configRm: string;
  onOpenProfileModal?: () => void;
}

const VIBES = [
  'Craft beer & darts',
  'Curry',
  'Taproom',
  'Karaoke',
  'Bowling',
  'Escape room',
  'Comedy',
  'Live music',
  'Arcade',
  'Crazy golf',
  'Cocktails',
  'Pizza',
];

export const EventSelector: React.FC<EventSelectorProps> = ({
  events,
  currentEvent,
  onSelectEvent,
  onNewEvent,
  onLockEvent,
  onUnlockEvent,
  onDeleteEvent,
  onUpdateEvent,
  squad,
  currentUser,
  onOpenProfileModal,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // New event form state
  const [newName, setNewName] = useState('');
  const [newWhere, setNewWhere] = useState('');
  const [newVibe, setNewVibe] = useState('');
  const [newWhen, setNewWhen] = useState('');
  const [newRollFree, setNewRollFree] = useState(false);
  const [newMsg, setNewMsg] = useState('');

  // Editable parameters for current event
  const [editWhere, setEditWhere] = useState(currentEvent?.where || '');
  const [editVibe, setEditVibe] = useState(currentEvent?.vibe || '');
  const [editWhen, setEditWhen] = useState(currentEvent?.when || '');
  const [editBudget, setEditBudget] = useState(currentEvent?.budget || '35');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(currentEvent?.name || '');

  // Synchronize edit fields when currentEvent changes
  useEffect(() => {
    if (currentEvent) {
      setEditWhere(currentEvent.where || '');
      setEditVibe(currentEvent.vibe || '');
      setEditWhen(currentEvent.when || '');
      setEditBudget(currentEvent.budget || '35');
      setRenameValue(currentEvent.name || '');
    }
  }, [currentEvent?.id, currentEvent?.name, currentEvent?.where, currentEvent?.vibe, currentEvent?.when, currentEvent?.budget]);

  const handleSaveRename = () => {
    if (!currentEvent || !onUpdateEvent || !renameValue.trim()) return;
    onUpdateEvent({
      ...currentEvent,
      name: renameValue.trim(),
    });
    setIsRenaming(false);
  };

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

  const whenStr = currentEvent ? evWhen(currentEvent) : '';
  const displayWhere = currentEvent?.where || 'Local';
  const displayVibe = currentEvent?.vibe || 'Craft beer & darts';
  const displayWhen = whenStr || currentEvent?.when || 'Sat 7pm';
  const displayBudget = currentEvent?.budget
    ? currentEvent.budget.startsWith('£')
      ? currentEvent.budget
      : `£${currentEvent.budget}`
    : '£35';

  const winVenue = currentEvent
    ? currentEvent.venues.find((v) => v.id === currentEvent.win) || currentEvent.venues[0]
    : null;

  const handleSaveParameters = () => {
    if (!currentEvent || !onUpdateEvent) return;
    onUpdateEvent({
      ...currentEvent,
      where: editWhere.trim(),
      vibe: editVibe.trim(),
      when: editWhen.trim(),
      budget: editBudget.trim().replace(/^£/, ''),
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleOpenNew = () => {
    if (!currentUser) {
      if (onOpenProfileModal) onOpenProfileModal();
      return;
    }
    setNewWhere(currentUser.loc || editWhere || '');
    setIsCreatingNew(true);
    setNewMsg('');
  };

  const handleCreate = () => {
    if (!newName.trim()) {
      setNewMsg('Give the outing plan a name first');
      return;
    }
    onNewEvent({
      name: newName.trim(),
      where: newWhere.trim(),
      vibe: newVibe.trim(),
      when: newWhen.trim(),
      rollFree: newRollFree,
    });
    setNewName('');
    setNewVibe('');
    setNewWhen('');
    setIsCreatingNew(false);
    setIsExpanded(false);
  };

  const handleAddVibeToEdit = (v: string) => {
    const label = v.trim();
    if (!editVibe.toLowerCase().includes(label.toLowerCase())) {
      const next = editVibe.trim() ? `${editVibe.trim()}, ${label}` : label;
      setEditVibe(next);
      if (currentEvent && onUpdateEvent) {
        onUpdateEvent({ ...currentEvent, vibe: next });
      }
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Compact Clickable Pill Bar with Prominent Event Header */}
      {currentEvent ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (!isRenaming) setIsExpanded(!isExpanded);
          }}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isRenaming) {
              e.preventDefault();
              setIsExpanded(!isExpanded);
            }
          }}
          className={`cursor-pointer w-full bg-card border rounded-2xl p-3 sm:px-4 sm:py-3 transition-all flex flex-col gap-2 text-xs sm:text-sm select-none shadow-md ${
            isExpanded
              ? 'border-primary bg-card shadow-[0_0_16px_color-mix(in_oklab,var(--accent)_15%,transparent)]'
              : 'border-line hover:border-line2 hover:bg-card'
          }`}
          title="Click to edit outing parameters or switch plans"
        >
          {/* Prominent Active Event Header Row */}
          <div className="flex items-center justify-between gap-2 border-b border-line/70 pb-2">
            {isRenaming ? (
              <div
                className="flex items-center gap-1.5 flex-1 min-w-0"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename();
                    if (e.key === 'Escape') setIsRenaming(false);
                  }}
                  autoFocus
                  placeholder="Event name (e.g., Friday Outing)"
                  className="bg-card2 border border-primary text-ink font-bold text-xs sm:text-sm px-2.5 py-1 rounded-lg outline-none flex-1 min-w-0"
                />
                <button
                  type="button"
                  onClick={handleSaveRename}
                  className="bg-secondary text-secondary-ink font-bold text-xs px-2.5 py-1 rounded-lg hover:brightness-105 active:scale-95 transition cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsRenaming(false)}
                  className="bg-line text-ink2 font-bold text-xs px-2 py-1 rounded-lg hover:text-ink transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-sm sm:text-base font-extrabold text-ink font-display flex items-center gap-1.5 truncate">
                  <span>🗓️</span>
                  <span className="truncate">{currentEvent.name || 'Squad Outing'}</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameValue(currentEvent.name || '');
                    setIsRenaming(true);
                  }}
                  title="Rename outing plan"
                  className="text-[11px] font-bold text-primary hover:text-ink bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-lg border border-primary/30 transition flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Rename</span>
                </button>
              </div>
            )}

            <div className="flex items-center shrink-0 text-primary font-bold text-xs bg-card2 border border-line hover:border-primary/40 px-2.5 py-1 rounded-xl">
              <span>{isExpanded ? 'Hide ▴' : 'Edit ▾'}</span>
            </div>
          </div>

          {/* Context Pills (Wrapped cleanly across 2 lines without truncation) */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink font-semibold min-w-0 flex-1 pt-0.5">
            <span className="inline-flex items-center gap-1 text-primary whitespace-nowrap">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{displayWhere}</span>
            </span>
            <span className="text-muted shrink-0">•</span>
            <span className="inline-flex items-center gap-1 text-secondary whitespace-nowrap">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{displayVibe}</span>
            </span>
            <span className="text-muted shrink-0">•</span>
            <span className="inline-flex items-center gap-1 text-secondary whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>{displayWhen}</span>
            </span>
            <span className="text-muted shrink-0">•</span>
            <span className="text-ink font-bold shrink-0 whitespace-nowrap">
              {displayBudget}
            </span>
            {Boolean(currentEvent.locked) && (
              <span className="text-[11px] font-bold text-secondary bg-secondary/15 border border-secondary/30 px-2 py-0.5 rounded shrink-0 flex items-center gap-1 whitespace-nowrap">
                <Lock className="w-2.5 h-2.5" />
                <span>{winVenue ? winVenue.name : 'Winner Decided'}</span>
              </span>
            )}
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsExpanded(!isExpanded)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsExpanded(!isExpanded);
            }
          }}
          className="cursor-pointer w-full bg-card border border-dashed border-primary/40 hover:border-primary rounded-2xl px-4 py-3 transition flex items-center justify-between gap-3 text-xs sm:text-sm select-none"
        >
          <div className="flex items-center gap-2 text-ink font-bold">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Blank Canvas · No Outing Plan Selected</span>
          </div>
          <div className="flex items-center gap-1 text-primary font-bold text-xs bg-primary/15 px-3 py-1 rounded-xl">
            <span>+ Create Plan</span>
          </div>
        </div>
      )}

      {/* Expandable Clean Drawer / Panel */}
      {isExpanded && (
        <div className="bg-card border border-line rounded-2xl p-4 sm:p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-150 shadow-xl">
          {/* Header & Plan Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                  Active Outing Plan
                </label>
                {currentEvent && (
                  <button
                    type="button"
                    onClick={() => {
                      setRenameValue(currentEvent.name || '');
                      setIsRenaming(true);
                    }}
                    className="text-[11px] font-bold text-primary hover:text-ink flex items-center gap-1 transition cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Rename Plan</span>
                  </button>
                )}
              </div>
              <select
                value={currentEvent?.id || ''}
                onChange={(e) => {
                  setConfirmDelete(false);
                  onSelectEvent(e.target.value);
                }}
                disabled={!events.length}
                className="w-full bg-card2 text-ink h-10 px-3 rounded-xl text-xs sm:text-sm font-bold cursor-pointer outline-none border border-line focus:border-primary transition"
              >
                {events.length ? (
                  events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.locked ? '[Locked] ' : ''}{e.name}
                      {e.locked ? ' – winner decided' : ''}
                    </option>
                  ))
                ) : (
                  <option>Blank Canvas (0 outing plans)</option>
                )}
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto pt-2 sm:pt-0">
              <button
                type="button"
                onClick={handleOpenNew}
                className="cursor-pointer bg-primary text-primary-ink font-bold text-xs h-10 px-3.5 rounded-xl hover:brightness-105 active:scale-95 transition whitespace-nowrap flex items-center gap-1 shadow-[0_0_12px_color-mix(in_oklab,var(--accent)_20%,transparent)]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Plan</span>
              </button>

              {currentEvent && (
                <>
                  {currentEvent.locked ? (
                    <button
                      type="button"
                      onClick={() => onUnlockEvent(currentEvent.id)}
                      className="cursor-pointer border border-line bg-card2 text-ink hover:text-ink font-bold text-xs h-10 px-3 rounded-xl hover:border-line2 transition whitespace-nowrap active:scale-95 flex items-center gap-1"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Unlock</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onLockEvent(currentEvent.id)}
                      className="cursor-pointer bg-secondary text-secondary-ink font-bold text-xs h-10 px-3.5 rounded-xl hover:brightness-105 transition whitespace-nowrap active:scale-95 shadow-[0_0_12px_color-mix(in_oklab,var(--good)_20%,transparent)] flex items-center gap-1"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Lock Winner</span>
                    </button>
                  )}

                  {confirmDelete ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDelete(false);
                          onDeleteEvent(currentEvent.id);
                        }}
                        className="cursor-pointer bg-primary text-primary-ink font-bold text-xs h-10 px-2.5 rounded-xl whitespace-nowrap"
                      >
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="cursor-pointer bg-card2 border border-line text-ink2 text-xs h-10 px-2 rounded-xl whitespace-nowrap"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="cursor-pointer text-muted hover:text-primary p-2 rounded-xl border border-transparent hover:border-line transition"
                      title="Delete this outing plan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Outing Parameters Form */}
          {currentEvent && !isCreatingNew && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-ink2 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>Outing Parameters</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-primary" />
                    <span>Where (Town / Area)</span>
                  </label>
                  <input
                    value={editWhere}
                    onChange={(e) => setEditWhere(e.target.value)}
                    placeholder="e.g. Rochester, Soho"
                    className="w-full bg-card2 border border-line focus:border-primary text-ink px-3 py-2 rounded-xl text-xs outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-secondary" />
                    <span>Vibe / Activity</span>
                  </label>
                  <input
                    value={editVibe}
                    onChange={(e) => setEditVibe(e.target.value)}
                    placeholder="e.g. Craft beer, darts"
                    className="w-full bg-card2 border border-line focus:border-primary text-ink px-3 py-2 rounded-xl text-xs outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-secondary" />
                    <span>When (Date / Time)</span>
                  </label>
                  <input
                    value={editWhen}
                    onChange={(e) => setEditWhen(e.target.value)}
                    placeholder="e.g. Sat 7pm"
                    className="w-full bg-card2 border border-line focus:border-primary text-ink px-3 py-2 rounded-xl text-xs outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1 flex items-center gap-1">
                    <Coins className="w-3 h-3 text-secondary" />
                    <span>Budget (£ / head)</span>
                  </label>
                  <input
                    inputMode="numeric"
                    value={editBudget}
                    onChange={(e) => setEditBudget(e.target.value)}
                    placeholder="e.g. 35"
                    className="w-full bg-card2 border border-line focus:border-primary text-ink px-3 py-2 rounded-xl text-xs outline-none transition"
                  />
                </div>
              </div>

              {/* Quick vibe tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {VIBES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => handleAddVibeToEdit(v)}
                    className="cursor-pointer border border-line bg-card2 text-ink2 text-[11px] px-2.5 py-1 rounded-lg hover:border-primary/40 hover:text-ink transition whitespace-nowrap active:scale-95"
                  >
                    + {v}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-secondary font-semibold">
                  {savedSuccess && '✓ Parameters updated!'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveParameters}
                    className="cursor-pointer bg-secondary text-secondary-ink font-bold text-xs h-9 px-4 rounded-xl hover:brightness-105 active:scale-95 transition flex items-center gap-1 shadow-[0_0_12px_color-mix(in_oklab,var(--good)_20%,transparent)]"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Save Parameters</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className="cursor-pointer border border-line bg-card2 text-muted hover:text-ink font-semibold text-xs h-9 px-3.5 rounded-xl transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* New Event Form */}
          {isCreatingNew && (
            <div className="bg-card2 border border-line rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <div className="text-xs font-bold text-ink uppercase tracking-wider">
                  Create New Outing Plan
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="text-xs text-muted hover:text-ink cursor-pointer p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Plan name (e.g. Payday Drinks, Saturday Crawl)"
                  className="sm:col-span-2 w-full bg-card border border-line focus:border-primary text-ink h-9 px-3 rounded-xl text-xs outline-none"
                />
                <input
                  value={newWhere}
                  onChange={(e) => setNewWhere(e.target.value)}
                  placeholder="Where (e.g. Rochester, Soho)"
                  className="w-full bg-card border border-line focus:border-primary text-ink h-9 px-3 rounded-xl text-xs outline-none"
                />
                <input
                  value={newVibe}
                  onChange={(e) => setNewVibe(e.target.value)}
                  placeholder="Vibe (e.g. Craft beer, darts)"
                  className="w-full bg-card border border-line focus:border-primary text-ink h-9 px-3 rounded-xl text-xs outline-none"
                />
                <input
                  value={newWhen}
                  onChange={(e) => setNewWhen(e.target.value)}
                  placeholder="When (e.g. Sat 7pm)"
                  className="sm:col-span-2 w-full bg-card border border-line focus:border-primary text-ink h-9 px-3 rounded-xl text-xs outline-none"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={newRollFree}
                  onChange={(e) => setNewRollFree(e.target.checked)}
                  className="accent-primary"
                />
                <span>Seed plan with initial spots</span>
              </label>

              {newMsg && <div className="text-xs text-primary">{newMsg}</div>}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCreate}
                  className="cursor-pointer bg-primary text-primary-ink font-bold text-xs h-9 px-4 rounded-xl hover:brightness-105 active:scale-95 transition"
                >
                  Create Plan
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="cursor-pointer border border-line bg-transparent text-muted font-semibold text-xs h-9 px-3.5 rounded-xl hover:text-ink transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
