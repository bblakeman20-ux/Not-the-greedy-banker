import React, { useEffect, useState } from 'react';
import { OutingEvent, User, Venue } from '../../types';
import { normName } from '../../utils/storage';
import { who } from '../../utils/kitty';
import { liveBountiesFor } from '../../utils/eventActions';
import { VenueCard } from './VenueCard';
import { AlertTriangle, Check, CheckCircle2, Clock, Dices, Flame, Home, Plus, RotateCcw, Send, Sparkles, ThumbsDown, Trash2, X } from 'lucide-react';

interface ShortlistPanelProps {
  event: OutingEvent;
  squad: User[];
  me: User | null;
  now: number;
  isLocked: boolean;
  topContenders: Venue[];
  soloPitches: Venue[];
  coldPassedVenues: Venue[];
  winVenue?: Venue;
  spinningId: string | null;
  spinMsg: string;
  canUndoSpin: boolean;
  onSpin: () => void;
  onUndoSpin: () => void;
  onClearSpinMsg: () => void;
  onVote: (venueId: string, type: 'k' | 'p') => void;
  onLockIn: (venueId: string) => void;
  onDelete: (venueId: string) => void;
  onPitch: (name: string, loc: string) => boolean;
  onBailout: () => void;
  onHideBounty: (id: string) => void;
  onTrim: () => void;
  onPitchHouse?: (user: User) => void;
  onGoDiscover: () => void;
  onOpenPintdr: () => void;
}

const clock = (ms: number): string => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

// Bounty alerts, host offers, roulette and the tiered, voted shortlist.
export const ShortlistPanel: React.FC<ShortlistPanelProps> = ({
  event,
  squad,
  me,
  now,
  isLocked,
  topContenders,
  soloPitches,
  coldPassedVenues,
  winVenue,
  spinningId,
  spinMsg,
  canUndoSpin,
  onSpin,
  onUndoSpin,
  onClearSpinMsg,
  onVote,
  onLockIn,
  onDelete,
  onPitch,
  onBailout,
  onHideBounty,
  onTrim,
  onPitchHouse,
  onGoDiscover,
  onOpenPintdr,
}) => {
  const [expandedVenueId, setExpandedVenueId] = useState<string | null>(null);
  const [showSoloPitches, setShowSoloPitches] = useState(false);
  const [showGraveyard, setShowGraveyard] = useState(false);
  const [bountyName, setBountyName] = useState('');
  const [bountyLoc, setBountyLoc] = useState('');

  const mine = liveBountiesFor(event, me?.id, now)[0];

  // A fresh veto clock starts with the vetoed venue's area pre-filled
  useEffect(() => {
    if (!mine) return;
    setBountyName('');
    setBountyLoc(event.venues.find((v) => v.id === mine.vid)?.loc || event.where || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine?.id]);

  const renderCard = (v: Venue) => (
    <VenueCard
      key={v.id}
      venue={v}
      squad={squad}
      me={me}
      isWinner={event.win === v.id}
      isSpinning={spinningId === v.id}
      isLocked={isLocked}
      isExpanded={expandedVenueId === v.id}
      onToggleExpand={() => setExpandedVenueId(expandedVenueId === v.id ? null : v.id)}
      onVote={onVote}
      onLockIn={onLockIn}
      onDelete={onDelete}
    />
  );

  return (
    <div className="space-y-4">
      {!isLocked && mine && (
        <div className="bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] border border-primary/50 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-primary flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-primary" />
              <span>Active Veto Bounty</span>
            </div>
            <span className="cd text-lg">{clock(mine.until - now)}</span>
          </div>
          <div className="text-xs text-ink2 leading-relaxed">
            You vetoed <b>{mine.vname}</b>. Pitch a replacement before the clock hits zero or
            it's default-planning inertia — and you owe the squad a round!
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={bountyName}
              onChange={(e) => setBountyName(e.target.value)}
              placeholder="Your replacement venue / activity"
              className="bg-card border border-line focus:border-primary text-ink px-3.5 py-2.5 rounded-xl text-xs outline-none"
            />
            <input
              value={bountyLoc}
              onChange={(e) => setBountyLoc(e.target.value)}
              placeholder="Town / Station"
              className="bg-card border border-line focus:border-primary text-ink px-3.5 py-2.5 rounded-xl text-xs outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (onPitch(bountyName, bountyLoc)) {
                  setBountyName('');
                  setBountyLoc('');
                }
              }}
              className="flex-1 cursor-pointer bg-primary text-primary-ink font-semibold text-xs px-4 py-2.5 rounded-xl hover:brightness-105 active:scale-95 transition flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Pitch Replacement</span>
            </button>
            <button
              type="button"
              onClick={onBailout}
              className="cursor-pointer border border-line bg-card2 text-ink font-semibold text-xs px-4 py-2.5 rounded-xl hover:border-line2 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Gerg AI Bailout</span>
            </button>
          </div>
        </div>
      )}

      {/* Squad Bounties (Active Alerts) */}
      {!isLocked &&
        (event.bounties || []).some(
          (b) =>
            (!b.done && now < b.until && b.uid !== me?.id) ||
            (!b.done && now >= b.until && !b.hide)
        ) && (
          <div className="bg-card border border-line rounded-2xl p-4 space-y-2.5">
            {(event.bounties || [])
              .filter(
                (b) =>
                  (!b.done && now < b.until && b.uid !== me?.id) ||
                  (!b.done && now >= b.until && !b.hide)
              )
              .map((b) => {
                const u = who(b.uid, squad);
                const isLive = !b.done && now < b.until;
                return isLive ? (
                  <div
                    key={b.id}
                    className="flex items-center justify-between bg-card2 border border-primary/50 rounded-xl px-3.5 py-2.5 text-xs"
                  >
                    <span className="text-ink2 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>
                        <b>{u?.emo ? `${u.emo} ` : ''}{u?.name || 'Someone'}</b> vetoed <b>{b.vname}</b> · must pitch a replacement
                      </span>
                    </span>
                    <span className="cd">{clock(b.until - now)}</span>
                  </div>
                ) : (
                  <div
                    key={b.id}
                    className="flex items-center justify-between bg-card2 border border-line rounded-xl px-3.5 py-2.5 text-xs"
                  >
                    <span className="text-primary flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>
                        <b>{u?.emo ? `${u.emo} ` : ''}{u?.name || 'Someone'}</b> vetoed <b>{b.vname}</b> and pitched nothing · owes the first round
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onHideBounty(b.id)}
                      className="cursor-pointer text-xs bg-card hover:bg-line text-ink px-2.5 py-1 rounded-lg border border-line flex items-center gap-1"
                    >
                      <Check className="w-3 h-3 text-secondary" />
                      <span>Bought it</span>
                    </button>
                  </div>
                );
              })}
          </div>
        )}

      {/* Voted Venues & Shortlist Section */}
      <div className="space-y-4">
        {/* Unpitched Squad Host Offers */}
        {!isLocked && onPitchHouse && squad.some((u) => u.offersHouse) && (
          (() => {
            const unpitchedHosts = squad.filter(
              (u) =>
                u.offersHouse &&
                !event.venues.some((v) => normName(v.name).includes(normName(u.name)))
            );
            if (!unpitchedHosts.length) return null;
            return (
              <div className="space-y-2 pb-2 border-b border-line/70">
                {unpitchedHosts.map((h) => (
                  <div
                    key={h.id}
                    className="bg-[color-mix(in_oklab,var(--good)_6%,transparent)] border border-secondary/30 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-bold text-secondary flex items-center gap-1.5 flex-wrap">
                        <Home className="w-4 h-4 text-secondary shrink-0" />
                        <span>{h.emo ? `${h.emo} ` : ''}{h.name} offered to host at their place ({h.loc})</span>
                      </div>
                      <p className="text-ink2 text-[11px] truncate sm:whitespace-normal">
                        {h.houseNote || 'House outing / pre-drinks – BYOB, games & tunes with zero pub markup.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPitchHouse(h)}
                      className="cursor-pointer bg-secondary text-secondary-ink font-bold text-xs px-3.5 py-1.5 rounded-lg hover:brightness-105 active:scale-95 transition whitespace-nowrap shrink-0 self-start sm:self-auto flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Pitch {h.name}'s Place</span>
                    </button>
                  </div>
                ))}
              </div>
            );
          })()
        )}

        {/* Shortlist Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <h3 className="text-sm font-bold text-ink font-display flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span>Squad Shortlist & Votes ({event.venues.length})</span>
          </h3>

          {!isLocked && event.venues.length > 0 && (
            <div className="flex items-center gap-2">
              {soloPitches.length > 0 && (
                <button
                  type="button"
                  onClick={onTrim}
                  className="cursor-pointer border border-line bg-card2 hover:border-primary/60 text-ink2 hover:text-ink font-semibold text-xs px-3 py-1.5 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 active:scale-95"
                  title="Purge all 1-vote solo pitches that haven't been seconded"
                >
                  <Trash2 className="w-3.5 h-3.5 text-primary" />
                  <span>Trim Deadwood ({soloPitches.length})</span>
                </button>
              )}
              {Boolean(spinMsg || canUndoSpin) && (
                <button
                  type="button"
                  onClick={onUndoSpin}
                  className="cursor-pointer border border-line bg-card2 text-ink2 hover:text-ink hover:border-primary/50 font-semibold text-xs px-3 py-1.5 rounded-xl transition whitespace-nowrap flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
              )}
              <button
                type="button"
                onClick={onSpin}
                className="cursor-pointer bg-primary text-primary-ink font-bold text-xs px-3.5 py-1.5 rounded-xl hover:brightness-105 active:scale-95 transition whitespace-nowrap flex items-center gap-1.5 shadow-[0_0_12px_color-mix(in_oklab,var(--accent)_25%,transparent)]"
              >
                <Dices className="w-4 h-4" />
                <span>Spin Roulette</span>
              </button>
            </div>
          )}
        </div>

        {spinMsg && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-primary bg-card2 border border-primary/40 px-3.5 py-2.5 rounded-xl">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>{spinMsg}</span>
            </span>
            {!isLocked && !spinningId && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onUndoSpin}
                  className="cursor-pointer bg-card border border-line hover:border-primary text-ink font-semibold text-[11px] px-2.5 py-1 rounded-lg transition whitespace-nowrap flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Undo Roulette</span>
                </button>
                <button
                  type="button"
                  title="Remove message"
                  onClick={onClearSpinMsg}
                  className="cursor-pointer text-muted hover:text-ink p-1 rounded transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {event.venues.length === 0 ? (
          <div className="bg-card border-2 border-dashed border-line rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-primary flex items-center justify-center mx-auto text-xl shadow-inner">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-display font-black text-base sm:text-lg text-ink">
                No ideas on the shortlist yet
              </h4>
              <p className="text-xs text-ink2 mt-1 max-w-sm mx-auto leading-relaxed">
                Kick off the squad plan by generating ideas with Gerg AI, swiping matches in Pintdr, or browsing the interactive map.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1 max-w-md mx-auto">
              <button
                type="button"
                onClick={onGoDiscover}
                className="w-full sm:w-auto cursor-pointer bg-primary hover:brightness-110 active:scale-95 text-primary-ink font-bold text-xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-primary/20"
              >
                <Sparkles className="w-3.5 h-3.5 fill-current" />
                <span>✨ Go to Gerg AI Generator</span>
              </button>
              <button
                type="button"
                onClick={onOpenPintdr}
                className="w-full sm:w-auto cursor-pointer bg-card2 hover:bg-line border border-primary/40 hover:border-primary text-ink font-bold text-xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5 active:scale-95 shadow-md"
              >
                <Flame className="w-3.5 h-3.5 text-primary fill-current" />
                <span>Launch Pintdr Swipe Deck</span>
              </button>
            </div>
          </div>
        ) : isLocked ? (
          <div className="space-y-3">
            {winVenue && renderCard(winVenue)}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tier 1: Top Contenders (2+ Keen or Outing Winner) */}
            {topContenders.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-secondary flex items-center justify-between px-1">
                  <span className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 fill-current" />
                    <span>Top Contenders (2+ Keen / Majority)</span>
                  </span>
                  <span className="text-[10px] text-muted">{topContenders.length} spots</span>
                </div>
                <div className="space-y-2">
                  {topContenders.map((v) => renderCard(v))}
                </div>
              </div>
            )}

            {/* Tier 2: Solo Pitches (1 Vote, Needs a Seconder) */}
            {soloPitches.length > 0 && (
              event.venues.length > 5 ? (
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowSoloPitches(!showSoloPitches)}
                    className="w-full cursor-pointer flex items-center justify-between bg-card border border-line hover:border-line2 rounded-xl px-4 py-2.5 text-xs text-ink2 font-semibold transition"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>🌱 Solo Pitches (Needs a Seconder - 1 Vote)</span>
                      <span className="bg-card2 text-muted px-2 py-0.5 rounded-full text-[10px]">
                        {soloPitches.length}
                      </span>
                    </span>
                    <span className="text-[11px] text-primary">
                      {showSoloPitches ? '▴ Hide Solo Pitches' : `▾ Show ${soloPitches.length} Solo Pitches`}
                    </span>
                  </button>

                  {showSoloPitches && (
                    <div className="space-y-2 pl-1 border-l-2 border-line/60 animate-in fade-in duration-150">
                      {soloPitches.map((v) => renderCard(v))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5 pt-1">
                  <div className="text-xs font-semibold text-muted flex items-center justify-between px-1">
                    <span>🌱 Solo Pitches (Needs a Seconder)</span>
                    <span className="text-[10px]">{soloPitches.length} spots</span>
                  </div>
                  <div className="space-y-2">
                    {soloPitches.map((v) => renderCard(v))}
                  </div>
                </div>
              )
            )}

            {/* Tier 3: Cold / Passed Drawer (0 Keen & 2+ Pass votes) */}
            {coldPassedVenues.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-line/80">
                <button
                  type="button"
                  onClick={() => setShowGraveyard(!showGraveyard)}
                  className="w-full cursor-pointer flex items-center justify-between bg-card border border-line hover:border-line2 rounded-xl px-4 py-2.5 text-xs text-muted hover:text-ink2 font-semibold transition"
                >
                  <span className="flex items-center gap-1.5">
                    <ThumbsDown className="w-4 h-4 text-muted" />
                    <span>Cold / Passed Venues ({coldPassedVenues.length} dropped by squad)</span>
                  </span>
                  <span className="text-[11px] text-primary">
                    {showGraveyard ? '▴ Hide Passed' : `▾ Show ${coldPassedVenues.length} Passed`}
                  </span>
                </button>

                {showGraveyard && (
                  <div className="space-y-2 pl-1 opacity-75 animate-in fade-in duration-150">
                    {coldPassedVenues.map((v) => renderCard(v))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
