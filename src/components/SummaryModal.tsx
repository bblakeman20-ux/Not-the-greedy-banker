import React, { useState } from 'react';
import { AppConfig, OutingEvent, User } from '../types';
import { copyStr, gbp, payUrl, safeUrl } from '../utils/storage';
import { calculateLedger, calculateSettlement, who } from '../utils/kitty';
import { downloadIcs, fmtWhen, whenOf } from '../utils/dates';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: OutingEvent | null;
  squad: User[];
  config: AppConfig;
  now: number;
  onShowToast?: (msg: string) => void;
}

export const SummaryModal: React.FC<SummaryModalProps> = ({
  isOpen,
  onClose,
  event,
  squad,
  config,
  now,
  onShowToast,
}) => {
  const [msg, setMsg] = useState('');

  if (!isOpen || !event) return null;

  const winVenue = event.venues.find((v) => v.id === event.win) || event.venues[0];
  const allInSlots = event.slots.filter(
    (s) => squad.length > 0 && squad.every((u) => s.av && s.av[u.id])
  );
  const { tot } = calculateLedger(event, squad);
  const settlements = calculateSettlement(event, squad);

  const owes = settlements.map((t) => {
    const c = who(t.to, squad);
    const l = c ? payUrl(c, t.amt) : '';
    const fromName = who(t.from, squad)?.name || 'Someone';
    const toName = c?.name || 'Someone';
    return `   ${fromName} → ${toName} ${gbp(t.amt)}${l ? ' ' + l : ''}`;
  });

  const shame = [
    ...new Set(
      (event.bounties || [])
        .filter((b) => !b.done && now >= b.until && !b.hide)
        .map((b) => (who(b.uid, squad) || {}).name)
        .filter(Boolean)
    ),
  ];

  const mapsUrl = (q: string) =>
    'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

  const whenList = allInSlots.map((s) => {
    const w = whenOf(s);
    return s.lbl + (w ? ` (${fmtWhen(w)})` : '');
  });

  const summaryText =
    `🍻 ${event.name.toUpperCase()}\n` +
    `${event.locked ? '🔒 LOCKED IN' : '🎯 FRONT RUNNER'}: ${
      winVenue
        ? winVenue.name +
          ' (' +
          winVenue.loc +
          ')' +
          (winVenue.when ? ' – ' + winVenue.when : '')
        : 'TBD'
    }` +
    (winVenue && winVenue.steps && winVenue.steps.length
      ? '\n' + winVenue.steps.map((x) => '   • ' + x).join('\n')
      : '') +
    (winVenue && safeUrl(winVenue.url) ? '\n🔗 ' + safeUrl(winVenue.url) : '') +
    (winVenue
      ? '\n📍 ' + mapsUrl((winVenue.kind === 'combo' ? '' : winVenue.name + ', ') + winVenue.loc)
      : '') +
    `\n📅 ${event.locked ? 'WHEN' : 'ALIGNED'}: ${
      whenList.join(' OR ') || event.when || 'Voting'
    }` +
    `\n💷 KITTY: ${gbp(tot)} total` +
    (owes.length ? `\n💸 SETTLE UP:\n${owes.join('\n')}` : '') +
    (shame.length ? `\n🍺 FIRST ROUND: ${shame.join(', ')} (missed the Veto Bounty)` : '');

  const calSlot = allInSlots.find((s) => whenOf(s));

  const groupLink =
    `${window.location.origin}${window.location.pathname}` +
    (config.db
      ? `?db=${encodeURIComponent(config.db)}&room=${encodeURIComponent(config.rm)}&ev=${encodeURIComponent(
          event.id
        )}`
      : '');

  const fullShareText = config.db ? `${summaryText}\n\n🔗 Live Room: ${groupLink}` : summaryText;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullShareText)}`;

  const handleCopy = async () => {
    const ok = await copyStr(fullShareText);
    const m = ok ? '📋 Copied full summary & link to clipboard!' : "❌ Couldn't copy";
    setMsg(m);
    if (onShowToast) onShowToast(m);
  };

  const handleMessengerShare = async () => {
    await copyStr(fullShareText);
    const m = '📋 Copied summary & link! Paste it into your Messenger chat.';
    setMsg(m);
    if (onShowToast) onShowToast(m);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Pintdr',
          text: summaryText,
          url: config.db ? groupLink : '',
        });
        const m = '✅ Shared summary!';
        setMsg(m);
        if (onShowToast) onShowToast(m);
        return;
      } catch (e: any) {
        if (e.name === 'AbortError') return;
      }
    }
    await handleCopy();
  };

  return (
    <div className="mt-4 bg-card2 border border-line rounded-2xl p-5 transition-all space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-secondary">
          📋 Outing Summary & Settle-Up Sheet
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted hover:text-ink cursor-pointer"
        >
          ✕
        </button>
      </div>

      <textarea
        rows={9}
        readOnly
        value={summaryText}
        className="w-full bg-card border border-line text-ink p-3.5 rounded-xl text-xs font-mono leading-relaxed outline-none"
      />

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer bg-secondary text-secondary-ink font-semibold text-xs px-3.5 py-2 rounded-xl hover:brightness-105 active:scale-95 transition whitespace-nowrap"
        >
          🟢 Share to WhatsApp
        </a>
        <a
          href="https://www.messenger.com/"
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleMessengerShare}
          className="cursor-pointer border border-secondary/40 bg-card text-secondary font-semibold text-xs px-3.5 py-2 rounded-xl hover:border-secondary active:scale-95 transition whitespace-nowrap"
        >
          💬 Share to Messenger
        </a>
        <button
          type="button"
          onClick={handleNativeShare}
          className="cursor-pointer border border-line bg-card text-ink font-semibold text-xs px-3.5 py-2 rounded-xl hover:border-line2 active:scale-95 transition whitespace-nowrap"
        >
          📤 Share / Copy
        </button>
        {calSlot && (
          <button
            type="button"
            onClick={() => downloadIcs(calSlot, winVenue, config)}
            className="cursor-pointer bg-primary text-primary-ink font-semibold text-xs px-3.5 py-2 rounded-xl hover:brightness-105 active:scale-95 transition whitespace-nowrap"
          >
            📅 Download .ics
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer border border-line bg-transparent text-muted font-semibold text-xs px-3 py-2 rounded-xl hover:text-ink transition whitespace-nowrap"
        >
          Close
        </button>
      </div>

      {msg && <div className="text-xs text-secondary">{msg}</div>}
    </div>
  );
};
