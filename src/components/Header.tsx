import React, { useRef } from 'react';
import { Settings, Download, QrCode, Share2, Palette } from 'lucide-react';
import { PintdrLogo } from './PintdrLogo';
import { setBuilderAdmin } from '../utils/storage';
import { SyncState } from '../types';

const SYNC_DOT: Record<SyncState, string> = {
  live: 'bg-secondary animate-pulse',
  local: 'bg-muted',
  error: 'bg-red-500',
};

const SYNC_LABEL: Record<SyncState, string> = {
  live: 'Live – synced with your squad',
  local: 'Local only – changes stay on this device',
  error: 'Not syncing – check your connection',
};

interface HeaderProps {
  statusText: string;
  syncState: SyncState;
  isDenied: boolean;
  onOpenSetup: () => void;
  onOpenShare: () => void;
  onOpenQrCode: () => void;
  onOpenTheme: () => void;
  showInstall: boolean;
  onInstall: () => void;
  roomFriendlyName?: string;
  onAdminUnlock?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  statusText,
  syncState,
  onOpenSetup,
  onOpenShare,
  onOpenQrCode,
  onOpenTheme,
  showInstall,
  onInstall,
  roomFriendlyName,
  onAdminUnlock,
}) => {
  const tapCountRef = useRef(0);
  const lastTapRef = useRef(0);

  const handleLogoTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current > 2500) {
      tapCountRef.current = 1;
    } else {
      tapCountRef.current += 1;
    }
    lastTapRef.current = now;

    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      setBuilderAdmin(true);
      if (onAdminUnlock) {
        onAdminUnlock();
      } else {
        onOpenSetup();
      }
    }
  };

  return (
    <header className="flex items-center justify-between gap-2.5">
      {/* Left: Pintdr Logo (Tap 5x for Builder Admin) with Inline Live Room Indicator */}
      <div className="flex items-center gap-2 min-w-0" onClick={handleLogoTap}>
        <PintdrLogo
          size="sm"
          showWordmark={true}
          orientation="horizontal"
          inlineNode={
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSetup();
              }}
              title={`Room: ${roomFriendlyName || statusText} · ${SYNC_LABEL[syncState]} · Tap to switch squad room`}
              className="inline-flex items-center gap-1.5 cursor-pointer text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-lg bg-card2 border border-line hover:border-primary/50 transition text-muted hover:text-ink min-w-0 active:scale-95 shadow-sm"
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SYNC_DOT[syncState]}`} />
              <span className="truncate max-w-[150px] sm:max-w-[200px]">
                {roomFriendlyName || statusText.replace(/^[⚡⚠️🔴🟢⚪]\s*/, '') || 'Live'}
              </span>
            </button>
          }
        />
      </div>

      {/* Right: Icon Buttons (Install, QR Join, Share, Settings) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {showInstall && (
          <button
            type="button"
            onClick={onInstall}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center cursor-pointer border border-line bg-card2 text-ink rounded-xl transition hover:border-line2 active:scale-95"
            title="Install Pintdr App"
          >
            <Download className="w-4 h-4 text-primary" />
          </button>
        )}
        <button
          type="button"
          onClick={onOpenQrCode}
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center cursor-pointer border border-line bg-card2 text-ink rounded-xl transition hover:border-primary/50 active:scale-95"
          title="Show QR Code to join room"
        >
          <QrCode className="w-4 h-4 text-primary" />
        </button>
        <button
          type="button"
          onClick={onOpenShare}
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center cursor-pointer border border-secondary/30 bg-[color-mix(in_oklab,var(--good)_12%,transparent)] text-secondary rounded-xl transition hover:bg-[color-mix(in_oklab,var(--good)_20%,transparent)] active:scale-95 shadow-[0_0_12px_color-mix(in_oklab,var(--good)_12%,transparent)]"
          title="Share room & view summary"
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onOpenTheme}
          title="Room colour theme"
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center cursor-pointer border border-line bg-card2 text-primary rounded-xl transition hover:border-primary/50 active:scale-95"
        >
          <Palette className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onOpenSetup}
          title="Rooms & Cloud Sync Settings"
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center cursor-pointer border border-line bg-card2 text-muted hover:text-ink rounded-xl transition hover:border-line2 active:scale-95"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
