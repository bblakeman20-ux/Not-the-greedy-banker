import React from 'react';
import { User, OutingEvent } from '../types';
import { MAX_VETOES, getSavedUserProfile } from '../utils/storage';
import { Plus, Home, Pencil } from 'lucide-react';

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
}

export const ProfileBar: React.FC<ProfileBarProps> = ({
  squad,
  currentUserId,
  onSelectUser,
  onEditUser,
  onEditSpecificUser,
  onNewUser,
  onJoinWithSavedProfile,
  currentEvent,
  onPitchHouse,
}) => {
  const savedProfile = getSavedUserProfile();
  const me = squad.find((u) => u.id === currentUserId);
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
      ? currentEvent.venues.filter((v) => (v.votes || {})[me.id] === 'v').length
      : 0;
  const vetoesLeft = Math.max(0, MAX_VETOES - vetoesUsed);

  return (
    <div className="pt-2 border-t border-[#2b2b2f]/60">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth">
        {/* If user has saved profile not yet joined in this room */}
        {hasSavedProfileNotInSquad && onJoinWithSavedProfile && (
          <button
            type="button"
            onClick={() => onJoinWithSavedProfile(savedProfile)}
            className="cursor-pointer border border-[#ff6b57]/60 bg-[#ff6b57]/15 hover:bg-[#ff6b57]/25 text-[#ff6b57] font-bold text-xs h-9 px-3 rounded-xl transition whitespace-nowrap active:scale-95 flex items-center gap-1.5 shrink-0 shadow-[0_0_12px_rgba(255,107,87,0.2)]"
            title={`Join as ${savedProfile.name}`}
          >
            <span className="text-sm leading-none">{savedProfile.emo || '🍺'}</span>
            <span>Join as {savedProfile.name}</span>
          </button>
        )}

        {/* Squad Member Pills */}
        {squad.map((u) => {
          const isMe = u.id === currentUserId;
          const uVetoesUsed = currentEvent
            ? currentEvent.venues.filter((v) => (v.votes || {})[u.id] === 'v').length
            : 0;
          const uVetoesLeft = Math.max(0, MAX_VETOES - uVetoesUsed);

          if (isMe) {
            return (
              <button
                key={u.id}
                type="button"
                onClick={onEditUser}
                title="Your active profile · Tap to edit"
                className="cursor-pointer border border-[#ff6b57] bg-[rgba(255,107,87,0.18)] hover:bg-[rgba(255,107,87,0.25)] text-[#ffffff] font-bold text-xs h-9 px-3.5 rounded-xl transition-all whitespace-nowrap active:scale-95 flex items-center gap-1.5 shrink-0 shadow-[0_0_14px_rgba(255,107,87,0.25)] ring-1 ring-[#ff6b57]/40"
              >
                <span className="text-base leading-none select-none" role="img" aria-label="avatar">
                  {u.emo || '🍺'}
                </span>
                <span>You</span>
                {currentEvent && !currentEvent.locked && (
                  <span className="text-[11px] font-semibold text-[#ff6b57] bg-[#17171a] px-1.5 py-0.5 rounded border border-[#ff6b57]/30">
                    {vetoesLeft} veto{vetoesLeft === 1 ? '' : 'es'}
                  </span>
                )}
                {u.offersHouse && (
                  <Home className="w-3 h-3 text-[#c6ff3d] shrink-0" title="Offers house" />
                )}
                <Pencil className="w-3 h-3 text-[#8d8d94] hover:text-[#ffffff] ml-0.5" />
              </button>
            );
          }

          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelectUser(u.id)}
              title={`Switch active profile to ${u.name}`}
              className="cursor-pointer border border-[#2b2b2f] bg-[#212124] hover:border-[#3b3b40] hover:bg-[#27272c] text-[#f4f4f5] font-semibold text-xs h-9 px-3 rounded-xl transition whitespace-nowrap active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <span className="text-sm leading-none select-none" role="img" aria-label="avatar">
                {u.emo || '🍺'}
              </span>
              <span className="truncate max-w-[100px]">{u.name}</span>
              {currentEvent && !currentEvent.locked && uVetoesUsed > 0 && (
                <span className="text-[10px] text-[#8d8d94] font-normal">
                  ({uVetoesLeft} left)
                </span>
              )}
              {u.offersHouse && (
                <Home className="w-3 h-3 text-[#c6ff3d] shrink-0" title="Offers house" />
              )}
            </button>
          );
        })}

        {/* Pitch My Place quick chip if me has offersHouse */}
        {me && me.offersHouse && onPitchHouse && currentEvent && !currentEvent.locked && (
          <button
            type="button"
            onClick={() => onPitchHouse(me)}
            className="cursor-pointer border border-[#c6ff3d]/40 bg-[rgba(198,255,61,0.12)] hover:bg-[rgba(198,255,61,0.2)] text-[#c6ff3d] font-bold text-xs h-9 px-3 rounded-xl transition whitespace-nowrap active:scale-95 flex items-center gap-1 shrink-0"
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
          className="cursor-pointer border border-dashed border-[#ff6b57]/50 bg-[#212124] hover:bg-[#ff6b57]/10 text-[#ff6b57] font-bold text-xs h-9 px-3 rounded-xl hover:border-[#ff6b57] transition whitespace-nowrap active:scale-95 flex items-center gap-1 shrink-0"
          title="Add squad member"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </div>
    </div>
  );
};
