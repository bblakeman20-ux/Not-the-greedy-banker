import React, { useState } from 'react';
import { User, Venue } from '../../types';
import { MAX_VETOES, safeUrl } from '../../utils/storage';
import { mapsUrl } from './links';
import { AlertTriangle, Crown, ExternalLink, Lock, MapPin, Unlock, Map as MapIcon } from 'lucide-react';

interface DecidedPlanCardProps {
  venue: Venue;
  isLocked: boolean;
  me: User | null;
  myVetoesLeft: number;
  onUnlock: () => void;
  onLockIn: (venueId: string) => void;
  onVeto: (venue: Venue) => void;
  notify: (msg: string) => void;
}

// The front-runner (or locked-in) plan, with lock/unlock and the costly "veto the decided plan" escape hatch.
export const DecidedPlanCard: React.FC<DecidedPlanCardProps> = ({
  venue: decidedVenue,
  isLocked,
  me,
  myVetoesLeft,
  onUnlock,
  onLockIn,
  onVeto,
  notify,
}) => {
  const [confirmVetoWinner, setConfirmVetoWinner] = useState(false);

  return (
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
              onClick={onUnlock}
              className="cursor-pointer text-xs font-bold text-ink2 hover:text-ink bg-card border border-line hover:border-line2 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5 text-secondary" />
              <span>Unlock Plan</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onLockIn(decidedVenue.id)}
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
              onClick={() => {
                setConfirmVetoWinner(false);
                onVeto(decidedVenue);
              }}
              className="cursor-pointer text-xs font-black bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded-lg shadow-lg shadow-red-600/40 active:scale-95 transition flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>💥 Yes, Veto & Face Bounty</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
