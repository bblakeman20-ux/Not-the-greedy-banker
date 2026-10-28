import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { AppConfig, BanItem, OutingEvent, User, Venue } from '../../types';
import { isBanned, realPlace } from '../../utils/storage';
import { themeConfetti } from '../../utils/theme';
import { rollMapSpots } from '../../utils/mapRoll';
import {
  addUnvoted,
  hideBounty,
  rankVenues,
  removeVenue,
  shortlist,
  swipeRight,
  toggleVote,
  toggleWinner,
  trimSoloPitches,
  vetoWinner,
  vetoesLeft,
} from '../../utils/eventActions';
import { PintdrOverlay } from '../PintdrOverlay';
import { DecidedPlanCard } from '../activities/DecidedPlanCard';
import { ShortlistPanel } from '../activities/ShortlistPanel';
import { DiscoverPanel } from '../activities/DiscoverPanel';
import { BanListPanel } from '../activities/BanListPanel';
import { CheckCircle2, ShieldAlert } from 'lucide-react';

interface ActivitiesTabProps {
  event: OutingEvent;
  squad: User[];
  banList: BanItem[];
  currentUser: User | null;
  config: AppConfig;
  now: number;
  onUpdateEvent: (ev: OutingEvent) => void;
  onAddBan: (name: string) => void;
  onRemoveBan: (id: string) => void;
  boardTally: Record<string, { r: number; m: number }>;
  onOpenSetup: () => void;
  onShowToast?: (msg: string) => void;
  onPitchHouse?: (user: User) => void;
}

const NEED_PROFILE = '👆 Tap your profile first in the squad bar above (or + New Profile)';

// Coordinates the Activities tab: owns the plan-changing handlers (built on the
// pure functions in utils/eventActions) and hands them to the panels.
export const ActivitiesTab: React.FC<ActivitiesTabProps> = ({
  event,
  squad,
  banList,
  currentUser,
  config,
  now,
  onUpdateEvent,
  onAddBan,
  onRemoveBan,
  onOpenSetup,
  onShowToast,
  onPitchHouse,
}) => {
  const [isPintdrOpen, setIsPintdrOpen] = useState(false);
  const [subTab, setSubTab] = useState<'shortlist' | 'discover' | 'ban'>('shortlist');
  const [askToken, setAskToken] = useState(0);
  const [spinningId, setSpinningId] = useState<string | null>(null);
  const [spinMsg, setSpinMsg] = useState('');
  const [preSpinWinId, setPreSpinWinId] = useState<string | null | undefined>(undefined);

  const isLocked = Boolean(event.locked);
  const me = currentUser;
  const myVetoesLeft = vetoesLeft(event, me?.id);
  const ranked = rankVenues(event, squad);
  const decidedVenue = event.win ? event.venues.find((v) => v.id === event.win) || null : null;
  const winVenue = decidedVenue || ranked.sorted[0];

  const notify = (msg: string) => {
    if (onShowToast) onShowToast(msg);
  };

  const requireMe = (): User | null => {
    if (!me) notify(NEED_PROFILE);
    return me;
  };

  const treason = (user: User, did: string) =>
    notify(`🚨 TREASON ALERT! ${user.name} caved to default planning and ${did} The Greedy Banker! £5 Traitor Tax applied.`);

  const resetRoulette = () => {
    setSpinMsg('');
    setPreSpinWinId(undefined);
  };

  const handleVote = (venueId: string, type: 'k' | 'p') => {
    if (isLocked) {
      notify('🔒 This event is locked in – tap 🔓 Unlock or 🚨 Veto Decided Plan to change');
      return;
    }
    const user = requireMe();
    if (!user) return;
    const res = toggleVote(event, venueId, user, type);
    if (!res) return;
    if (res.taxed) treason(user, 'voted for');
    else if (type === 'k') notify(res.on ? `👍 Voted keen for "${res.venue.name}"` : `↩️ Removed keen vote on "${res.venue.name}"`);
    else notify(res.on ? `👎 Passed on "${res.venue.name}"` : `↩️ Removed pass on "${res.venue.name}"`);
    onUpdateEvent(res.event);
  };

  const handleVeto = (decided: Venue) => {
    const user = requireMe();
    if (!user) return;
    if (myVetoesLeft <= 0) {
      notify("🚫 You've used both of your Veto tokens for this outing!");
      return;
    }
    onUpdateEvent(vetoWinner(event, decided, user.id, now));
    resetRoulette();
    setSubTab('discover');
    notify(`💥 Vetoed "${decided.name}"! 1 Veto token used. 60s Bounty clock started – pitch an alternative!`);
  };

  const handleUnlock = () => {
    onUpdateEvent({ ...event, locked: null });
    notify('🔓 Plan unlocked – squad can change the plan');
  };

  const handleLockIn = (id: string) => {
    if (isLocked) return;
    const res = toggleWinner(event, id);
    onUpdateEvent(res.event);
    resetRoulette();
    const v = event.venues.find((x) => x.id === id);
    if (v) notify(res.picked ? `⭐ Selected "${v.name}" as winning venue` : `↩️ Unpicked "${v.name}"`);
  };

  const handleDelete = (id: string) => {
    if (isLocked) return;
    const v = event.venues.find((x) => x.id === id);
    if (!v) return;
    onUpdateEvent(removeVenue(event, id));
    notify(`🗑️ Removed "${v.name}"`);
  };

  // Manual pitches and bounty replacements. Returns true if it went on the list.
  const handlePitch = (nameStr: string, locStr: string): boolean => {
    if (isLocked) return false;
    const user = requireMe();
    const name = nameStr.trim();
    if (!user || !name) return false;
    if (isBanned(name, banList)) {
      notify("🚫 Nice try – that's on the Ban List!");
      return false;
    }
    const res = shortlist(event, user, [{ name, loc: locStr.trim(), desc: 'Squad pitch' }], now, { dedupe: false });
    if (res.taxed) treason(user, 'pitched');
    onUpdateEvent(res.event);
    return true;
  };

  // Likes from the swipe deck and the map explorer
  const handleSwipeAdd = (data: Partial<Venue>, makeWinner = false) => {
    if (isLocked) return;
    const user = requireMe();
    if (!user) return;
    const res = swipeRight(event, user, data, { roomSize: squad.length || 1, makeWinner, now });
    if (res.taxed) treason(user, 'swiped right on');
    if (res.outcome === 'already') {
      notify(`👍 You already liked "${data.name}". Waiting for a 2nd squad match!`);
      return;
    }
    if (res.outcome === 'pooled' && !res.taxed) notify(`🕵️ Swiped right on "${data.name}". Waiting for a 2nd squad match!`);
    if (res.outcome === 'match') {
      confetti({ particleCount: 80, spread: 90, origin: { y: 0.5 }, colors: themeConfetti() });
      notify(`🔥 IT'S A SQUAD MATCH! "${res.venue?.name}" reached 2 votes and joined the Shortlist!`);
    }
    onUpdateEvent(res.event);
  };

  const handleShortlistIdeas = (ideas: Partial<Venue>[]): boolean => {
    if (isLocked) return false;
    const user = requireMe();
    if (!user) return false;
    const res = shortlist(event, user, ideas, now);
    if (res.taxed) treason(user, 'shortlisted');
    onUpdateEvent(res.event);
    return true;
  };

  const handleAddRolled = (venues: Partial<Venue>[]): number => {
    const user = requireMe();
    if (!user || isLocked) return 0;
    const res = addUnvoted(event, user, venues, now);
    onUpdateEvent(res.event);
    return res.redeemed.length;
  };

  const handleTrim = () => {
    if (isLocked) return;
    const res = trimSoloPitches(event);
    if (!res.removed) {
      notify('👍 No 1-vote solo pitches to trim!');
      return;
    }
    onUpdateEvent(res.event);
    notify(`🧹 Purged ${res.removed} unbacked solo pitch${res.removed === 1 ? '' : 'es'}!`);
  };

  const handleSpin = async () => {
    if (isLocked) return;
    const pool = ranked.active.length > 0 ? ranked.active : event.venues;
    if (!pool.length) {
      // Nothing on the list yet: roll some real map spots to spin instead
      const where = realPlace(event.where) || event.mid?.name || realPlace(me?.loc);
      if (!where) {
        setSpinMsg('📍 Set an area for this plan first, then roll or pitch some spots to spin');
        return;
      }
      setSpinMsg('🎲 Nothing to spin yet – rolling free ideas first...');
      const roll = await rollMapSpots(event, banList, where, event.vibe || '');
      if (roll.venues.length && me) {
        handleAddRolled(roll.venues);
        setSpinMsg(`🎲 Added ${roll.venues.length} spots near ${where} – spin again!`);
      } else {
        setSpinMsg(`🤷 Couldn't find spots near ${where}`);
      }
      return;
    }

    setPreSpinWinId(preSpinWinId !== undefined ? preSpinWinId : (event.win ?? null));
    const winner = pool[Math.floor(Math.random() * pool.length)];
    const steps = pool.length > 1 ? 16 : 1;
    for (let i = 0; i < steps; i++) {
      const v = i === steps - 1 ? winner : pool[Math.floor(Math.random() * pool.length)];
      setSpinningId(v.id);
      setSpinMsg(`🎲 ${v.name}...`);
      await new Promise((r) => setTimeout(r, 40 + i * i * 1.2));
    }
    setSpinningId(null);
    setSpinMsg(`🎯 Fate has spoken: ${winner.name}`);
    onUpdateEvent({ ...event, win: winner.id });
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors: themeConfetti() });
  };

  const handleUndoSpin = () => {
    if (isLocked) return;
    const restored = preSpinWinId !== undefined && preSpinWinId !== event.win ? preSpinWinId : null;
    onUpdateEvent({ ...event, win: restored });
    setSpinningId(null);
    resetRoulette();
    notify('↩️ Roulette result undone');
  };

  return (
    <div className="space-y-4">
      {decidedVenue && (
        <DecidedPlanCard
          venue={decidedVenue}
          isLocked={isLocked}
          me={me}
          myVetoesLeft={myVetoesLeft}
          onUnlock={handleUnlock}
          onLockIn={handleLockIn}
          onVeto={handleVeto}
          notify={notify}
        />
      )}

      {/* High-Contrast Hero Segmented Switcher */}
      <div className="grid grid-cols-3 gap-2 bg-card border-2 border-line2 p-1.5 rounded-2xl shadow-xl">
        <button
          type="button"
          onClick={() => setSubTab('shortlist')}
          className={`cursor-pointer min-h-[52px] py-2 px-2 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 text-center active:scale-[0.98] ${
            subTab === 'shortlist'
              ? 'bg-secondary text-secondary-ink font-black shadow-[0_0_20px_color-mix(in_oklab,var(--good)_35%,transparent)]'
              : 'bg-card2 text-muted hover:text-ink border border-line'
          }`}
        >
          <CheckCircle2 className={`w-4 h-4 shrink-0 ${subTab === 'shortlist' ? 'text-secondary-ink' : 'text-secondary'}`} />
          <span className="text-xs sm:text-sm font-bold truncate">Shortlist ({event.venues.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('discover')}
          className={`cursor-pointer min-h-[52px] py-2 px-2 rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 text-center active:scale-[0.98] ${
            subTab === 'discover'
              ? 'bg-primary text-primary-ink font-black shadow-[0_0_20px_color-mix(in_oklab,var(--accent)_35%,transparent)]'
              : 'bg-card2 text-muted hover:text-ink border border-line'
          }`}
        >
          <div className="flex items-center justify-center leading-tight">
            <span className="text-xs sm:text-sm font-black tracking-tight">✨ Idea Generator</span>
          </div>
          <span
            className={`text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.2 rounded ${
              subTab === 'discover'
                ? 'bg-black/20 text-primary-ink'
                : 'bg-card text-primary-hi border border-primary/30'
            }`}
          >
            BY GERG AI
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('ban')}
          className={`cursor-pointer min-h-[52px] py-2 px-2 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 text-center active:scale-[0.98] ${
            subTab === 'ban'
              ? 'bg-[#ef4444] text-white font-black shadow-[0_0_20px_rgba(239,68,68,0.35)]'
              : 'bg-card2 text-muted hover:text-ink border border-line'
          }`}
        >
          <ShieldAlert className={`w-4 h-4 shrink-0 ${subTab === 'ban' ? 'text-white' : 'text-[#ef4444]'}`} />
          <span className="text-xs sm:text-sm font-bold truncate">Ban List ({banList.length})</span>
        </button>
      </div>

      <div className={subTab === 'shortlist' ? '' : 'hidden'}>
        <ShortlistPanel
          event={event}
          squad={squad}
          me={me}
          now={now}
          isLocked={isLocked}
          topContenders={ranked.top}
          soloPitches={ranked.solo}
          coldPassedVenues={ranked.cold}
          winVenue={winVenue}
          spinningId={spinningId}
          spinMsg={spinMsg}
          canUndoSpin={preSpinWinId !== undefined}
          onSpin={handleSpin}
          onUndoSpin={handleUndoSpin}
          onClearSpinMsg={() => setSpinMsg('')}
          onVote={handleVote}
          onLockIn={handleLockIn}
          onDelete={handleDelete}
          onPitch={handlePitch}
          onBailout={() => {
            setSubTab('discover');
            setAskToken((t) => t + 1);
          }}
          onHideBounty={(id) => onUpdateEvent(hideBounty(event, id))}
          onTrim={handleTrim}
          onPitchHouse={onPitchHouse}
          onGoDiscover={() => setSubTab('discover')}
          onOpenPintdr={() => setIsPintdrOpen(true)}
        />
      </div>

      {/* Kept mounted while hidden so typed inputs and fresh Gerg AI ideas survive tab switches */}
      {!isLocked && (
        <div className={subTab === 'discover' ? '' : 'hidden'}>
          <DiscoverPanel
            event={event}
            squad={squad}
            banList={banList}
            currentUser={currentUser}
            config={config}
            notify={notify}
            onOpenPintdr={() => setIsPintdrOpen(true)}
            onAddVenue={(v) => handleSwipeAdd(v, false)}
            onShortlist={handleShortlistIdeas}
            onAddRolled={handleAddRolled}
            onPitch={handlePitch}
            onAddBan={onAddBan}
            askToken={askToken}
          />
        </div>
      )}

      {subTab === 'ban' && <BanListPanel banList={banList} onAddBan={onAddBan} onRemoveBan={onRemoveBan} />}

      {/* PINTDR™ Immersive Swiper Overlay Modal */}
      <PintdrOverlay
        isOpen={isPintdrOpen}
        onClose={() => setIsPintdrOpen(false)}
        event={event}
        squad={squad}
        banList={banList}
        currentUser={currentUser}
        config={config}
        onAddVenue={handleSwipeAdd}
        onAddBan={onAddBan}
        onShowToast={notify}
        onOpenSetup={onOpenSetup}
      />
    </div>
  );
};
