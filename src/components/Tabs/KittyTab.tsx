import React, { useState } from 'react';
import { Expense, OutingEvent, User } from '../../types';
import { copyStr, gbp, hasBank, mailOk, payUrl } from '../../utils/storage';
import { calculateLedger, calculateSettlement, who } from '../../utils/kitty';

interface KittyTabProps {
  event: OutingEvent;
  squad: User[];
  currentUser: User | null;
  onUpdateEvent: (ev: OutingEvent) => void;
  onShowToast?: (msg: string) => void;
}

export const KittyTab: React.FC<KittyTabProps> = ({
  event,
  squad,
  currentUser,
  onUpdateEvent,
  onShowToast,
}) => {
  const [showBank, setShowBank] = useState(false);
  const [eTtl, setETtl] = useState('');
  const [eAmt, setEAmt] = useState('');
  const [expFor, setExpFor] = useState<string[] | null>(null); // null = everyone
  const [msg, setMsg] = useState('');
  const [confirmExpId, setConfirmExpId] = useState<string | null>(null);
  const [confirmUndoId, setConfirmUndoId] = useState<string | null>(null);

  const notify = (text: string) => {
    setMsg(text);
    if (onShowToast) onShowToast(text);
  };

  const me = currentUser;
  const { share, tot } = calculateLedger(event, squad);
  const settlements = calculateSettlement(event, squad);

  const handleTogFor = (id: string) => {
    if (id === '*') {
      setExpFor(null);
    } else {
      const f = expFor || squad.map((u) => u.id);
      const next = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
      setExpFor(next.length === squad.length ? null : next);
    }
  };

  const handleAddExpense = () => {
    const t = eTtl.trim();
    const a = Math.round(parseFloat(eAmt) * 100) / 100;
    if (!t || !(a > 0)) {
      notify('⚠️ Enter an item name and amount first');
      return;
    }
    if (!me) {
      notify('👆 Tap your profile in the squad bar above first (or + New Profile)');
      return;
    }

    const f = (expFor || []).filter((id) => who(id, squad));
    if (expFor && !f.length) {
      notify('⚠️ Pick at least one person to split it between');
      return;
    }

    const newExp: Expense = {
      id: 'e' + Date.now(),
      ttl: t,
      amt: a,
      by: me.name,
      byId: me.id,
      ...(expFor ? { for: Object.fromEntries(f.map((i) => [i, 1])) } : {}),
    };

    onUpdateEvent({
      ...event,
      exp: [...event.exp, newExp],
    });

    setETtl('');
    setEAmt('');
    setExpFor(null);
    notify(`🧾 Added "${t}" (${gbp(a)}) to the kitty`);
  };

  const handleDeleteExpense = (id: string) => {
    const e = event.exp.find((x) => x.id === id);
    if (e) {
      const exp = event.exp.filter((x) => x.id !== id);
      onUpdateEvent({ ...event, exp });
      setConfirmExpId(null);
      notify(`🗑️ Removed "${e.ttl}" from kitty`);
    }
  };

  const handleCopyBank = async (userId: string, amt?: number) => {
    const u = who(userId, squad);
    if (!u) return;
    const text = `${u.acn || u.name}\nSort code: ${u.sort}\nAccount: ${u.acc}${
      amt ? `\nAmount: ${gbp(amt)}` : ''
    }\nRef: Pintdr Outing`;

    const ok = await copyStr(text);
    notify(ok ? `🏦 ${u.name}'s bank details copied` : "❌ Couldn't copy");
  };

  const handleMarkPaid = (from: string, to: string, amt: number) => {
    const f = who(from, squad);
    const t = who(to, squad);
    if (!f || !t) return;

    const paidList = event.paid || [];
    const newPaid = {
      id: 'p' + Date.now(),
      from,
      to,
      amt,
      at: Date.now(),
    };

    onUpdateEvent({
      ...event,
      paid: [...paidList, newPaid],
    });

    notify(`✅ Marked ${f.name} → ${t.name} (${gbp(amt)}) as paid`);
  };

  const handleUnpaid = (id: string) => {
    const paid = (event.paid || []).filter((x) => x.id !== id);
    onUpdateEvent({ ...event, paid });
    setConfirmUndoId(null);
    notify('↩️ Undid payment record');
  };

  const everyoneCount = squad.length;

  return (
    <div className="space-y-5">
      {/* Squad Open Bank Mode */}
      <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm sm:text-base font-bold text-[#f4f4f5] font-display">
              🏦 Squad Open Bank Mode
            </div>
            <div className="text-xs text-[#8d8d94] mt-0.5">
              Shared squad payment links, bank sort codes & account details
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowBank(!showBank)}
            className="cursor-pointer bg-[rgba(255,107,87,0.13)] border border-[#ff6b57]/30 text-[#ff6b57] font-semibold text-xs px-3.5 py-2 rounded-xl hover:bg-[rgba(255,107,87,0.2)] transition whitespace-nowrap"
          >
            {showBank ? '🔒 Hide Pay Details' : '🔓 Show Pay Details'}
          </button>
        </div>

        {showBank && (
          <div className="bg-[#212124] border border-[#2b2b2f] rounded-xl p-4 space-y-3">
            <div className="text-xs text-[#ff6b57] font-medium">
              ⚠️ Real pay details — anyone with the group room link can view these.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {squad.map((u) => {
                const link = payUrl(u);
                return (
                  <div
                    key={u.id}
                    className="bg-[#17171a] border border-[#2b2b2f] p-3.5 rounded-xl text-xs space-y-1.5"
                  >
                    <div className="font-bold text-[#f4f4f5]">
                      {u.emo} {u.name} <span className="text-[#8d8d94] font-normal">· {u.pay}</span>
                    </div>

                    {link && (
                      <div className="truncate">
                        🔗{' '}
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#ff6b57] hover:underline"
                        >
                          {link.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                      </div>
                    )}

                    {mailOk(u) && (
                      <div className="truncate">
                        📧{' '}
                        <a href={`mailto:${u.payMail}`} className="text-[#cfcfd4] hover:underline">
                          {u.payMail}
                        </a>
                      </div>
                    )}

                    {hasBank(u) && (
                      <div className="flex items-center justify-between text-[#8d8d94]">
                        <span>
                          🏦 {u.sort} · {u.acc}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyBank(u.id)}
                          className="cursor-pointer text-[11px] bg-[#212124] border border-[#2b2b2f] text-[#f4f4f5] px-2.5 py-0.5 rounded-lg hover:bg-[#2b2b2f]"
                        >
                          Copy
                        </button>
                      </div>
                    )}

                    {!link && !mailOk(u) && !hasBank(u) && (
                      <div className="text-[#8d8d94]">No pay details added yet</div>
                    )}

                    {u.tx && (
                      <div className="text-[#cfcfd4] pt-0.5 text-[11px] italic">
                        Latest: {u.tx}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Expense Kitty */}
      <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-[#f4f4f5] font-display">🧾 Expense Kitty</div>
            <div className="text-xs text-[#8d8d94] mt-0.5">
              Log rounds, tickets, and Ubers to split fairly across the squad
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-[#ff6b57]">Total {gbp(tot)}</div>
            {me && (
              <div className="text-[11px] text-[#8d8d94]">
                Your share {gbp(share[me.id] || 0)}
              </div>
            )}
          </div>
        </div>

        {/* Expenses List */}
        {event.exp.length > 0 && (
          <div className="space-y-2">
            {event.exp.map((e) => {
              const payer = who(e.byId || '', squad) || squad.find((u) => u.name === e.by);
              const splitMembers = Object.keys(e.for || {}).filter(
                (i) => e.for?.[i] && who(i, squad)
              );
              const forTxt =
                splitMembers.length > 0 && splitMembers.length < everyoneCount
                  ? ' · for ' + splitMembers.map((i) => who(i, squad)?.name).join(', ')
                  : '';

              return (
                <div
                  key={e.id}
                  className="flex items-center justify-between text-xs bg-[#212124] border border-[#2b2b2f] px-3.5 py-2.5 rounded-xl text-[#8d8d94]"
                >
                  <span>
                    <b className="text-[#f4f4f5]">{e.ttl}</b> · paid by {payer?.name || e.by}
                    {forTxt}
                  </span>
                  <span className="flex items-center gap-2.5">
                    <b className="text-[#c6ff3d]">{gbp(e.amt)}</b>
                    {confirmExpId === e.id ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(e.id)}
                          className="cursor-pointer bg-[#ff6b57] text-[#1a0703] font-semibold text-[11px] px-2 py-0.5 rounded-md"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmExpId(null)}
                          className="cursor-pointer bg-[#17171a] border border-[#2b2b2f] text-[#cfcfd4] text-[11px] px-1.5 py-0.5 rounded-md"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmExpId(e.id)}
                        className="cursor-pointer text-xs text-[#8d8d94] hover:text-[#ff6b57]"
                        title="Remove expense"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Expense Form */}
        <div className="space-y-3 pt-2 border-t border-[#2b2b2f]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={eTtl}
              onChange={(e) => setETtl(e.target.value)}
              placeholder="Item (e.g. Uber XL, First Round)"
              className="bg-[#212124] border border-[#2b2b2f] focus:border-[#ff6b57] text-[#f4f4f5] px-3.5 py-2.5 rounded-xl text-xs outline-none"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={eAmt}
              onChange={(e) => setEAmt(e.target.value)}
              placeholder="£ Amount"
              className="bg-[#212124] border border-[#2b2b2f] focus:border-[#ff6b57] text-[#f4f4f5] px-3.5 py-2.5 rounded-xl text-xs outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-xs text-[#8d8d94]">Split between:</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleTogFor('*')}
                className={`cursor-pointer font-semibold text-xs px-3 py-1.5 rounded-lg transition ${
                  !expFor
                    ? 'bg-[rgba(198,255,61,0.18)] text-[#c6ff3d] border border-[#c6ff3d]'
                    : 'border border-[#2b2b2f] bg-[#212124] text-[#8d8d94]'
                }`}
              >
                👥 Everyone
              </button>
              {squad.map((u) => {
                const isIncluded = !expFor || expFor.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleTogFor(u.id)}
                    className={`cursor-pointer font-semibold text-xs px-3 py-1.5 rounded-lg transition ${
                      expFor && isIncluded
                        ? 'bg-[rgba(198,255,61,0.18)] text-[#c6ff3d] border border-[#c6ff3d]'
                        : 'border border-[#2b2b2f] bg-[#212124] text-[#8d8d94]'
                    }`}
                  >
                    {u.emo} {u.name}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddExpense}
            className="w-full cursor-pointer bg-[rgba(198,255,61,0.12)] border border-[#c6ff3d]/30 text-[#c6ff3d] font-semibold text-xs px-4 py-2.5 rounded-xl hover:bg-[rgba(198,255,61,0.2)] active:scale-95 transition"
          >
            + Add Expense
          </button>
        </div>
      </div>

      {/* Settle Up */}
      <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-5 space-y-4">
        <div>
          <div className="text-sm font-bold text-[#f4f4f5] font-display">🤝 Settle Up</div>
          <div className="text-xs text-[#8d8d94] mt-0.5">
            Simplified minimum-transfer breakdown so everyone gets squared up fast
          </div>
        </div>

        <div className="space-y-3">
          {settlements.length ? (
            settlements.map((t, idx) => {
              const f = who(t.from, squad);
              const c = who(t.to, squad);
              if (!f || !c) return null;
              const link = payUrl(c, t.amt);
              const isPayerMe = me && t.from === me.id;

              return (
                <div
                  key={idx}
                  className={`bg-[#212124] border rounded-xl p-4 space-y-3 ${
                    isPayerMe ? 'border-[#ff6b57]' : 'border-[#2b2b2f]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#f4f4f5]">
                      <b>
                        {f.emo} {f.name}
                      </b>
                      {isPayerMe && ' (you)'} →{' '}
                      <b>
                        {c.emo} {c.name}
                      </b>
                    </span>
                    <b className="text-[#ff6b57] text-sm">{gbp(t.amt)}</b>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cursor-pointer bg-[rgba(198,255,61,0.12)] border border-[#c6ff3d]/30 text-[#c6ff3d] font-semibold text-xs px-3 py-1.5 rounded-lg hover:bg-[rgba(198,255,61,0.2)] transition"
                      >
                        💸 Pay {gbp(t.amt)}
                      </a>
                    )}
                    {mailOk(c) && (
                      <a
                        href={`mailto:${c.payMail}?subject=${encodeURIComponent(
                          'Pintdr – ' + gbp(t.amt)
                        )}`}
                        className="cursor-pointer border border-[#2b2b2f] bg-[#17171a] text-[#f4f4f5] font-semibold text-xs px-3 py-1.5 rounded-lg hover:border-[#3b3b40] transition"
                      >
                        📧 Email
                      </a>
                    )}
                    {hasBank(c) && (
                      <button
                        type="button"
                        onClick={() => handleCopyBank(c.id, t.amt)}
                        className="cursor-pointer border border-[#2b2b2f] bg-[#17171a] text-[#f4f4f5] font-semibold text-xs px-3 py-1.5 rounded-lg hover:border-[#3b3b40] transition"
                      >
                        🏦 Copy bank details
                      </button>
                    )}
                    {!link && !mailOk(c) && !hasBank(c) && (
                      <span className="text-xs text-[#8d8d94]">
                        {c.name} hasn't added pay details – nudge them to ✏️ Edit Me
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleMarkPaid(t.from, t.to, t.amt)}
                      className="cursor-pointer border border-[#2b2b2f] bg-[#17171a] text-[#c6ff3d] font-semibold text-xs px-3 py-1.5 rounded-lg hover:border-[#3b3b40] transition"
                    >
                      ✅ Mark paid
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-[#212124] border border-[#2b2b2f] rounded-xl p-4 text-xs text-[#c6ff3d]">
              ✅ All square — nobody owes anything right now!
            </div>
          )}
        </div>

        {/* Paid so far list */}
        {event.paid && event.paid.length > 0 && (
          <div className="pt-3 border-t border-[#2b2b2f] space-y-2">
            <div className="text-xs font-medium text-[#8d8d94]">Paid so far:</div>
            <div className="space-y-1.5">
              {event.paid.map((x) => {
                const f = who(x.from, squad);
                const t = who(x.to, squad);
                if (!f || !t) return null;
                const dateStr = new Date(x.at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                });
                return (
                  <div
                    key={x.id}
                    className="flex items-center justify-between text-xs bg-[#212124] border border-[#2b2b2f] px-3 py-2 rounded-lg text-[#8d8d94]"
                  >
                    <span>
                      ✅ {f.name} paid {t.name} <b className="text-[#f4f4f5]">{gbp(x.amt)}</b> · {dateStr}
                    </span>
                    {confirmUndoId === x.id ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUnpaid(x.id)}
                          className="cursor-pointer bg-[#ff6b57] text-[#1a0703] font-semibold text-[11px] px-2 py-0.5 rounded-md"
                        >
                          Confirm Undo
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmUndoId(null)}
                          className="cursor-pointer bg-[#17171a] border border-[#2b2b2f] text-[#cfcfd4] text-[11px] px-1.5 py-0.5 rounded-md"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmUndoId(x.id)}
                        className="cursor-pointer text-xs bg-[#17171a] border border-[#2b2b2f] text-[#cfcfd4] hover:text-[#ff6b57] px-2.5 py-0.5 rounded-md"
                      >
                        Undo
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {msg && <div className="text-xs text-[#c6ff3d]">{msg}</div>}
      </div>
    </div>
  );
};
