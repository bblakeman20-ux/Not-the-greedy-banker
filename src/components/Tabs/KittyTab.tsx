import React, { useState } from 'react';
import { Expense, OutingEvent, User } from '../../types';
import { copyStr, gbp, hasBank, mailOk, payUrl } from '../../utils/storage';
import { calculateLedger, calculateSettlement, who } from '../../utils/kitty';
import { PayChangeWarning } from '../PayChangeWarning';

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
      <div className="bg-card border border-line rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm sm:text-base font-bold text-ink font-display">
              🏦 Squad Open Bank Mode
            </div>
            <div className="text-xs text-muted mt-0.5">
              Shared squad payment links, bank sort codes & account details
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowBank(!showBank)}
            className="cursor-pointer bg-[color-mix(in_oklab,var(--accent)_13%,transparent)] border border-primary/30 text-primary font-semibold text-xs px-3.5 py-2 rounded-xl hover:bg-[color-mix(in_oklab,var(--accent)_20%,transparent)] transition whitespace-nowrap"
          >
            {showBank ? '🔒 Hide Pay Details' : '🔓 Show Pay Details'}
          </button>
        </div>

        {showBank && (
          <div className="bg-card2 border border-line rounded-xl p-4 space-y-3">
            <div className="text-xs text-primary font-medium">
              ⚠️ Real pay details — anyone with the group room link can view these. Pay links (Monzo, PayPal, Revolut) are the safest way to get paid.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {squad.map((u) => {
                const link = payUrl(u);
                return (
                  <div
                    key={u.id}
                    className="bg-card border border-line p-3.5 rounded-xl text-xs space-y-1.5"
                  >
                    <div className="font-bold text-ink">
                      {u.emo} {u.name} <span className="text-muted font-normal">· {u.pay}</span>
                    </div>
                    <PayChangeWarning user={u} squad={squad} />

                    {link && (
                      <div className="truncate">
                        🔗{' '}
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {link.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                      </div>
                    )}

                    {mailOk(u) && (
                      <div className="truncate">
                        📧{' '}
                        <a href={`mailto:${u.payMail}`} className="text-ink2 hover:underline">
                          {u.payMail}
                        </a>
                      </div>
                    )}

                    {hasBank(u) && (
                      <div className="flex items-center justify-between text-muted">
                        <span>
                          🏦 {u.sort} · {u.acc}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyBank(u.id)}
                          className="cursor-pointer text-[11px] bg-card2 border border-line text-ink px-2.5 py-0.5 rounded-lg hover:bg-line"
                        >
                          Copy
                        </button>
                      </div>
                    )}

                    {!link && !mailOk(u) && !hasBank(u) && (
                      <div className="text-muted">No pay details added yet</div>
                    )}

                    {u.tx && (
                      <div className="text-ink2 pt-0.5 text-[11px] italic">
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
      <div className="bg-card border border-line rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-ink font-display">🧾 Expense Kitty</div>
            <div className="text-xs text-muted mt-0.5">
              Log rounds, tickets, and Ubers to split fairly across the squad
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-primary">Total {gbp(tot)}</div>
            {me && (
              <div className="text-[11px] text-muted">
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
                  className="flex items-center justify-between text-xs bg-card2 border border-line px-3.5 py-2.5 rounded-xl text-muted"
                >
                  <span>
                    <b className="text-ink">{e.ttl}</b> · paid by {payer?.name || e.by}
                    {forTxt}
                  </span>
                  <span className="flex items-center gap-2.5">
                    <b className="text-secondary">{gbp(e.amt)}</b>
                    {confirmExpId === e.id ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(e.id)}
                          className="cursor-pointer bg-primary text-primary-ink font-semibold text-[11px] px-2 py-0.5 rounded-md"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmExpId(null)}
                          className="cursor-pointer bg-card border border-line text-ink2 text-[11px] px-1.5 py-0.5 rounded-md"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmExpId(e.id)}
                        className="cursor-pointer text-xs text-muted hover:text-primary"
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
        <div className="space-y-3 pt-2 border-t border-line">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={eTtl}
              onChange={(e) => setETtl(e.target.value)}
              placeholder="Item (e.g. Uber XL, First Round)"
              className="bg-card2 border border-line focus:border-primary text-ink px-3.5 py-2.5 rounded-xl text-xs outline-none"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={eAmt}
              onChange={(e) => setEAmt(e.target.value)}
              placeholder="£ Amount"
              className="bg-card2 border border-line focus:border-primary text-ink px-3.5 py-2.5 rounded-xl text-xs outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-xs text-muted">Split between:</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleTogFor('*')}
                className={`cursor-pointer font-semibold text-xs px-3 py-1.5 rounded-lg transition ${
                  !expFor
                    ? 'bg-[color-mix(in_oklab,var(--good)_18%,transparent)] text-secondary border border-secondary'
                    : 'border border-line bg-card2 text-muted'
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
                        ? 'bg-[color-mix(in_oklab,var(--good)_18%,transparent)] text-secondary border border-secondary'
                        : 'border border-line bg-card2 text-muted'
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
            className="w-full cursor-pointer bg-[color-mix(in_oklab,var(--good)_12%,transparent)] border border-secondary/30 text-secondary font-semibold text-xs px-4 py-2.5 rounded-xl hover:bg-[color-mix(in_oklab,var(--good)_20%,transparent)] active:scale-95 transition"
          >
            + Add Expense
          </button>
        </div>
      </div>

      {/* Settle Up */}
      <div className="bg-card border border-line rounded-2xl p-5 space-y-4">
        <div>
          <div className="text-sm font-bold text-ink font-display">🤝 Settle Up</div>
          <div className="text-xs text-muted mt-0.5">
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
                  className={`bg-card2 border rounded-xl p-4 space-y-3 ${
                    isPayerMe ? 'border-primary' : 'border-line'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink">
                      <b>
                        {f.emo} {f.name}
                      </b>
                      {isPayerMe && ' (you)'} →{' '}
                      <b>
                        {c.emo} {c.name}
                      </b>
                    </span>
                    <b className="text-primary text-sm">{gbp(t.amt)}</b>
                  </div>
                  <PayChangeWarning user={c} squad={squad} />

                  <div className="flex flex-wrap items-center gap-2">
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cursor-pointer bg-[color-mix(in_oklab,var(--good)_12%,transparent)] border border-secondary/30 text-secondary font-semibold text-xs px-3 py-1.5 rounded-lg hover:bg-[color-mix(in_oklab,var(--good)_20%,transparent)] transition"
                      >
                        💸 Pay {gbp(t.amt)}
                      </a>
                    )}
                    {mailOk(c) && (
                      <a
                        href={`mailto:${c.payMail}?subject=${encodeURIComponent(
                          'Pintdr – ' + gbp(t.amt)
                        )}`}
                        className="cursor-pointer border border-line bg-card text-ink font-semibold text-xs px-3 py-1.5 rounded-lg hover:border-line2 transition"
                      >
                        📧 Email
                      </a>
                    )}
                    {hasBank(c) && (
                      <button
                        type="button"
                        onClick={() => handleCopyBank(c.id, t.amt)}
                        className="cursor-pointer border border-line bg-card text-ink font-semibold text-xs px-3 py-1.5 rounded-lg hover:border-line2 transition"
                      >
                        🏦 Copy bank details
                      </button>
                    )}
                    {!link && !mailOk(c) && !hasBank(c) && (
                      <span className="text-xs text-muted">
                        {c.name} hasn't added pay details – nudge them to ✏️ Edit Me
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleMarkPaid(t.from, t.to, t.amt)}
                      className="cursor-pointer border border-line bg-card text-secondary font-semibold text-xs px-3 py-1.5 rounded-lg hover:border-line2 transition"
                    >
                      ✅ Mark paid
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-card2 border border-line rounded-xl p-4 text-xs text-secondary">
              ✅ All square — nobody owes anything right now!
            </div>
          )}
        </div>

        {/* Paid so far list */}
        {event.paid && event.paid.length > 0 && (
          <div className="pt-3 border-t border-line space-y-2">
            <div className="text-xs font-medium text-muted">Paid so far:</div>
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
                    className="flex items-center justify-between text-xs bg-card2 border border-line px-3 py-2 rounded-lg text-muted"
                  >
                    <span>
                      ✅ {f.name} paid {t.name} <b className="text-ink">{gbp(x.amt)}</b> · {dateStr}
                    </span>
                    {confirmUndoId === x.id ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUnpaid(x.id)}
                          className="cursor-pointer bg-primary text-primary-ink font-semibold text-[11px] px-2 py-0.5 rounded-md"
                        >
                          Confirm Undo
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmUndoId(null)}
                          className="cursor-pointer bg-card border border-line text-ink2 text-[11px] px-1.5 py-0.5 rounded-md"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmUndoId(x.id)}
                        className="cursor-pointer text-xs bg-card border border-line text-ink2 hover:text-primary px-2.5 py-0.5 rounded-md"
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

        {msg && <div className="text-xs text-secondary">{msg}</div>}
      </div>
    </div>
  );
};
