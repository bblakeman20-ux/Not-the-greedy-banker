import React from 'react';
import { User, OutingEvent } from '../types';
import { hasPay, MAX_VETOES } from '../utils/storage';

interface ProfileBarProps {
  squad: User[];
  currentUserId: string;
  onSelectUser: (id: string) => void;
  onEditUser: () => void;
  onNewUser: () => void;
  currentEvent: OutingEvent | null;
}

export const ProfileBar: React.FC<ProfileBarProps> = ({
  squad,
  currentUserId,
  onSelectUser,
  onEditUser,
  onNewUser,
  currentEvent,
}) => {
  const me = squad.find((u) => u.id === currentUserId);
  const vetoesUsed =
    me && currentEvent
      ? currentEvent.venues.filter((v) => (v.votes || {})[me.id] === 'v').length
      : 0;
  const vetoesLeft = Math.max(0, MAX_VETOES - vetoesUsed);

  return (
    <div className="mt-3 pt-2.5 border-t border-[#2b2b2f]">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="text-xs text-[#8d8d94] font-medium">
          {me ? (
            <span>
              YOU ARE: <b className="text-[#f4f4f5]">{me.emo} {me.name}</b>
              {currentEvent && !currentEvent.locked && (
                <span className="text-[#ff6b57]">
                  {' '}• 👎 {vetoesLeft} veto{vetoesLeft === 1 ? '' : 'es'} left
                </span>
              )}
            </span>
          ) : (
            '👆 TAP YOUR PROFILE:'
          )}
        </span>
        <div className="flex items-center gap-1.5">
          {me && (
            <button
              type="button"
              onClick={onEditUser}
              className="cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] font-semibold text-xs px-2.5 py-1.5 rounded-xl hover:border-[#3b3b40] transition"
            >
              ✏️ Edit Me
            </button>
          )}
          <button
            type="button"
            onClick={onNewUser}
            className="cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] font-semibold text-xs px-2.5 py-1.5 rounded-xl hover:border-[#3b3b40] transition"
          >
            + New Profile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {squad.map((u) => {
          const isSelected = u.id === currentUserId;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelectUser(u.id)}
              className={`text-left p-2.5 rounded-xl border transition cursor-pointer ${
                isSelected
                  ? 'border-[#ff6b57] bg-[rgba(255,107,87,0.13)] text-[#f4f4f5]'
                  : 'border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] hover:border-[#3b3b40]'
              }`}
            >
              <div className="font-bold text-sm truncate">
                {u.emo} {u.name}
              </div>
              <div className="text-[11px] text-[#8d8d94] truncate">
                📍 {u.loc} • {u.pay}
                {hasPay(u) && ' 💳'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
