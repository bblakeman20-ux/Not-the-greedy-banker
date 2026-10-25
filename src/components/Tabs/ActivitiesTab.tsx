import React, { useState, useEffect } from 'react';
import { AppConfig, BanItem, Bounty, OutingEvent, User, Venue } from '../../types';
import { gbp, isBanned, MAX_VETOES, normName, safeUrl } from '../../utils/storage';
import { who } from '../../utils/kitty';
import { fetchPlaces, makeIdeas, miles } from '../../utils/osm';
import { askGergAI, MODES } from '../../utils/gemini';
import { getLocalCuratedIdeas } from '../../utils/localPlaces';
import confetti from 'canvas-confetti';
import { VenueExplorer } from '../VenueExplorer';
import { PintdrOverlay } from '../PintdrOverlay';
import {
  Flame,
  Sparkles,
  Map as MapIcon,
  Compass,
  Plus,
  ExternalLink,
  Clock,
  MapPin,
  Sliders,
  Calendar,
  Coins,
  ThumbsUp,
  ThumbsDown,
  Star,
  Crown,
  RotateCcw,
  Dices,
  Trophy,
  Home,
  Ban,
  X,
  Zap,
  Route,
  Check,
  CheckCircle2,
  AlertTriangle,
  Search,
  ShieldAlert,
  Send,
  Ticket,
  Gem,
} from 'lucide-react';

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
  onPitchHouse,
}) => {
  const [isPintdrOpen, setIsPintdrOpen] = useState(false);
  const [subTab, setSubTab] = useState<'shortlist' | 'discover' | 'ban'>('shortlist');
  const [discoverTool, setDiscoverTool] = useState<'ai' | 'map' | 'manual'>('ai');
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

  // Keep search inputs synchronized when switching events or receiving a Travel Midpoint hand-off
  useEffect(() => {
    setAiLoc(event.where || '');
    setAiVib(event.vibe || '');
    setAiWhen(event.when || '');
  }, [event.id, event.where, event.vibe, event.when]);
  const [aiMode, setAiMode] = useState('gems');
  const [freeMsg, setFreeMsg] = useState('');
  const [aiMsg, setAiMsg] = useState('');
  const [aiSources, setAiSources] = useState<Array<{ title: string; uri: string }>>([]);
  const [fastMode, setFastMode] = useState(true);
  const [streamingIdeas, setStreamingIdeas] = useState<Partial<Venue>[]>([]);
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [spinningId, setSpinningId] = useState<string | null>(null);
  const [spinMsg, setSpinMsg] = useState('');
  const [preSpinWinId, setPreSpinWinId] = useState<string | null | undefined>(undefined);

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
    if (event.win === id) {
      onUpdateEvent({ ...event, win: null });
      setSpinMsg('');
      setPreSpinWinId(undefined);
      const winVenue = event.venues.find((v) => v.id === id);
      if (winVenue) notify(`↩️ Unpicked "${winVenue.name}"`);
      return;
    }
    onUpdateEvent({ ...event, win: id });
    setSpinMsg('');
    setPreSpinWinId(undefined);
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
      const center = pool.cs[0];

      // Strictly filter individual real venues that are not already on the shortlist
      const existingNames = new Set(event.venues.map((v) => normName(v.name)));
      const validPlaces = pool.places.filter(
        (p) => p.name && !isBanned(p.name, banList) && !existingNames.has(normName(p.name))
      );

      const picked = validPlaces.slice(0, 3);
      if (!picked.length) {
        setFreeMsg(`🤷 That's everything nearby for "${vibe || 'any vibe'}" – try another vibe or wider area`);
        return;
      }

      const pend = myBounties.map((b) => b.id);
      const won = picked.length ? redeemBounties(pend, picked[0].name) : 0;

      const newVenues: Venue[] = picked.map((p, i) => {
        const street = p.t['addr:street'];
        const house = p.t['addr:housenumber'] || p.t['addr:housename'];
        const postcode = p.t['addr:postcode'];
        const town = p.t['addr:town'] || p.t['addr:city'] || p.t['addr:suburb'] || area;
        const streetPart = house && street ? `${house} ${street}` : (street || '');
        const fullLoc = [streetPart, town, postcode].filter(Boolean).join(', ') || area;
        const dist = center ? miles(center, p) : undefined;

        const details = [
          p.c.l,
          p.t.brewery ? `Brewery: ${p.t.brewery}` : '',
          p.t.cuisine ? `Cuisine: ${p.t.cuisine.replace(/;/g, ', ')}` : '',
          p.t.outdoor_seating === 'yes' ? 'Beer garden' : '',
          dist != null ? `${dist.toFixed(1)} mi from ${area}` : '',
        ]
          .filter(Boolean)
          .join(' • ');

        return {
          id: 'v' + Date.now() + i,
          name: p.name,
          loc: fullLoc,
          desc: `${p.c.e} ${details}`,
          kind: 'spot' as const,
          url: safeUrl(p.t.website || p.t['contact:website']),
          lat: p.lat,
          lon: p.lon,
          src: 'osm',
          votes: {},
        };
      });

      onUpdateEvent({
        ...event,
        venues: [...newVenues, ...event.venues],
        bounties: [...event.bounties],
      });

      setFreeMsg(
        `✅ Added ${picked.length} real venues near ${where}${
          won ? ' • 🎯 Veto Bounty redeemed!' : ''
        } • 🎲 roll again for more • OpenStreetMap verified`
      );
    } catch {
      // Offline / rate-limit fallback: Instantly load curated UK spots
      const fallbackIdeas = getLocalCuratedIdeas(where, vibe, banList, new Set(event.venues.map((v) => normName(v.name))), 3);
      if (fallbackIdeas.length) {
        const newVenues: Venue[] = fallbackIdeas.map((x, i) => ({
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
        });

        setFreeMsg(`✅ Rolled ${fallbackIdeas.length} curated anti-default spots near ${where}`);
        return;
      }
      setFreeMsg(`❌ Couldn't reach the map – try another area or use Gerg AI.`);
    }
  };

  const handleAskGergAI = async () => {
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

    const previousWin = preSpinWinId !== undefined ? preSpinWinId : (event.win ?? null);
    setPreSpinWinId(previousWin);

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

  const handleUndoRoulette = () => {
    if (isLocked) return;
    const restoredWin =
      preSpinWinId !== undefined && preSpinWinId !== event.win ? preSpinWinId : null;
    onUpdateEvent({ ...event, win: restoredWin });
    setSpinMsg('');
    setSpinningId(null);
    setPreSpinWinId(undefined);
    notify('↩️ Roulette result undone');
  };

  // Auto-rank venues: Pinned winner first -> Zero vetoes -> Net Keen score descending
  const sortedVenues = [...event.venues].sort((a, b) => {
    const aWin = event.win === a.id ? 1 : 0;
    const bWin = event.win === b.id ? 1 : 0;
    if (aWin !== bWin) return bWin - aWin;

    const aVotes = a.votes || {};
    const bVotes = b.votes || {};
    const aVetoes = squad.filter((u) => aVotes[u.id] === 'v').length;
    const bVetoes = squad.filter((u) => bVotes[u.id] === 'v').length;
    const aClean = aVetoes === 0 ? 1 : 0;
    const bClean = bVetoes === 0 ? 1 : 0;
    if (aClean !== bClean) return bClean - aClean;

    const aKeen = squad.filter((u) => aVotes[u.id] === 'k').length;
    const bKeen = squad.filter((u) => bVotes[u.id] === 'k').length;
    return bKeen - bVetoes - (aKeen - aVetoes);
  });

  const winVenue = event.venues.find((v) => v.id === event.win) || sortedVenues[0];
  const displayedVenues = isLocked
    ? sortedVenues.filter((v) => winVenue && v.id === winVenue.id)
    : sortedVenues;

  const boardEntries = Object.entries(boardTally)
    .filter(([id, t]) => who(id, squad) && (t.r || t.m))
    .sort((a, b) => b[1].m - a[1].m || b[1].r - a[1].r);

  const mapsUrl = (q: string) =>
    'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

  return (
    <div className="space-y-4">
      {/* 3-Way Segmented Control for Activities */}
      <div className="grid grid-cols-3 gap-1.5 bg-[#17171a] border border-[#2b2b2f] p-1.5 rounded-2xl shadow-md">
        <button
          type="button"
          onClick={() => setSubTab('shortlist')}
          className={`cursor-pointer py-2.5 px-2 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5 truncate ${
            subTab === 'shortlist'
              ? 'bg-[#212124] text-[#ffffff] shadow-[inset_0_0_0_1.5px_#ff6b57,0_0_12px_rgba(255,107,87,0.18)]'
              : 'text-[#8d8d94] hover:text-[#f4f4f5]'
          }`}
        >
          <CheckCircle2 className={`w-4 h-4 shrink-0 ${subTab === 'shortlist' ? 'text-[#c6ff3d]' : 'text-[#8d8d94]'}`} />
          <span className="truncate">Shortlist ({event.venues.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('discover')}
          className={`cursor-pointer py-2.5 px-2 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5 truncate ${
            subTab === 'discover'
              ? 'bg-[#212124] text-[#ffffff] shadow-[inset_0_0_0_1.5px_#ff6b57,0_0_12px_rgba(255,107,87,0.18)]'
              : 'text-[#8d8d94] hover:text-[#f4f4f5]'
          }`}
        >
          <Sparkles className={`w-4 h-4 shrink-0 ${subTab === 'discover' ? 'text-[#ff6b57]' : 'text-[#8d8d94]'}`} />
          <span className="truncate">Discover / Gerg AI</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('ban')}
          className={`cursor-pointer py-2.5 px-2 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5 truncate ${
            subTab === 'ban'
              ? 'bg-[#212124] text-[#ffffff] shadow-[inset_0_0_0_1.5px_#ff6b57,0_0_12px_rgba(255,107,87,0.18)]'
              : 'text-[#8d8d94] hover:text-[#f4f4f5]'
          }`}
        >
          <ShieldAlert className={`w-4 h-4 shrink-0 ${subTab === 'ban' ? 'text-[#ff6b57]' : 'text-[#8d8d94]'}`} />
          <span className="truncate">Ban List ({banList.length})</span>
        </button>
      </div>

      {/* Sub-Tab 1: Shortlist View */}
      {subTab === 'shortlist' && (
        <div className="space-y-4">
      {!isLocked && mine && (
        <div className="bg-[rgba(255,107,87,0.1)] border border-[#ff6b57]/50 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-[#ff6b57] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-[#ff6b57]" />
              <span>Active Veto Bounty</span>
            </div>
            <span className="cd text-lg">{clock(mine.until - now)}</span>
          </div>
          <div className="text-xs text-[#cfcfd4] leading-relaxed">
            You vetoed <b>{mine.vname}</b>. Pitch a replacement before the clock hits zero or
            it's default-planning inertia — and you owe the squad a round!
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={bountyName}
              onChange={(e) => setBountyName(e.target.value)}
              placeholder="Your replacement venue / activity"
              className="bg-[#17171a] border border-[#2b2b2f] focus:border-[#ff6b57] text-[#f4f4f5] px-3.5 py-2.5 rounded-xl text-xs outline-none"
            />
            <input
              value={bountyLoc}
              onChange={(e) => setBountyLoc(e.target.value)}
              placeholder="Town / Station"
              className="bg-[#17171a] border border-[#2b2b2f] focus:border-[#ff6b57] text-[#f4f4f5] px-3.5 py-2.5 rounded-xl text-xs outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handlePitchVenue(bountyName, bountyLoc, true)}
              className="flex-1 cursor-pointer bg-[#ff6b57] text-[#1a0703] font-semibold text-xs px-4 py-2.5 rounded-xl hover:brightness-105 active:scale-95 transition flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Pitch Replacement</span>
            </button>
            <button
              type="button"
              onClick={handleAskGergAI}
              className="cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] font-semibold text-xs px-4 py-2.5 rounded-xl hover:border-[#3b3b40] transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#ff6b57]" />
              <span>Gerg AI Bailout</span>
            </button>
          </div>
        </div>
      )}

      {/* Squad Bounties & Bounty Board */}
      {!isLocked &&
        ((event.bounties || []).some(
          (b) =>
            (!b.done && now < b.until && b.uid !== me?.id) ||
            (!b.done && now >= b.until && !b.hide)
        ) ||
          boardEntries.length > 0) && (
          <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-4 space-y-2.5">
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
                    className="flex items-center justify-between bg-[#212124] border border-[#ff6b57]/50 rounded-xl px-3.5 py-2.5 text-xs"
                  >
                    <span className="text-[#cfcfd4] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#ff6b57] shrink-0" />
                      <span>
                        <b>{u?.emo ? `${u.emo} ` : ''}{u?.name || 'Someone'}</b> vetoed <b>{b.vname}</b> · must pitch a replacement
                      </span>
                    </span>
                    <span className="cd">{clock(b.until - now)}</span>
                  </div>
                ) : (
                  <div
                    key={b.id}
                    className="flex items-center justify-between bg-[#212124] border border-[#2b2b2f] rounded-xl px-3.5 py-2.5 text-xs"
                  >
                    <span className="text-[#ff6b57] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#ff6b57] shrink-0" />
                      <span>
                        <b>{u?.emo ? `${u.emo} ` : ''}{u?.name || 'Someone'}</b> vetoed <b>{b.vname}</b> and pitched nothing · owes the first round
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleHideBounty(b.id)}
                      className="cursor-pointer text-xs bg-[#17171a] hover:bg-[#2b2b2f] text-[#f4f4f5] px-2.5 py-1 rounded-lg border border-[#2b2b2f] flex items-center gap-1"
                    >
                      <Check className="w-3 h-3 text-[#c6ff3d]" />
                      <span>Bought it</span>
                    </button>
                  </div>
                );
              })}

            {boardEntries.length > 0 && (
              <div className="text-xs text-[#8d8d94] flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-[#cfcfd4] flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-[#f59e0b]" />
                  <span>Bounty Tally:</span>
                </span>
                {boardEntries.map(([id, t], idx) => {
                  const u = who(id, squad);
                  return (
                    <span key={id} className="flex items-center gap-1">
                      {idx > 0 && <span className="text-[#3b3b40]">·</span>}
                      <span className="text-[#f4f4f5] font-medium">{u?.emo ? `${u.emo} ` : ''}{u?.name}</span>
                      {t.r > 0 && (
                        <span className="text-[10px] text-[#c6ff3d] bg-[#c6ff3d]/10 px-1.5 py-0.2 rounded font-bold">
                          +{t.r} saved
                        </span>
                      )}
                      {t.m > 0 && (
                        <span className="text-[10px] text-[#ff6b57] bg-[#ff6b57]/10 px-1.5 py-0.2 rounded font-bold">
                          -{t.m} owed
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

      {/* Voted Venues & Shortlist Card */}
      <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-5 space-y-4">
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
              <div className="space-y-2 pb-2 border-b border-[#2b2b2f]/70">
                {unpitchedHosts.map((h) => (
                  <div
                    key={h.id}
                    className="bg-[rgba(198,255,61,0.06)] border border-[#c6ff3d]/30 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-bold text-[#c6ff3d] flex items-center gap-1.5 flex-wrap">
                        <Home className="w-4 h-4 text-[#c6ff3d] shrink-0" />
                        <span>{h.emo ? `${h.emo} ` : ''}{h.name} offered to host at their place ({h.loc})</span>
                      </div>
                      <p className="text-[#cfcfd4] text-[11px] truncate sm:whitespace-normal">
                        {h.houseNote || 'House outing / pre-drinks – BYOB, games & tunes with zero pub markup.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPitchHouse(h)}
                      className="cursor-pointer bg-[#c6ff3d] text-[#141a03] font-bold text-xs px-3.5 py-1.5 rounded-lg hover:brightness-105 active:scale-95 transition whitespace-nowrap shrink-0 self-start sm:self-auto flex items-center gap-1"
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#f4f4f5] font-display flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#ff6b57]" />
              <span>Squad Shortlist & Votes ({event.venues.length})</span>
            </h3>
            <p className="text-xs text-[#8d8d94] mt-0.5">
              Vote Keen or Veto on pitched spots, or spin Roulette to pick a winner
            </p>
          </div>

          {!isLocked && event.venues.length > 0 && (
            <div className="flex items-center gap-2">
              {(spinMsg || preSpinWinId !== undefined) && (
                <button
                  type="button"
                  onClick={handleUndoRoulette}
                  className="cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#cfcfd4] hover:text-[#f4f4f5] hover:border-[#ff6b57]/50 font-semibold text-xs px-3 py-2 rounded-xl transition whitespace-nowrap flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSpinRoulette}
                className="cursor-pointer bg-[#ff6b57] text-[#1a0703] font-semibold text-xs px-3.5 py-2 rounded-xl hover:brightness-105 active:scale-95 transition whitespace-nowrap flex items-center gap-1.5"
              >
                <Dices className="w-4 h-4" />
                <span>Spin Roulette</span>
              </button>
            </div>
          )}
        </div>

        {spinMsg && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#ff6b57] bg-[#212124] border border-[#ff6b57]/40 px-3.5 py-2.5 rounded-xl">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#ff6b57]" />
              <span>{spinMsg}</span>
            </span>
            {!isLocked && !spinningId && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUndoRoulette}
                  className="cursor-pointer bg-[#17171a] border border-[#2b2b2f] hover:border-[#ff6b57] text-[#f4f4f5] font-semibold text-[11px] px-2.5 py-1 rounded-lg transition whitespace-nowrap flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Undo Roulette</span>
                </button>
                <button
                  type="button"
                  title="Remove message"
                  onClick={() => setSpinMsg('')}
                  className="cursor-pointer text-[#8d8d94] hover:text-[#f4f4f5] p-1 rounded transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {displayedVenues.length === 0 ? (
          <div className="bg-[#212124] border border-[#2b2b2f] rounded-2xl p-8 text-center text-sm text-[#8d8d94]">
            No ideas on the shortlist yet. Roll free map spots, ask Gerg AI, or launch Pintdr mode below.
          </div>
        ) : (
          <div className="space-y-4">
            {displayedVenues.map((v) => {
              const vt = v.votes || {};
              const keenList = squad.filter((u) => vt[u.id] === 'k').map((u) => `${u.emo || '👤'} ${u.name}`);
              const vetoList = squad.filter((u) => vt[u.id] === 'v').map((u) => `${u.emo || '👤'} ${u.name}`);
              const isWinner = event.win === v.id;
              const isSpinning = spinningId === v.id;

              return (
                <div
                  key={v.id}
                  className={`border-2 rounded-2xl p-5 sm:p-6 transition-all space-y-4 ${
                    isWinner
                      ? 'border-[#f59e0b] bg-[#22242b] shadow-[0_0_24px_rgba(245,158,11,0.22)] ring-1 ring-[#f59e0b]/50'
                      : 'border-[#2b2b2f] bg-[#212124] hover:border-[#3b3b40]'
                  } ${isSpinning ? 'roulette-spin' : ''}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-extrabold text-base sm:text-xl text-[#ffffff] flex items-center gap-2 flex-wrap font-display">
                        {v.kind === 'combo' && <Route className="w-4 h-4 text-[#c6ff3d] shrink-0" />}
                        {v.kind === 'event' && <Ticket className="w-4 h-4 text-[#ff6b57] shrink-0" />}
                        <span>{v.name}</span>
                        {isWinner && (
                          <span className="text-xs font-bold text-[#f59e0b] bg-[#f59e0b]/15 border border-[#f59e0b]/30 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                            <Crown className="w-3.5 h-3.5 fill-current" />
                            <span>Outing Winner Picked</span>
                          </span>
                        )}
                        <span className="text-xs sm:text-sm font-semibold text-[#a1a1aa] flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#ff6b57]" />
                          <span>{v.loc}</span>
                        </span>
                      </div>
                      
                      {/* Meta chips */}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-[#cfcfd4]">
                        {v.when && (
                          <span className="inline-flex items-center gap-1 bg-[#17171a] px-2 py-0.5 rounded border border-[#2b2b2f]">
                            <Clock className="w-3 h-3 text-[#38bdf8]" />
                            <span>{v.when}</span>
                          </span>
                        )}
                        {v.cost && (
                          <span className="inline-flex items-center gap-1 bg-[#17171a] px-2 py-0.5 rounded border border-[#2b2b2f]">
                            <Coins className="w-3 h-3 text-[#f59e0b]" />
                            <span>{v.cost} pp</span>
                          </span>
                        )}
                        {v.live && (
                          <span className="inline-flex items-center gap-1 bg-[#17171a] px-2 py-0.5 rounded border border-[#2b2b2f] text-[#c6ff3d]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Live verified</span>
                          </span>
                        )}
                        {v.src === 'osm' && (
                          <span className="inline-flex items-center gap-1 bg-[#17171a] px-2 py-0.5 rounded border border-[#2b2b2f]">
                            <MapIcon className="w-3 h-3 text-[#ff6b57]" />
                            <span>Map spot</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-start">
                      {safeUrl(v.url) && (
                        <a
                          href={safeUrl(v.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Venue Info"
                          className="w-8 h-8 rounded-xl border border-[#2b2b2f] bg-[#17171a] text-[#8d8d94] hover:text-[#f4f4f5] hover:border-[#3b3b40] flex items-center justify-center transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <a
                        href={mapsUrl((v.kind === 'combo' ? '' : v.name + ', ') + v.loc)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in Google Maps"
                        className="w-8 h-8 rounded-xl border border-[#2b2b2f] bg-[#17171a] text-[#8d8d94] hover:text-[#ff6b57] hover:border-[#ff6b57]/40 flex items-center justify-center transition"
                      >
                        <MapIcon className="w-3.5 h-3.5" />
                      </a>
                      {!isLocked && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleLockIn(v.id)}
                            title={isWinner ? 'Winner picked' : 'Pick as winner'}
                            className={`w-8 h-8 rounded-xl transition flex items-center justify-center cursor-pointer ${
                              isWinner
                                ? 'bg-[#f59e0b] text-[#141a03] shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                                : 'border border-[#2b2b2f] bg-[#17171a] text-[#8d8d94] hover:text-[#f59e0b] hover:border-[#f59e0b]/40'
                            }`}
                          >
                            <Star className={`w-3.5 h-3.5 ${isWinner ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            type="button"
                            title="Remove spot"
                            onClick={() => handleDeleteVenue(v.id)}
                            className="w-8 h-8 rounded-xl border border-transparent hover:border-[#2b2b2f] text-[#8d8d94] hover:text-[#ff6b57] flex items-center justify-center transition cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Multi-Stop Timeline or Ordered Steps */}
                  {v.stops && v.stops.length > 0 ? (
                    <div className="bg-[#17171a] p-4 sm:p-5 rounded-xl border border-[#2b2b2f] space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2b2b2f]/80 pb-3">
                        <div className="text-xs sm:text-sm font-bold text-[#c6ff3d] flex items-center gap-1.5">
                          <Route className="w-4 h-4 text-[#c6ff3d]" />
                          <span>Multi-Stop Timeline ({v.stops.length} Venues)</span>
                        </div>
                        <a
                          href={`https://www.google.com/maps/dir/${v.stops
                            .map((s) => encodeURIComponent(s.name + ', ' + (s.loc || v.loc)))
                            .join('/')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-[#ff6b57] hover:underline flex items-center gap-1 transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Full Walking Route (Google Maps)</span>
                        </a>
                      </div>

                      <div className="relative pl-6 space-y-3.5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#2b2b2f]">
                        {v.stops.map((stop, sIdx) => {
                          const stopMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            stop.name + ', ' + (stop.loc || v.loc)
                          )}`;
                          return (
                            <div key={sIdx} className="relative group">
                              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#ff6b57] text-[#1a0703] text-[10px] font-black flex items-center justify-center ring-4 ring-[#17171a]">
                                {sIdx + 1}
                              </div>
                              <div className="bg-[#212124] border border-[#2b2b2f] rounded-xl p-3 space-y-1.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="font-bold text-xs sm:text-sm text-[#ffffff] flex items-center gap-2">
                                    <span>{stop.name}</span>
                                    {stop.url && (
                                      <a
                                        href={safeUrl(stop.url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#8d8d94] hover:text-[#f4f4f5] text-xs"
                                        title="Venue Website"
                                      >
                                        <ExternalLink className="w-3 h-3 inline" />
                                      </a>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {stop.time && (
                                      <span className="text-[10px] font-bold text-[#c6ff3d] bg-[#c6ff3d]/10 px-2 py-0.5 rounded border border-[#c6ff3d]/20 flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5" />
                                        <span>{stop.time}</span>
                                      </span>
                                    )}
                                    {stop.category && (
                                      <span className="text-[10px] text-[#cfcfd4] bg-[#17171a] px-2 py-0.5 rounded border border-[#2b2b2f]">
                                        {stop.category}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between gap-2 text-xs text-[#a1a1aa]">
                                  <span className="truncate flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-[#ff6b57]" />
                                    <span>{stop.loc || v.loc}</span>
                                  </span>
                                  <a
                                    href={stopMapUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-[#cfcfd4] hover:text-[#ff6b57] hover:underline whitespace-nowrap font-medium flex items-center gap-0.5"
                                  >
                                    <span>Map Pin</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : v.steps && v.steps.length > 0 ? (
                    <div className="relative pl-5 space-y-2 border-l-2 border-[#ff6b57]/40 ml-2 my-2 py-0.5">
                      {v.steps.map((st, i) => (
                        <div key={i} className="relative text-xs sm:text-sm text-[#f4f4f5] flex items-start gap-2">
                          <span className="absolute -left-[27px] top-0.5 w-4 h-4 rounded-full bg-[#17171a] border border-[#ff6b57] text-[#ff6b57] text-[10px] font-black flex items-center justify-center shadow-sm">
                            {i + 1}
                          </span>
                          <span className="leading-snug">{st}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {v.desc && <div className="text-xs sm:text-sm text-[#cfcfd4] leading-relaxed">{v.desc}</div>}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#2b2b2f]/80">
                    <span
                      className={`text-xs sm:text-sm font-bold flex items-center gap-1.5 ${
                        vetoList.length ? 'text-[#ff6b57]' : 'text-[#c6ff3d]'
                      }`}
                    >
                      {vetoList.length ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-[#ff6b57]" />
                          <span>Vetoed by {vetoList.join(', ')}</span>
                        </>
                      ) : (
                        <>
                          <ThumbsUp className="w-4 h-4 text-[#c6ff3d]" />
                          <span>Keen ({keenList.length}): {keenList.join(', ') || 'No votes yet'}</span>
                        </>
                      )}
                    </span>

                    {!isLocked && me && (
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleVote(v.id, 'k')}
                          className={`cursor-pointer font-extrabold text-xs sm:text-sm h-11 px-5 rounded-xl transition-all whitespace-nowrap active:scale-95 flex items-center gap-1.5 ${
                            vt[me.id] === 'k'
                              ? 'bg-[#c6ff3d] text-[#141a03] shadow-[0_0_16px_rgba(198,255,61,0.35)]'
                              : 'border border-[#2b2b2f] bg-[#17171a] text-[#cfcfd4] hover:text-[#ffffff] hover:border-[#3b3b40]'
                          }`}
                        >
                          <ThumbsUp className="w-4 h-4" />
                          <span>Keen</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVote(v.id, 'v')}
                          className={`cursor-pointer font-extrabold text-xs sm:text-sm h-11 px-5 rounded-xl transition-all whitespace-nowrap active:scale-95 flex items-center gap-1.5 ${
                            vt[me.id] === 'v'
                              ? 'bg-[#ff6b57] text-[#1a0703] shadow-[0_0_16px_rgba(255,107,87,0.35)]'
                              : 'border border-[#2b2b2f] bg-[#17171a] text-[#cfcfd4] hover:text-[#ffffff] hover:border-[#3b3b40]'
                          }`}
                        >
                          <ThumbsDown className="w-4 h-4" />
                          <span>Veto</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  )}

  {/* Sub-Tab 2: Discover / Gerg AI View */}
  {subTab === 'discover' && !isLocked && (
    <div className="space-y-4">
      {/* One Clean Pintdr Swipe Deck Hero Button */}
      <button
        type="button"
        onClick={() => setIsPintdrOpen(true)}
        className="w-full cursor-pointer bg-gradient-to-r from-[#ff6b57] to-[#ff8f7d] hover:brightness-110 active:scale-[0.99] text-[#1a0703] font-display font-black text-sm sm:text-base py-3.5 px-6 rounded-2xl transition flex items-center justify-center gap-2.5 shadow-[0_0_24px_rgba(255,107,87,0.3)]"
      >
        <Flame className="w-5 h-5 fill-current" />
        <span>Launch Pintdr Swipe Deck</span>
      </button>

      {/* Discovery Tool Sub-Pills */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setDiscoverTool('ai')}
          className={`min-h-[42px] cursor-pointer text-xs sm:text-sm px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm font-bold ${
            discoverTool === 'ai'
              ? 'bg-[#f4f4f5] text-[#17171a]'
              : 'bg-[#212124] text-[#8d8d94] hover:text-[#f4f4f5] border border-[#2b2b2f]'
          }`}
        >
          <Sparkles className={`w-4 h-4 ${discoverTool === 'ai' ? 'text-[#17171a]' : 'text-[#c6ff3d]'}`} />
          <span>Ask Gerg AI</span>
        </button>
        <button
          type="button"
          onClick={() => setDiscoverTool('map')}
          className={`min-h-[42px] cursor-pointer text-xs sm:text-sm px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm font-bold ${
            discoverTool === 'map'
              ? 'bg-[#f4f4f5] text-[#17171a]'
              : 'bg-[#212124] text-[#8d8d94] hover:text-[#f4f4f5] border border-[#2b2b2f]'
          }`}
        >
          <MapIcon className={`w-4 h-4 ${discoverTool === 'map' ? 'text-[#17171a]' : 'text-[#ff6b57]'}`} />
          <span>Interactive Map</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setDiscoverTool('manual');
            if (!pitchLoc) setPitchLoc(event.where || 'Local');
          }}
          className={`min-h-[42px] cursor-pointer text-xs sm:text-sm px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm font-bold ${
            discoverTool === 'manual'
              ? 'bg-[#f4f4f5] text-[#17171a]'
              : 'bg-[#212124] text-[#8d8d94] hover:text-[#f4f4f5] border border-[#2b2b2f]'
          }`}
        >
          <Plus className={`w-4 h-4 ${discoverTool === 'manual' ? 'text-[#17171a] stroke-[3]' : 'text-[#f4f4f5]'}`} />
          <span>Pitch Custom</span>
        </button>
      </div>

          {/* Child Panel: Mode 1 - Interactive Map & Curated Spots */}
          {activeIdeaMode === 'map' && (
            <div className="space-y-4 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#212124] border border-[#2b2b2f] rounded-xl p-3.5">
                <div className="text-xs text-[#cfcfd4]">
                  Browse real venues in <b>{aiLoc || event.where || 'your area'}</b> with Google Map pins, Tinder swipe cards, or grid.
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleRollFree}
                    className="cursor-pointer bg-[#17171a] border border-[#2b2b2f] hover:border-[#ff6b57] text-[#f4f4f5] font-semibold text-xs px-3.5 py-2 rounded-xl active:scale-95 transition whitespace-nowrap flex items-center gap-1.5"
                  >
                    <Dices className="w-3.5 h-3.5 text-[#ff6b57]" />
                    <span>Roll 3 Instant Spots</span>
                  </button>
                </div>
              </div>
              {freeMsg && (
                <div className="text-xs text-[#cfcfd4] bg-[#212124] border border-[#2b2b2f] px-3.5 py-2.5 rounded-xl">
                  {freeMsg}
                </div>
              )}

              <VenueExplorer
                event={event}
                squad={squad}
                currentUser={currentUser}
                banList={banList}
                defaultArea={
                  aiLoc.trim() || event.where || (event.mid && event.mid.name) || currentUser?.loc || 'Rochester'
                }
                defaultVibe={aiVib.trim() || event.vibe || ''}
                onAddVenue={handleExplorerAddVenue}
                onAddBan={onAddBan}
                onShowToast={notify}
                onOpenPintdr={() => setIsPintdrOpen(true)}
              />
            </div>
          )}

          {/* Child Panel: Mode 2 - Pintdr Mode */}
          {activeIdeaMode === 'pintdr' && (
            <div className="bg-[#212124] border border-[#ff6b57]/40 rounded-xl p-6 sm:p-8 text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ff6b57] to-[#ff8f7d] shadow-lg shadow-[#ff6b57]/20 text-[#1a0703]">
                <Flame className="w-8 h-8 fill-current" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h4 className="text-lg font-extrabold text-[#ffffff] font-display">
                  Pintdr Squad Matcher
                </h4>
                <p className="text-xs sm:text-sm text-[#cfcfd4] leading-relaxed">
                  Rapid-fire Tinder swipe deck tuned for <b>{aiLoc || event.where || 'your area'}</b> {aiVib ? `(${aiVib})` : ''}.
                  Swipe right on spots you fancy, left to skip, or ban duds permanently.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPintdrOpen(true)}
                  className="cursor-pointer bg-gradient-to-r from-[#ff6b57] to-[#ff8f7d] hover:brightness-110 active:scale-95 text-[#1a0703] font-display font-black text-sm px-6 py-3 rounded-xl transition flex items-center gap-2 shadow-md shadow-[#ff6b57]/25"
                >
                  <Flame className="w-4 h-4 fill-current" />
                  <span>Launch Fullscreen Pintdr</span>
                </button>
                <button
                  type="button"
                  onClick={handleRollFree}
                  className="cursor-pointer bg-[#17171a] border border-[#2b2b2f] hover:border-[#3b3b40] text-[#f4f4f5] font-semibold text-xs px-4 py-3 rounded-xl active:scale-95 transition flex items-center gap-1.5"
                >
                  <Dices className="w-3.5 h-3.5 text-[#ff6b57]" />
                  <span>Roll 3 Spots to Shortlist</span>
                </button>
              </div>
              {freeMsg && <div className="text-xs text-[#cfcfd4] mt-2">{freeMsg}</div>}
            </div>
          )}

          {/* Child Panel: Mode 3 - Gerg AI */}
          {activeIdeaMode === 'ai' && (
            <div className="space-y-4 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-[#f4f4f5] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#ff6b57]" />
                    <span>Gerg AI Idea Engine</span>
                  </div>
                  <div className="text-[11px] text-[#8d8d94]">
                    {MODES[aiMode]?.sub || 'Tailored ideas, live events & multi-stop combos'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setFastMode(!fastMode)}
                  className={`cursor-pointer text-[11px] font-bold px-3 py-1 rounded-lg border transition flex items-center gap-1.5 shrink-0 ${
                    fastMode
                      ? 'bg-[rgba(198,255,61,0.12)] text-[#c6ff3d] border-[#c6ff3d]/40'
                      : 'bg-[#212124] text-[#8d8d94] border-[#2b2b2f]'
                  }`}
                >
                  {fastMode ? (
                    <>
                      <Zap className="w-3 h-3 text-[#c6ff3d]" />
                      <span>Fast Mode: ON</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3 h-3" />
                      <span>Deep Web Search</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {Object.entries(MODES).map(([k, m]) => {
                  const ModeIcon = k === 'gems' ? Gem : k === 'events' ? Ticket : k === 'combo' ? Route : Dices;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setAiMode(k)}
                      className={`cursor-pointer text-xs font-semibold px-3 py-2 rounded-xl border transition whitespace-nowrap flex items-center justify-center gap-1.5 ${
                        aiMode === k
                          ? 'border-[#ff6b57] bg-[#212124] text-[#f4f4f5]'
                          : 'border-[#2b2b2f] bg-[#212124] text-[#8d8d94] hover:text-[#f4f4f5]'
                      }`}
                    >
                      <ModeIcon className="w-3.5 h-3.5" />
                      <span>{m.lbl}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleAskGergAI}
                disabled={isAiStreaming}
                className={`w-full cursor-pointer font-bold text-xs sm:text-sm px-4 py-3 rounded-xl transition flex items-center justify-center gap-2 ${
                  isAiStreaming
                    ? 'border border-[#ff6b57] bg-[#2a1a17] text-[#ff6b57] animate-pulse cursor-wait'
                    : 'bg-[#ff6b57] text-[#1a0703] hover:brightness-105 active:scale-[0.99]'
                }`}
              >
                {isAiStreaming ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff6b57] animate-ping" />
                    <span>Generating ideas for {aiLoc || 'your area'}...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-current" />
                    <span>Ask Gerg AI ({MODES[aiMode]?.lbl})</span>
                  </>
                )}
              </button>

              {/* Real-time Streaming Rack */}
              {streamingIdeas.length > 0 && (
                <div className="p-3.5 bg-[#212124] border border-[#ff6b57]/40 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-[#ff6b57]">
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-[#ff6b57]" />
                      <span>Incoming ideas ({streamingIdeas.length} of 3)</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {streamingIdeas.map((idea, idx) => (
                      <div
                        key={idx}
                        className="bg-[#17171a] border border-[#2b2b2f] rounded-lg p-3 text-xs"
                      >
                        <div className="font-bold text-[#f4f4f5] truncate flex items-center gap-1.5">
                          {idea.kind === 'combo' ? (
                            <Route className="w-3.5 h-3.5 text-[#c6ff3d] shrink-0" />
                          ) : idea.live ? (
                            <Ticket className="w-3.5 h-3.5 text-[#ff6b57] shrink-0" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
                          )}
                          <span className="truncate">{idea.name}</span>
                        </div>
                        <div className="text-[11px] text-[#8d8d94] truncate mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#ff6b57]" />
                          <span>{idea.loc}</span>
                        </div>
                        <p className="text-[11px] text-[#cfcfd4] mt-1 line-clamp-2">{idea.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {aiMsg && (
                <div className="text-xs text-[#cfcfd4] whitespace-pre-line bg-[#212124] border border-[#2b2b2f] p-3 rounded-xl">
                  {aiMsg}
                </div>
              )}
              {aiSources.length > 0 && (
                <div className="text-xs text-[#8d8d94] flex flex-wrap items-center gap-1">
                  <Search className="w-3.5 h-3.5 mr-0.5 inline" />
                  <span>Checked:</span>
                  {aiSources.map((s, idx) => (
                    <span key={idx}>
                      {idx > 0 && ' · '}
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

          {/* Child Panel: Mode 4 - Manual Pitch */}
          {activeIdeaMode === 'manual' && (
            <div className="bg-[#212124] border border-[#2b2b2f] rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-[#f4f4f5] font-display flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-[#c6ff3d]" />
                    <span>Pitch Custom Activity</span>
                  </div>
                  <div className="text-xs text-[#8d8d94]">
                    Add your own venue or custom activity directly to the squad shortlist
                  </div>
                </div>
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setPitchName(`${currentUser.name}'s Place`);
                      setPitchLoc(currentUser.loc || aiLoc || 'Local');
                    }}
                    className="cursor-pointer text-xs font-bold text-[#c6ff3d] hover:underline transition whitespace-nowrap flex items-center gap-1"
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span>Pitch My Place</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#8d8d94] mb-1">
                    Venue or Activity Name
                  </label>
                  <input
                    value={pitchName}
                    onChange={(e) => setPitchName(e.target.value)}
                    placeholder="e.g. Flight Club Darts"
                    className="w-full bg-[#17171a] border border-[#2b2b2f] focus:border-[#ff6b57] text-[#f4f4f5] px-3.5 py-2.5 rounded-xl text-xs sm:text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#8d8d94] mb-1">
                    Town / Station (Defaults to parent location)
                  </label>
                  <input
                    value={pitchLoc || aiLoc}
                    onChange={(e) => setPitchLoc(e.target.value)}
                    placeholder="e.g. Rochester"
                    className="w-full bg-[#17171a] border border-[#2b2b2f] focus:border-[#ff6b57] text-[#f4f4f5] px-3.5 py-2.5 rounded-xl text-xs sm:text-sm outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => handlePitchVenue(pitchName, pitchLoc || aiLoc, false)}
                className="w-full cursor-pointer bg-[rgba(198,255,61,0.12)] border border-[#c6ff3d]/30 text-[#c6ff3d] font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl hover:bg-[rgba(198,255,61,0.2)] active:scale-95 transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Custom Pitch to Shortlist</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* The Squad Ban List */}
      <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-[#ff6b57] font-display flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-[#ff6b57]" />
              <span>The Ban List ({banList.length})</span>
            </div>
            <div className="text-xs text-[#8d8d94] mt-0.5">
              Blacklisted chains & default pubs automatically excluded across all 4 discovery modes
            </div>
          </div>
        </div>

        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
          {banList.length === 0 ? (
            <div className="bg-[#212124] border border-[#2b2b2f] text-xs text-[#8d8d94] px-3.5 py-2.5 rounded-xl">
              No pubs banned right now — add any chain or spot below to exclude it from all rolls and searches.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {banList.map((b) => (
                <div
                  key={b.id}
                  className="inline-flex items-center gap-1.5 bg-[#212124] border border-[#2b2b2f] text-xs px-3 py-1.5 rounded-xl"
                >
                  <Ban className="w-3.5 h-3.5 text-[#ff6b57] shrink-0" />
                  <span className="text-[#f4f4f5] font-semibold">{b.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveBan(b.id)}
                    className="cursor-pointer text-[#8d8d94] hover:text-[#ff6b57] text-xs p-1"
                    title="Remove ban"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            value={newBan}
            onChange={(e) => setNewBan(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddBan()}
            placeholder="Ban another pub or chain (e.g. Wetherspoon, Greene King)..."
            className="flex-1 bg-[#212124] border border-[#2b2b2f] focus:border-[#ff6b57] text-[#f4f4f5] px-3.5 py-2.5 rounded-xl text-xs sm:text-sm outline-none"
          />
          <button
            type="button"
            onClick={handleAddBan}
            className="cursor-pointer bg-[rgba(255,107,87,0.13)] border border-[#ff6b57]/30 text-[#ff6b57] font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl hover:bg-[rgba(255,107,87,0.2)] transition whitespace-nowrap"
          >
            Ban Venue
          </button>
        </div>
      </div>

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
