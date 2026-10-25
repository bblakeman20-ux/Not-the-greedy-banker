import React from 'react';
import { Settings, Download, QrCode, Sun, Moon, Share2 } from 'lucide-react';
import { PintdrLogo } from './PintdrLogo';
import { ThemeMode } from '../utils/theme';

interface HeaderProps {
  statusText: string;
  isDenied: boolean;
  onOpenSetup: () => void;
  onOpenShare: () => void;
  onOpenQrCode: () => void;
  showInstall: boolean;
  onInstall: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  statusText,
  onOpenSetup,
  onOpenShare,
  onOpenQrCode,
  showInstall,
  onInstall,
  theme,
  onToggleTheme,
}) => {
  return (
    <header className="flex items-center justify-between gap-2.5">
      {/* Left: Pintdr Logo + Live Room Indicator */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <PintdrLogo size="sm" showWordmark={true} orientation="horizontal" />
        <button
          type="button"
          onClick={onOpenSetup}
          title="Click to manage room or backend connection"
          className="text-[11px] sm:text-xs font-semibold text-[#ff6b57] hover:text-[#f4f4f5] transition cursor-pointer flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#212124] border border-[#2b2b2f] hover:border-[#ff6b57]/40 truncate shrink min-w-0"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff6b57] animate-pulse shrink-0" />
          <span className="truncate">{statusText.replace(/^[⚡⚠️🔴🟢⚪]\s*/, '')}</span>
        </button>
      </div>

      {/* Right: Icon Buttons (QR Join, Share, Theme, Settings) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {showInstall && (
          <button
            type="button"
            onClick={onInstall}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] rounded-xl transition hover:border-[#3b3b40] active:scale-95"
            title="Install Pintdr App"
          >
            <Download className="w-4 h-4 text-[#ff6b57]" />
          </button>
        )}
        <button
          type="button"
          onClick={onOpenQrCode}
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] rounded-xl transition hover:border-[#ff6b57]/50 active:scale-95"
          title="Show QR Code to join room"
        >
          <QrCode className="w-4 h-4 text-[#ff6b57]" />
        </button>
        <button
          type="button"
          onClick={onOpenShare}
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center cursor-pointer border border-[#c6ff3d]/30 bg-[rgba(198,255,61,0.12)] text-[#c6ff3d] rounded-xl transition hover:bg-[rgba(198,255,61,0.2)] active:scale-95 shadow-[0_0_12px_rgba(198,255,61,0.12)]"
          title="Share room & view summary"
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] rounded-xl transition hover:border-[#3b3b40] active:scale-95"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-[#f59e0b]" />
          ) : (
            <Moon className="w-4 h-4 text-[#38bdf8]" />
          )}
        </button>
        <button
          type="button"
          onClick={onOpenSetup}
          title="Rooms & Cloud Sync Settings"
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center cursor-pointer border border-[#2b2b2f] bg-[#212124] text-[#a1a1aa] hover:text-[#f4f4f5] rounded-xl transition hover:border-[#3b3b40] active:scale-95"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
