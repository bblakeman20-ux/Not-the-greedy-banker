import React, { useState } from 'react';
import { BanItem } from '../../types';
import { Ban, ShieldAlert, X } from 'lucide-react';

interface BanListPanelProps {
  banList: BanItem[];
  onAddBan: (name: string) => void;
  onRemoveBan: (id: string) => void;
}

export const BanListPanel: React.FC<BanListPanelProps> = ({ banList, onAddBan, onRemoveBan }) => {
  const [newBan, setNewBan] = useState('');

  const handleAddBan = () => {
    if (newBan.trim()) {
      onAddBan(newBan.trim());
      setNewBan('');
    }
  };

  return (
      <div className="bg-card border border-line rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-primary font-display flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-primary" />
              <span>The Ban List ({banList.length})</span>
            </div>
            <div className="text-xs text-muted mt-0.5">
              Blacklisted chains & default pubs automatically excluded across all rolls and searches
            </div>
          </div>
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {banList.length === 0 ? (
            <div className="bg-card2 border border-line text-xs text-muted px-3.5 py-2.5 rounded-xl">
              No pubs banned right now — add any chain or spot below to exclude it from all rolls and searches.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {banList.map((b) => (
                <div
                  key={b.id}
                  className="inline-flex items-center gap-1.5 bg-card2 border border-line text-xs px-3 py-1.5 rounded-xl"
                >
                  <Ban className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-ink font-semibold">{b.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveBan(b.id)}
                    className="cursor-pointer text-muted hover:text-primary text-xs p-1"
                    title="Remove ban"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            value={newBan}
            onChange={(e) => setNewBan(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddBan()}
            placeholder="Ban another pub or chain (e.g. Wetherspoon, Greene King)..."
            className="flex-1 bg-card2 border border-line focus:border-primary text-ink px-3.5 py-2.5 rounded-xl text-xs sm:text-sm outline-none"
          />
          <button
            type="button"
            onClick={handleAddBan}
            className="cursor-pointer bg-[color-mix(in_oklab,var(--accent)_13%,transparent)] border border-primary/30 text-primary font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl hover:bg-[color-mix(in_oklab,var(--accent)_20%,transparent)] transition whitespace-nowrap"
          >
            Ban Venue
          </button>
        </div>
      </div>
  );
};
