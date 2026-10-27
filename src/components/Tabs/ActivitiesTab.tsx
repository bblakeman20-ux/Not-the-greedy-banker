import React, { useState, useEffect } from 'react';
import { AppConfig, BanItem, Bounty, Expense, OutingEvent, User, Venue } from '../../types';
import { gbp, isBanned, MAX_VETOES, normName, safeUrl } from '../../utils/storage';
import { who } from '../../utils/kitty';
import { fetchPlaces, makeIdeas, miles } from '../../utils/osm';
import { askGergAI, MODES } from '../../utils/gemini';
import { getLocalCuratedIdeas } from '../../utils/localPlaces';
import confetti from 'canvas-confetti';
import { themeConfetti } from '../../utils/theme';
import { VenueExplorer } from '../VenueExplorer';
import { PintdrOverlay } from '../PintdrOverlay';
import { FlickeringFlameLoader } from '../FlickeringFlameLoader';
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
  ChevronDown,
  ChevronUp,
  Skull,
  Trash2,
  Lock,
  Unlock,
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

  const [expandedVenueId, setExpandedVenueId] = useState<string | null>(null);
  const [showSoloPitches, setShowSoloPitches] = useState(false);
  const [showGraveyard, setShowGraveyard] = useState(false);
  const [stagedIdeas, setStagedIdeas] = useState<Venue[]>([]);

  const [confirmVetoWinner, setConfirmVetoWinner] = useState(false);

  const isLocked = Boolean(event.locked);
  const me = currentUser;

  const myVetoesUsed = me
    ? Math.max(
        event.planVetoes?.[me.id] || 0,
        (event.bounties || []).filter((b) => b.uid === me.id).length
      )
    : 0;
  const myVetoesLeft = Math.max(0, MAX_VETOES - myVetoesUsed);

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

  const handleVote = (venueId: string, type: 'k' | 'p') => {
    if (isLocked) {
      notify('🔒 This event is locked in – tap 🔓 Unlock or 🚨 Veto Decided Plan to change');
      return;
    }
    if (!me) {
      notify('👆 Tap your profile first in the squad bar above (or + New Profile)');
      return;
    }

    const targetVenue = event.venues.find((v) => v.id === venueId);
    if (!targetVenue) return;

    const currentVote = (targetVenue.votes || {})[me.id];

    // Treason Mode check if voting Keen for The Greedy Banker
    let updatedExpenses = event.exp || [];
    let updatedTraitors = event.traitors || [];
    if (type === 'k' && currentVote !== 'k' && /greedy\s*banker/i.test(targetVenue.name)) {
      notify(
        `🚨 TREASON ALERT! ${me.name} caved to default planning and voted for The Greedy Banker! £5 Traitor Tax applied.`
      );
      updatedTraitors = Array.from(new Set([...updatedTraitors, me.id]));
      updatedExpenses = [
        ...updatedExpenses,
        {
          id: 'exp_' + Date.now(),
          ttl: '🐍 Traitor Tax (The Greedy Banker)',
          amt: 5,
          by: me.name,
          byId: me.id,
        },
      ];
    }

    const venues = event.venues.map((v) => {
      if (v.id !== venueId) return v;
      const votes = { ...(v.votes || {}) };
      if (type === 'k') {
        votes[me.id] = currentVote === 'k' ? null : 'k';
      } else {
        // Free Pass / Not Keen toggle (no penalties or bounty clock)
        votes[me.id] = currentVote === 'p' || currentVote === 'v' ? null : 'p';
      }
      return { ...v, votes };
    });

    if (type === 'k') {
      if (currentVote !== 'k') {
        notify(`👍 Voted keen for "${targetVenue.name}"`);
      } else {
        notify(`↩️ Removed keen vote on "${targetVenue.name}"`);
      }
    } else {
      if (currentVote !== 'p' && currentVote !== 'v') {
        notify(`👎 Passed on "${targetVenue.name}"`);
      } else {
        notify(`↩️ Removed pass on "${targetVenue.name}"`);
      }
    }

    onUpdateEvent({
      ...event,
      venues,
      exp: updatedExpenses,
      traitors: updatedTraitors,
    });
  };

  const handleVetoDecidedPlan = (decided: Venue) => {
    if (!me) {
      notify('👆 Tap your profile first in the squad bar above (or + New Profile)');
      return;
    }
    if (myVetoesLeft <= 0) {
      notify("🚫 You've used both of your Veto tokens for this outing!");
      return;
    }

    // 1. Deduct 1 Veto token from profile
    const currentPlanVetoes = event.planVetoes || {};
    const updatedPlanVetoes = {
      ...currentPlanVetoes,
      [me.id]: myVetoesUsed + 1,
    };

    // 2. Apply Bounty penalty (add active 60s Bounty clock)
    const newBounty: Bounty = {
      id: 'bty_' + Date.now(),
      uid: me.id,
      vid: decided.id,
      vname: decided.name,
      until: now + 60000,
    };

    // 3. Unlock and dethrone winning venue
    const updatedVenues = event.venues.map((v) => {
      if (v.id === decided.id) {
        const votes = { ...(v.votes || {}) };
        votes[me.id] = 'p'; // User passes on the vetoed venue
        return { ...v, votes };
      }
      return v;
    });

    onUpdateEvent({
      ...event,
      win: null,
      locked: null,
      venues: updatedVenues,
      bounties: [...(event.bounties || []), newBounty],
      planVetoes: updatedPlanVetoes,
    });

    setConfirmVetoWinner(false);
    setPreSpinWinId(undefined);
    setSpinMsg('');

    // 4. Open Bounty replacement prompt in Gerg AI tab
    setBountyName('');
    setBountyLoc(decided.loc || event.where || '');
    setSubTab('discover');

    notify(`💥 Vetoed "${decided.name}"! 1 Veto token used. 60s Bounty clock started – pitch an alternative!`);
  };

  const handleUnlockWinner = () => {
    onUpdateEvent({ ...event, locked: null });
    notify('🔓 Plan unlocked – squad can change the plan');
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

    let updatedExpenses = event.exp || [];
    let updatedTraitors = event.traitors || [];
    if (/greedy\s*banker/i.test(n)) {
      notify(
        `🚨 TREASON ALERT! ${me.name} caved to default planning and pitched The Greedy Banker! £5 Traitor Tax applied.`
      );
      updatedTraitors = Array.from(new Set([...updatedTraitors, me.id]));
      updatedExpenses = [
        ...updatedExpenses,
        {
          id: 'exp_' + Date.now(),
          ttl: '🐍 Traitor Tax (The Greedy Banker)',
          amt: 5,
          by: me.name,
          byId: me.id,
        },
      ];
    }

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
      exp: updatedExpenses,
      traitors: updatedTraitors,
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
    handlePintdrAddVenue(venueData, false);
  };

  const handlePintdrAddVenue = (venueData: Partial<Venue>, makeWinner = false) => {
    if (isLocked) return;
    if (!me) {
      notify('👆 Tap your profile first in the squad bar above (or + New Profile)');
      return;
    }

    const roomSize = squad ? squad.length : 1;
    const isTreason = /greedy\s*banker/i.test(venueData.name || '');

    // Treason Tax if pitching / liking The Greedy Banker
    let updatedExpenses = event.exp || [];
    let updatedTraitors = event.traitors || [];
    if (isTreason) {
      notify(
        `🚨 TREASON ALERT! ${me.name} caved to default planning and swiped right on The Greedy Banker! £5 Traitor Tax applied.`
      );
      updatedTraitors = Array.from(new Set([...updatedTraitors, me.id]));
      updatedExpenses = [
        ...updatedExpenses,
        {
          id: 'exp_' + Date.now(),
          ttl: '🐍 Traitor Tax (The Greedy Banker)',
          amt: 5,
          by: me.name,
          byId: me.id,
        },
      ];
    }

    // Direct promote if room has < 2 people (solo mode) or if superlike/winner
    if (roomSize < 2 || makeWinner) {
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
        votes: { [me.id]: 'k' },
        ...venueData,
      };

      onUpdateEvent({
        ...event,
        win: makeWinner ? newVenueId : event.win,
        venues: [newVenue, ...event.venues.filter((v) => normName(v.name) !== normName(newVenue.name))],
        bounties: [...event.bounties],
        exp: updatedExpenses,
        traitors: updatedTraitors,
      });
      return;
    }

    // 2+ Likes Rule in Squad Match Pool
    const key = normName(venueData.name || 'venue_' + Date.now());
    const currentPool = { ...(event.swipePool || {}) };
    const existingItem = currentPool[key];

    if (existingItem) {
      const existingLikes = existingItem.likes || [];
      if (existingLikes.includes(me.id)) {
        notify(`👍 You already liked "${venueData.name}". Waiting for a 2nd squad match!`);
        return;
      }

      // SQUAD MATCH! 2+ unique squad members liked it
      const allLikes = [...existingLikes, me.id];
      delete currentPool[key];

      const pend = myBounties.map((b) => b.id);
      const won = redeemBounties(pend, venueData.name || '');

      const initialVotes: Record<string, 'k'> = {};
      allLikes.forEach((uid) => {
        initialVotes[uid] = 'k';
      });

      const newVenueId = 'v' + Date.now() + Math.random().toString(36).slice(2, 6);
      const matchedVenue: Venue = {
        id: newVenueId,
        name: venueData.name || existingItem.venue.name || 'Venue',
        loc: venueData.loc || existingItem.venue.loc || 'Local',
        desc: won
          ? `🎯 Veto Bounty replacement for ${myBounties[0]?.vname}`
          : (venueData.desc || existingItem.venue.desc || ''),
        kind: venueData.kind || existingItem.venue.kind || 'spot',
        when: venueData.when || existingItem.venue.when,
        cost: venueData.cost || existingItem.venue.cost,
        steps: venueData.steps || existingItem.venue.steps,
        url: venueData.url || existingItem.venue.url,
        live: venueData.live ?? existingItem.venue.live,
        src: venueData.src || existingItem.venue.src || 'osm',
        votes: initialVotes,
        ...existingItem.venue,
        ...venueData,
      };

      confetti({
        particleCount: 80,
        spread: 90,
        origin: { y: 0.5 },
        colors: themeConfetti(),
      });

      notify(`🔥 IT'S A SQUAD MATCH! "${matchedVenue.name}" reached 2 votes and joined the Shortlist!`);

      onUpdateEvent({
        ...event,
        venues: [matchedVenue, ...event.venues.filter((v) => normName(v.name) !== key)],
        swipePool: currentPool,
        bounties: [...event.bounties],
        exp: updatedExpenses,
        traitors: updatedTraitors,
      });
    } else {
      // 1st Like: hold in background swipe pool
      currentPool[key] = {
        venue: venueData,
        likes: [me.id],
        timestamp: Date.now(),
      };

      notify(`🕵️ Swiped right on "${venueData.name}". Waiting for a 2nd squad match!`);

      onUpdateEvent({
        ...event,
        swipePool: currentPool,
        exp: updatedExpenses,
        traitors: updatedTraitors,
      });
    }
  };

  const handlePromoteStagedIdea = (idea: Venue) => {
    if (isLocked) return;
    if (!me) {
      notify('👆 Tap your profile first in the squad bar above (or + New Profile)');
      return;
    }

    const pend = myBounties.map((b) => b.id);
    const won = redeemBounties(pend, idea.name);

    let updatedExpenses = event.exp || [];
    let updatedTraitors = event.traitors || [];
    if (/greedy\s*banker/i.test(idea.name)) {
      notify(
        `🚨 TREASON ALERT! ${me.name} caved to default planning and shortlisted The Greedy Banker! £5 Traitor Tax applied.`
      );
      updatedTraitors = Array.from(new Set([...updatedTraitors, me.id]));
      updatedExpenses = [
        ...updatedExpenses,
        {
          id: 'exp_' + Date.now(),
          ttl: '🐍 Traitor Tax (The Greedy Banker)',
          amt: 5,
          by: me.name,
          byId: me.id,
        },
      ];
    }

    const shortlistedVenue: Venue = {
      ...idea,
      id: 'v' + Date.now() + Math.random().toString(36).slice(2, 6),
      desc: won ? `🎯 Veto Bounty replacement for ${myBounties[0]?.vname}` : idea.desc,
      votes: { [me.id]: 'k' },
    };

    onUpdateEvent({
      ...event,
      venues: [shortlistedVenue, ...event.venues.filter((v) => normName(v.name) !== normName(idea.name))],
      bounties: [...event.bounties],
      exp: updatedExpenses,
      traitors: updatedTraitors,
    });

    setStagedIdeas((prev) => prev.filter((i) => i.id !== idea.id));
    confetti({ particleCount: 45, spread: 60, origin: { y: 0.6 } });
    notify(`💖 Shortlisted "${idea.name}"!`);
  };

  const handleTrimSoloPitches = () => {
    if (isLocked) return;
    const toRemove = event.venues.filter((v) => {
      if (v.id === event.win) return false;
      const vt = v.votes || {};
      const keenVotes = Object.values(vt).filter((x) => x === 'k').length;
      const vetoVotes = Object.values(vt).filter((x) => x === 'v').length;
      return keenVotes <= 1 && vetoVotes === 0;
    });

    if (toRemove.length === 0) {
      notify('👍 No 1-vote solo pitches to trim!');
      return;
    }

    const removeIds = new Set(toRemove.map((v) => v.id));
    const venues = event.venues.filter((v) => !removeIds.has(v.id));
    onUpdateEvent({ ...event, venues });
    notify(`🧹 Purged ${toRemove.length} unbacked solo pitch${toRemove.length === 1 ? '' : 'es'}!`);
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

      const newVenues: Venue[] = res.ideas.map((x, i) => ({
        id: 'v_staged_' + Date.now() + '_' + i,
        name: x.name || 'Venue',
        loc: x.loc || aiLoc || 'Local',
        desc: x.desc || '',
        kind: x.kind || 'spot',
        when: x.when,
        cost: x.cost,
        url: x.url,
        steps: x.steps,
        live: x.live,
        votes: {},
      }));

      setStagedIdeas(newVenues);
      setAiSources(res.sources);
      setAiMsg(
        `⚡ Gerg AI delivered ${res.ideas.length} ideas in ${res.duration.toFixed(
          1
        )}s! Review them below in "Fresh Gerg AI Rolls" and tap "➕ Shortlist This" to add to the squad list.`
      );
    } catch (e: any) {
      setAiMsg(`❌ ${e.message}`);
    } finally {
      setIsAiStreaming(false);
      setStreamingIdeas([]);
    }
  };

  // Helper to compute Keen, Pass, and Net Score (Keen - Pass)
  const getVenueScores = (v: Venue) => {
    const vt = v.votes || {};
    const keenCount = squad.filter((u) => vt[u.id] === 'k').length;
    const passCount = squad.filter((u) => vt[u.id] === 'p' || vt[u.id] === 'v').length;
    const netScore = keenCount - passCount;
    return { keenCount, passCount, netScore };
  };

  // Auto-sort venues: Pinned winner first -> Net Score (Keen - Pass) descending -> Keen count
  const sortedVenues = [...event.venues].sort((a, b) => {
    const aWin = event.win === a.id ? 1 : 0;
    const bWin = event.win === b.id ? 1 : 0;
    if (aWin !== bWin) return bWin - aWin;

    const aScores = getVenueScores(a);
    const bScores = getVenueScores(b);
    if (aScores.netScore !== bScores.netScore) {
      return bScores.netScore - aScores.netScore;
    }
    return bScores.keenCount - aScores.keenCount;
  });

  // Group into clean tiers:
  // 1. Cold / Passed Drawer: Only move an item if it has 0 Keen votes AND 2+ Pass votes
  const coldPassedVenues = sortedVenues.filter((v) => {
    if (event.win === v.id) return false;
    const { keenCount, passCount } = getVenueScores(v);
    return keenCount === 0 && passCount >= 2;
  });

  // 2. Active Venues (not in cold passed drawer)
  const activeVenues = sortedVenues.filter((v) => !coldPassedVenues.some((c) => c.id === v.id));

  // 3. Top Contenders: Winner OR 2+ Keen
  const topContenders = activeVenues.filter((v) => {
    if (event.win === v.id) return true;
    const { keenCount } = getVenueScores(v);
    return keenCount >= 2;
  });

  // 4. Solo / Other Pitches: Active venues with < 2 Keen
  const soloPitches = activeVenues.filter((v) => !topContenders.some((t) => t.id === v.id));

  const decidedVenue = event.win ? event.venues.find((v) => v.id === event.win) || null : null;
  const winVenue = decidedVenue || sortedVenues[0];

  const mapsUrl = (q: string) =>
    'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

  const handleSpinRoulette = async () => {
    if (isLocked) return;
    const okVenues = activeVenues.length > 0 ? activeVenues : event.venues;

    if (!okVenues.length) {
      if (event.venues.length) {
        setSpinMsg('🚫 All spots on the list have been passed by the squad – pitch or roll something new first');
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

  const renderVenueAccordionPill = (v: Venue) => {
    const vt = v.votes || {};
    const { keenCount, passCount, netScore } = getVenueScores(v);
    const keenList = squad.filter((u) => vt[u.id] === 'k').map((u) => `${u.emo || '👤'} ${u.name}`);
    const passList = squad
      .filter((u) => vt[u.id] === 'p' || vt[u.id] === 'v')
      .map((u) => `${u.emo || '👤'} ${u.name}`);
    const roomCount = squad ? squad.length : 0;
    const isMajorityOption = roomCount >= 2 && keenCount / roomCount > 0.5;
    const isWinner = event.win === v.id;
    const isSpinning = spinningId === v.id;
    const isExpanded = expandedVenueId === v.id;
    const isGreedyBanker = /greedy\s*banker/i.test(v.name);
    const isColdPassed = keenCount === 0 && passCount >= 2;

    return (
      <div
        key={v.id}
        className={`border-2 rounded-2xl transition-all overflow-hidden ${
          isGreedyBanker
            ? 'border-red-500/80 bg-red-950/30 shadow-[0_0_18px_rgba(239,68,68,0.25)] animate-pulse'
            : isWinner
            ? 'border-secondary bg-card2 shadow-[0_0_20px_color-mix(in_oklab,var(--good)_20%,transparent)] ring-1 ring-secondary/50'
            : isColdPassed
            ? 'border-line/60 bg-card/70 opacity-75'
            : 'border-line bg-card2 hover:border-line2'
        } ${isSpinning ? 'roulette-spin' : ''}`}
      >
        {/* Compact Accordion Header Pill (~60-64px) */}
        <div
          onClick={() => setExpandedVenueId(isExpanded ? null : v.id)}
          className="cursor-pointer min-h-[60px] p-3 sm:px-4 flex items-center justify-between gap-2.5 select-none hover:bg-ink/[0.02] transition"
        >
          {/* Left: Vote Status Badge */}
          <div className="shrink-0">
            {isWinner ? (
              <div
                className="w-10 h-10 rounded-xl bg-secondary/20 border border-secondary/40 text-secondary flex flex-col items-center justify-center font-black text-xs shadow-sm"
                title="Winning Pick"
              >
                <Crown className="w-4 h-4 fill-current" />
                <span className="text-[9px] uppercase leading-none font-bold">Win</span>
              </div>
            ) : keenCount >= 2 ? (
              <div
                className="w-10 h-10 rounded-xl bg-[color-mix(in_oklab,var(--good)_18%,transparent)] border border-secondary/40 text-secondary flex flex-col items-center justify-center font-black text-xs shadow-[0_0_12px_color-mix(in_oklab,var(--good)_20%,transparent)]"
                title={`${keenCount} keen, ${passCount} passed (Net: ${netScore > 0 ? `+${netScore}` : netScore})`}
              >
                <Flame className="w-4 h-4 fill-current" />
                <span className="text-[10px] leading-none font-black">{keenCount}</span>
              </div>
            ) : keenCount === 1 ? (
              <div
                className="w-10 h-10 rounded-xl bg-card border border-line text-ink2 flex flex-col items-center justify-center font-bold text-xs"
                title={`1 keen${passCount > 0 ? `, ${passCount} passed` : ' (Needs seconder)'}`}
              >
                <ThumbsUp className="w-3.5 h-3.5 text-secondary" />
                <span className="text-[10px] leading-none">1</span>
              </div>
            ) : passCount > 0 ? (
              <div
                className="w-10 h-10 rounded-xl bg-card border border-line text-muted flex flex-col items-center justify-center font-bold text-xs"
                title={`${passCount} squad members passed (Net: -${passCount})`}
              >
                <ThumbsDown className="w-3.5 h-3.5 text-muted" />
                <span className="text-[10px] leading-none">-{passCount}</span>
              </div>
            ) : (
              <div
                className="w-10 h-10 rounded-xl bg-card border border-line text-muted flex flex-col items-center justify-center font-bold text-xs"
                title="0 votes yet"
              >
                <span className="text-sm">🌱</span>
                <span className="text-[9px] leading-none">0</span>
              </div>
            )}
          </div>

          {/* Middle: Name, Town/Location, £ Price */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-display font-black text-sm sm:text-base text-ink truncate">
                {v.name}
              </span>
              {Boolean(isGreedyBanker) && (
                <span className="text-[9px] font-black uppercase tracking-wider bg-red-950 text-red-300 border border-red-500/60 px-1.5 py-0.5 rounded animate-pulse">
                  🚨 HIGH TREASON: DEFAULT PLANNING INERTIA
                </span>
              )}
              {Boolean(isMajorityOption) && (
                <span className="text-[9px] font-bold text-secondary bg-secondary/15 px-1.5 py-0.2 rounded border border-secondary/30">
                  Majority
                </span>
              )}
              {(keenCount > 0 || passCount > 0) && (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                    netScore > 0
                      ? 'text-secondary bg-secondary/10 border-secondary/25'
                      : netScore < 0
                      ? 'text-muted bg-line/40 border-line'
                      : 'text-ink2 bg-line/30 border-line'
                  }`}
                  title={`Net Score: ${netScore} (👍 ${keenCount} Keen - 👎 ${passCount} Pass)`}
                >
                  Net {netScore > 0 ? `+${netScore}` : netScore}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted mt-0.5 flex-wrap">
              <span className="truncate flex items-center gap-1">
                <MapPin className="w-3 h-3 text-primary shrink-0" />
                <span>{v.loc}</span>
              </span>
              {v.cost ? (
                <span className="text-secondary font-semibold shrink-0">
                  • £{v.cost.replace(/[^0-9.]/g, '') || v.cost} pp
                </span>
              ) : null}
              {v.when ? (
                <span className="text-muted shrink-0 hidden sm:inline">
                  • 🕒 {v.when}
                </span>
              ) : null}
            </div>
          </div>

          {/* Right: Quick Vote Buttons + Accordion Chevron */}
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {!isLocked && me && (
              <>
                <button
                  type="button"
                  onClick={() => handleVote(v.id, 'k')}
                  title={isGreedyBanker ? 'Commit Treason: £5 Traitor Tax' : 'Vote Keen'}
                  className={`cursor-pointer font-bold text-xs h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl transition flex items-center gap-1 active:scale-95 ${
                    isGreedyBanker
                      ? vt[me.id] === 'k'
                        ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 font-black'
                        : 'border border-red-500/60 bg-red-950/40 text-red-300 hover:bg-red-900/50'
                      : vt[me.id] === 'k'
                      ? 'bg-secondary text-secondary-ink shadow-[0_0_12px_color-mix(in_oklab,var(--good)_30%,transparent)] font-black'
                      : 'border border-line bg-card text-ink2 hover:text-ink hover:border-line2'
                  }`}
                >
                  {isGreedyBanker ? (
                    <>
                      <span>🐍</span>
                      <span className="hidden sm:inline">Commit Treason</span>
                    </>
                  ) : (
                    <>
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Keen</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleVote(v.id, 'p')}
                  title={
                    vt[me.id] === 'p' || vt[me.id] === 'v'
                      ? 'Remove Pass vote'
                      : 'Pass / Not Keen (Free vote, toggle on/off anytime)'
                  }
                  className={`cursor-pointer font-bold text-xs h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl transition flex items-center gap-1 active:scale-95 ${
                    vt[me.id] === 'p' || vt[me.id] === 'v'
                      ? 'bg-primary text-primary-ink shadow-[0_0_12px_color-mix(in_oklab,var(--accent)_30%,transparent)] font-black'
                      : 'border border-line bg-card text-ink2 hover:text-ink hover:border-line2'
                  }`}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Pass</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setExpandedVenueId(isExpanded ? null : v.id)}
              className="p-1.5 rounded-lg text-muted hover:text-ink transition"
              title={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expanded Accordion Details Panel */}
        {isExpanded && (
          <div className="p-4 sm:p-5 border-t border-line bg-card/95 space-y-4 animate-in fade-in duration-150">
            {/* Treason Mode Warning Banner */}
            {isGreedyBanker && (
              <div className="bg-red-950/70 border border-red-500/70 rounded-xl p-3 text-xs text-red-200 font-semibold flex items-center gap-2">
                <span className="text-base">⚠️</span>
                <span>
                  Warning: Voting for The Greedy Banker violates the Anti-Default Pact. Traitors buy the first round.
                </span>
              </div>
            )}

            {/* Description */}
            {Boolean(v.desc) && (
              <p className="text-xs sm:text-sm text-ink2 leading-relaxed">
                {v.desc}
              </p>
            )}

            {/* Multi-Stop Timeline or Steps */}
            {v.stops && v.stops.length > 0 ? (
              <div className="bg-card2 p-3.5 sm:p-4 rounded-xl border border-line space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-secondary">
                  <span className="flex items-center gap-1.5">
                    <Route className="w-4 h-4" />
                    <span>Multi-Stop Timeline ({v.stops.length} Venues)</span>
                  </span>
                  <a
                    href={`https://www.google.com/maps/dir/${v.stops
                      .map((s) => encodeURIComponent(s.name + ', ' + (s.loc || v.loc)))
                      .join('/')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Full Walking Route</span>
                  </a>
                </div>
                <div className="space-y-2">
                  {v.stops.map((stop, sIdx) => (
                    <div
                      key={sIdx}
                      className="bg-card border border-line rounded-lg p-2.5 flex items-center justify-between text-xs"
                    >
                      <div className="font-semibold text-ink flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-primary text-primary-ink text-[9px] font-black flex items-center justify-center">
                          {sIdx + 1}
                        </span>
                        <span>{stop.name}</span>
                      </div>
                      {Boolean(stop.time) && (
                        <span className="text-[10px] text-secondary bg-secondary/10 px-1.5 py-0.5 rounded border border-secondary/20">
                          {stop.time}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : v.steps && v.steps.length > 0 ? (
              <div className="bg-card2 p-3 rounded-xl border border-line space-y-1.5 text-xs text-ink2">
                <div className="text-[10px] font-bold text-primary uppercase tracking-wider">
                  Timeline / Route Steps
                </div>
                {v.steps.map((st, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="text-primary font-bold">•</span>
                    <span>{st}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Voters Breakdown */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line/80 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <ThumbsUp className="w-3.5 h-3.5 text-secondary shrink-0" />
                <span className="font-bold text-secondary">Keen ({keenList.length}):</span>
                <span className="text-ink2">{keenList.join(', ') || 'None yet'}</span>
              </div>
              {passList.length > 0 && (
                <div className="flex items-center gap-1.5 text-ink2">
                  <ThumbsDown className="w-3.5 h-3.5 text-muted shrink-0" />
                  <span className="font-semibold text-muted">Passed ({passList.length}):</span>
                  <span className="text-muted">{passList.join(', ')}</span>
                </div>
              )}
            </div>

            {/* Expanded Action Toolbar */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-line/80">
              <div className="flex items-center gap-2">
                <a
                  href={mapsUrl((v.kind === 'combo' ? '' : v.name + ', ') + v.loc)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer text-xs font-semibold text-muted hover:text-primary bg-card2 border border-line hover:border-primary/40 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>Google Maps</span>
                </a>
                {Boolean(safeUrl(v.url)) && (
                  <a
                    href={safeUrl(v.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer text-xs font-semibold text-muted hover:text-ink bg-card2 border border-line px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Website</span>
                  </a>
                )}
              </div>

              {!isLocked && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleLockIn(v.id)}
                    className={`cursor-pointer text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                      isWinner
                        ? 'bg-secondary text-secondary-ink shadow-md'
                        : 'border border-line bg-card2 text-ink2 hover:text-secondary hover:border-secondary/40'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${isWinner ? 'fill-current' : ''}`} />
                    <span>{isWinner ? 'Winner Picked' : 'Lock Winner'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteVenue(v.id)}
                    className="cursor-pointer text-xs font-semibold text-muted hover:text-primary bg-card2 border border-line hover:border-primary/40 p-1.5 rounded-xl transition"
                    title="Remove from shortlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 👑 DECIDED SQUAD PLAN Hero Card */}
      {decidedVenue && (
        <div className="border-2 border-secondary bg-gradient-to-br from-card via-card to-card shadow-[0_0_28px_color-mix(in_oklab,var(--good)_22%,transparent)] rounded-2xl p-4 sm:p-5 ring-1 ring-secondary/40 relative overflow-hidden space-y-3.5 animate-in fade-in duration-200">
          {/* Subtle gold crown watermark background effect */}
          <div className="absolute -right-6 -bottom-6 text-secondary/5 pointer-events-none select-none">
            <Crown className="w-36 h-36" />
          </div>

          {/* Top Row: Crown + Status Badge + Veto Token Status */}
          <div className="flex flex-wrap items-center justify-between gap-2 relative z-10">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-8 h-8 rounded-xl bg-secondary/20 border border-secondary/50 text-secondary flex items-center justify-center font-black shadow-sm">
                <Crown className="w-4 h-4 fill-current" />
              </div>
              <span className="text-xs sm:text-sm font-black font-display tracking-wider uppercase text-secondary">
                👑 DECIDED SQUAD PLAN
              </span>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                  isLocked
                    ? 'bg-secondary text-secondary-ink border-secondary'
                    : 'bg-secondary/15 text-secondary border-secondary/40'
                }`}
              >
                {isLocked ? '🔒 Locked In Final Pick' : '🎯 Front Runner Pick'}
              </span>
            </div>

            {me && (
              <div className="text-[11px] font-semibold text-muted flex items-center gap-1.5 bg-card/90 px-2.5 py-1 rounded-lg border border-line">
                <span>🎟️</span>
                <span>
                  Your Vetoes:{' '}
                  <b className={myVetoesLeft > 0 ? 'text-secondary' : 'text-[#ef4444]'}>
                    {myVetoesLeft} / {MAX_VETOES}
                  </b>{' '}
                  left
                </span>
              </div>
            )}
          </div>

          {/* Venue Info */}
          <div className="space-y-1 relative z-10">
            <h2 className="text-xl sm:text-2xl font-black font-display text-ink tracking-tight">
              {decidedVenue.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
              <span className="flex items-center gap-1 text-ink">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{decidedVenue.loc}</span>
              </span>
              {decidedVenue.cost ? (
                <span className="text-secondary font-bold">
                  • £{decidedVenue.cost.replace(/[^0-9.]/g, '') || decidedVenue.cost} pp
                </span>
              ) : null}
              {decidedVenue.when ? (
                <span className="text-muted">
                  • 🕒 {decidedVenue.when}
                </span>
              ) : null}
            </div>
            {decidedVenue.desc && (
              <p className="text-xs sm:text-sm text-ink2 pt-1 leading-relaxed">
                {decidedVenue.desc}
              </p>
            )}
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-secondary/20 relative z-10">
            <div className="flex items-center gap-2">
              <a
                href={mapsUrl((decidedVenue.kind === 'combo' ? '' : decidedVenue.name + ', ') + decidedVenue.loc)}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer text-xs font-semibold text-ink2 hover:text-ink bg-card border border-line hover:border-secondary/50 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
              >
                <MapIcon className="w-3.5 h-3.5 text-primary" />
                <span>Google Maps</span>
              </a>
              {Boolean(safeUrl(decidedVenue.url)) && (
                <a
                  href={safeUrl(decidedVenue.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer text-xs font-semibold text-ink2 hover:text-ink bg-card border border-line px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Website</span>
                </a>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {isLocked ? (
                <button
                  type="button"
                  onClick={handleUnlockWinner}
                  className="cursor-pointer text-xs font-bold text-ink2 hover:text-ink bg-card border border-line hover:border-line2 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
                >
                  <Unlock className="w-3.5 h-3.5 text-secondary" />
                  <span>Unlock Plan</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleLockIn(decidedVenue.id)}
                  className="cursor-pointer text-xs font-black text-secondary-ink bg-secondary hover:brightness-110 active:scale-95 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lock In Plan</span>
                </button>
              )}

              {/* 🚨 VETO DECIDED PLAN BUTTON */}
              <button
                type="button"
                onClick={() => {
                  if (!me) {
                    notify('👆 Tap your profile first in the squad bar above (or + New Profile)');
                    return;
                  }
                  if (myVetoesLeft <= 0) {
                    notify("🚫 You've used both of your Veto tokens for this outing!");
                    return;
                  }
                  setConfirmVetoWinner(true);
                }}
                disabled={myVetoesLeft <= 0}
                className={`cursor-pointer text-xs font-black px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-md active:scale-95 ${
                  myVetoesLeft <= 0
                    ? 'opacity-40 cursor-not-allowed bg-red-950/40 text-red-400 border border-red-900/40'
                    : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 ring-1 ring-red-400'
                }`}
                title={
                  myVetoesLeft <= 0
                    ? 'No Veto tokens remaining'
                    : 'Veto this decided plan (Costs 1 Veto token and starts 60s Bounty clock)'
                }
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>🚨 Veto Decided Plan (Costs 1 Veto + Bounty)</span>
              </button>
            </div>
          </div>

          {/* Veto Confirmation Prompt Modal / Callout */}
          {confirmVetoWinner && (
            <div className="bg-red-950/90 border-2 border-red-500 rounded-xl p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150 relative z-20 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-900/60 text-red-300 flex items-center justify-center shrink-0 text-base font-black">
                  💣
                </div>
                <div className="space-y-1 min-w-0">
                  <h4 className="text-sm font-black text-ink">
                    Blow up the squad's decided plan?
                  </h4>
                  <p className="text-xs text-red-200 leading-relaxed">
                    Vetoing <b>"{decidedVenue.name}"</b> will deduct <b>1 of your 2 Veto tokens</b>, dethrone the winner, and trigger a <b>60-second Bounty clock</b> for you to pitch a replacement!
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmVetoWinner(false)}
                  className="cursor-pointer text-xs font-semibold bg-card text-ink2 hover:text-ink px-3 py-1.5 rounded-lg border border-line transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleVetoDecidedPlan(decidedVenue)}
                  className="cursor-pointer text-xs font-black bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded-lg shadow-lg shadow-red-600/40 active:scale-95 transition flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>💥 Yes, Veto & Face Bounty</span>
                </button>
              </div>
            </div>
          )}
        </div>
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

      {/* Sub-Tab 1: Shortlist View */}
      {subTab === 'shortlist' && (
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
                  onClick={() => handlePitchVenue(bountyName, bountyLoc, true)}
                  className="flex-1 cursor-pointer bg-primary text-primary-ink font-semibold text-xs px-4 py-2.5 rounded-xl hover:brightness-105 active:scale-95 transition flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Pitch Replacement</span>
                </button>
                <button
                  type="button"
                  onClick={handleAskGergAI}
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
                          onClick={() => handleHideBounty(b.id)}
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
                      onClick={handleTrimSoloPitches}
                      className="cursor-pointer border border-line bg-card2 hover:border-primary/60 text-ink2 hover:text-ink font-semibold text-xs px-3 py-1.5 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 active:scale-95"
                      title="Purge all 1-vote solo pitches that haven't been seconded"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-primary" />
                      <span>Trim Deadwood ({soloPitches.length})</span>
                    </button>
                  )}
                  {Boolean(spinMsg || preSpinWinId !== undefined) && (
                    <button
                      type="button"
                      onClick={handleUndoRoulette}
                      className="cursor-pointer border border-line bg-card2 text-ink2 hover:text-ink hover:border-primary/50 font-semibold text-xs px-3 py-1.5 rounded-xl transition whitespace-nowrap flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Undo</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSpinRoulette}
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
                      onClick={handleUndoRoulette}
                      className="cursor-pointer bg-card border border-line hover:border-primary text-ink font-semibold text-[11px] px-2.5 py-1 rounded-lg transition whitespace-nowrap flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Undo Roulette</span>
                    </button>
                    <button
                      type="button"
                      title="Remove message"
                      onClick={() => setSpinMsg('')}
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
                    onClick={() => setSubTab('discover')}
                    className="w-full sm:w-auto cursor-pointer bg-primary hover:brightness-110 active:scale-95 text-primary-ink font-bold text-xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-primary/20"
                  >
                    <Sparkles className="w-3.5 h-3.5 fill-current" />
                    <span>✨ Go to Gerg AI Generator</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPintdrOpen(true)}
                    className="w-full sm:w-auto cursor-pointer bg-card2 hover:bg-line border border-primary/40 hover:border-primary text-ink font-bold text-xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5 active:scale-95 shadow-md"
                  >
                    <Flame className="w-3.5 h-3.5 text-primary fill-current" />
                    <span>Launch Pintdr Swipe Deck</span>
                  </button>
                </div>
              </div>
            ) : isLocked ? (
              <div className="space-y-3">
                {winVenue && renderVenueAccordionPill(winVenue)}
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
                      {topContenders.map((v) => renderVenueAccordionPill(v))}
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
                          {soloPitches.map((v) => renderVenueAccordionPill(v))}
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
                        {soloPitches.map((v) => renderVenueAccordionPill(v))}
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
                        {coldPassedVenues.map((v) => renderVenueAccordionPill(v))}
                      </div>
                    )}
                  </div>
                )}
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
        className="w-full cursor-pointer bg-gradient-to-r from-primary to-primary-hi hover:brightness-110 active:scale-[0.99] text-primary-ink font-display font-black text-sm sm:text-base py-3.5 px-6 rounded-2xl transition flex items-center justify-center gap-2.5 shadow-[0_0_24px_color-mix(in_oklab,var(--accent)_30%,transparent)]"
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
              ? 'bg-ink text-card'
              : 'bg-card2 text-muted hover:text-ink border border-line'
          }`}
        >
          <Sparkles className={`w-4 h-4 ${discoverTool === 'ai' ? 'text-card' : 'text-secondary'}`} />
          <span>Ask Gerg AI</span>
        </button>
        <button
          type="button"
          onClick={() => setDiscoverTool('map')}
          className={`min-h-[42px] cursor-pointer text-xs sm:text-sm px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm font-bold ${
            discoverTool === 'map'
              ? 'bg-ink text-card'
              : 'bg-card2 text-muted hover:text-ink border border-line'
          }`}
        >
          <MapIcon className={`w-4 h-4 ${discoverTool === 'map' ? 'text-card' : 'text-primary'}`} />
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
              ? 'bg-ink text-card'
              : 'bg-card2 text-muted hover:text-ink border border-line'
          }`}
        >
          <Plus className={`w-4 h-4 ${discoverTool === 'manual' ? 'text-card stroke-[3]' : 'text-ink'}`} />
          <span>Pitch Custom</span>
        </button>
      </div>

          {/* Child Panel: Mode 1 - Interactive Map & Curated Spots */}
          {discoverTool === 'map' && (
            <div className="space-y-4 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card2 border border-line rounded-xl p-3.5">
                <div className="text-xs text-ink2">
                  Browse real venues in <b>{aiLoc || event.where || 'your area'}</b> with Google Map pins, Tinder swipe cards, or grid.
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleRollFree}
                    className="cursor-pointer bg-card border border-line hover:border-primary text-ink font-semibold text-xs px-3.5 py-2 rounded-xl active:scale-95 transition whitespace-nowrap flex items-center gap-1.5"
                  >
                    <Dices className="w-3.5 h-3.5 text-primary" />
                    <span>Roll 3 Instant Spots</span>
                  </button>
                </div>
              </div>
              {freeMsg && (
                <div className="text-xs text-ink2 bg-card2 border border-line px-3.5 py-2.5 rounded-xl">
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

          {/* Child Panel: Mode 2 - Gerg AI */}
          {discoverTool === 'ai' && (
            <div className="space-y-4 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>Gerg AI Idea Engine</span>
                  </div>
                  <div className="text-[11px] text-muted">
                    {MODES[aiMode]?.sub || 'Tailored ideas, live events & multi-stop combos'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setFastMode(!fastMode)}
                  className={`cursor-pointer text-[11px] font-bold px-3 py-1 rounded-lg border transition flex items-center gap-1.5 shrink-0 ${
                    fastMode
                      ? 'bg-[color-mix(in_oklab,var(--good)_12%,transparent)] text-secondary border-secondary/40'
                      : 'bg-card2 text-muted border-line'
                  }`}
                >
                  {fastMode ? (
                    <>
                      <Zap className="w-3 h-3 text-secondary" />
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
                          ? 'border-primary bg-card2 text-ink'
                          : 'border-line bg-card2 text-muted hover:text-ink'
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
                    ? 'border border-primary bg-card text-primary animate-pulse cursor-wait'
                    : 'bg-primary text-primary-ink hover:brightness-105 active:scale-[0.99]'
                }`}
              >
                {isAiStreaming ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                    <span>Generating ideas for {aiLoc || 'your area'}...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-current" />
                    <span>Ask Gerg AI ({MODES[aiMode]?.lbl})</span>
                  </>
                )}
              </button>

              {/* Animated Flickering Flame Loading State */}
              {isAiStreaming && streamingIdeas.length === 0 && (
                <div className="bg-card border border-primary/30 rounded-2xl p-6 shadow-xl my-2">
                  <FlickeringFlameLoader
                    statusText={`🔥 Gerg AI is uncorking "${aiVib || 'anti-default'}" spots near ${aiLoc || 'your area'}...`}
                    subText="Scanning Google Search, live tickets, and tailored venues"
                    size="sm"
                  />
                </div>
              )}

              {/* Real-time Streaming Rack */}
              {streamingIdeas.length > 0 && (
                <div className="p-3.5 bg-card2 border border-primary/40 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-primary">
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-primary" />
                      <span>Incoming ideas ({streamingIdeas.length} of 3)</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {streamingIdeas.map((idea, idx) => (
                      <div
                        key={idx}
                        className="bg-card border border-line rounded-lg p-3 text-xs"
                      >
                        <div className="font-bold text-ink truncate flex items-center gap-1.5">
                          {idea.kind === 'combo' ? (
                            <Route className="w-3.5 h-3.5 text-secondary shrink-0" />
                          ) : idea.live ? (
                            <Ticket className="w-3.5 h-3.5 text-primary shrink-0" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-secondary shrink-0" />
                          )}
                          <span className="truncate">{idea.name}</span>
                        </div>
                        <div className="text-[11px] text-muted truncate mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary" />
                          <span>{idea.loc}</span>
                        </div>
                        <p className="text-[11px] text-ink2 mt-1 line-clamp-2">{idea.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {aiMsg && (
                <div className="text-xs text-ink2 whitespace-pre-line bg-card2 border border-line p-3 rounded-xl">
                  {aiMsg}
                </div>
              )}
              {aiSources.length > 0 && (
                <div className="text-xs text-muted flex flex-wrap items-center gap-1">
                  <Search className="w-3.5 h-3.5 mr-0.5 inline" />
                  <span>Checked:</span>
                  {aiSources.map((s, idx) => (
                    <span key={idx}>
                      {idx > 0 && ' · '}
                      <a
                        href={s.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ink2 hover:underline"
                      >
                        {s.title}
                      </a>
                    </span>
                  ))}
                </div>
              )}

              {/* Fresh Gerg AI Rolls Staging Area */}
              {stagedIdeas.length > 0 && (
                <div className="bg-card border-2 border-primary/40 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/80 pb-3">
                    <div>
                      <div className="font-display font-black text-sm sm:text-base text-ink flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span>Fresh Gerg AI Rolls ({stagedIdeas.length})</span>
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        Staged ideas · tap <strong>➕ Shortlist This</strong> to promote any idea to the squad shortlist.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        stagedIdeas.forEach((idea) => handlePromoteStagedIdea(idea));
                      }}
                      className="cursor-pointer text-xs font-bold text-secondary hover:underline bg-[color-mix(in_oklab,var(--good)_10%,transparent)] px-2.5 py-1 rounded-lg border border-secondary/30"
                    >
                      ➕ Shortlist All
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {stagedIdeas.map((idea) => {
                      const isGreedy = /greedy\s*banker/i.test(idea.name || '');
                      return (
                        <div
                          key={idea.id}
                          className={`bg-card2 border rounded-xl p-3.5 space-y-2.5 flex flex-col justify-between transition ${
                            isGreedy
                              ? 'border-red-500/80 bg-red-950/30 shadow-[0_0_12px_rgba(239,68,68,0.25)] animate-pulse'
                              : 'border-line hover:border-line2'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-display font-black text-sm sm:text-base text-ink leading-snug">
                                {idea.name}
                              </h4>
                              {idea.kind === 'combo' && (
                                <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded border border-secondary/20 shrink-0">
                                  Combo
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-primary-hi font-semibold flex items-center gap-1 mt-1 flex-wrap">
                              <MapPin className="w-3 h-3 text-primary shrink-0" />
                              <span className="truncate">{idea.loc}</span>
                              {idea.cost ? (
                                <span className="text-ink2">
                                  • £{idea.cost.replace(/[^0-9.]/g, '') || idea.cost} pp
                                </span>
                              ) : null}
                              {idea.when ? (
                                <span className="text-muted">• 🕒 {idea.when}</span>
                              ) : null}
                            </div>
                            {Boolean(idea.desc) && (
                              <p className="text-xs text-ink2 mt-2 line-clamp-3 leading-relaxed">
                                {idea.desc}
                              </p>
                            )}
                          </div>

                          <div className="pt-2 border-t border-line flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => handlePromoteStagedIdea(idea)}
                              className={`flex-1 cursor-pointer font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 ${
                                isGreedy
                                  ? 'bg-red-600 hover:bg-red-500 text-white font-black'
                                  : 'bg-primary hover:brightness-110 text-primary-ink'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{isGreedy ? '🐍 Commit Treason & Shortlist' : '➕ Shortlist This'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setStagedIdeas((prev) => prev.filter((i) => i.id !== idea.id))}
                              className="cursor-pointer text-muted hover:text-primary p-2 rounded-xl border border-line bg-card"
                              title="Discard idea"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Child Panel: Mode 3 - Manual Pitch */}
          {discoverTool === 'manual' && (
            <div className="bg-card2 border border-line rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-ink font-display flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-secondary" />
                    <span>Pitch Custom Activity</span>
                  </div>
                  <div className="text-xs text-muted">
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
                    className="cursor-pointer text-xs font-bold text-secondary hover:underline transition whitespace-nowrap flex items-center gap-1"
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span>Pitch My Place</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-muted mb-1">
                    Venue or Activity Name
                  </label>
                  <input
                    value={pitchName}
                    onChange={(e) => setPitchName(e.target.value)}
                    placeholder="e.g. Flight Club Darts"
                    className="w-full bg-card border border-line focus:border-primary text-ink px-3.5 py-2.5 rounded-xl text-xs sm:text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted mb-1">
                    Town / Station (Defaults to parent location)
                  </label>
                  <input
                    value={pitchLoc || aiLoc}
                    onChange={(e) => setPitchLoc(e.target.value)}
                    placeholder="e.g. Rochester"
                    className="w-full bg-card border border-line focus:border-primary text-ink px-3.5 py-2.5 rounded-xl text-xs sm:text-sm outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => handlePitchVenue(pitchName, pitchLoc || aiLoc, false)}
                className="w-full cursor-pointer bg-[color-mix(in_oklab,var(--good)_12%,transparent)] border border-secondary/30 text-secondary font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl hover:bg-[color-mix(in_oklab,var(--good)_20%,transparent)] active:scale-95 transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Custom Pitch to Shortlist</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 3: The Squad Ban List */}
      {subTab === 'ban' && (
        <div className="bg-card border border-line rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-primary font-display flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-primary" />
                <span>The Ban List ({banList.length})</span>
              </div>
              <div className="text-xs text-muted mt-0.5">
                Blacklisted chains & default pubs automatically excluded across all rolls and searches
              </div>
            </div>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {banList.length === 0 ? (
              <div className="bg-card2 border border-line text-xs text-muted px-3.5 py-2.5 rounded-xl">
                No pubs banned right now — add any chain or spot below to exclude it from all rolls and searches.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {banList.map((b) => (
                  <div
                    key={b.id}
                    className="inline-flex items-center gap-1.5 bg-card2 border border-line text-xs px-3 py-1.5 rounded-xl"
                  >
                    <Ban className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-ink font-semibold">{b.name}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveBan(b.id)}
                      className="cursor-pointer text-muted hover:text-primary text-xs p-1"
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
              className="flex-1 bg-card2 border border-line focus:border-primary text-ink px-3.5 py-2.5 rounded-xl text-xs sm:text-sm outline-none"
            />
            <button
              type="button"
              onClick={handleAddBan}
              className="cursor-pointer bg-[color-mix(in_oklab,var(--accent)_13%,transparent)] border border-primary/30 text-primary font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl hover:bg-[color-mix(in_oklab,var(--accent)_20%,transparent)] transition whitespace-nowrap"
            >
              Ban Venue
            </button>
          </div>
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
