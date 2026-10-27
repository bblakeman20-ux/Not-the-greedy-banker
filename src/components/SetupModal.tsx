import React, { useState, useEffect } from 'react';
import { AppConfig } from '../types';
import {
  clearRecentRooms,
  copyStr,
  DEFAULT_FIREBASE_DB,
  generateRoomCode,
  getRecentRoomList,
  humanizeRoomCode,
  isBuilderAdmin,
  removeRecentRoom,
  RoomMeta,
  saveRecentRoom,
  setBuilderAdmin,
  updateRoomFriendlyName,
} from '../utils/storage';
import {
  Share2,
  Check,
  PlusCircle,
  Database,
  Trash2,
  ShieldCheck,
  Edit2,
  Lock,
  Unlock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RotateCw,
  Home,
  Copy,
  Users,
} from 'lucide-react';

interface SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSave: (newCfg: AppConfig) => void;
  currentPlanName?: string;
  squadCount?: number;
  onShowToast?: (msg: string) => void;
}

export const SetupModal: React.FC<SetupModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
  currentPlanName,
  squadCount,
  onShowToast,
}) => {
  const [db, setDb] = useState(config.db || DEFAULT_FIREBASE_DB);
  const [rm, setRm] = useState(config.rm);
  const [md, setMd] = useState(config.md);
  const [key, setKey] = useState(config.key);
  const [msg, setMsg] = useState('');
  const [recentRooms, setRecentRooms] = useState<RoomMeta[]>([]);

  // Builder Admin State
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPassInput, setShowAdminPassInput] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [adminDrawerOpen, setAdminDrawerOpen] = useState(false);

  // New room creator state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newRoomCode, setNewRoomCode] = useState('');
  const [newRoomLabel, setNewRoomLabel] = useState('');

  // Inline rename state for rooms
  const [renamingCode, setRenamingCode] = useState<string | null>(null);
  const [renamingLabel, setRenamingLabel] = useState('');

  // Active room rename state
  const [isRenamingActive, setIsRenamingActive] = useState(false);
  const [activeLabelInput, setActiveLabelInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDb(config.db || DEFAULT_FIREBASE_DB);
      setRm(config.rm);
      setMd(config.md);
      setKey(config.key);
      setMsg('');
      setIsAdmin(isBuilderAdmin());
      setRecentRooms(getRecentRoomList());
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const isCentralDb = !db || db === DEFAULT_FIREBASE_DB;
  const currentMeta = recentRooms.find((r) => r.code === rm) || {
    code: rm,
    name: humanizeRoomCode(rm),
    planName: currentPlanName,
    memberCount: squadCount,
  };

  const notify = (m: string) => {
    setMsg(m);
    if (onShowToast) onShowToast(m);
  };

  const handleSelectRecentRoom = (roomCode: string, friendlyName?: string) => {
    setRm(roomCode);
    const cleanDb = db.trim().replace(/\/$/, '') || DEFAULT_FIREBASE_DB;
    saveRecentRoom(roomCode, friendlyName, undefined, undefined);
    setRecentRooms(getRecentRoomList());

    onSave({
      ...config,
      db: cleanDb,
      rm: roomCode,
      md: md.trim() || 'gemini-flash-latest',
      key: key.trim(),
    });

    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('room', roomCode);
      window.history.replaceState({}, '', newUrl.pathname + newUrl.search + newUrl.hash);
    }

    notify(`⚡ Switched to "${friendlyName || humanizeRoomCode(roomCode)}"`);
  };

  const handleOpenCreateNew = () => {
    const code = generateRoomCode();
    setNewRoomCode(code);
    setNewRoomLabel(humanizeRoomCode(code));
    setIsCreatingNew(true);
  };

  const handleConfirmCreateNew = () => {
    const cleanCode = newRoomCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') || generateRoomCode();
    const cleanLabel = newRoomLabel.trim() || humanizeRoomCode(cleanCode);

    setRm(cleanCode);
    saveRecentRoom(cleanCode, cleanLabel, undefined, 1);
    setRecentRooms(getRecentRoomList());
    setIsCreatingNew(false);

    const cleanDb = db.trim().replace(/\/$/, '') || DEFAULT_FIREBASE_DB;
    onSave({
      ...config,
      db: cleanDb,
      rm: cleanCode,
      md: md.trim() || 'gemini-flash-latest',
      key: key.trim(),
    });

    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('room', cleanCode);
      window.history.replaceState({}, '', newUrl.pathname + newUrl.search + newUrl.hash);
    }

    notify(`✨ Created & joined "${cleanLabel}"!`);
  };

  const handleSaveActiveRename = () => {
    if (activeLabelInput.trim()) {
      updateRoomFriendlyName(rm, activeLabelInput.trim());
      setRecentRooms(getRecentRoomList());
      setIsRenamingActive(false);
      notify(`✏️ Renamed active room to "${activeLabelInput.trim()}"`);
    }
  };

  const handleSaveItemRename = (code: string) => {
    if (renamingLabel.trim()) {
      updateRoomFriendlyName(code, renamingLabel.trim());
      setRecentRooms(getRecentRoomList());
      setRenamingCode(null);
      notify(`✏️ Updated room label`);
    }
  };

  const handleRemoveRoom = (roomCode: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecentRoom(roomCode);
    setRecentRooms(getRecentRoomList());
  };

  const handleClearRooms = () => {
    clearRecentRooms();
    setRecentRooms([]);
    notify('🧹 Cleared recent room history from this device.');
  };

  const handleUnlockAdmin = () => {
    if (passcodeInput.trim() === '1280') {
      setBuilderAdmin(true);
      setIsAdmin(true);
      setShowAdminPassInput(false);
      setPasscodeInput('');
      setAdminDrawerOpen(true);
      notify('🛠️ Builder Admin Mode Unlocked!');
    } else {
      notify('❌ Incorrect admin passcode.');
    }
  };

  const handleLockAdmin = () => {
    setBuilderAdmin(false);
    setIsAdmin(false);
    setAdminDrawerOpen(false);
    notify('🔒 Builder Admin Mode Locked');
  };

  const handleSaveAdminSettings = () => {
    const cleanDb = db.trim().replace(/\/$/, '') || DEFAULT_FIREBASE_DB;
    const cleanMd = md.trim() || 'gemini-flash-latest';
    const cleanKey = key.trim();

    onSave({
      ...config,
      db: cleanDb,
      md: cleanMd,
      key: cleanKey,
    });
    notify('✅ Saved Builder Admin backend & model settings!');
  };

  const handleShareLink = async () => {
    const cleanDb = db.trim().replace(/\/$/, '') || DEFAULT_FIREBASE_DB;
    const isCustomDb = cleanDb && cleanDb !== DEFAULT_FIREBASE_DB;

    const link =
      `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(rm)}` +
      (isCustomDb ? `&db=${encodeURIComponent(cleanDb)}` : '');

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Pintdr: ${currentMeta.name}`,
          text: `🍻 Join our squad plan "${currentMeta.name}" on Pintdr!`,
          url: link,
        });
        notify('✅ Shared squad link!');
        return;
      } catch (e: any) {
        if (e.name === 'AbortError') return;
      }
    }

    const copied = await copyStr(`🍻 Join our squad plan "${currentMeta.name}" on Pintdr\n${link}`);
    notify(copied ? '📋 Link copied – share it with your squad!' : "❌ Couldn't copy link");
  };

  const handleCopyRoomCode = async () => {
    const copied = await copyStr(rm);
    notify(copied ? `📋 Copied room slug "${rm}"` : "❌ Couldn't copy");
  };

  return (
    <div className="mt-3 bg-[#1e1e22] border border-[#2b2b2f] rounded-2xl p-4 sm:p-5 transition-all shadow-2xl animate-in fade-in duration-150 text-[#f4f4f5]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4 border-b border-[#2b2b2f]/70 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ff6b57] to-[#ff8f7d] flex items-center justify-center text-[#1a0703] shadow-md shadow-[#ff6b57]/20">
            <Home className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-display font-black text-[#ffffff] tracking-wide flex items-center gap-1.5">
              <span>Squad Rooms</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[rgba(198,255,61,0.15)] text-[#c6ff3d] border border-[#c6ff3d]/30 font-mono">
                Live Sync
              </span>
            </h2>
            <p className="text-[11px] text-[#8d8d94]">1-tap room switcher & device memory</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg border border-[#2b2b2f] bg-[#17171a] text-[#8d8d94] hover:text-[#ffffff] hover:border-[#3b3b40] transition cursor-pointer"
          title="Close modal"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        {/* Active Connected Room Hero Card */}
        <div className="bg-[#17171a] border-2 border-[#ff6b57]/50 rounded-2xl p-3.5 sm:p-4 shadow-lg shadow-[#ff6b57]/10 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#ff6b57] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#c6ff3d] animate-ping" />
              <span>Active Squad Room</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveLabelInput(currentMeta.name);
                  setIsRenamingActive(!isRenamingActive);
                }}
                className="text-[11px] font-semibold text-[#8d8d94] hover:text-[#f4f4f5] px-2 py-1 rounded-lg border border-[#2b2b2f] bg-[#212124] hover:border-[#3b3b40] transition cursor-pointer flex items-center gap-1"
                title="Rename this room"
              >
                <Edit2 className="w-3 h-3 text-[#ff6b57]" />
                <span>Rename</span>
              </button>
              <button
                type="button"
                onClick={handleCopyRoomCode}
                className="text-[11px] font-semibold text-[#8d8d94] hover:text-[#f4f4f5] px-2 py-1 rounded-lg border border-[#2b2b2f] bg-[#212124] hover:border-[#3b3b40] transition cursor-pointer flex items-center gap-1"
                title="Copy room slug"
              >
                <Copy className="w-3 h-3" />
                <span>Slug</span>
              </button>
            </div>
          </div>

          {/* Room Display Name or Inline Rename Field */}
          {isRenamingActive ? (
            <div className="flex items-center gap-1.5 pt-1">
              <input
                value={activeLabelInput}
                onChange={(e) => setActiveLabelInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveActiveRename()}
                placeholder="Room display name (e.g. Medway Lads)"
                autoFocus
                className="flex-1 bg-[#212124] border border-[#ff6b57] text-[#ffffff] px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold outline-none"
              />
              <button
                type="button"
                onClick={handleSaveActiveRename}
                className="cursor-pointer bg-[#ff6b57] text-[#1a0703] font-bold text-xs px-3 py-1.5 rounded-xl hover:brightness-105 active:scale-95"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsRenamingActive(false)}
                className="cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#8d8d94] font-semibold text-xs px-2.5 py-1.5 rounded-xl hover:text-[#ffffff]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div>
              <h3 className="font-display font-black text-lg sm:text-xl text-[#ffffff] truncate">
                {currentMeta.name}
              </h3>
              <div className="flex items-center gap-2 text-xs text-[#8d8d94] font-mono mt-0.5 flex-wrap">
                <span className="text-[#a1a1aa]">{rm}</span>
                {squadCount ? (
                  <span className="text-[#c6ff3d] font-sans flex items-center gap-1">
                    • <Users className="w-3 h-3" /> {squadCount} mates
                  </span>
                ) : null}
                {currentPlanName ? (
                  <span className="text-[#ff8f7d] font-sans truncate">
                    • 🗓️ {currentPlanName}
                  </span>
                ) : null}
              </div>
            </div>
          )}

          {/* Quick Share Link Button */}
          <div className="pt-2 border-t border-[#2b2b2f]/60 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleShareLink}
              className="w-full cursor-pointer bg-gradient-to-r from-[#ff6b57] to-[#ff8f7d] text-[#1a0703] font-bold text-xs py-2 px-3 rounded-xl hover:brightness-105 active:scale-98 transition flex items-center justify-center gap-1.5 shadow-md shadow-[#ff6b57]/20"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>💬 Share Squad Link with Friends</span>
            </button>
          </div>
        </div>

        {/* Action Row: Create New Room */}
        {!isCreatingNew ? (
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleOpenCreateNew}
              className="w-full cursor-pointer border border-[#2b2b2f] bg-[#17171a] hover:border-[#ff6b57]/50 text-[#f4f4f5] font-bold text-xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 active:scale-98 shadow-sm group"
            >
              <PlusCircle className="w-4 h-4 text-[#ff6b57] group-hover:scale-110 transition-transform" />
              <span>+ Create or Join Another Room</span>
            </button>
          </div>
        ) : (
          /* Inline New Room Form */
          <div className="bg-[#17171a] border border-[#ff6b57]/40 rounded-2xl p-3.5 space-y-2.5 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#f4f4f5] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#ff6b57]" />
                <span>Create New Squad Room</span>
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="text-xs text-[#8d8d94] hover:text-[#f4f4f5] p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-semibold text-[#8d8d94] block mb-1">
                  Friendly Room Name
                </label>
                <input
                  value={newRoomLabel}
                  onChange={(e) => setNewRoomLabel(e.target.value)}
                  placeholder="e.g. Medway Lads, Friday Outing"
                  className="w-full bg-[#212124] border border-transparent focus:border-[#ff6b57] text-[#ffffff] px-3 py-1.5 rounded-xl text-xs outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold text-[#8d8d94]">
                    Custom Room Code (Slug)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const c = generateRoomCode();
                      setNewRoomCode(c);
                      if (!newRoomLabel) setNewRoomLabel(humanizeRoomCode(c));
                    }}
                    className="text-[10px] text-[#ff6b57] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>🎲 Roll Random</span>
                  </button>
                </div>
                <input
                  value={newRoomCode}
                  onChange={(e) => setNewRoomCode(e.target.value)}
                  placeholder="e.g. medway-pints or custom-code"
                  className="w-full bg-[#212124] border border-transparent focus:border-[#ff6b57] text-[#ffffff] px-3 py-1.5 rounded-xl text-xs font-mono outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleConfirmCreateNew}
                className="flex-1 cursor-pointer bg-[#ff6b57] text-[#1a0703] font-bold text-xs py-2 px-3 rounded-xl hover:brightness-105 active:scale-98 transition flex items-center justify-center gap-1"
              >
                <span>✨ Create & Enter Room</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#8d8d94] font-semibold text-xs py-2 px-3 rounded-xl hover:text-[#f4f4f5]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Recent Rooms Switcher (1-Tap Switch) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#cfcfd4] flex items-center gap-1.5">
              <span>Recent Rooms on this device:</span>
              <span className="bg-[#212124] text-[#8d8d94] text-[10px] font-mono px-1.5 py-0.2 rounded-full">
                {recentRooms.length}
              </span>
            </span>

            {recentRooms.length > 0 && (
              <button
                type="button"
                onClick={handleClearRooms}
                className="text-[10px] text-[#8d8d94] hover:text-[#ff6b57] cursor-pointer transition flex items-center gap-1"
                title="Clear recent rooms from this browser"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {recentRooms.length === 0 ? (
            <div className="bg-[#17171a] border border-[#2b2b2f] rounded-xl p-4 text-center text-xs text-[#8d8d94]">
              No other saved rooms on this device yet.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-0.5">
              {recentRooms.map((r) => {
                const isActive = r.code === rm;
                const isEditing = renamingCode === r.code;

                return (
                  <div
                    key={r.code}
                    onClick={() => {
                      if (!isEditing && !isActive) {
                        handleSelectRecentRoom(r.code, r.name);
                      }
                    }}
                    className={`group w-full flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all select-none ${
                      isActive
                        ? 'border-[#ff6b57] bg-[rgba(255,107,87,0.12)] cursor-default'
                        : 'border-[#2b2b2f] bg-[#17171a] hover:border-[#3b3b40] hover:bg-[#212124] cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive
                            ? 'bg-[#ff6b57] text-[#1a0703]'
                            : 'bg-[#212124] text-[#8d8d94] group-hover:text-[#f4f4f5]'
                        }`}
                      >
                        <Home className="w-3.5 h-3.5" />
                      </div>

                      {isEditing ? (
                        <div
                          className="flex items-center gap-1.5 flex-1 min-w-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            value={renamingLabel}
                            onChange={(e) => setRenamingLabel(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveItemRename(r.code)}
                            autoFocus
                            className="flex-1 bg-[#212124] border border-[#ff6b57] text-[#ffffff] px-2 py-1 rounded-lg text-xs outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveItemRename(r.code)}
                            className="bg-[#ff6b57] text-[#1a0703] font-bold text-[10px] px-2 py-1 rounded-lg"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingCode(null)}
                            className="text-[#8d8d94] text-[10px] px-1.5 py-1"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-display font-bold text-xs sm:text-sm text-[#ffffff] truncate">
                              {r.name || humanizeRoomCode(r.code)}
                            </span>
                            {isActive && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-[#c6ff3d]/15 text-[#c6ff3d] border border-[#c6ff3d]/30 font-mono">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-[#8d8d94] font-mono truncate mt-0.5">
                            <span className="truncate">{r.code}</span>
                            {r.memberCount ? (
                              <span className="font-sans text-[#a1a1aa] shrink-0">
                                • {r.memberCount} mates
                              </span>
                            ) : null}
                            {r.planName ? (
                              <span className="font-sans text-[#ff8f7d] shrink-0 truncate">
                                • {r.planName}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>

                    {!isEditing && (
                      <div
                        className="flex items-center gap-1 shrink-0 ml-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingCode(r.code);
                            setRenamingLabel(r.name);
                          }}
                          className="p-1 rounded text-[#8d8d94] hover:text-[#f4f4f5] transition cursor-pointer"
                          title="Rename room label"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveRoom(r.code, e)}
                          className="p-1 rounded text-[#8d8d94] hover:text-[#ff6b57] transition cursor-pointer opacity-70 hover:opacity-100"
                          title="Remove from history"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[10px] text-[#8d8d94] bg-[#17171a] p-2.5 rounded-xl border border-[#2b2b2f]/50 mt-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[#c6ff3d] shrink-0" />
            <span>
              <b>Device-only privacy:</b> These rooms are remembered on your personal phone/browser only.
            </span>
          </div>
        </div>

        {/* BUILDER ADMIN DRAWER (Only visible when unlocked!) */}
        {isAdmin && (
          <div className="border border-amber-500/40 bg-[#17171a] rounded-2xl overflow-hidden mt-3 shadow-lg">
            <button
              type="button"
              onClick={() => setAdminDrawerOpen(!adminDrawerOpen)}
              className="w-full cursor-pointer flex items-center justify-between p-3 text-xs font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/15 transition"
            >
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                <span>🛠️ Builder Admin (Firebase & Gerg AI Models)</span>
              </span>
              <span className="text-[11px]">
                {adminDrawerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </button>

            {adminDrawerOpen && (
              <div className="p-3.5 space-y-3 border-t border-amber-500/30 text-xs animate-in slide-in-from-top-2">
                {/* Central Backend Banner */}
                <div className="bg-[#212124] border border-[#2b2b2f] rounded-xl p-2.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[#f4f4f5]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#c6ff3d] animate-pulse" />
                      <span>{isCentralDb ? 'Central Default Firebase' : 'Custom Database URL'}</span>
                    </span>
                    <span className="text-[10px] text-[#c6ff3d] font-mono">europe-west1</span>
                  </div>
                  <p className="text-[10px] text-[#8d8d94] mt-1 break-all font-mono">
                    {DEFAULT_FIREBASE_DB}
                  </p>
                </div>

                {/* Firebase URL override */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-[#8d8d94]">
                      Firebase RTDB URL Override
                    </label>
                    {!isCentralDb && (
                      <button
                        type="button"
                        onClick={() => setDb(DEFAULT_FIREBASE_DB)}
                        className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                      >
                        Reset to Default
                      </button>
                    )}
                  </div>
                  <input
                    value={db}
                    onChange={(e) => setDb(e.target.value)}
                    placeholder="https://...-rtdb.europe-west1.firebasedatabase.app"
                    className="w-full bg-[#212124] border border-[#2b2b2f] focus:border-amber-400 text-[#ffffff] px-2.5 py-1.5 rounded-xl text-xs font-mono outline-none"
                  />
                </div>

                {/* Gemini Model Selector */}
                <div>
                  <label className="text-[10px] font-semibold text-[#8d8d94] block mb-1">
                    Gemini Model Identifier
                  </label>
                  <input
                    value={md}
                    onChange={(e) => setMd(e.target.value)}
                    placeholder="gemini-flash-latest"
                    className="w-full bg-[#212124] border border-[#2b2b2f] focus:border-amber-400 text-[#ffffff] px-2.5 py-1.5 rounded-xl text-xs font-mono outline-none mb-1.5"
                  />
                  <div className="flex flex-wrap gap-1">
                    {[
                      { id: 'gemini-flash-latest', label: '⚡ Latest' },
                      { id: 'gemini-3.8-flash', label: '3.8 Flash' },
                      { id: 'gemini-3.1-flash-lite', label: '3.1 Lite' },
                      { id: 'gemini-4-argon', label: '4 Argon' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMd(m.id)}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                          md === m.id
                            ? 'border-amber-400 bg-amber-500/20 text-amber-300 font-bold'
                            : 'border-[#2b2b2f] bg-[#212124] text-[#8d8d94] hover:text-[#f4f4f5]'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Key */}
                <div>
                  <label className="text-[10px] font-semibold text-[#8d8d94] block mb-1">
                    Custom Gemini API Key (Optional)
                  </label>
                  <input
                    type="password"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-[#212124] border border-[#2b2b2f] focus:border-amber-400 text-[#ffffff] px-2.5 py-1.5 rounded-xl text-xs font-mono outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveAdminSettings}
                  className="w-full cursor-pointer bg-amber-500 hover:bg-amber-400 text-[#1a0703] font-bold text-xs py-2 px-3 rounded-xl transition"
                >
                  Save Admin Backend Settings
                </button>
              </div>
            )}
          </div>
        )}

        {/* Feedback message banner if present */}
        {msg && (
          <div className="text-xs text-[#c6ff3d] bg-[rgba(198,255,61,0.1)] border border-[#c6ff3d]/30 px-3 py-2 rounded-xl flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{msg}</span>
          </div>
        )}

        {/* Bottom Bar: Subtle Admin Unlock & Close Button */}
        <div className="flex items-center justify-between pt-2 border-t border-[#2b2b2f]/60">
          <div>
            {!isAdmin ? (
              !showAdminPassInput ? (
                <button
                  type="button"
                  onClick={() => setShowAdminPassInput(true)}
                  className="text-[10px] text-[#52525b] hover:text-[#a1a1aa] transition cursor-pointer flex items-center gap-1"
                  title="Builder Admin access"
                >
                  <Lock className="w-2.5 h-2.5" />
                  <span>Builder Admin</span>
                </button>
              ) : (
                <div className="flex items-center gap-1 text-[11px]">
                  <input
                    type="password"
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUnlockAdmin()}
                    placeholder="Passcode"
                    autoFocus
                    className="w-20 bg-[#17171a] border border-[#3b3b40] text-[#f4f4f5] px-2 py-0.5 rounded text-[10px] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleUnlockAdmin}
                    className="cursor-pointer bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-amber-500/30"
                  >
                    Unlock
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdminPassInput(false)}
                    className="text-[#8d8d94] text-[10px] px-1"
                  >
                    ✕
                  </button>
                </div>
              )
            ) : (
              <button
                type="button"
                onClick={handleLockAdmin}
                className="text-[10px] text-amber-400 hover:text-amber-300 transition cursor-pointer flex items-center gap-1 font-semibold"
                title="Lock Builder Admin mode"
              >
                <Unlock className="w-2.5 h-2.5" />
                <span>Admin Unlocked (Tap to Lock)</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border border-[#2b2b2f] bg-[#17171a] hover:border-[#3b3b40] text-[#cfcfd4] hover:text-[#ffffff] font-semibold text-xs px-4 py-1.5 rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
