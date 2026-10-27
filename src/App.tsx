import React, { useState, useEffect, useRef } from 'react';
import { AppConfig, AppState, OutingEvent, RoomTheme, User, Venue } from './types';
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
  getRoomMetaMap,
  humanizeRoomCode,
  saveRecentRoom,
  getClaimedUserForRoom,
  setClaimedUserForRoom,
  clearClaimedUserForRoom,
  sanitizeSquad,
  getDeviceId,
} from './utils/storage';
import { applyRoomTheme, presetName, sanitizeTheme } from './utils/theme';
import { FirebaseSync } from './utils/firebase';
import { Header } from './components/Header';
import { SetupModal } from './components/SetupModal';
import { WhoAreYouModal } from './components/WhoAreYouModal';
import { SummaryModal } from './components/SummaryModal';
import { ProfileBar } from './components/ProfileBar';
import { ProfileModal } from './components/ProfileModal';
import { EventSelector } from './components/EventSelector';
import { ActivitiesTab } from './components/Tabs/ActivitiesTab';
import { DatesTab } from './components/Tabs/DatesTab';
import { TravelTab } from './components/Tabs/TravelTab';
import { KittyTab } from './components/Tabs/KittyTab';
import { QrCodeModal } from './components/QrCodeModal';
import { ShareDrawer } from './components/ShareDrawer';
import { ThemePicker } from './components/ThemePicker';
import { BottomNav, TabType } from './components/BottomNav';
import { Sparkles, Plus } from 'lucide-react';
import { fetchPlaces, makeIdeas } from './utils/osm';
import { getLocalCuratedIdeas } from './utils/localPlaces';
import { parseWhen, isoLocal } from './utils/dates';
import { calculateLedger } from './utils/kitty';

export const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>(loadInitialConfig);
  const [state, setState] = useState<AppState>(() => {
    // Check if there's a cached snapshot for this room
    try {
      const snap = JSON.parse(getStorage('snap', 'null'));
      if (snap && snap.room === (config.rm || '').replace(/\W/g, '') && snap.S) {
        return {
          ...snap.S,
          squad: sanitizeSquad(snap.S.squad || []),
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
  const [isShareOpen, setIsShareOpen] = useState(false);
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

  const [isThemeOpen, setIsThemeOpen] = useState(false);

  // The palette lives in the room state, so a change by anyone syncs to everyone
  useEffect(() => {
    applyRoomTheme(state.theme);
  }, [state.theme]);

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
        setState({
          ...remoteState,
          squad: sanitizeSquad(remoteState.squad || []),
        });
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
              squad: sanitizeSquad(snap.S.squad || []),
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

  // Current user resolution: must be claimed on this device for this room!
  const claimedId = getClaimedUserForRoom(config.rm);
  const currentUser: User | null =
    (claimedId ? state.squad.find((u) => u.id === claimedId) : null) ||
    null;

  const [showWhoAreYou, setShowWhoAreYou] = useState(false);
  const isWhoAreYouModalVisible = !currentUser || showWhoAreYou;

  // Compute readable room name from saved metadata or humanized slug
  const roomMetaMap = getRoomMetaMap();
  const roomFriendlyName = roomMetaMap[config.rm]?.name || humanizeRoomCode(config.rm);

  // Sync active room to Recent Rooms on this device with live stats
  useEffect(() => {
    if (config.rm) {
      saveRecentRoom(
        config.rm,
        undefined,
        currentEvent?.name || undefined,
        state.squad.length
      );
    }
  }, [config.rm, currentEvent?.name, state.squad.length]);

  const handleJoinNewUser = (newUser: User) => {
    const squad = sanitizeSquad([...state.squad, newUser]);
    persistState({ ...state, squad });
    setClaimedUserForRoom(config.rm, newUser.id);
    setConfig((prev) => ({ ...prev, u: newUser.id }));
    saveUserProfile(newUser);
    setShowWhoAreYou(false);
    showToast(`🍻 Welcome to the squad, ${newUser.name}!`);
  };

  const handleClaimExistingUser = (member: User) => {
    const deviceId = getDeviceId();
    const updatedMember: User = {
      ...member,
      claimedDeviceId: deviceId,
      claimedAt: Date.now(),
    };
    const squad = state.squad.map((u) => (u.id === member.id ? updatedMember : u));
    persistState({ ...state, squad });
    setClaimedUserForRoom(config.rm, member.id);
    setConfig((prev) => ({ ...prev, u: member.id }));
    saveUserProfile(updatedMember);
    setShowWhoAreYou(false);
    showToast(`🍻 You're logged in as ${member.name}!`);
  };

  const handleJoinWithSavedProfile = (saved: User) => {
    const id = saved.id || ('u' + Date.now());
    const cleanName = /^you$/i.test((saved.name || '').trim()) ? 'Ben' : saved.name;
    const newUser: User = {
      ...saved,
      name: cleanName,
      id,
      claimedDeviceId: getDeviceId(),
      claimedAt: Date.now(),
    };
    const squad = sanitizeSquad([...state.squad, newUser]);
    persistState({ ...state, squad });
    setClaimedUserForRoom(config.rm, id);
    handleSelectUser(id);
    showToast(`🍻 Added ${cleanName} to this room's squad!`);
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

  const handleSetTheme = (picked: RoomTheme) => {
    const theme = sanitizeTheme({ ...picked, by: currentUser?.name, at: Date.now() });
    if (!theme) return;
    persistState({ ...state, theme });
    showToast(`🎨 Room theme: ${presetName(theme)}`);
  };

  const handleSelectUser = (id: string) => {
    setClaimedUserForRoom(config.rm, id);
    const updated = { ...config, u: id };
    setConfig(updated);
    setStorage('u', id);
    const target = state.squad.find((u) => u.id === id);
    if (target) {
      const deviceId = getDeviceId();
      const updatedMember: User = {
        ...target,
        claimedDeviceId: deviceId,
        claimedAt: Date.now(),
      };
      const squad = state.squad.map((u) => (u.id === id ? updatedMember : u));
      persistState({ ...state, squad });
      saveUserProfile(updatedMember);
      showToast(`Switched profile to ${target.name}`);
    }
  };

  const handleSaveProfile = (data: Partial<User>, isEdit: boolean) => {
    let squad: User[];
    const targetId = (data as any).id || profileModal.user?.id || currentUser?.id;
    const cleanName = /^you$/i.test((data.name || '').trim()) ? 'Ben' : (data.name || 'Mate');

    if (isEdit && targetId) {
      const updatedUser = {
        ...(state.squad.find((u) => u.id === targetId) || {}),
        ...data,
        name: cleanName,
        id: targetId,
      } as User;
      squad = sanitizeSquad(state.squad.map((u) => (u.id === targetId ? updatedUser : u)));
      persistState({ ...state, squad });
      saveUserProfile(updatedUser);
      handleSelectUser(targetId);
      showToast('✅ Profile updated');
    } else {
      const id = 'u' + Date.now();
      const newUser: User = {
        id,
        name: cleanName,
        emo: data.emo || '🍺',
        loc: data.loc || 'Local',
        mode: 'Train',
        pay: data.pay || 'Monzo',
        claimedDeviceId: getDeviceId(),
        claimedAt: Date.now(),
        ...data,
      };
      squad = sanitizeSquad([...state.squad, newUser]);
      persistState({ ...state, squad });
      saveUserProfile(newUser);
      setClaimedUserForRoom(config.rm, id);
      handleSelectUser(id);
      showToast(`🍻 Welcome to the squad, ${cleanName}!`);
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
    if (config.u === id || claimedId === id) {
      clearClaimedUserForRoom(config.rm);
      setConfig((prev) => ({ ...prev, u: '' }));
      setShowWhoAreYou(true);
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
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 pb-28 space-y-4">
      {/* Top Header Card & Squad Profile Strip */}
      <div className="bg-card border border-line rounded-2xl p-3.5 sm:p-5 shadow-xl space-y-3">
        <Header
          statusText={syncStatus.text}
          isDenied={syncStatus.ok === 401 || syncStatus.ok === 403}
          onOpenSetup={() => setIsSetupOpen(!isSetupOpen)}
          onOpenShare={() => setIsShareOpen(true)}
          onOpenQrCode={() => setIsQrOpen(true)}
          onOpenTheme={() => setIsThemeOpen(true)}
          showInstall={Boolean(installPrompt)}
          onInstall={handleInstallClick}
          roomFriendlyName={roomFriendlyName}
          onAdminUnlock={() => {
            setIsSetupOpen(true);
            showToast('🛠️ Builder Admin Mode Unlocked!');
          }}
        />

        {/* Squad Profile Single-Row Horizontal Scrolling Strip */}
        <ProfileBar
          squad={state.squad}
          currentUserId={config.u}
          onSelectUser={handleSelectUser}
          onEditUser={() => {
            if (currentUser) {
              setProfileModal({ isOpen: true, user: currentUser });
            } else {
              setShowWhoAreYou(true);
            }
          }}
          onEditSpecificUser={(targetUser) => setProfileModal({ isOpen: true, user: targetUser })}
          onNewUser={() => setProfileModal({ isOpen: true, user: null })}
          onJoinWithSavedProfile={handleJoinWithSavedProfile}
          currentEvent={currentEvent}
          onPitchHouse={handlePitchHouse}
          boardTally={boardTally}
          onOpenWhoAreYou={() => setShowWhoAreYou(true)}
        />
      </div>

      {/* "Who are you?" First-Visit & Identity Gate Modal */}
      <WhoAreYouModal
        isOpen={isWhoAreYouModalVisible}
        roomCode={config.rm}
        squad={state.squad}
        onJoinNew={handleJoinNewUser}
        onClaimExisting={handleClaimExistingUser}
        canDismiss={Boolean(currentUser)}
        onClose={() => setShowWhoAreYou(false)}
      />

      {/* Share Drawer (WhatsApp / Messenger / Copy Link / QR / Outing Summary) */}
      <ShareDrawer
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        event={currentEvent}
        configDb={config.db}
        configRm={config.rm}
        onOpenSummary={() => {
          setIsShareOpen(false);
          setIsSummaryOpen(true);
        }}
        onOpenQrCode={() => {
          setIsShareOpen(false);
          setIsQrOpen(true);
        }}
        onShowToast={showToast}
      />

      {/* QR Code Modal for Camera Onboarding */}
      <ThemePicker
        isOpen={isThemeOpen}
        onClose={() => setIsThemeOpen(false)}
        theme={state.theme}
        onApply={handleSetTheme}
      />

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
        currentPlanName={currentEvent?.name}
        squadCount={state.squad.length}
        onShowToast={showToast}
      />

      {/* Summary Accordion */}
      {isSummaryOpen && currentEvent && (
        <SummaryModal
          isOpen={isSummaryOpen}
          onClose={() => setIsSummaryOpen(false)}
          event={currentEvent}
          squad={state.squad}
          config={config}
          now={now}
          onShowToast={showToast}
        />
      )}

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

      {/* Collapsible Outing Context Bar & Events Manager */}
      <EventSelector
        events={state.events}
        currentEvent={currentEvent}
        onSelectEvent={handleSelectEvent}
        onNewEvent={handleNewEvent}
        onLockEvent={handleLockEvent}
        onUnlockEvent={handleUnlockEvent}
        onDeleteEvent={handleDeleteEvent}
        onUpdateEvent={handleUpdateCurrentEvent}
        squad={state.squad}
        currentUser={currentUser}
        configDb={config.db}
        configRm={config.rm}
        onOpenProfileModal={() => setProfileModal({ isOpen: true, user: null })}
      />

      {/* Blank Canvas Empty State */}
      {!currentEvent && (
        <div className="bg-card border border-line rounded-2xl p-6 sm:p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto text-primary">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="text-base sm:text-lg font-bold text-ink font-display">
            Blank Canvas · Ready for Your Squad Outing
          </div>
          <p className="text-xs sm:text-sm text-muted max-w-md mx-auto">
            This room is clean with no pre-made events. Create your first outing plan to start pitching spots, swiping in Pintdr mode, and coordinating dates.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
            {state.squad.length === 0 ? (
              <button
                type="button"
                onClick={() => setProfileModal({ isOpen: true, user: null })}
                className="cursor-pointer bg-primary text-primary-ink font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl hover:brightness-105 active:scale-95 transition shadow-[0_0_16px_color-mix(in_oklab,var(--accent)_25%,transparent)] flex items-center gap-1.5"
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
                className="cursor-pointer bg-primary text-primary-ink font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl hover:brightness-105 active:scale-95 transition shadow-[0_0_16px_color-mix(in_oklab,var(--accent)_25%,transparent)] flex items-center gap-1.5"
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
        <div className="space-y-4">
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

      {/* Fixed Frosted-Glass Bottom Navigation Bar */}
      {currentEvent && (
        <BottomNav
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          actCount={actCount}
          isLocked={Boolean(currentEvent.locked)}
          hasAlignedDate={hasAlignedDate}
          dateCount={dateCount}
          hasMidpoint={hasMidpoint}
          kittyTotal={kittyTotal}
        />
      )}

      {/* Floating In-App Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-card2 border border-primary text-ink px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2 max-w-[90vw] transition-all animate-in fade-in slide-in-from-bottom-2">
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
export default App;
