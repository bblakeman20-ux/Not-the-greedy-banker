import React, { useState } from 'react';
import { User, OutingEvent, Venue } from '../types';
import { MAX_VETOES, getSavedUserProfile, payUrl, copyStr } from '../utils/storage';
import { Plus, Home, Pencil, ExternalLink, Copy, Check, ThumbsUp, ThumbsDown, UserCheck, ShieldAlert, X } from 'lucide-react';

interface ProfileBarProps {
  squad: User[];
  currentUserId: string;
  onSelectUser: (id: string) => void;
  onEditUser: () => void;
  onEditSpecificUser?: (user: User) => void;
  onNewUser: () => void;
  onJoinWithSavedProfile?: (profile: User) => void;
  currentEvent: OutingEvent | null;
  onPitchHouse?: (user: User) => void;
  boardTally?: Record<string, { r: number; m: number }>;
  onOpenWhoAreYou?: () => void;
}

export const ProfileBar: React.FC<ProfileBarProps> = ({
  squad,
  currentUserId,
  onSelectUser,
  onEditUser,
  onNewUser,
  onJoinWithSavedProfile,
  currentEvent,
  onPitchHouse,
  boardTally,
  onOpenWhoAreYou,
}) => {
  const [inspectedMember, setInspectedMember] = useState<User | null>(null);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);

  const savedProfile = getSavedUserProfile();
  const me = squad.find((u) => u.id === currentUserId);
  const otherMembers = squad.filter((u) => u.id !== currentUserId);

  const hasSavedProfileNotInSquad =
    savedProfile &&
    savedProfile.name &&
    !squad.some(
      (u) =>
        u.id === savedProfile.id ||
        u.name.trim().toLowerCase() === savedProfile.name.trim().toLowerCase()
    );

  const vetoesUsed =
    me && currentEvent
      ? Math.max(
          currentEvent.planVetoes?.[me.id] || 0,
          (currentEvent.bounties || []).filter((b) => b.uid === me.id).length
        )
      : 0;
  const vetoesLeft = Math.max(0, MAX_VETOES - vetoesUsed);

  const handleOpenMemberCard = (member: User) => {
    setInspectedMember(member);
    setConfirmSwitch(false);
    setCopiedBank(false);
  };

  const handleConfirmSwitch = () => {
    if (inspectedMember) {
      onSelectUser(inspectedMember.id);
      setInspectedMember(null);
      setConfirmSwitch(false);
    }
  };

  const handleCopyBank = async (text: string) => {
    const ok = await copyStr(text);
    if (ok) {
      setCopiedBank(true);
      setTimeout(() => setCopiedBank(false), 2000);
    }
  };

  // Inspect Keen & Pass votes for inspected member in currentEvent
  const memberKeenVenues: Venue[] =
    inspectedMember && currentEvent
      ? currentEvent.venues.filter(
          (v) => (v.votes || {})[inspectedMember.id] === 'k'
        )
      : [];

  const memberPassVenues: Venue[] =
    inspectedMember && currentEvent
      ? currentEvent.venues.filter((v) => {
          const vt = (v.votes || {})[inspectedMember.id];
          return vt === 'p' || vt === 'v';
        })
      : [];

  return (
    <div className="pt-2 border-t border-line/60">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth">
        {/* If user has saved profile not yet joined in this room */}
        {hasSavedProfileNotInSquad && onJoinWithSavedProfile && (
          <button
            type="button"
            onClick={() => onJoinWithSavedProfile(savedProfile)}
            className="cursor-pointer border border-primary/60 bg-primary/15 hover:bg-primary/25 text-primary font-bold text-xs h-9 px-3 rounded-xl transition whitespace-nowrap active:scale-95 flex items-center gap-1.5 shrink-0 shadow-[0_0_12px_color-mix(in_oklab,var(--accent)_20%,transparent)]"
            title={`Join as ${savedProfile.name}`}
          >
            <span className="text-sm leading-none">{savedProfile.emo || '🍺'}</span>
            <span>Join as {savedProfile.name}</span>
          </button>
        )}

        {/* 1. ACTIVE CLAIMED USER PILL (ALWAYS ON THE LEFT) */}
        {me ? (
          <button
            type="button"
            onClick={onEditUser}
            title="Your active profile · Tap to edit"
            className="cursor-pointer border border-primary bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] hover:bg-[color-mix(in_oklab,var(--accent)_25%,transparent)] text-ink font-bold text-xs h-9 px-3.5 rounded-xl transition-all whitespace-nowrap active:scale-95 flex items-center gap-1.5 shrink-0 shadow-[0_0_16px_color-mix(in_oklab,var(--accent)_30%,transparent)] ring-1 ring-primary/50"
          >
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" title="Active on this device" />
            <span className="text-base leading-none select-none" role="img" aria-label="avatar">
              {me.emo || '🍺'}
            </span>
            <span className="font-black text-ink">{me.name}</span>
            <span className="text-[11px] text-primary font-semibold">(You)</span>

            {Boolean(me.isTraitor || (currentEvent?.traitors || []).includes(me.id)) && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-500/60 bg-red-950/80 text-red-300 animate-pulse flex items-center gap-0.5"
                title="Traitor: Voted for The Greedy Banker! £5 Traitor Tax"
              >
                🐍 Traitor
              </span>
            )}

            {Boolean(currentEvent && !currentEvent.locked) && (
              <span className="text-[11px] font-semibold text-primary bg-card px-1.5 py-0.5 rounded border border-primary/30">
                {vetoesLeft} veto{vetoesLeft === 1 ? '' : 'es'}
              </span>
            )}

            {Boolean(boardTally?.[me.id]) && (
              <span
                className={`text-[11px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${
                  ((boardTally?.[me.id]?.r || 0) - (boardTally?.[me.id]?.m || 0)) >= 0
                    ? 'text-secondary bg-secondary/15 border-secondary/30'
                    : 'text-primary bg-primary/15 border-primary/30'
                }`}
                title="Bounty score"
              >
                🏆 {((boardTally?.[me.id]?.r || 0) - (boardTally?.[me.id]?.m || 0)) >= 0
                  ? `+${(boardTally?.[me.id]?.r || 0) - (boardTally?.[me.id]?.m || 0)}`
                  : (boardTally?.[me.id]?.r || 0) - (boardTally?.[me.id]?.m || 0)}
              </span>
            )}

            {Boolean(me.offersHouse) && (
              <span title="Offers house">
                <Home className="w-3 h-3 text-secondary shrink-0" />
              </span>
            )}
            <Pencil className="w-3 h-3 text-muted hover:text-ink ml-0.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenWhoAreYou}
            className="cursor-pointer border border-dashed border-primary bg-primary/20 hover:bg-primary/30 text-primary font-bold text-xs h-9 px-3.5 rounded-xl transition whitespace-nowrap active:scale-95 flex items-center gap-1.5 shrink-0 shadow-[0_0_14px_color-mix(in_oklab,var(--accent)_25%,transparent)] animate-pulse"
          >
            <span className="text-sm">👋</span>
            <span>Who are you? (Claim profile)</span>
          </button>
        )}

        {/* Vertical subtle divider between You and Mates */}
        {otherMembers.length > 0 && (
          <div className="h-5 w-[1px] bg-line shrink-0 mx-0.5" />
        )}

        {/* 2. OTHER SQUAD MEMBERS (READ-ONLY STATUS PILLS - DOES NOT SWITCH IDENTITY ON TAP) */}
        {otherMembers.map((u) => {
          const uVetoesUsed = currentEvent
            ? Math.max(
                currentEvent.planVetoes?.[u.id] || 0,
                (currentEvent.bounties || []).filter((b) => b.uid === u.id).length
              )
            : 0;
          const uVetoesLeft = Math.max(0, MAX_VETOES - uVetoesUsed);
          const t = boardTally?.[u.id];
          const hasTally = Boolean(t && ((t.r || 0) > 0 || (t.m || 0) > 0));
          const netTally = (t?.r || 0) - (t?.m || 0);
          const isTraitor = Boolean(u.isTraitor || (currentEvent?.traitors || []).includes(u.id));

          return (
            <button
              key={u.id}
              type="button"
              onClick={() => handleOpenMemberCard(u)}
              title={`View ${u.name}'s info & votes (Read-only)`}
              className="cursor-pointer border border-line bg-card2 hover:border-line2 hover:bg-card2 text-ink font-semibold text-xs h-9 px-3 rounded-xl transition whitespace-nowrap active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <span className="text-sm leading-none select-none" role="img" aria-label="avatar">
                {u.emo || '🍺'}
              </span>
              <span className="truncate max-w-[100px]">{u.name}</span>
              {isTraitor && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-500/60 bg-red-950/80 text-red-300 animate-pulse flex items-center gap-0.5"
                  title="Traitor: Voted for The Greedy Banker! £5 Traitor Tax"
                >
                  🐍 Traitor
                </span>
              )}
              {Boolean(currentEvent && !currentEvent.locked && uVetoesUsed > 0) && (
                <span className="text-[10px] text-muted font-normal">
                  ({uVetoesLeft} left)
                </span>
              )}
              {hasTally && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${
                    netTally >= 0
                      ? 'text-secondary bg-secondary/15 border-secondary/30'
                      : 'text-primary bg-primary/15 border-primary/30'
                  }`}
                  title={`${t?.r || 0} rounds saved, ${t?.m || 0} rounds owed`}
                >
                  🏆 {netTally >= 0 ? `+${netTally}` : netTally}
                </span>
              )}
              {Boolean(u.offersHouse) && (
                <span title="Offers house">
                  <Home className="w-3 h-3 text-secondary shrink-0" />
                </span>
              )}
            </button>
          );
        })}

        {/* Pitch My Place quick chip if me has offersHouse */}
        {me && me.offersHouse && onPitchHouse && currentEvent && !currentEvent.locked && (
          <button
            type="button"
            onClick={() => onPitchHouse(me)}
            className="cursor-pointer border border-secondary/40 bg-[color-mix(in_oklab,var(--good)_12%,transparent)] hover:bg-[color-mix(in_oklab,var(--good)_20%,transparent)] text-secondary font-bold text-xs h-9 px-3 rounded-xl transition whitespace-nowrap active:scale-95 flex items-center gap-1 shrink-0"
            title="Pitch your house to the shortlist"
          >
            <Home className="w-3 h-3" />
            <span>Pitch My Place</span>
          </button>
        )}

        {/* [+ Add] Button */}
        <button
          type="button"
          onClick={onNewUser}
          className="cursor-pointer border border-dashed border-primary/50 bg-card2 hover:bg-primary/10 text-primary font-bold text-xs h-9 px-3 rounded-xl hover:border-primary transition whitespace-nowrap active:scale-95 flex items-center gap-1 shrink-0"
          title="Add squad member"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </div>

      {/* READ-ONLY SQUAD MEMBER CARD (OPENS WHEN TAPPING A MATE) */}
      {inspectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm bg-card border border-line rounded-2xl p-5 shadow-2xl text-ink space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-card2 border border-line flex items-center justify-center text-2xl shrink-0">
                  {inspectedMember.emo || '🍺'}
                </span>
                <div>
                  <div className="text-base font-bold text-ink flex items-center gap-1.5">
                    <span>{inspectedMember.name}</span>
                    {Boolean(inspectedMember.isTraitor || (currentEvent?.traitors || []).includes(inspectedMember.id)) && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded border border-red-500/60 bg-red-950/80 text-red-300">
                        🐍 Traitor
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted">
                    Squad Mate Info & Votes
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedMember(null)}
                className="w-8 h-8 rounded-lg bg-card2 hover:bg-line flex items-center justify-center text-muted hover:text-ink transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Travel & Starting Point */}
            <div className="grid grid-cols-2 gap-2 bg-card2 p-3 rounded-xl border border-line text-xs">
              <div>
                <span className="text-[11px] text-muted block">📍 Starting Station</span>
                <span className="font-semibold text-ink">{inspectedMember.loc || 'Local'}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted block">🚆 Travel Mode</span>
                <span className="font-semibold text-ink">{inspectedMember.mode || 'Train'}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="bg-card2 p-3 rounded-xl border border-line space-y-1.5 text-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                💳 Payment Info
              </span>
              {payUrl(inspectedMember) ? (
                <div className="flex items-center justify-between">
                  <span className="text-ink font-medium">{inspectedMember.pay || 'Pay Link'}</span>
                  <a
                    href={payUrl(inspectedMember)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/20 border border-primary/40 text-primary font-semibold text-xs hover:bg-primary/30 transition"
                  >
                    <span>Open Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : inspectedMember.sort && inspectedMember.acc ? (
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[11px]">
                    Sort: {inspectedMember.sort} • Acc: {inspectedMember.acc}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyBank(`${inspectedMember.sort} ${inspectedMember.acc}`)}
                    className="p-1 rounded bg-card text-muted hover:text-ink"
                    title="Copy bank details"
                  >
                    {copiedBank ? <Check className="w-3.5 h-3.5 text-secondary" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ) : (
                <div className="text-muted italic text-[11px]">
                  No payment link or bank details added yet.
                </div>
              )}
            </div>

            {/* House Note if offers house */}
            {inspectedMember.offersHouse && (
              <div className="p-2.5 rounded-xl bg-secondary/10 border border-secondary/30 text-xs flex items-start gap-2 text-secondary">
                <Home className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">🏠 Offers house: </span>
                  <span className="text-ink/90">{inspectedMember.houseNote || 'Available for squad afters / chill'}</span>
                </div>
              </div>
            )}

            {/* Active Votes on this Outing */}
            <div className="bg-card2 p-3 rounded-xl border border-line space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  👍 Keen Spots ({memberKeenVenues.length})
                </span>
                {memberPassVenues.length > 0 && (
                  <span className="text-[10px] text-muted font-semibold">
                    {memberPassVenues.length} Passed
                  </span>
                )}
              </div>

              {memberKeenVenues.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
                  {memberKeenVenues.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-card border border-line"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-secondary shrink-0 font-bold">👍</span>
                        <span className="font-semibold text-ink truncate text-[11px]">
                          {v.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted shrink-0">
                        {v.loc} {v.cost ? `• ${v.cost}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-muted italic">
                  Hasn't voted Keen on any spots on the shortlist yet.
                </div>
              )}

              {Boolean(currentEvent?.planVetoes?.[inspectedMember.id]) && (
                <div className="pt-1 border-t border-line/60 text-[11px] text-red-300 flex items-center gap-1">
                  <span>🚨 Used {currentEvent?.planVetoes?.[inspectedMember.id]} Plan Veto token</span>
                </div>
              )}
            </div>

            {/* Muted Switch Profile Action with Two-Step Confirmation */}
            <div className="pt-2 border-t border-line/60 space-y-2">
              {!confirmSwitch ? (
                <button
                  type="button"
                  onClick={() => setConfirmSwitch(true)}
                  className="w-full py-2 px-3 rounded-xl border border-line bg-card hover:bg-card2 text-muted hover:text-ink text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Switch to {inspectedMember.name}'s profile on this device</span>
                </button>
              ) : (
                <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/50 space-y-2 animate-fade-in text-xs">
                  <div className="text-amber-200 font-semibold leading-tight">
                    ⚠️ Are you sure you want to vote and manage outings as <span className="font-bold underline">{inspectedMember.name}</span>?
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setConfirmSwitch(false)}
                      className="px-2.5 py-1 rounded-lg border border-line2 text-muted hover:text-ink text-xs font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmSwitch}
                      className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition cursor-pointer shadow-[0_0_10px_color-mix(in_oklab,var(--good)_30%,transparent)]"
                    >
                      Yes, Switch Profile
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
