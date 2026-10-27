import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { copyStr, DEFAULT_FIREBASE_DB } from '../utils/storage';
import { Share2, Copy, Check, X, QrCode } from 'lucide-react';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  dbUrl: string;
  eventId?: string;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  dbUrl,
  eventId,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isCustomDb = dbUrl && dbUrl !== DEFAULT_FIREBASE_DB;
  const fullUrl =
    `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomCode)}` +
    (isCustomDb ? `&db=${encodeURIComponent(dbUrl)}` : '') +
    (eventId ? `&ev=${encodeURIComponent(eventId)}` : '');

  const handleCopy = async () => {
    const ok = await copyStr(fullUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Pintdr 🍻',
          text: `🍻 Join our squad plan on Pintdr! (Room: ${roomCode})`,
          url: fullUrl,
        });
      } catch (e: any) {
        if (e.name === 'AbortError') return;
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card border border-line rounded-3xl p-5 max-w-sm w-full text-center relative shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-muted hover:text-ink hover:bg-card2 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center justify-center gap-2 mb-1 text-primary">
          <QrCode className="w-5 h-5" />
          <h3 className="font-display font-extrabold text-base text-ink">
            Scan to Join Squad
          </h3>
        </div>
        <p className="text-xs text-muted mb-4">
          Point any phone camera to jump straight into this live room.
        </p>

        {/* QR Code Container with High Contrast Surface */}
        <div className="bg-white p-4 rounded-2xl inline-block shadow-md mx-auto mb-4">
          <QRCodeSVG
            value={fullUrl}
            size={192}
            level="M"
            includeMargin={false}
          />
        </div>

        {/* Room Code Badge */}
        <div className="bg-card2 border border-line rounded-xl px-3 py-2 mb-4 text-xs font-mono text-ink flex items-center justify-between">
          <span className="text-muted">Room Code:</span>
          <span className="font-bold text-primary">{roomCode}</span>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center justify-center gap-1.5 cursor-pointer bg-card2 hover:bg-line border border-line text-ink font-semibold text-xs py-2.5 px-3 rounded-xl transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-secondary" />
                <span className="text-secondary">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleNativeShare}
            className="flex items-center justify-center gap-1.5 cursor-pointer bg-primary text-primary-ink font-semibold text-xs py-2.5 px-3 rounded-xl hover:brightness-105 active:scale-95 transition"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Link</span>
          </button>
        </div>
      </div>
    </div>
  );
};
