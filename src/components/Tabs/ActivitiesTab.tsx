import React, { useState } from 'react';
import { AppConfig, BanItem, Bounty, OutingEvent, User, Venue } from '../../types';
import { gbp, isBanned, MAX_VETOES, normName, safeUrl } from '../../utils/storage';
import { who } from '../../utils/kitty';
import { fetchPlaces, makeIdeas } from '../../utils/osm';
import { askGergAI, MODES } from '../../utils/gemini';
import confetti from 'canvas-confetti';
import { VenueExplorer } from '../VenueExplorer';
import { PintdrOverlay } from '../PintdrOverlay';
import { Flame, Sparkles } from 'lucide-react';

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
}

const KIND_ICON: Record<string, string> = {
  event: '🎟️ ',
  combo: '🔀 ',
};

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
  boardTally,
  onOpenSetup,
  onShowToast,
}) => {
  const [isPintdrOpen, setIsPintdrOpen] = useState(false);
  const [newBan, setNewBan] = useState('');
  const [pitchName, setPitchName] = useState('');
  const [pitchLoc, setPitchLoc] = useState('');
  const [bountyName, setBountyName] = useState('');
  const [bountyLoc, setBountyLoc] = useState('');

  // Find ideas inputs
  const [aiLoc, setAiLoc] = useState(event.where || '');
  const [aiVib, setAiVib] = useState(event.vibe || '');
  const [aiWhen, setAiWhen] = useState(event.when || '');
  const [aiBud, setAiBud] = useState('');
  const [aiMode, setAiMode] = useState('gems');
  const [freeMsg, setFreeMsg] = useState('');
  const [aiMsg, setAiMsg] = useState('');
  const [aiSources, setAiSources] = useState<Array<{ title: string; uri: string }>>([]);
  const [fastMode, setFastMode] = useState(true);
  const [streamingIdeas, setStreamingIdeas] = useState<Partial<Venue>[]>([]);
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [spinningId, setSpinningId] = useState<string | null>(null);
  const [spinMsg, setSpinMsg] = useState('');

  const isLocked = Boolean(event.locked);
  const me = currentUser;

  const notify = (msg: string) => {
    if (onShowToast) onShowToast(msg);
  };

  const clock = (ms: number): string => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };

  const myBounties = (event.bounties || []).filter(
    (b) => me && b.uid === me.id && !b.done && now < b.until
  );
  const mine = myBounties[0];

  const redeemBounties = (ids: string[], withName: string): number => {
    let n = 0;
    (event.bounties || []).forEach((b) => {
      if (ids.includes(b.id) && !b.done) {
        b.done = 1;
        b.with = withName;
        n++;
      }
    });
    return n;
  };

  const handleAddBan = () => {
    if (newBan.trim()) {
      onAddBan(newBan.trim());
      setNewBan('');
    }
  };

  const handleVote = (venueId: string, type: 'k' | 'v') => {
    if (isLocked) {
      notify('🔒 This event is locked in – tap 🔓 Unlock to change the plan');
      return;
    }
    if (!me) {
      notify('👆 Tap your profile first in the squad bar above (or + New Profile)');
      return;
    }

    const venues = event.venues.map((v) => {
      if (v.id !== venueId) return v;
      const votes = { ...(v.votes || {}) };
      const currentVote = votes[me.id];

      if (type === 'v' && currentVote !== 'v') {
        const vetoesUsed = event.venues.filter((x) => (x.votes || {})[me.id] === 'v').length;
        if (vetoesUsed >= MAX_VETOES) {
          notify("🚫 You've used both vetoes. Un-veto one, or pitch something better!");
          return v;
        }
      }

      votes[me.id] = currentVote === type ? null : type;
      return { ...v, votes };
    });

    let bounties = (event.bounties || []).filter(
      (b) => !(b.uid === me.id && b.vid === venueId && !b.done && now < b.until)
    );

    const targetVenue = event.venues.find((v) => v.id === venueId);
    if (type === 'v' && targetVenue && (targetVenue.votes || {})[me.id] !== 'v') {
      bounties.push({
        id: 'x' + Date.now(),
        uid: me.id,
        vid: venueId,
        vname: targetVenue.name,
        until: now + 60000,
      });
      notify(`👎 Vetoed "${targetVenue.name}"! 60s Bounty clock started – pitch an alternative!`);
    }

    onUpdateEvent({ ...event, venues, bounties });
  };

  const handleLockIn = (id: string) => {
    if (isLocked) return;
    onUpdateEvent({ ...event, win: id });
    const winVenue = event.venues.find((v) => v.id === id);
    if (winVenue) notify(`⭐ Selected "${winVenue.name}" as winning venue`);
  };

  const handleDeleteVenue = (id: string) => {
    if (isLocked) return;
    const v = event.venues.find((x) => x.id === id);
    if (v) {
      const venues = event.venues.filter((x) => x.id !== id);
      const win = event.win === id ? null : event.win;
      onUpdateEvent({ ...event, venues, win });
      notify(`🗑️ Removed "${v.name}"`);
    }
  };

  const handlePitchVenue = (nameStr: string, locStr: string, isFromBounty = false) => {
    if (isLocked) return;
    if (!me) {
      notify('👆 Tap your profile first in the squad bar above (or + New Profile)');
      return;
    }
    const n = nameStr.trim();
    const l = locStr.trim();
    if (!n) return;

    if (isBanned(n, banList)) {
      notify("🚫 Nice try – that's on the Ban List!");
      return;
    }

    const pend = myBounties;
    const won = redeemBounties(pend.map((b) => b.id), n);

    const newVenue: Venue = {
      id: 'v' + Date.now(),
      name: n,
      loc: l || 'Local',
      desc: won ? `🎯 Veto Bounty replacement for ${pend[0]?.vname}` : 'Squad pitch',
      votes: { [me.id]: 'k' },
    };

    onUpdateEvent({
      ...event,
      venues: [newVenue, ...event.venues],
      bounties: [...event.bounties],
    });

    if (isFromBounty) {
      setBountyName('');
      setBountyLoc('');
    } else {
      setPitchName('');
      setPitchLoc('');
    }
  };

  const handleExplorerAddVenue = (venueData: Partial<Venue>) => {
    if (isLocked) return;
    const pend = myBounties.map((b) => b.id);
    const won = redeemBounties(pend, venueData.name || '');

    const newVenue: Venue = {
      id: 'v' + Date.now() + Math.random().toString(36).slice(2, 6),
      name: venueData.name || 'Venue',
      loc: venueData.loc || 'Local',
      desc: won ? `🎯 Veto Bounty replacement for ${myBounties[0]?.vname}` : (venueData.desc || ''),
      kind: venueData.kind || 'spot',
      steps: venueData.steps,
      url: venueData.url,
      src: 'osm',
      votes: me ? { [me.id]: 'k' } : {},
      ...venueData,
    };

    onUpdateEvent({
      ...event,
      venues: [newVenue, ...event.venues],
      bounties: [...event.bounties],
    });
  };

  const handlePintdrAddVenue = (venueData: Partial<Venue>, makeWinner = false) => {
    if (isLocked) return;
    const pend = myBounties.map((b) => b.id);
    const won = redeemBounties(pend, venueData.name || '');

    const newVenueId = 'v' + Date.now() + Math.random().toString(36).slice(2, 6);
    const newVenue: Venue = {
      id: newVenueId,
      name: venueData.name || 'Venue',
      loc: venueData.loc || 'Local',
      desc: won ? `🎯 Veto Bounty replacement for ${myBounties[0]?.vname}` : (venueData.desc || ''),
      kind: venueData.kind || 'spot',
      when: venueData.when,
      cost: venueData.cost,
      steps: venueData.steps,
      url: venueData.url,
      live: venueData.live,
      src: venueData.src || (venueData.live ? undefined : 'osm'),
      votes: me ? { [me.id]: 'k' } : {},
      ...venueData,
    };

    onUpdateEvent({
      ...event,
      win: makeWinner ? newVenueId : event.win,
      venues: [newVenue, ...event.venues],
      bounties: [...event.bounties],
    });
  };

  const handleHideBounty = (id: string) => {
    const bounties = (event.bounties || []).map((b) =>
      b.id === id ? { ...b, hide: 1 } : b
    );
    onUpdateEvent({ ...event, bounties });
  };

  const handleRollFree = async () => {
    if (isLocked) return;
    if (!me) {
      notify('👆 Tap your profile first in the squad bar above (or + New Profile)');
      return;
    }
    const where = aiLoc.trim() || event.where || (event.mid && event.mid.name) || '';
    const vibe = aiVib.trim() || event.vibe || '';
    if (!where) {
      setFreeMsg('📍 Add a "where" first (town or area)');
      return;
    }

    setFreeMsg(`🗺️ Searching the map around ${where}...`);
    try {
      const pool = await fetchPlaces(where, vibe, banList, (msg) => setFreeMsg(`🗺️ ${msg}`));
      const area = where.split(/\s*(?:,|\bor\b|&)\s*/i)[0].replace(/\b\w/g, (c) => c.toUpperCase());
      const seen = new Set<string>();
      const ideas = makeIdeas(pool, area, event, seen);

      if (!ideas.length) {
        setFreeMsg(`🤷 That's everything nearby for "${vibe || 'any vibe'}" – try another vibe or wider area`);
        return;
      }

      const pend = myBounties.map((b) => b.id);
      const won = ideas.length ? redeemBounties(pend, ideas[ideas.length - 1].name || '') : 0;

      const newVenues: Venue[] = ideas.reverse().map((x, i) => ({
        id: 'v' + Date.now() + i,
        name: x.name || 'Venue',
        loc: x.loc || 'Local',
        desc: x.desc || '',
        kind: x.kind || 'spot',
        steps: x.steps,
        url: x.url,
        src: 'osm',
        votes: {},
      }));

      onUpdateEvent({
        ...event,
        venues: [...newVenues, ...event.venues],
        bounties: [...event.bounties],
      });

      setFreeMsg(
        `✅ Rolled ${ideas.length} real places near ${where}${
          won ? ' • 🎯 Veto Bounty redeemed!' : ''
        } • 🎲 roll again for more • Map data © OpenStreetMap`
      );
    } catch (e: any) {
      setFreeMsg(`❌ Couldn't reach the map: ${e.message}. Try again or use Gerg AI.`);
    }
  };

  const handleAskGergAI = async () => {
    if (!config.key) {
      onOpenSetup();
      setAiMsg('⚠️ Paste Gemini API Key in Setup first!');
      return;
    }
    if (isLocked || !me) {
      if (!me) notify('👆 Tap your profile first in the squad bar above (or + New Profile)');
      return;
    }

    setAiMsg('');
    setAiSources([]);
    setStreamingIdeas([]);
    setIsAiStreaming(true);

    const handleStreamIdea = (idea: Partial<Venue>, index: number) => {
      setStreamingIdeas((prev) => {
        if (prev.some((p) => normName(p.name || '') === normName(idea.name || ''))) return prev;
        return [...prev, idea];
      });
    };

    try {
      const res = await askGergAI(
        config,
        aiMode,
        squad,
        event,
        banList,
        aiLoc,
        aiVib,
        aiWhen,
        aiBud,
        (msg) => setAiMsg(msg),
        handleStreamIdea,
        fastMode
      );

      const pend = myBounties.map((b) => b.id);
      const won = res.ideas.length ? redeemBounties(pend, res.ideas[0]?.name || '') : 0;

      const newVenues: Venue[] = res.ideas.reverse().map((x, i) => ({
        id: 'v' + Date.now() + i,
        name: x.name || 'Venue',
        loc: x.loc || 'Local',
        desc: x.desc || '',
        kind: x.kind || 'spot',
        when: x.when,
        cost: x.cost,
        url: x.url,
        steps: x.steps,
        live: x.live,
        votes: { [me.id]: 'k' },
      }));

      onUpdateEvent({
        ...event,
        venues: [...newVenues, ...event.venues],
        bounties: [...event.bounties],
      });

      setAiSources(res.sources);
      setAiMsg(
        `⚡ Gerg AI delivered ${res.ideas.length} ideas in ${res.duration.toFixed(
          1
        )}s${res.usedModel !== config.md ? ` (via ${res.usedModel})` : ''}${
          res.searchAttempted && !res.searchSuccess
            ? ' • ⚠️ live search unavailable, double-check dates'
            : ''
        }${won ? ' • 🎯 Veto Bounty redeemed!' : ''}`
      );
    } catch (e: any) {
      setAiMsg(`❌ ${e.message}`);
    } finally {
      setIsAiStreaming(false);
      setStreamingIdeas([]);
    }
  };

  const handleSpinRoulette = async () => {
    if (isLocked) return;
    const okVenues = event.venues.filter((v) => !Object.values(v.votes || {}).includes('v'));

    if (!okVenues.length) {
      if (event.venues.length) {
        setSpinMsg('🚫 Everything on the list has been vetoed – pitch or roll something new first');
        return;
      }
      setSpinMsg('🎲 Nothing to spin yet – rolling free ideas first...');
      await handleRollFree();
      return;
    }

    const winner = okVenues[Math.floor(Math.random() * okVenues.length)];
    const steps = okVenues.length > 1 ? 16 : 1;

    for (let i = 0; i < steps; i++) {
      const v = i === steps - 1 ? winner : okVenues[Math.floor(Math.random() * okVenues.length)];
      setSpinningId(v.id);
      setSpinMsg(`🎲 ${v.name}...`);
      await new Promise((r) => setTimeout(r, 40 + i * i * 1.2));
    }

    setSpinningId(null);
    setSpinMsg(`🎯 Fate has spoken: ${winner.name}`);
    onUpdateEvent({ ...event, win: winner.id });

    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  const winVenue = event.venues.find((v) => v.id === event.win) || event.venues[0];
  const displayedVenues = isLocked
    ? event.venues.filter((v) => winVenue && v.id === winVenue.id)
    : event.venues;

  const boardEntries = Object.entries(boardTally)
    .filter(([id, t]) => who(id, squad) && (t.r || t.m))
    .sort((a, b) => b[1].m - a[1].m || b[1].r - a[1].r);

  const mapsUrl = (q: string) =>
    'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

  return (
    <div className="space-y-3">
      {/* Ban List */}
      <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-3.5">
        <div className="text-xs font-bold text-[#ff6b57]">
          🚫 The Ban List (No Default Planning)
        </div>
        <div className="my-2 space-y-1">
          {banList.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between bg-[#212124] text-xs px-2.5 py-1.5 rounded-lg"
            >
              <span>
                🔒 <b>{b.name}</b>
              </span>
              {b.lock ? (
                <span className="text-[11px] text-[#8d8d94]">Eternal</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onRemoveBan(b.id)}
                  className="cursor-pointer text-[#8d8d94] hover:text-[#ff6b57] text-xs px-1"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            value={newBan}
            onChange={(e) => setNewBan(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddBan()}
            placeholder="Ban another pub..."
            className="flex-1 bg-[#212124] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
          />
          <button
            type="button"
            onClick={handleAddBan}
            className="cursor-pointer bg-[rgba(255,107,87,0.13)] text-[#ff6b57] font-semibold text-xs px-3 py-2 rounded-xl hover:bg-[rgba(255,107,87,0.2)] transition"
          >
            Ban
          </button>
        </div>
      </div>

      {/* Veto Bounty (My Active Veto) */}
      {!isLocked && mine && (
        <div className="bg-[rgba(255,107,87,0.13)] border border-[#ff6b57] rounded-2xl p-3.5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-[#ff6b57]">🎯 Veto Bounty</div>
            <span className="cd text-lg">{clock(mine.until - now)}</span>
          </div>
          <div className="text-xs text-[#cfcfd4] my-1.5">
            You vetoed <b>{mine.vname}</b>. Pitch a replacement before the clock hits zero or
            it's default-planning inertia — and you owe the first round 🍺
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2">
            <input
              value={bountyName}
              onChange={(e) => setBountyName(e.target.value)}
              placeholder="Your replacement venue / activity"
              className="bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
            <input
              value={bountyLoc}
              onChange={(e) => setBountyLoc(e.target.value)}
              placeholder="Town / Station"
              className="bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handlePitchVenue(bountyName, bountyLoc, true)}
              className="flex-1 cursor-pointer bg-[#ff6b57] text-[#1a0703] font-semibold text-xs px-3.5 py-2 rounded-xl hover:brightness-105 active:scale-95 transition"
            >
              🚀 Pitch Replacement
            </button>
            <button
              type="button"
              onClick={handleAskGergAI}
              className="cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] font-semibold text-xs px-3.5 py-2 rounded-xl hover:border-[#3b3b40] transition"
            >
              🤖 Gerg AI, bail me out
            </button>
          </div>
        </div>
      )}

      {/* Squad Bounties list */}
      {!isLocked && (
        <div className="space-y-1.5">
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
                  className="flex items-center justify-between bg-[#17171a] border border-[#ff6b57] rounded-xl px-3 py-2 text-xs"
                >
                  <span className="text-[#8d8d94]">
                    ⏱️ <b>{u?.name || 'Someone'}</b> vetoed <b>{b.vname}</b> – must pitch a
                    replacement
                  </span>
                  <span className="cd">{clock(b.until - now)}</span>
                </div>
              ) : (
                <div
                  key={b.id}
                  className="flex items-center justify-between bg-[#17171a] border border-[#2b2b2f] rounded-xl px-3 py-2 text-xs"
                >
                  <span className="text-[#ff6b57]">
                    💀 <b>{u?.name || 'Someone'}</b> vetoed <b>{b.vname}</b> and pitched nothing –
                    owes the first round 🍺
                  </span>
                  <button
                    type="button"
                    onClick={() => handleHideBounty(b.id)}
                    className="cursor-pointer text-xs bg-[#212124] hover:bg-[#2b2b2f] text-[#f4f4f5] px-2 py-1 rounded-lg"
                  >
                    🍺 Bought it
                  </button>
                </div>
              );
            })}
        </div>
      )}

      {/* Bounty Board */}
      {boardEntries.length > 0 && (
        <div className="text-xs text-[#8d8d94] px-1">
          🏆 Bounty Board:{' '}
          {boardEntries.map(([id, t], idx) => {
            const u = who(id, squad);
            return (
              <span key={id}>
                {idx > 0 && ' • '}
                {u?.emo} {u?.name} {t.r ? `✅${t.r}` : ''} {t.m ? `💀${t.m}` : ''}
              </span>
            );
          })}
        </div>
      )}

      {/* PINTDR™ Mode Hero Launcher */}
      {!isLocked && (
        <div className="bg-gradient-to-r from-[#1f1716] via-[#241a18] to-[#1a171a] border-2 border-[#ff6b57]/40 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 w-28 h-28 bg-[#ff6b57]/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-3.5 z-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#ff6b57] to-[#ff8f7d] flex items-center justify-center text-[#1a0703] shadow-lg shadow-[#ff6b57]/30 shrink-0">
              <Flame className="w-7 h-7 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-sm text-[#f4f4f5]">
                  PINTDR™: The Anti-Banker Matchmaker
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ff6b57] text-[#1a0703] uppercase tracking-wider animate-pulse">
                  Swipe Mode
                </span>
              </div>
              <p className="text-xs text-[#cfcfd4] mt-0.5">
                Swipe right to pitch to the squad • Live AI wildcards + mapped venues served hot
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPintdrOpen(true)}
            className="w-full sm:w-auto cursor-pointer bg-gradient-to-r from-[#ff6b57] to-[#ff8f7d] hover:brightness-110 active:scale-95 text-[#1a0703] font-display font-black text-xs py-3 px-5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-[#ff6b57]/25 shrink-0 z-10"
          >
            <Flame className="w-4 h-4 fill-current" />
            <span>Launch PINTDR Overlay 🔥</span>
          </button>
        </div>
      )}

      {/* Interactive Map Venue Explorer & Tinder Swipe Deck */}
      {!isLocked && (
        <VenueExplorer
          event={event}
          squad={squad}
          currentUser={currentUser}
          banList={banList}
          defaultArea={event.where || (event.mid && event.mid.name) || (currentUser?.loc) || 'Rochester'}
          defaultVibe={event.vibe || ''}
          onAddVenue={handleExplorerAddVenue}
          onAddBan={onAddBan}
          onShowToast={notify}
          onOpenPintdr={() => setIsPintdrOpen(true)}
        />
      )}

      {/* Find Ideas Panel */}
      {!isLocked && (
        <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-4">
          <strong className="text-xs text-[#cfcfd4] block">💡 Find ideas</strong>
          <div className="text-xs text-[#8d8d94]">
            Where & vibe come from the event – tweak them here
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2">
            <input
              value={aiLoc}
              onChange={(e) => setAiLoc(e.target.value)}
              placeholder="Where (town/station)"
              className="bg-[#212124] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
            <input
              value={aiVib}
              onChange={(e) => setAiVib(e.target.value)}
              placeholder="Vibe (e.g. curry)"
              className="bg-[#212124] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
            <input
              value={aiWhen}
              onChange={(e) => setAiWhen(e.target.value)}
              placeholder="When (blank = agreed date)"
              className="bg-[#212124] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
            <input
              inputMode="numeric"
              value={aiBud}
              onChange={(e) => setAiBud(e.target.value)}
              placeholder="Budget £ / head"
              className="bg-[#212124] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleRollFree}
            className="w-full cursor-pointer bg-[#ff6b57] text-[#1a0703] font-semibold text-xs px-3.5 py-2.5 rounded-xl hover:brightness-105 active:scale-95 transition"
          >
            🎲 Roll free ideas (real places from the map)
          </button>
          {freeMsg && <div className="text-xs text-[#cfcfd4] mt-1.5">{freeMsg}</div>}

          <div className="border-t border-[#2b2b2f] my-3"></div>

          {/* Gerg AI Section */}
          <strong className="text-xs text-[#cfcfd4] block">🤖 Gerg AI</strong>
          <div className="text-xs text-[#8d8d94]">
            Smarter ideas, live events and combos (needs Gemini key in ⚙️ Setup)
          </div>

          <div className="grid grid-cols-2 gap-2 my-2">
            {Object.entries(MODES).map(([k, m]) => (
              <button
                key={k}
                type="button"
                onClick={() => setAiMode(k)}
                className={`cursor-pointer text-xs font-semibold px-3 py-2 rounded-xl border transition ${
                  aiMode === k
                    ? 'border-[#ff6b57] bg-[#212124] text-[#f4f4f5]'
                    : 'border-[#2b2b2f] bg-[#212124] text-[#8d8d94] hover:text-[#f4f4f5]'
                }`}
              >
                {m.lbl}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs text-[#cfcfd4]">{MODES[aiMode]?.sub}</span>
            <button
              type="button"
              onClick={() => setFastMode(!fastMode)}
              className={`cursor-pointer text-[11px] font-bold px-2.5 py-1 rounded-full border transition flex items-center gap-1 shrink-0 ${
                fastMode
                  ? 'bg-[rgba(198,255,61,0.12)] text-[#c6ff3d] border-[#c6ff3d]/40'
                  : 'bg-[#212124] text-[#8d8d94] border-[#2b2b2f]'
              }`}
            >
              <span>{fastMode ? '⚡ Fast Mode: ON' : '🔍 Deep Mode'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleAskGergAI}
            disabled={isAiStreaming}
            className={`w-full cursor-pointer border font-semibold text-xs px-3.5 py-2.5 rounded-xl transition flex items-center justify-center gap-2 ${
              isAiStreaming
                ? 'border-[#ff6b57] bg-[#2a1a17] text-[#ff6b57] animate-pulse cursor-wait'
                : 'border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] hover:border-[#3b3b40]'
            }`}
          >
            {isAiStreaming ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff6b57] animate-ping"></span>
                <span>⚡ Streaming ideas in real-time...</span>
              </>
            ) : (
              <span>✨ Ask Gerg AI: {MODES[aiMode]?.lbl.replace(/^\S+\s/, '')}</span>
            )}
          </button>

          {/* Real-time Streaming Rack */}
          {streamingIdeas.length > 0 && (
            <div className="mt-3 p-3 bg-[#1e1a17] border border-[#ff6b57]/40 rounded-xl space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between text-xs font-bold text-[#ff6b57]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#ff6b57] animate-ping" />
                  ⚡ Streaming ideas in real-time ({streamingIdeas.length} of 3)
                </span>
                <span className="text-[10px] text-[#8d8d94]">zero thinking delay</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {streamingIdeas.map((idea, idx) => (
                  <div key={idx} className="bg-[#141416] border border-[#ff6b57]/20 rounded-lg p-2.5 text-xs shadow-md">
                    <div className="font-bold text-[#f4f4f5] truncate">
                      {idea.kind === 'combo' ? '🔀 ' : idea.live ? '🎟️ ' : '🤖 '}
                      {idea.name}
                    </div>
                    <div className="text-[11px] text-[#8d8d94] truncate">📍 {idea.loc}</div>
                    <p className="text-[11px] text-[#cfcfd4] mt-1 line-clamp-2">{idea.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {aiMsg && <div className="text-xs text-[#cfcfd4] mt-2 whitespace-pre-line">{aiMsg}</div>}
          {aiSources.length > 0 && (
            <div className="text-xs text-[#8d8d94] mt-1.5">
              🔎 Checked:{' '}
              {aiSources.map((s, idx) => (
                <span key={idx}>
                  {idx > 0 && ', '}
                  <a
                    href={s.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#cfcfd4] hover:underline"
                  >
                    {s.title}
                  </a>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Roulette row */}
      {!isLocked && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-[#8d8d94]">
            💡 {event.venues.length} idea{event.venues.length === 1 ? '' : 's'} on the list
          </span>
          <button
            type="button"
            onClick={handleSpinRoulette}
            className="cursor-pointer bg-[#ff6b57] text-[#1a0703] font-semibold text-xs px-3.5 py-2 rounded-xl hover:brightness-105 active:scale-95 transition"
          >
            🎲 Roulette – let fate pick
          </button>
        </div>
      )}

      {spinMsg && (
        <div className="text-xs font-bold text-[#ff6b57] px-1">{spinMsg}</div>
      )}

      {/* Venues List */}
      <div className="space-y-2">
        {displayedVenues.map((v) => {
          const vt = v.votes || {};
          const keenList = squad.filter((u) => vt[u.id] === 'k').map((u) => u.name);
          const vetoList = squad.filter((u) => vt[u.id] === 'v').map((u) => u.name);
          const isWinner = event.win === v.id;
          const isSpinning = spinningId === v.id;
          const meta = [
            v.when ? `🗓️ ${v.when}` : '',
            v.cost ? `💷 ${v.cost} pp` : '',
          ]
            .filter(Boolean)
            .join(' • ');

          return (
            <div
              key={v.id}
              className={`bg-[#17171a] border rounded-2xl p-3.5 transition-all ${
                isWinner ? 'border-[#ff6b57]' : 'border-[#2b2b2f]'
              } ${isSpinning ? 'roulette-spin' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-sm text-[#f4f4f5]">
                    {isWinner && '⭐ '}
                    {v.kind ? KIND_ICON[v.kind] : ''}
                    {v.name}
                  </div>
                  <div className="text-xs text-[#cfcfd4] mt-0.5">📍 {v.loc}</div>
                  {(meta || v.src) && (
                    <div className="text-[11px] text-[#8d8d94] mt-1">
                      {meta}
                      {v.live ? ' • 🔎 checked live' : ''}
                      {v.src === 'osm' ? `${meta ? ' • ' : ''}🗺️ from the map` : ''}
                    </div>
                  )}
                  {v.steps && v.steps.length > 0 && (
                    <ol className="list-decimal list-inside text-xs text-[#f4f4f5] mt-2 space-y-0.5 pl-1">
                      {v.steps.map((st, i) => (
                        <li key={i}>{st}</li>
                      ))}
                    </ol>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {safeUrl(v.url) && (
                    <a
                      href={safeUrl(v.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] font-semibold text-xs px-2.5 py-1 rounded-xl hover:border-[#3b3b40] transition"
                    >
                      🔗 Info
                    </a>
                  )}
                  <a
                    href={mapsUrl((v.kind === 'combo' ? '' : v.name + ', ') + v.loc)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] font-semibold text-xs px-2.5 py-1 rounded-xl hover:border-[#3b3b40] transition"
                  >
                    🗺️ Map
                  </a>
                  {!isLocked && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleLockIn(v.id)}
                        className={`cursor-pointer font-semibold text-xs px-2.5 py-1 rounded-xl transition ${
                          isWinner
                            ? 'bg-[#ff6b57] text-[#1a0703]'
                            : 'border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] hover:border-[#3b3b40]'
                        }`}
                      >
                        {isWinner ? '⭐ Picked' : '⭐ Pick'}
                      </button>
                      <button
                        type="button"
                        title="Remove"
                        onClick={() => handleDeleteVenue(v.id)}
                        className="cursor-pointer text-xs text-[#8d8d94] hover:text-[#ff6b57] px-1 py-1"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>

              {v.desc && <div className="text-xs text-[#8d8d94] my-2">{v.desc}</div>}

              <div className="flex items-center justify-between pt-1">
                <span
                  className={`text-xs ${
                    vetoList.length ? 'text-[#ff6b57]' : 'text-[#c6ff3d]'
                  }`}
                >
                  {vetoList.length
                    ? `⚠️ Veto: ${vetoList.join(', ')}`
                    : `👍 Keen: ${keenList.join(', ') || '0'}`}
                </span>

                {!isLocked && me && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleVote(v.id, 'k')}
                      className={`cursor-pointer font-semibold text-xs px-3 py-1.5 rounded-xl transition ${
                        vt[me.id] === 'k'
                          ? 'bg-[rgba(198,255,61,0.2)] text-[#c6ff3d] border border-[#c6ff3d]'
                          : 'border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] hover:border-[#3b3b40]'
                      }`}
                    >
                      👍 Keen
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVote(v.id, 'v')}
                      className={`cursor-pointer font-semibold text-xs px-3 py-1.5 rounded-xl transition ${
                        vt[me.id] === 'v'
                          ? 'bg-[rgba(255,107,87,0.2)] text-[#ff6b57] border border-[#ff6b57]'
                          : 'border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] hover:border-[#3b3b40]'
                      }`}
                    >
                      👎 Veto
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pitch Activity Manually */}
      {!isLocked && (
        <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-4">
          <div className="text-xs font-bold text-[#f4f4f5]">➕ Pitch Activity Manually</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2">
            <input
              value={pitchName}
              onChange={(e) => setPitchName(e.target.value)}
              placeholder="Venue / Activity"
              className="bg-[#212124] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
            <input
              value={pitchLoc}
              onChange={(e) => setPitchLoc(e.target.value)}
              placeholder="Town / Station"
              className="bg-[#212124] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => handlePitchVenue(pitchName, pitchLoc, false)}
            className="cursor-pointer bg-[rgba(198,255,61,0.12)] text-[#c6ff3d] font-semibold text-xs px-3.5 py-2 rounded-xl hover:bg-[rgba(198,255,61,0.2)] active:scale-95 transition"
          >
            + Add Pitch
          </button>
        </div>
      )}

      {/* PINTDR™ Immersive Swiper Overlay Modal */}
      <PintdrOverlay
        isOpen={isPintdrOpen}
        onClose={() => setIsPintdrOpen(false)}
        event={event}
        squad={squad}
        banList={banList}
        currentUser={currentUser}
        config={config}
        onAddVenue={handlePintdrAddVenue}
        onAddBan={onAddBan}
        onShowToast={notify}
        onOpenSetup={onOpenSetup}
      />
    </div>
  );
};
