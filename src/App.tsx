import React, { useState, useEffect, useRef } from 'react';
import { AppConfig, AppState, OutingEvent, User, Venue } from './types';
import {
  getInitialDemoState,
  freshRoomState,
  getSavedUserProfile,
  loadInitialConfig,
  setStorage,
  getStorage,
  newEvent,
  normName,
  saveUserProfile,
} from './utils/storage';
import { getSavedTheme, setSavedTheme, applyThemeClass, ThemeMode } from './utils/theme';
import { FirebaseSync } from './utils/firebase';
import { Header } from './components/Header';
import { SetupModal } from './components/SetupModal';
import { SummaryModal } from './components/SummaryModal';
import { ProfileBar } from './components/ProfileBar';
import { ProfileModal } from './components/ProfileModal';
import { EventSelector } from './components/EventSelector';
import { ActivitiesTab } from './components/Tabs/ActivitiesTab';
import { DatesTab } from './components/Tabs/DatesTab';
import { TravelTab } from './components/Tabs/TravelTab';
import { KittyTab } from './components/Tabs/KittyTab';
import { QrCodeModal } from './components/QrCodeModal';
import { Target, Calendar, Train, Coins, Lock, Check, MapPin, Sparkles, Plus } from 'lucide-react';
import { fetchPlaces, makeIdeas } from './utils/osm';
import { getLocalCuratedIdeas } from './utils/localPlaces';
import { parseWhen, isoLocal } from './utils/dates';
import { calculateLedger } from './utils/kitty';

type TabType = 'act' | 'dat' | 'trv' | 'kit';

export const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>(loadInitialConfig);
  const [state, setState] = useState<AppState>(() => {
    // Check if there's a cached snapshot for this room
    try {
      const snap = JSON.parse(getStorage('snap', 'null'));
      if (snap && snap.room === (config.rm || '').replace(/\W/g, '') && snap.S) {
        return {
          ...snap.S,
          ban: (snap.S.ban || []).filter((b: any) => !/greedy\s*banker/i.test(b?.name || '')),
        };
      }
    } catch (e) {}
    return freshRoomState();
  });

  const [activeTab, setActiveTab] = useState<TabType>('act');
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [profileModal, setProfileModal] = useState<{
    isOpen: boolean;
    user: User | null;
  }>({ isOpen: false, user: null });

  const [syncStatus, setSyncStatus] = useState<{
    ok: boolean | number;
    streaming: boolean;
    text: string;
  }>({
    ok: true,
    streaming: false,
    text: config.db ? `🟢 Live: ${config.rm}` : '⚪ Local Mode (demo data)',
  });

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [now, setNow] = useState(Date.now());
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [theme, setTheme] = useState<ThemeMode>(getSavedTheme);

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setSavedTheme(next);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 3200);
  };

  const syncRef = useRef<FirebaseSync | null>(null);

  // Initialize and bind Firebase sync
  useEffect(() => {
    const sync = new FirebaseSync(
      config.db,
      config.rm,
      (remoteState) => {
        setState(remoteState);
      },
      (status) => {
        setSyncStatus(status);
      }
    );
    syncRef.current = sync;

    if (config.db) {
      sync.syncClock();
      sync.startStream();
      sync.pull();
    } else {
      setSyncStatus({
        ok: true,
        streaming: false,
        text: '⚪ Local Mode (demo data)',
      });
    }

    return () => {
      sync.stop();
    };
  }, []);

  // Listen to popstate (browser back/forward or deep links)
  useEffect(() => {
    const onPop = () => {
      const p = new URLSearchParams(window.location.search);
      const rmUrl = p.get('room');
      if (rmUrl && rmUrl !== config.rm) {
        const nextCfg = { ...config, rm: rmUrl };
        setConfig(nextCfg);
        setStorage('rm', rmUrl);
        let roomState: AppState = freshRoomState();
        try {
          const snap = JSON.parse(getStorage('snap', 'null'));
          if (snap && snap.room === (rmUrl || '').replace(/\W/g, '') && snap.S) {
            roomState = {
              ...snap.S,
              ban: (snap.S.ban || []).filter((b: any) => !/greedy\s*banker/i.test(b?.name || '')),
            };
          }
        } catch (e) {}
        setState(roomState);
        if (syncRef.current) {
          syncRef.current.updateConfig(nextCfg.db, rmUrl);
        }
        showToast(`⚡ Joined room: ${rmUrl}`);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [config]);

  // Update sync on config change
  const handleSaveConfig = (newCfg: AppConfig) => {
    const was = config.db + config.rm;
    setConfig(newCfg);
    setStorage('db', newCfg.db);
    setStorage('rm', newCfg.rm);
    setStorage('md', newCfg.md);
    setStorage('key', newCfg.key);

    if (was !== newCfg.db + newCfg.rm) {
      let roomState: AppState = freshRoomState();
      try {
        const snap = JSON.parse(getStorage('snap', 'null'));
        if (snap && snap.room === (newCfg.rm || '').replace(/\W/g, '') && snap.S) {
          roomState = {
            ...snap.S,
            ban: (snap.S.ban || []).filter((b: any) => !/greedy\s*banker/i.test(b?.name || '')),
          };
        }
      } catch (e) {}
      setState(roomState);
      if (syncRef.current) {
        syncRef.current.updateConfig(newCfg.db, newCfg.rm);
      }
    }
  };

  // Clock tick every second for Veto Bounty countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(syncRef.current ? syncRef.current.now() : Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Polling fallback when tab is visible and not streaming
  useEffect(() => {
    const interval = setInterval(() => {
      if (config.db && !document.hidden && !syncStatus.streaming && syncRef.current) {
        syncRef.current.pull();
      }
    }, 4000);

    const onVisibility = () => {
      if (!document.hidden && config.db && syncRef.current) {
        syncRef.current.pull();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [config.db, syncStatus.streaming]);

  // PWA beforeinstallprompt handler
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  // Current event calculation
  const currentEvent: OutingEvent | null =
    state.events.find((e) => e.id === config.ev) ||
    state.events.find((e) => !e.locked) ||
    state.events[0] ||
    null;

  const savedProfile = getSavedUserProfile();
  const currentUser: User | null =
    state.squad.find((u) => u.id === config.u) ||
    (savedProfile
      ? state.squad.find(
          (u) =>
            u.id === savedProfile.id ||
            u.name.trim().toLowerCase() === savedProfile.name.trim().toLowerCase()
        )
      : null) ||
    state.squad[0] ||
    null;

  // Auto-connect saved user profile if matching member exists in room
  useEffect(() => {
    const saved = getSavedUserProfile();
    if (!saved) return;
    const match = state.squad.find(
      (u) =>
        u.id === config.u ||
        (saved.name && u.name.trim().toLowerCase() === saved.name.trim().toLowerCase())
    );
    if (match && match.id !== config.u) {
      handleSelectUser(match.id);
    }
  }, [state.squad]);

  const handleJoinWithSavedProfile = (saved: User) => {
    const id = saved.id || ('u' + Date.now());
    const newUser: User = {
      ...saved,
      id,
    };
    const squad = [...state.squad, newUser];
    persistState({ ...state, squad });
    handleSelectUser(id);
    showToast(`🍻 Added ${saved.name} to this room's squad!`);
  };

  const persistState = (newState: AppState) => {
    setState(newState);
    if (syncRef.current) {
      syncRef.current.push(newState);
    }
    try {
      const rmKey = (config.rm || '').replace(/\W/g, '');
      setStorage('snap', JSON.stringify({ room: rmKey, S: newState }));
    } catch (e) {}
  };

  const handleSelectUser = (id: string) => {
    const updated = { ...config, u: id };
    setConfig(updated);
    setStorage('u', id);
    const target = state.squad.find((u) => u.id === id);
    if (target) {
      saveUserProfile(target);
    }
  };

  const handleSaveProfile = (data: Partial<User>, isEdit: boolean) => {
    let squad: User[];
    const targetId = (data as any).id || profileModal.user?.id || currentUser?.id;

    if (isEdit && targetId) {
      const updatedUser = {
        ...(state.squad.find((u) => u.id === targetId) || {}),
        ...data,
        id: targetId,
      } as User;
      squad = state.squad.map((u) =>
        u.id === targetId ? updatedUser : u
      );
      persistState({ ...state, squad });
      saveUserProfile(updatedUser);
      handleSelectUser(targetId);
      showToast('✅ Profile updated');
    } else {
      const id = 'u' + Date.now();
      const newUser: User = {
        id,
        name: data.name || 'Mate',
        emo: data.emo || '🍺',
        loc: data.loc || 'Local',
        mode: 'Train',
        pay: data.pay || 'Monzo',
        ...data,
      };
      squad = [...state.squad, newUser];
      persistState({ ...state, squad });
      saveUserProfile(newUser);
      handleSelectUser(id);
      showToast(`🍻 Welcome to the squad, ${data.name || 'Mate'}!`);
    }
  };

  const handleDeleteProfile = (id: string) => {
    if (state.squad.length < 2) {
      showToast('⚠️ Keep at least 1 member in the squad');
      return;
    }
    const removed = state.squad.find((u) => u.id === id);
    const squad = state.squad.filter((u) => u.id !== id);
    persistState({ ...state, squad });
    if (config.u === id) {
      const fallbackId = squad[0]?.id || '';
      handleSelectUser(fallbackId);
    }
    if (removed) showToast(`🗑️ Removed ${removed.name}'s profile`);
  };

  const handleSelectEvent = (id: string) => {
    const updated = { ...config, ev: id };
    setConfig(updated);
    const evKey = 'ev:' + (config.db ? config.rm.replace(/\W/g, '') : 'local');
    setStorage(evKey, id);
  };

  const handleNewEvent = async (d: {
    name: string;
    where: string;
    vibe: string;
    when: string;
    rollFree: boolean;
  }) => {
    const ev = newEvent({
      name: d.name,
      where: d.where,
      vibe: d.vibe,
      when: d.when,
      by: config.u,
    });

    if (ev.when) {
      const parsed = parseWhen(ev.when);
      ev.slots = [
        {
          id: 's' + Date.now(),
          lbl: ev.when,
          at: parsed ? isoLocal(parsed) : null,
          av: { [config.u]: 1 },
        },
      ];
    }

    const events = [ev, ...state.events];
    persistState({ ...state, events });
    handleSelectEvent(ev.id);
    setActiveTab('act');

    if (d.rollFree && ev.where) {
      try {
        const pool = await fetchPlaces(ev.where, ev.vibe, state.ban);
        const area = ev.where.split(/\s*(?:,|\bor\b|&)\s*/i)[0];
        const ideas = makeIdeas(pool, area, ev, new Set());
        if (ideas.length) {
          const venues = ideas.reverse().map((x, i) => ({
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
          ev.venues = venues;
          persistState({ ...state, events: [ev, ...state.events.filter((e) => e.id !== ev.id)] });
        }
      } catch (e) {}
    }
  };

  const handleLockEvent = (id: string) => {
    const target = state.events.find((e) => e.id === id);
    if (!target || target.locked) return;
    const winVenue = target.venues.find((v) => v.id === target.win) || target.venues[0];
    if (!winVenue) {
      showToast('🎯 Pick a venue first – tap ⭐ Pick on one, or spin the 🎲 Roulette');
      return;
    }

    const events = state.events.map((e) =>
      e.id === id ? { ...e, win: winVenue.id, locked: Date.now() } : e
    );
    persistState({ ...state, events });
    showToast(`🔒 Locked in "${winVenue.name}"!`);
  };

  const handleUnlockEvent = (id: string) => {
    const events = state.events.map((e) =>
      e.id === id ? { ...e, locked: null } : e
    );
    persistState({ ...state, events });
    showToast('🔓 Event unlocked – the plan can change again!');
  };

  const handleDeleteEvent = (id: string) => {
    const target = state.events.find((e) => e.id === id);
    if (!target) return;
    const events = state.events.filter((e) => e.id !== id);
    persistState({ ...state, events });
    handleSelectEvent('');
    showToast(`🗑️ Deleted "${target.name}"`);
  };

  const handleUpdateCurrentEvent = (updatedEvent: OutingEvent) => {
    const events = state.events.map((e) => (e.id === updatedEvent.id ? updatedEvent : e));
    persistState({ ...state, events });
  };

  // Cross-tab hand-off: Travel Midpoint -> Activities Tab + Auto-Roll Ideas
  const handleSelectIdeasNearMid = async (placeName: string) => {
    if (!currentEvent) return;
    const cleanPlace = placeName.trim();
    if (!cleanPlace) {
      setActiveTab('act');
      return;
    }

    // Immediately seed curated spots so the user sees ideas near the midpoint with zero delay
    const existingNames = new Set(currentEvent.venues.map((v) => normName(v.name)));
    const instantIdeas = getLocalCuratedIdeas(
      cleanPlace,
      currentEvent.vibe || '',
      state.ban,
      existingNames,
      3
    );

    const seededVenues: Venue[] = instantIdeas.map((x, i) => ({
      id: 'v' + Date.now() + i,
      name: x.name || 'Venue',
      loc: x.loc || cleanPlace,
      desc: x.desc || '',
      kind: x.kind || 'spot',
      steps: x.steps,
      url: x.url,
      src: 'osm',
      votes: currentUser ? { [currentUser.id]: 'k' } : {},
    }));

    const updatedEvent: OutingEvent = {
      ...currentEvent,
      where: cleanPlace,
      venues: [...seededVenues, ...currentEvent.venues],
    };

    handleUpdateCurrentEvent(updatedEvent);
    setActiveTab('act');
    showToast(
      seededVenues.length
        ? `📍 Set area to ${cleanPlace} & rolled ${seededVenues.length} midpoint spots!`
        : `📍 Set discovery area to ${cleanPlace}`
    );
  };

  const handleAddBan = (name: string) => {
    if (/greedy\s*banker/i.test(name)) {
      showToast("🍺 We don't actually ban The Greedy Banker!");
      return;
    }
    const ban = [...state.ban, { id: 'b' + Date.now(), name }];
    persistState({ ...state, ban });
    showToast(`🚫 Added "${name}" to the Ban List`);
  };

  const handleRemoveBan = (id: string) => {
    const ban = state.ban.filter((b) => b.id !== id);
    persistState({ ...state, ban });
  };

  const handlePitchHouse = (user: User) => {
    if (!currentEvent) {
      showToast('⚠️ Select or create an event first');
      return;
    }
    if (currentEvent.locked) {
      showToast('🔒 This event is locked in – unlock first to change venues');
      return;
    }
    const houseName = `${user.name}'s Place 🏠`;
    const alreadyExists = currentEvent.venues.some(
      (v) =>
        normName(v.name) === normName(houseName) ||
        normName(v.name).includes(normName(user.name))
    );
    if (alreadyExists) {
      showToast(`🏠 "${houseName}" is already on the shortlist!`);
      return;
    }

    const houseVenue: Venue = {
      id: 'v_house_' + user.id + '_' + Date.now(),
      name: houseName,
      loc: user.loc || 'Local',
      desc:
        user.houseNote?.trim() ||
        'House outing / pre-drinks – BYOB, games & tunes with zero pub markup!',
      kind: 'spot',
      cost: 'Free / BYOB',
      votes: { [user.id]: 'k' },
      src: 'house',
    };

    const venues = [houseVenue, ...currentEvent.venues];
    handleUpdateCurrentEvent({ ...currentEvent, venues });
    showToast(`🏠 Pitched ${user.name}'s Place to the shortlist!`);
  };

  // Bounty Board tally
  const boardTally: Record<string, { r: number; m: number }> = JSON.parse(
    JSON.stringify(state.board || {})
  );
  state.events.forEach((e) => {
    (e.bounties || []).forEach((b) => {
      const entry = (boardTally[b.uid] = boardTally[b.uid] || { r: 0, m: 0 });
      if (b.done) entry.r++;
      else if (!b.done && now >= b.until) entry.m++;
    });
  });

  // Live Navigation Tab Status Indicators
  const actCount = currentEvent ? currentEvent.venues.length : 0;
  const hasAlignedDate = Boolean(
    currentEvent &&
      state.squad.length > 0 &&
      currentEvent.slots.some((s) => state.squad.every((u) => s.av && s.av[u.id]))
  );
  const dateCount = currentEvent ? currentEvent.slots.length : 0;
  const hasMidpoint = Boolean(currentEvent?.mid);
  const kittyTotal = currentEvent ? Math.round(calculateLedger(currentEvent, state.squad).tot) : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 space-y-6">
      {/* Top Main Card */}
      <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-5 sm:p-6 shadow-xl">
        <Header
          statusText={syncStatus.text}
          isDenied={syncStatus.ok === 401 || syncStatus.ok === 403}
          onOpenSetup={() => setIsSetupOpen(!isSetupOpen)}
          onOpenSummary={() => setIsSummaryOpen(!isSummaryOpen)}
          onOpenQrCode={() => setIsQrOpen(true)}
          showInstall={Boolean(installPrompt)}
          onInstall={handleInstallClick}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />

        {/* QR Code Modal for Camera Onboarding */}
        <QrCodeModal
          isOpen={isQrOpen}
          onClose={() => setIsQrOpen(false)}
          roomCode={config.rm}
          dbUrl={config.db}
          eventId={currentEvent?.id}
        />

        {/* Setup Accordion */}
        <SetupModal
          isOpen={isSetupOpen}
          onClose={() => setIsSetupOpen(false)}
          config={config}
          onSave={handleSaveConfig}
        />

        {/* Summary Accordion */}
        <SummaryModal
          isOpen={isSummaryOpen}
          onClose={() => setIsSummaryOpen(false)}
          event={currentEvent}
          squad={state.squad}
          config={config}
          now={now}
        />

        {/* Squad Profile Bar */}
        <ProfileBar
          squad={state.squad}
          currentUserId={config.u}
          onSelectUser={handleSelectUser}
          onEditUser={() => setProfileModal({ isOpen: true, user: currentUser })}
          onEditSpecificUser={(targetUser) => setProfileModal({ isOpen: true, user: targetUser })}
          onNewUser={() => setProfileModal({ isOpen: true, user: null })}
          onJoinWithSavedProfile={handleJoinWithSavedProfile}
          currentEvent={currentEvent}
          onPitchHouse={handlePitchHouse}
        />

        {/* Profile Edit/Create Modal */}
        <ProfileModal
          isOpen={profileModal.isOpen}
          onClose={() => setProfileModal({ isOpen: false, user: null })}
          user={profileModal.user}
          onSave={handleSaveProfile}
          onDelete={handleDeleteProfile}
          canDelete={state.squad.length > 1}
          onPitchHouse={handlePitchHouse}
        />
      </div>

      {/* Events Selector */}
      <EventSelector
        events={state.events}
        currentEvent={currentEvent}
        onSelectEvent={handleSelectEvent}
        onNewEvent={handleNewEvent}
        onLockEvent={handleLockEvent}
        onUnlockEvent={handleUnlockEvent}
        onDeleteEvent={handleDeleteEvent}
        squad={state.squad}
        currentUser={currentUser}
        configDb={config.db}
        configRm={config.rm}
        onOpenProfileModal={() => setProfileModal({ isOpen: true, user: null })}
      />

      {/* Blank Canvas Empty State */}
      {!currentEvent && (
        <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-6 sm:p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#ff6b57]/15 border border-[#ff6b57]/30 flex items-center justify-center mx-auto text-[#ff6b57]">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="text-base sm:text-lg font-bold text-[#ffffff] font-display">
            Blank Canvas · Ready for Your Squad Outing
          </div>
          <p className="text-xs sm:text-sm text-[#8d8d94] max-w-md mx-auto">
            This room is clean with no pre-made events. Create your first outing plan to start pitching spots, swiping in Pintdr mode, and coordinating dates.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
            {state.squad.length === 0 ? (
              <button
                type="button"
                onClick={() => setProfileModal({ isOpen: true, user: null })}
                className="cursor-pointer bg-[#ff6b57] text-[#1a0703] font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl hover:brightness-105 active:scale-95 transition shadow-[0_0_16px_rgba(255,107,87,0.25)] flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your Profile First</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  handleNewEvent({
                    name: "Friday Outing",
                    where: currentUser?.loc || '',
                    vibe: '',
                    when: 'Friday 7:00 PM',
                    rollFree: false,
                  })
                }
                className="cursor-pointer bg-[#ff6b57] text-[#1a0703] font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl hover:brightness-105 active:scale-95 transition shadow-[0_0_16px_rgba(255,107,87,0.25)] flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Start New Outing Plan</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Event Details and Tabs */}
      {currentEvent && (
        <div className="space-y-5">
          {/* Navigation Tabs with Vector Icons & Status Indicators */}
          <div className="grid grid-cols-4 gap-2 bg-[#17171a] border border-[#2b2b2f] p-2 rounded-2xl sticky top-3 z-10 backdrop-blur-md shadow-xl">
            <button
              type="button"
              onClick={() => setActiveTab('act')}
              className={`py-3 px-3 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer whitespace-nowrap truncate flex items-center justify-center gap-1.5 ${
                activeTab === 'act'
                  ? 'bg-[#24252a] text-[#ffffff] shadow-[inset_0_0_0_1.5px_#ff6b57,0_0_12px_rgba(255,107,87,0.18)]'
                  : 'text-[#a1a1aa] hover:text-[#ffffff] hover:bg-[#1f1f23]'
              }`}
            >
              <Target className={`w-4 h-4 shrink-0 ${activeTab === 'act' ? 'text-[#ff6b57]' : 'text-[#8d8d94]'}`} />
              <span>Activities</span>
              {currentEvent.locked ? (
                <Lock className="w-3.5 h-3.5 text-[#c6ff3d] ml-1 shrink-0" />
              ) : actCount > 0 ? (
                <span className="text-[#8d8d94] ml-0.5 text-xs font-normal">· {actCount}</span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dat')}
              className={`py-3 px-3 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer whitespace-nowrap truncate flex items-center justify-center gap-1.5 ${
                activeTab === 'dat'
                  ? 'bg-[#24252a] text-[#ffffff] shadow-[inset_0_0_0_1.5px_#ff6b57,0_0_12px_rgba(255,107,87,0.18)]'
                  : 'text-[#a1a1aa] hover:text-[#ffffff] hover:bg-[#1f1f23]'
              }`}
            >
              <Calendar className={`w-4 h-4 shrink-0 ${activeTab === 'dat' ? 'text-[#ff6b57]' : 'text-[#8d8d94]'}`} />
              <span>Dates</span>
              {hasAlignedDate ? (
                <Check className="w-3.5 h-3.5 text-[#c6ff3d] ml-1 shrink-0" />
              ) : dateCount > 0 ? (
                <span className="text-[#8d8d94] ml-0.5 text-xs font-normal">· {dateCount}</span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('trv')}
              className={`py-3 px-3 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer whitespace-nowrap truncate flex items-center justify-center gap-1.5 ${
                activeTab === 'trv'
                  ? 'bg-[#24252a] text-[#ffffff] shadow-[inset_0_0_0_1.5px_#ff6b57,0_0_12px_rgba(255,107,87,0.18)]'
                  : 'text-[#a1a1aa] hover:text-[#ffffff] hover:bg-[#1f1f23]'
              }`}
            >
              <Train className={`w-4 h-4 shrink-0 ${activeTab === 'trv' ? 'text-[#ff6b57]' : 'text-[#8d8d94]'}`} />
              <span>Travel</span>
              {hasMidpoint && <MapPin className="w-3.5 h-3.5 text-[#ff6b57] ml-1 shrink-0" />}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('kit')}
              className={`py-3 px-3 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer whitespace-nowrap truncate flex items-center justify-center gap-1.5 ${
                activeTab === 'kit'
                  ? 'bg-[#24252a] text-[#ffffff] shadow-[inset_0_0_0_1.5px_#ff6b57,0_0_12px_rgba(255,107,87,0.18)]'
                  : 'text-[#a1a1aa] hover:text-[#ffffff] hover:bg-[#1f1f23]'
              }`}
            >
              <Coins className={`w-4 h-4 shrink-0 ${activeTab === 'kit' ? 'text-[#ff6b57]' : 'text-[#8d8d94]'}`} />
              <span>Kitty</span>
              {kittyTotal > 0 && (
                <span className="text-[#c6ff3d] ml-0.5 text-xs font-normal tabular-nums">
                  · £{kittyTotal}
                </span>
              )}
            </button>
          </div>

          {/* Tab Views */}
          {activeTab === 'act' && (
            <ActivitiesTab
              event={currentEvent}
              squad={state.squad}
              banList={state.ban}
              currentUser={currentUser}
              config={config}
              now={now}
              onUpdateEvent={handleUpdateCurrentEvent}
              onAddBan={handleAddBan}
              onRemoveBan={handleRemoveBan}
              boardTally={boardTally}
              onOpenSetup={() => setIsSetupOpen(true)}
              onShowToast={showToast}
              onPitchHouse={handlePitchHouse}
            />
          )}

          {activeTab === 'dat' && (
            <DatesTab
              event={currentEvent}
              squad={state.squad}
              currentUser={currentUser}
              config={config}
              onUpdateEvent={handleUpdateCurrentEvent}
              onOpenSetup={() => setIsSetupOpen(true)}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'trv' && (
            <TravelTab
              event={currentEvent}
              squad={state.squad}
              onUpdateSquad={(squad) => persistState({ ...state, squad })}
              onUpdateEvent={handleUpdateCurrentEvent}
              onSelectIdeasNearMid={handleSelectIdeasNearMid}
            />
          )}

          {activeTab === 'kit' && (
            <KittyTab
              event={currentEvent}
              squad={state.squad}
              currentUser={currentUser}
              onUpdateEvent={handleUpdateCurrentEvent}
              onShowToast={showToast}
            />
          )}
        </div>
      )}

      {/* Floating In-App Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#212124] border border-[#ff6b57] text-[#f4f4f5] px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2 max-w-[90vw] transition-all animate-in fade-in slide-in-from-bottom-2">
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
export default App;
