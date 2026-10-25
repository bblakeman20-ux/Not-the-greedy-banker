import React, { useState } from 'react';
import { OutingEvent, User } from '../../types';
import { calculateMidpoint, miles } from '../../utils/osm';

interface TravelTabProps {
  event: OutingEvent;
  squad: User[];
  onUpdateSquad: (squad: User[]) => void;
  onUpdateEvent: (ev: OutingEvent) => void;
  onSelectIdeasNearMid: (placeName: string) => void;
}

const MODES = ['Train', 'Uber Split', 'Driver', 'Walk'];

export const TravelTab: React.FC<TravelTabProps> = ({
  event,
  squad,
  onUpdateSquad,
  onUpdateEvent,
  onSelectIdeasNearMid,
}) => {
  const [midMsg, setMidMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const winVenue = event.venues.find((v) => v.id === event.win) || event.venues[0] || null;
  const currentLocsKey = squad.map((u) => u.id + ':' + u.loc).join('|');
  const isStale = event.mid && event.mid.locs !== currentLocsKey;

  const handleCycleMode = (userId: string) => {
    const updated = squad.map((u) => {
      if (u.id !== userId) return u;
      const idx = MODES.indexOf(u.mode);
      const nextMode = MODES[(idx + 1) % MODES.length];
      return { ...u, mode: nextMode };
    });
    onUpdateSquad(updated);
  };

  const handleFindMidpoint = async () => {
    setLoading(true);
    setMidMsg("🗺️ Looking up everyone's stations...");
    try {
      const { midpoint, lost } = await calculateMidpoint(squad, winVenue);
      onUpdateEvent({ ...event, mid: midpoint });
      setMidMsg(
        lost.length
          ? `⚠️ Couldn't find ${lost.join(', ')} – fix their station in ✏️ Edit Me`
          : '🎯 Midpoint calculated!'
      );
    } catch (e: any) {
      setMidMsg(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const M = event.mid;
  const vp = M && M.v && winVenue && M.vid === winVenue.id ? M.v : null;

  const mapsUrl = (q: string) =>
    'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

  return (
    <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-[#f4f4f5] font-display">
            🚆 Squad Travel & Midpoint
          </div>
          <div className="text-xs text-[#8d8d94] mt-0.5">
            Calculate the fairest geographic meeting point across everyone's stations
          </div>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={handleFindMidpoint}
          className="cursor-pointer bg-[#ff6b57] text-[#1a0703] font-semibold text-xs px-4 py-2 rounded-xl hover:brightness-105 active:scale-95 transition whitespace-nowrap"
        >
          {loading ? 'Finding...' : '📍 Find Midpoint'}
        </button>
      </div>

      {/* Midpoint display card */}
      {M ? (
        <div className="bg-[rgba(255,107,87,0.1)] border border-[#ff6b57]/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[#f4f4f5]">
              🎯 Midpoint: <b>near {M.name}</b>
            </span>
            <a
              href={mapsUrl(`${(+M.lat).toFixed(5)},${(+M.lon).toFixed(5)}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] font-semibold text-xs px-3 py-1.5 rounded-lg hover:border-[#3b3b40] transition whitespace-nowrap"
            >
              Map ↗
            </a>
          </div>

          {isStale && (
            <div className="text-xs text-[#ff6b57]">
              ↻ Someone changed station – tap Find Midpoint again
            </div>
          )}

          <button
            type="button"
            onClick={() => onSelectIdeasNearMid(M.name)}
            className="w-full cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] font-semibold text-xs px-3.5 py-2.5 rounded-xl hover:border-[#3b3b40] transition"
          >
            ✨ Discover ideas near {M.name}
          </button>
        </div>
      ) : (
        <div className="bg-[#212124] border border-[#2b2b2f] rounded-xl p-4 text-xs text-[#8d8d94]">
          Tap <b>📍 Find Midpoint</b> to calculate the fairest station or town for the squad to meet.
        </div>
      )}

      {midMsg && <div className="text-xs text-[#cfcfd4]">{midMsg}</div>}

      {/* Squad travel stations list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {squad.map((u) => {
          const p = M && M.pts && M.pts[u.id];
          const dist: string[] = [];
          if (p && M) dist.push(`${miles(p, M).toFixed(1)} mi to midpoint`);
          if (p && vp && winVenue) {
            dist.push(`${miles(p, vp).toFixed(1)} mi to ${winVenue.name}`);
          }

          return (
            <div
              key={u.id}
              className="flex items-center justify-between gap-3 bg-[#212124] border border-[#2b2b2f] rounded-xl p-3.5"
            >
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#f4f4f5] truncate">
                  {u.emo} {u.name}{' '}
                  <span className="text-xs font-normal text-[#8d8d94]">· {u.loc}</span>
                </div>
                {dist.length > 0 && (
                  <div className="text-[11px] text-[#8d8d94] mt-0.5 truncate">
                    📏 {dist.join(' · ')}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleCycleMode(u.id)}
                className="cursor-pointer border border-[#2b2b2f] bg-[#17171a] text-[#f4f4f5] font-semibold text-xs px-3 py-1.5 rounded-lg hover:border-[#3b3b40] transition shrink-0 whitespace-nowrap"
              >
                🚆 {u.mode}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
