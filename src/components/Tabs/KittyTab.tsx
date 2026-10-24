import React, { useState } from 'react';
import { Expense, OutingEvent, User } from '../../types';
import { copyStr, gbp, hasBank, mailOk, payUrl } from '../../utils/storage';
import { calculateLedger, calculateSettlement, who } from '../../utils/kitty';

interface KittyTabProps {
  event: OutingEvent;
  squad: User[];
  currentUser: User | null;
  onUpdateEvent: (ev: OutingEvent) => void;
}

export const KittyTab: React.FC<KittyTabProps> = ({
  event,
  squad,
  currentUser,
  onUpdateEvent,
}) => {
  const [showBank, setShowBank] = useState(false);
  const [eTtl, setETtl] = useState('');
  const [eAmt, setEAmt] = useState('');
  const [expFor, setExpFor] = useState<string[] | null>(null); // null = everyone
  const [msg, setMsg] = useState('');

  const me = currentUser;
  const { bal, share, tot } = calculateLedger(event, squad);
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
    if (!t || !(a > 0)) return;
    if (!me) {
      alert('👆 Tap your profile first (or + New Profile)');
      return;
    }

    const f = (expFor || []).filter((id) => who(id, squad));
    if (expFor && !f.length) {
      alert('Pick at least one person to split it between');
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
  };

  const handleDeleteExpense = (id: string) => {
    const e = event.exp.find((x) => x.id === id);
    if (e && window.confirm(`Remove "${e.ttl}"?`)) {
      const exp = event.exp.filter((x) => x.id !== id);
      onUpdateEvent({ ...event, exp });
    }
  };

  const handleCopyBank = async (userId: string, amt?: number) => {
    const u = who(userId, squad);
    if (!u) return;
    const text = `${u.acn || u.name}\nSort code: ${u.sort}\nAccount: ${u.acc}${
      amt ? `\nAmount: ${gbp(amt)}` : ''
    }\nRef: Greedy Banker`;

    const ok = await copyStr(text);
    setMsg(ok ? `🏦 ${u.name}'s bank details copied` : "❌ Couldn't copy");
  };

  const handleMarkPaid = (from: string, to: string, amt: number) => {
    const f = who(from, squad);
    const t = who(to, squad);
    if (!f || !t) return;
    if (!window.confirm(`Mark ${gbp(amt)} from ${f.name} to ${t.name} as paid?`)) return;

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

    setMsg(`✅ ${f.name} → ${t.name} marked paid`);
  };

  const handleUnpaid = (id: string) => {
    if (window.confirm('Undo this payment?')) {
      const paid = (event.paid || []).filter((x) => x.id !== id);
      onUpdateEvent({ ...event, paid });
    }
  };

  const everyoneCount = squad.length;

  return (
    <div className="space-y-3">
      {/* Sherlock's Open Bank Mode */}
      <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-bold text-[#f4f4f5] font-display">
              🏦 Sherlock's Open Bank Mode
            </div>
            <div className="text-xs text-[#8d8d94]">"Link in bank details & expenses"</div>
          </div>
          <button
            type="button"
            onClick={() => setShowBank(!showBank)}
            className="cursor-pointer bg-[rgba(255,107,87,0.13)] text-[#ff6b57] font-semibold text-xs px-3.5 py-2 rounded-xl hover:bg-[rgba(255,107,87,0.2)] transition"
          >
            {showBank ? '🔒 Hide Pay Details' : '🔓 Show Pay Details'}
          </button>
        </div>

        {showBank && (
          <div className="mt-3 bg-[#212124] border border-[#2b2b2f] rounded-2xl p-3.5">
            <div className="text-xs text-[#ff6b57] mb-2 font-medium">
              ⚠️ ROAST ALERT: real pay details — anyone with the group link can see these!
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {squad.map((u) => {
                const link = payUrl(u);
                return (
                  <div
                    key={u.id}
                    className="bg-[#17171a] border border-[#2b2b2f] p-3 rounded-xl text-xs space-y-1"
                  >
                    <div className="font-bold text-[#f4f4f5]">
                      {u.emo} {u.name} <span className="text-[#8d8d94]">({u.pay})</span>
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
                          🏦 {u.sort} • {u.acc}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyBank(u.id)}
                          className="cursor-pointer text-[11px] bg-[#212124] text-[#f4f4f5] px-2 py-0.5 rounded-lg hover:bg-[#2b2b2f]"
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
      <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-4">
        <div className="text-xs font-bold text-[#f4f4f5] mb-2">🧾 Expense Kitty</div>

        {/* Expenses List */}
        <div className="space-y-1.5 mb-3">
          {event.exp.map((e) => {
            const payer = who(e.byId || '', squad) || squad.find((u) => u.name === e.by);
            const splitMembers = Object.keys(e.for || {}).filter(
              (i) => e.for?.[i] && who(i, squad)
            );
            const forTxt =
              splitMembers.length > 0 && splitMembers.length < everyoneCount
                ? ' • for ' + splitMembers.map((i) => who(i, squad)?.name).join(', ')
                : '';

            return (
              <div
                key={e.id}
                className="flex items-center justify-between text-xs py-1 text-[#8d8d94]"
              >
                <span>
                  <b className="text-[#f4f4f5]">{e.ttl}</b> ({payer?.name || e.by}
                  {forTxt})
                </span>
                <span className="flex items-center gap-2">
                  <b className="text-[#c6ff3d]">{gbp(e.amt)}</b>
                  <button
                    type="button"
                    onClick={() => handleDeleteExpense(e.id)}
                    className="cursor-pointer text-xs text-[#8d8d94] hover:text-[#ff6b57]"
                  >
                    ✕
                  </button>
                </span>
              </div>
            );
          })}
        </div>

        {/* Total & Share summary */}
        <div className="flex items-center justify-between border-t border-[#2b2b2f] pt-2 mb-3 text-xs text-[#ff6b57] font-bold">
          <span>Total {gbp(tot)}</span>
          {me && <span>Your share {gbp(share[me.id] || 0)}</span>}
        </div>

        {/* Add Expense Form */}
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              value={eTtl}
              onChange={(e) => setETtl(e.target.value)}
              placeholder="Item (e.g. Uber XL)"
              className="bg-[#212124] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={eAmt}
              onChange={(e) => setEAmt(e.target.value)}
              placeholder="£ Amount"
              className="bg-[#212124] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
          </div>

          <div className="text-xs text-[#8d8d94]">Split between:</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button
              type="button"
              onClick={() => handleTogFor('*')}
              className={`cursor-pointer font-semibold text-xs px-2.5 py-1 rounded-lg transition ${
                !expFor
                  ? 'bg-[rgba(198,255,61,0.2)] text-[#c6ff3d] border border-[#c6ff3d]'
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
                  className={`cursor-pointer font-semibold text-xs px-2.5 py-1 rounded-lg transition ${
                    expFor && isIncluded
                      ? 'bg-[rgba(198,255,61,0.2)] text-[#c6ff3d] border border-[#c6ff3d]'
                      : 'border border-[#2b2b2f] bg-[#212124] text-[#8d8d94]'
                  }`}
                >
                  {u.emo} {u.name}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleAddExpense}
            className="w-full cursor-pointer bg-[rgba(198,255,61,0.12)] text-[#c6ff3d] font-semibold text-xs px-3.5 py-2.5 rounded-xl hover:bg-[rgba(198,255,61,0.2)] active:scale-95 transition"
          >
            + Add Expense
          </button>
        </div>
      </div>

      {/* Settle Up */}
      <div className="bg-[#17171a] border border-[#2b2b2f] rounded-2xl p-4">
        <div className="text-xs font-bold text-[#f4f4f5] mb-2">🤝 Settle Up</div>

        <div className="space-y-2">
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
                  className={`bg-[#212124] border rounded-2xl p-3.5 ${
                    isPayerMe ? 'border-[#ff6b57]' : 'border-[#2b2b2f]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
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

                  <div className="flex flex-wrap items-center gap-1.5">
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cursor-pointer bg-[rgba(198,255,61,0.12)] text-[#c6ff3d] font-semibold text-xs px-3 py-1.5 rounded-xl hover:bg-[rgba(198,255,61,0.2)] transition"
                      >
                        💸 Pay {gbp(t.amt)}
                      </a>
                    )}
                    {mailOk(c) && (
                      <a
                        href={`mailto:${c.payMail}?subject=${encodeURIComponent(
                          'Not The Greedy Banker – ' + gbp(t.amt)
                        )}`}
                        className="cursor-pointer border border-[#2b2b2f] bg-[#17171a] text-[#f4f4f5] font-semibold text-xs px-3 py-1.5 rounded-xl hover:border-[#3b3b40] transition"
                      >
                        📧 Email
                      </a>
                    )}
                    {hasBank(c) && (
                      <button
                        type="button"
                        onClick={() => handleCopyBank(c.id, t.amt)}
                        className="cursor-pointer border border-[#2b2b2f] bg-[#17171a] text-[#f4f4f5] font-semibold text-xs px-3 py-1.5 rounded-xl hover:border-[#3b3b40] transition"
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
                      className="cursor-pointer border border-[#2b2b2f] bg-[#17171a] text-[#c6ff3d] font-semibold text-xs px-3 py-1.5 rounded-xl hover:border-[#3b3b40] transition"
                    >
                      ✅ Mark paid
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-xs text-[#c6ff3d]">✅ All square!</div>
          )}
        </div>

        {/* Paid so far list */}
        {event.paid && event.paid.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-[#2b2b2f]">
            <div className="text-xs text-[#8d8d94] mb-1.5">Paid so far:</div>
            <div className="space-y-1">
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
                    className="flex items-center justify-between text-xs py-1 text-[#8d8d94]"
                  >
                    <span>
                      ✅ {f.name} paid {t.name} <b className="text-[#f4f4f5]">{gbp(x.amt)}</b> • {dateStr}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUnpaid(x.id)}
                      className="cursor-pointer text-xs bg-[#212124] text-[#cfcfd4] hover:text-[#ff6b57] px-2 py-0.5 rounded-md"
                    >
                      Undo
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {msg && <div className="text-xs text-[#c6ff3d] mt-2">{msg}</div>}
      </div>
    </div>
  );
};
