import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { User } from '../types';
import { payChangeNote, recentPayChange } from '../utils/payDetails';

// Shown wherever someone might pay a squad member whose details changed recently.
export const PayChangeWarning: React.FC<{ user: User; squad: User[] }> = ({ user, squad }) => {
  const note = payChangeNote(user, squad);
  if (!note) return null;
  const byOther = recentPayChange(user, squad)?.byOther;
  return (
    <div
      className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border ${
        byOther ? 'bg-red-500/10 border-red-500/40 text-red-400' : 'bg-amber-500/10 border-amber-500/40 text-amber-500'
      }`}
    >
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
      <span>{note}</span>
    </div>
  );
};
