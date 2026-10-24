import React, { useState, useEffect, useRef } from 'react';
import { AppConfig, AppState, OutingEvent, User } from './types';
import {
  getInitialDemoState,
  loadInitialConfig,
  setStorage,
  getStorage,
  newEvent,
} from './utils/storage';
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
import { fetchPlaces, makeIdeas } from './utils/osm';
import { parseWhen, isoLocal } from './utils/dates';

type TabType = 'act' | 'dat' | 'trv' | 'kit';

export const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>(loadInitialConfig);
  const [state, setState] = useState<AppState>(() => {
    // Check if there's a cached snapshot for this room
    try {
      const snap = JSON.parse(getStorage('snap', 'null'));
      if (snap && snap.room === (config.rm || '').replace(/\W/g, '') && snap.S) {
        return snap.S;
      }
    } catch (e) {}
    return getInitialDemoState();
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

    if (syncRef.current && was !== newCfg.db + newCfg.rm) {
      syncRef.current.updateConfig(newCfg.db, newCfg.rm);
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

  const currentUser = state.squad.find((u) => u.id === config.u) || null;

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
  };

  const handleSaveProfile = (data: Partial<User>, isEdit: boolean) => {
    let squad: User[];
    let newUserId = config.u;

    if (isEdit && currentUser) {
      squad = state.squad.map((u) => (u.id === currentUser.id ? { ...u, ...data } : u));
    } else {
      const id = 'u' + Date.now();
      newUserId = id;
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
    }

    persistState({ ...state, squad });
    handleSelectUser(newUserId);
  };

  const handleDeleteProfile = (id: string) => {
    if (state.squad.length < 2) return;
    const squad = state.squad.filter((u) => u.id !== id);
    persistState({ ...state, squad });
    handleSelectUser('');
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

  const handleAddBan = (name: string) => {
    const ban = [...state.ban, { id: 'b' + Date.now(), name }];
    persistState({ ...state, ban });
  };

  const handleRemoveBan = (id: string) => {
    const ban = state.ban.filter((b) => b.id !== id || b.lock);
    persistState({ ...state, ban });
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

  return (
    <div className="max-w-[640px] mx-auto px-3 py-3.5 pb-16">
      {/* Top Main Card */}
      <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-4 mb-3">
        <Header
          statusText={syncStatus.text}
          isDenied={syncStatus.ok === 401 || syncStatus.ok === 403}
          onOpenSetup={() => setIsSetupOpen(!isSetupOpen)}
          onOpenSummary={() => setIsSummaryOpen(!isSummaryOpen)}
          onOpenQrCode={() => setIsQrOpen(true)}
          showInstall={Boolean(installPrompt)}
          onInstall={handleInstallClick}
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
          onNewUser={() => setProfileModal({ isOpen: true, user: null })}
          currentEvent={currentEvent}
        />

        {/* Profile Edit/Create Modal */}
        <ProfileModal
          isOpen={profileModal.isOpen}
          onClose={() => setProfileModal({ isOpen: false, user: null })}
          user={profileModal.user}
          onSave={handleSaveProfile}
          onDelete={handleDeleteProfile}
          canDelete={state.squad.length > 1}
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
      />

      {/* No Events Empty State */}
      {!currentEvent && (
        <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-6 text-center my-4">
          <div className="text-base font-bold text-[#f4f4f5]">🎉 No events yet</div>
          <div className="text-xs text-[#8d8d94] mt-1.5 mb-3">
            Create one for each night out – it keeps its own ideas, dates and kitty.
          </div>
          <button
            type="button"
            onClick={() =>
              handleNewEvent({
                name: "Tonight's Outing",
                where: currentUser?.loc || 'Medway',
                vibe: 'Competitive, craft beer, or good food',
                when: 'Sat 7pm',
                rollFree: true,
              })
            }
            className="cursor-pointer bg-[#ff6b57] text-[#1a0703] font-semibold text-xs px-4 py-2.5 rounded-xl hover:brightness-105 transition"
          >
            ➕ Create your first event
          </button>
        </div>
      )}

      {/* Event Details and Tabs */}
      {currentEvent && (
        <div>
          {/* Navigation Tabs */}
          <div className="grid grid-cols-4 gap-1 bg-[#17171a] border border-[#2b2b2f] p-1 rounded-2xl mb-3 sticky top-2 z-10 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setActiveTab('act')}
              className={`py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
                activeTab === 'act'
                  ? 'bg-[#212124] text-[#f4f4f5] shadow-[inset_0_0_0_1px_#3b3b40]'
                  : 'text-[#8d8d94] hover:text-[#f4f4f5]'
              }`}
            >
              🎯 Activities
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dat')}
              className={`py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
                activeTab === 'dat'
                  ? 'bg-[#212124] text-[#f4f4f5] shadow-[inset_0_0_0_1px_#3b3b40]'
                  : 'text-[#8d8d94] hover:text-[#f4f4f5]'
              }`}
            >
              📅 Dates
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('trv')}
              className={`py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
                activeTab === 'trv'
                  ? 'bg-[#212124] text-[#f4f4f5] shadow-[inset_0_0_0_1px_#3b3b40]'
                  : 'text-[#8d8d94] hover:text-[#f4f4f5]'
              }`}
            >
              🚆 Travel
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('kit')}
              className={`py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
                activeTab === 'kit'
                  ? 'bg-[#212124] text-[#f4f4f5] shadow-[inset_0_0_0_1px_#3b3b40]'
                  : 'text-[#8d8d94] hover:text-[#f4f4f5]'
              }`}
            >
              💷 Kitty
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
              onSelectIdeasNearMid={(place) => {
                setActiveTab('act');
              }}
            />
          )}

          {activeTab === 'kit' && (
            <KittyTab
              event={currentEvent}
              squad={state.squad}
              currentUser={currentUser}
              onUpdateEvent={handleUpdateCurrentEvent}
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
