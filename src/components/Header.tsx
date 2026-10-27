import React, { useRef } from 'react';
import { Settings, Download, QrCode, Share2 } from 'lucide-react';
import { PintdrLogo } from './PintdrLogo';
import { setBuilderAdmin } from '../utils/storage';

interface HeaderProps {
  statusText: string;
  isDenied: boolean;
  onOpenSetup: () => void;
  onOpenShare: () => void;
  onOpenQrCode: () => void;
  showInstall: boolean;
  onInstall: () => void;
  roomFriendlyName?: string;
  onAdminUnlock?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  statusText,
  onOpenSetup,
  onOpenShare,
  onOpenQrCode,
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
              title={`Room: ${roomFriendlyName || statusText} · Tap to switch squad room`}
              className="inline-flex items-center gap-1.5 cursor-pointer text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-lg bg-[#212124] border border-[#2b2b2f] hover:border-[#ff6b57]/50 transition text-[#a1a1aa] hover:text-[#f4f4f5] shrink-0 active:scale-95 shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#c6ff3d] animate-pulse shrink-0" />
              <span className="truncate max-w-[85px] xs:max-w-[125px] sm:max-w-[160px]">
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
