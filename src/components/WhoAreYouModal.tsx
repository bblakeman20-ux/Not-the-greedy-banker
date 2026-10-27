import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getDeviceId, getSavedUserProfile } from '../utils/storage';
import { Sparkles, Users, UserPlus, Check, ChevronDown, ChevronUp, AlertCircle, ShieldAlert, Smartphone } from 'lucide-react';

interface WhoAreYouModalProps {
  isOpen: boolean;
  roomCode: string;
  squad: User[];
  onJoinNew: (newUser: User) => void;
  onClaimExisting: (user: User) => void;
  canDismiss?: boolean;
  onClose?: () => void;
}

const EMOJI_PALETTE = [
  '🍺', '🍻', '🍹', '🍷', '🍕', '🎯', '⚡', '🔥',
  '👑', '🦁', '☕', '⚽', '🎸', '🕶️', '🚀', '🤠',
  '🌮', '🍔', '🎳', '🎲'
];

export const WhoAreYouModal: React.FC<WhoAreYouModalProps> = ({
  isOpen,
  roomCode,
  squad,
  onJoinNew,
  onClaimExisting,
  canDismiss = false,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [emo, setEmo] = useState('🍺');
  const [loc, setLoc] = useState('Local');
  const [payLink, setPayLink] = useState('');
  const [mode, setMode] = useState('Train');
  const [showDetails, setShowDetails] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingConfirmUser, setPendingConfirmUser] = useState<User | null>(null);

  const deviceId = getDeviceId();

  useEffect(() => {
    if (isOpen) {
      const saved = getSavedUserProfile();
      if (saved && saved.name && !/^you$/i.test(saved.name.trim())) {
        setName(saved.name);
        if (saved.emo) setEmo(saved.emo);
        if (saved.loc) setLoc(saved.loc);
        if (saved.payLink) setPayLink(saved.payLink);
        if (saved.mode) setMode(saved.mode);
      }
      setPendingConfirmUser(null);
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateAndJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg('Please enter your name to join the squad.');
      return;
    }
    if (/^you$/i.test(cleanName)) {
      setErrorMsg('Please enter your real name or nickname (e.g., Ben, Dan, Sarah).');
      return;
    }

    const newUser: User = {
      id: 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: cleanName,
      emo: emo || '🍺',
      loc: loc.trim() || 'Local',
      mode: mode || 'Train',
      pay: payLink.toLowerCase().includes('paypal') ? 'PayPal' : 'Monzo',
      payLink: payLink.trim() || undefined,
      claimedDeviceId: deviceId,
      claimedAt: Date.now(),
    };

    onJoinNew(newUser);
  };

  const handleSelectExisting = (member: User) => {
    // Check if this profile has been claimed by a different device
    const isClaimedByOther =
      Boolean(member.claimedDeviceId) && member.claimedDeviceId !== deviceId;

    if (isClaimedByOther) {
      setPendingConfirmUser(member);
    } else {
      onClaimExisting(member);
    }
  };

  const handleConfirmClaimOther = () => {
    if (pendingConfirmUser) {
      onClaimExisting(pendingConfirmUser);
      setPendingConfirmUser(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-card border border-line rounded-2xl shadow-2xl p-5 sm:p-7 text-ink space-y-6 my-auto">
        {/* Top Header */}
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto text-primary shadow-[0_0_20px_color-mix(in_oklab,var(--accent)_25%,transparent)]">
            <span className="text-2xl select-none leading-none">👋</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-display tracking-tight text-ink">
            Who are you?
          </h2>
          <p className="text-xs sm:text-sm text-muted max-w-xs sm:max-w-sm mx-auto">
            Choose your squad profile or create one so your votes, vetos, and suggestions sync with the lads.
          </p>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card2 border border-line text-[11px] text-primary font-mono font-medium">
            <span>🏠 Room: #{roomCode}</span>
          </div>
        </div>

        {/* Existing Member Confirmation Dialog (if tapping another device's profile) */}
        {pendingConfirmUser && (
          <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-500/50 space-y-3 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0 text-lg">
                <AlertCircle className="w-5 h-5 text-amber-400" />
              </div>
              <div className="space-y-1">
                <div className="text-xs sm:text-sm font-bold text-amber-200">
                  Are you sure you're {pendingConfirmUser.name}?
                </div>
                <p className="text-xs text-amber-300/80 leading-relaxed">
                  This profile has already been claimed on another device. If you're switching phones or sharing, you can take over this profile on this device.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1 justify-end">
              <button
                type="button"
                onClick={() => setPendingConfirmUser(null)}
                className="px-3 py-1.5 rounded-lg border border-line2 bg-card2 text-xs font-semibold text-muted hover:text-ink transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClaimOther}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-[0_0_12px_color-mix(in_oklab,var(--good)_30%,transparent)]"
              >
                <span>Yes, I am {pendingConfirmUser.name}</span>
              </button>
            </div>
          </div>
        )}

        {/* SECTION 1: New Member Form */}
        <form onSubmit={handleCreateAndJoin} className="bg-card2 border border-line rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-line">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <UserPlus className="w-4 h-4 text-primary" />
              <span>Section 1: Join as New Squad Member</span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-500/50 text-xs text-red-300">
              {errorMsg}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">
                Your Name <span className="text-primary">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="e.g. Ben, Dan, Sarah, Jamie"
                  className="w-full bg-card border border-line focus:border-primary text-ink px-3.5 py-2.5 rounded-xl text-sm font-medium outline-none placeholder:text-muted transition"
                  autoFocus
                />
                <div
                  className="w-11 h-11 rounded-xl bg-card border border-primary/40 flex items-center justify-center text-xl shrink-0 select-none shadow-inner"
                  title="Your chosen emoji"
                >
                  {emo}
                </div>
              </div>
            </div>

            {/* Quick Emoji Picker */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted block">
                Pick Your Squad Emoji:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_PALETTE.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setEmo(icon)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition cursor-pointer select-none ${
                      emo === icon
                        ? 'bg-primary/30 border-2 border-primary scale-110 shadow-[0_0_10px_color-mix(in_oklab,var(--accent)_40%,transparent)]'
                        : 'bg-card border border-line hover:border-primary/50 hover:bg-card2'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Expandable Optional Details */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-muted hover:text-ink flex items-center gap-1.5 font-medium transition cursor-pointer"
              >
                <span>{showDetails ? 'Hide' : '+ Add'} Station & Payment Link (Optional)</span>
                {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showDetails && (
                <div className="mt-2.5 p-3 rounded-xl bg-card border border-line space-y-2.5 animate-fade-in text-xs">
                  <div>
                    <label className="text-[11px] text-muted block mb-1">
                      Starting Station / Town
                    </label>
                    <input
                      type="text"
                      value={loc}
                      onChange={(e) => setLoc(e.target.value)}
                      placeholder="e.g. Chatham, Rainham, Rochester"
                      className="w-full bg-card2 border border-line focus:border-primary text-ink px-2.5 py-1.5 rounded-lg text-xs outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-muted block mb-1">
                        Transport Preference
                      </label>
                      <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value)}
                        className="w-full bg-card2 border border-line text-ink px-2.5 py-1.5 rounded-lg text-xs outline-none"
                      >
                        <option value="Train">🚆 Train</option>
                        <option value="Uber Split">🚕 Uber Split</option>
                        <option value="Driver">🚗 Driver (DD)</option>
                        <option value="Walk">🚶 Walk / Local</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-muted block mb-1">
                        Payment Link (Monzo/PayPal)
                      </label>
                      <input
                        type="text"
                        value={payLink}
                        onChange={(e) => setPayLink(e.target.value)}
                        placeholder="monzo.me/name"
                        className="w-full bg-card2 border border-line focus:border-primary text-ink px-2.5 py-1.5 rounded-lg text-xs outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full mt-2 cursor-pointer bg-primary hover:bg-primary-hi text-primary-ink font-black text-sm py-3 px-4 rounded-xl transition shadow-[0_0_20px_color-mix(in_oklab,var(--accent)_35%,transparent)] flex items-center justify-center gap-2 active:scale-98"
            >
              <span>🍻 Join Squad & Claim Profile</span>
            </button>
          </div>
        </form>

        {/* SECTION 2: Existing Member Tap List */}
        {squad.length > 0 && (
          <div className="space-y-3">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-line"></div>
              </div>
              <span className="relative bg-card px-3 text-[11px] font-bold uppercase tracking-wider text-muted">
                Section 2: Already in this room?
              </span>
            </div>

            <p className="text-xs text-muted text-center">
              Tap your name below to claim and switch to your profile:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {squad.map((member) => {
                const isClaimedByOther =
                  Boolean(member.claimedDeviceId) && member.claimedDeviceId !== deviceId;

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleSelectExisting(member)}
                    className="cursor-pointer border border-line bg-card2 hover:border-primary/60 hover:bg-card2 text-left p-2.5 rounded-xl transition active:scale-98 flex items-center justify-between gap-2 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-card border border-line flex items-center justify-center text-lg leading-none shrink-0 group-hover:scale-105 transition">
                        {member.emo || '🍺'}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-ink truncate group-hover:text-primary transition">
                          {member.name}
                        </div>
                        <div className="text-[10px] text-muted truncate">
                          {member.loc || 'Local'} • {member.mode || 'Train'}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1">
                      {isClaimedByOther ? (
                        <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Smartphone className="w-2.5 h-2.5" />
                          <span>Claimed</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted group-hover:text-ink font-medium">
                          Tap to claim →
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Optional Close if dismissable (e.g. user already has an active profile and just reopened the selector) */}
        {canDismiss && onClose && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-muted hover:text-ink cursor-pointer underline"
            >
              Cancel and return to outing
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
