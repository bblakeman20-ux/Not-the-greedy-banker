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
        className="w-full sm:max-w-md bg-[#17171a] border-t sm:border border-[#2b2b2f] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#2b2b2f]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#ff6b57]/20 border border-[#ff6b57]/40 flex items-center justify-center text-[#ff6b57]">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#ffffff] font-display">
                Share & Summary
              </h3>
              <p className="text-xs text-[#8d8d94]">
                Room: <strong className="text-[#ff6b57]">{configRm || 'default'}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#212124] border border-[#2b2b2f] text-[#8d8d94] hover:text-[#f4f4f5] flex items-center justify-center cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {event && (
          <div className="bg-[#212124] border border-[#2b2b2f] rounded-2xl p-3.5 space-y-1">
            <div className="text-xs font-semibold text-[#8d8d94] uppercase tracking-wider">
              Active Outing Plan
            </div>
            <div className="font-bold text-sm text-[#ffffff] flex items-center justify-between">
              <span>{event.name}</span>
              {event.where && (
                <span className="text-xs font-normal text-[#a1a1aa]">📍 {event.where}</span>
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
                ? 'bg-[#c6ff3d] text-[#141a03] shadow-[0_0_16px_rgba(198,255,61,0.25)]'
                : 'border border-[#2b2b2f] bg-[#212124] text-[#f4f4f5] hover:border-[#ff6b57]/50'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Invite Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-[#ff6b57]" />
                <span>Copy Invite Link</span>
              </>
            )}
          </button>
        </div>

        <div className="pt-2 border-t border-[#2b2b2f]/80 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenQrCode();
            }}
            className="cursor-pointer border border-[#2b2b2f] bg-[#212124] hover:bg-[#27272c] text-[#f4f4f5] font-bold text-xs sm:text-sm h-11 px-3 rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95"
          >
            <QrCode className="w-4 h-4 text-[#ff6b57]" />
            <span>Show QR Code</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSummary();
            }}
            className="cursor-pointer border border-[#c6ff3d]/40 bg-[rgba(198,255,61,0.12)] hover:bg-[rgba(198,255,61,0.2)] text-[#c6ff3d] font-bold text-xs sm:text-sm h-11 px-3 rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 shadow-[0_0_12px_rgba(198,255,61,0.12)]"
          >
            <FileText className="w-4 h-4" />
            <span>View Summary</span>
          </button>
        </div>

        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="w-full cursor-pointer text-xs font-semibold text-[#8d8d94] hover:text-[#f4f4f5] py-1 text-center transition flex items-center justify-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            <span>More device sharing options</span>
          </button>
        )}
      </div>
    </div>
  );
};
