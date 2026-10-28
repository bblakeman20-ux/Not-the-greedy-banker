import React from 'react';
import { User, Venue } from '../../types';
import { safeUrl } from '../../utils/storage';
import { venueScores } from '../../utils/eventActions';
import { mapsUrl } from './links';
import { ChevronDown, ChevronUp, Crown, ExternalLink, Flame, MapPin, Route, Star, ThumbsDown, ThumbsUp, Trash2, Map as MapIcon } from 'lucide-react';

interface VenueCardProps {
  venue: Venue;
  squad: User[];
  me: User | null;
  isWinner: boolean;
  isSpinning: boolean;
  isLocked: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onVote: (venueId: string, type: 'k' | 'p') => void;
  onLockIn: (venueId: string) => void;
  onDelete: (venueId: string) => void;
}

// One shortlist entry: a compact pill with quick votes that expands into details.
export const VenueCard: React.FC<VenueCardProps> = ({
  venue: v,
  squad,
  me,
  isWinner,
  isSpinning,
  isLocked,
  isExpanded,
  onToggleExpand,
  onVote,
  onLockIn,
  onDelete,
}) => {
  const vt = v.votes || {};
  const { keenCount, passCount, netScore } = venueScores(v, squad);
  const keenList = squad.filter((u) => vt[u.id] === 'k').map((u) => `${u.emo || '👤'} ${u.name}`);
  const passList = squad
    .filter((u) => vt[u.id] === 'p' || vt[u.id] === 'v')
    .map((u) => `${u.emo || '👤'} ${u.name}`);
  const roomCount = squad ? squad.length : 0;
  const isMajorityOption = roomCount >= 2 && keenCount / roomCount > 0.5;
  const isGreedyBanker = /greedy\s*banker/i.test(v.name);
  const isColdPassed = keenCount === 0 && passCount >= 2;

  return (
    <div
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
        onClick={onToggleExpand}
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
                onClick={() => onVote(v.id, 'k')}
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
                onClick={() => onVote(v.id, 'p')}
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
            onClick={onToggleExpand}
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
                  onClick={() => onLockIn(v.id)}
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
                  onClick={() => onDelete(v.id)}
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
