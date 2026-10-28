import React, { useState } from 'react';
import { OutingEvent } from '../types';
import { copyStr } from '../utils/storage';
import {
  Share2,
  MessageCircle,
  Copy,
  FileText,
  QrCode,
  X,
  Check,
  ExternalLink,
} from 'lucide-react';

interface ShareDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  event: OutingEvent | null;
  configDb: string;
  configRm: string;
  onOpenSummary: () => void;
  onOpenQrCode: () => void;
  onShowToast?: (msg: string) => void;
}

export const ShareDrawer: React.FC<ShareDrawerProps> = ({
  isOpen,
  onClose,
  event,
  configDb,
  configRm,
  onOpenSummary,
  onOpenQrCode,
  onShowToast,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const getShareLink = () => {
    return (
      `${window.location.origin}${window.location.pathname}` +
      (configDb || configRm
        ? `?db=${encodeURIComponent(configDb)}&room=${encodeURIComponent(
            configRm
          )}${event ? `&ev=${encodeURIComponent(event.id)}` : ''}`
        : '')
    );
  };

  const shareLink = getShareLink();
  const shareTitle = event ? `🍻 ${event.name} on Pintdr` : `🍻 Join Room "${configRm}" on Pintdr`;
  const shareText = event
    ? `🍻 ${event.name} – vote on spots & dates on Pintdr:\n${shareLink}`
    : `🍻 Jump into room "${configRm}" on Pintdr to plan our squad night out:\n${shareLink}`;

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  const handleCopyLink = async () => {
    const success = await copyStr(shareLink);
    if (success) {
      setCopied(true);
      if (onShowToast) onShowToast('📋 Room invite link copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } else {
      if (onShowToast) onShowToast('Could not copy link');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareLink,
        });
        if (onShowToast) onShowToast('Shared room link!');
        onClose();
        return;
      } catch (e: any) {
        if (e.name === 'AbortError') return;
      }
    }
    handleCopyLink();
  };

  const handleMessengerShare = async () => {
    await copyStr(shareText);
    if (onShowToast) onShowToast('📋 Copied! Paste into Messenger chat.');
    window.open('https://www.messenger.com/', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full sm:max-w-md bg-card border-t sm:border border-line rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink font-display">
                Share & Summary
              </h3>
              <p className="text-xs text-muted">
                Room: <strong className="text-primary">{configRm || 'default'}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-card2 border border-line text-muted hover:text-ink flex items-center justify-center cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {event && (
          <div className="bg-card2 border border-line rounded-2xl p-3.5 space-y-1">
            <div className="text-xs font-semibold text-muted uppercase tracking-wider">
              Active Outing Plan
            </div>
            <div className="font-bold text-sm text-ink flex items-center justify-between">
              <span>{event.name}</span>
              {event.where && (
                <span className="text-xs font-normal text-muted">📍 {event.where}</span>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onShowToast && onShowToast('Opening WhatsApp...')}
            className="cursor-pointer border border-[#25D366]/40 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] font-bold text-xs sm:text-sm h-12 px-3.5 rounded-xl transition flex items-center justify-center gap-2 whitespace-nowrap active:scale-95"
          >
            <Share2 className="w-4 h-4 text-[#25D366]" />
            <span>WhatsApp</span>
          </a>

          <button
            type="button"
            onClick={handleMessengerShare}
            className="cursor-pointer border border-[#00B2FF]/40 bg-[#00B2FF]/10 hover:bg-[#00B2FF]/20 text-[#00B2FF] font-bold text-xs sm:text-sm h-12 px-3.5 rounded-xl transition flex items-center justify-center gap-2 whitespace-nowrap active:scale-95"
          >
            <MessageCircle className="w-4 h-4 text-[#00B2FF]" />
            <span>Messenger</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className={`cursor-pointer font-bold text-xs sm:text-sm h-12 px-3.5 rounded-xl transition flex items-center justify-center gap-2 whitespace-nowrap active:scale-95 col-span-2 ${
              copied
                ? 'bg-secondary text-secondary-ink shadow-[0_0_16px_color-mix(in_oklab,var(--good)_25%,transparent)]'
                : 'border border-line bg-card2 text-ink hover:border-primary/50'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Invite Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-primary" />
                <span>Copy Invite Link</span>
              </>
            )}
          </button>
        </div>

        <div className="pt-2 border-t border-line/80 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenQrCode();
            }}
            className="cursor-pointer border border-line bg-card2 hover:bg-card2 text-ink font-bold text-xs sm:text-sm h-11 px-3 rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95"
          >
            <QrCode className="w-4 h-4 text-primary" />
            <span>Show QR Code</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSummary();
            }}
            className="cursor-pointer border border-secondary/40 bg-[color-mix(in_oklab,var(--good)_12%,transparent)] hover:bg-[color-mix(in_oklab,var(--good)_20%,transparent)] text-secondary font-bold text-xs sm:text-sm h-11 px-3 rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 shadow-[0_0_12px_color-mix(in_oklab,var(--good)_12%,transparent)]"
          >
            <FileText className="w-4 h-4" />
            <span>View Summary</span>
          </button>
        </div>

        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="w-full cursor-pointer text-xs font-semibold text-muted hover:text-ink py-1 text-center transition flex items-center justify-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            <span>More device sharing options</span>
          </button>
        )}
      </div>
    </div>
  );
};
