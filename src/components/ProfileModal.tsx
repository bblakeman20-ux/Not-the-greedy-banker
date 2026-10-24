import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { mailOk, payUrl } from '../utils/storage';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSave: (data: Partial<User>, isEdit: boolean) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onSave,
  onDelete,
  canDelete,
}) => {
  const isEdit = Boolean(user);
  const [name, setName] = useState('');
  const [emo, setEmo] = useState('🍺');
  const [loc, setLoc] = useState('Medway');
  const [pay, setPay] = useState('Monzo');
  const [payLink, setPayLink] = useState('');
  const [payMail, setPayMail] = useState('');
  const [acn, setAcn] = useState('');
  const [sort, setSort] = useState('');
  const [acc, setAcc] = useState('');
  const [tx, setTx] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmo(user.emo || '🍺');
      setLoc(user.loc || 'Medway');
      setPay(user.pay || 'Monzo');
      setPayLink(user.payLink || '');
      setPayMail(user.payMail || '');
      setAcn(user.acn || '');
      setSort(user.sort || '');
      setAcc(user.acc || '');
      setTx(user.tx || '');
    } else {
      setName('');
      setEmo('🍺');
      setLoc('Medway');
      setPay('Monzo');
      setPayLink('');
      setPayMail('');
      setAcn('');
      setSort('');
      setAcc('');
      setTx('');
    }
    setMsg('');
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const cleanName = name.trim();
    if (!cleanName) {
      setMsg('⚠️ Add your name');
      return;
    }

    const dig = (s: string) => s.replace(/\D/g, '');
    let cleanSort = dig(sort);
    const cleanAcc = dig(acc);

    const d: Partial<User> = {
      name: cleanName,
      emo: emo.trim() || '🍺',
      loc: loc.trim() || 'Local',
      pay: pay.trim() || 'Monzo',
      payLink: payLink.trim(),
      payMail: payMail.trim(),
      acn: acn.trim(),
      sort: cleanSort,
      acc: cleanAcc,
      tx: tx.trim(),
    };

    if (d.payLink && !payUrl(d)) {
      setMsg("⚠️ That pay link doesn't look like a web link");
      return;
    }
    if (d.payMail && !mailOk(d)) {
      setMsg("⚠️ That email doesn't look right");
      return;
    }
    if (d.sort && d.sort.length !== 6) {
      setMsg('⚠️ Sort code should be 6 digits');
      return;
    }
    if (d.acc && d.acc.length !== 8) {
      setMsg('⚠️ Account number should be 8 digits');
      return;
    }
    if (d.sort) {
      d.sort = d.sort.replace(/(\d\d)(\d\d)(\d\d)/, '$1-$2-$3');
    }

    onSave(d, isEdit);
    onClose();
  };

  const handleDelete = () => {
    if (!user) return;
    if (window.confirm(`Delete ${user.name}'s profile?`)) {
      onDelete(user.id);
      onClose();
    }
  };

  return (
    <div className="mt-3 bg-[#212124] border border-[#2b2b2f] rounded-2xl p-4 transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-[#ff6b57]">
          {isEdit ? `👤 Edit ${user?.name}` : '👤 New Profile'}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[#8d8d94] hover:text-[#f4f4f5] cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="text-[11px] text-[#8d8d94] block mb-0.5">Your Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              className="w-full bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-[#8d8d94] block mb-0.5">Emoji</label>
            <input
              value={emo}
              onChange={(e) => setEmo(e.target.value)}
              placeholder="Emoji (🍺 🕵️‍♂️ 🧬)"
              className="w-full bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-[#8d8d94] block mb-0.5">Station / Town</label>
            <input
              value={loc}
              onChange={(e) => setLoc(e.target.value)}
              placeholder="e.g. Chatham"
              className="w-full bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-[#8d8d94] block mb-0.5">Pay way</label>
            <input
              value={pay}
              onChange={(e) => setPay(e.target.value)}
              placeholder="Monzo / Revolut"
              className="w-full bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-[#ff6b57] mt-1 mb-1">
            💳 How to pay you (all optional)
          </div>
          <input
            value={payLink}
            onChange={(e) => setPayLink(e.target.value)}
            placeholder="Pay link (monzo.me/you, paypal.me/you, revolut.me/you)"
            className="w-full bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="text-[11px] text-[#8d8d94] block mb-0.5">PayPal Email</label>
            <input
              type="email"
              value={payMail}
              onChange={(e) => setPayMail(e.target.value)}
              placeholder="Payment email"
              className="w-full bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-[#8d8d94] block mb-0.5">Account Name</label>
            <input
              value={acn}
              onChange={(e) => setAcn(e.target.value)}
              placeholder="Account name"
              className="w-full bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-[#8d8d94] block mb-0.5">Sort Code</label>
            <input
              inputMode="numeric"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              placeholder="12-34-56"
              className="w-full bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-[#8d8d94] block mb-0.5">Account No.</label>
            <input
              inputMode="numeric"
              value={acc}
              onChange={(e) => setAcc(e.target.value)}
              placeholder="8 digits"
              className="w-full bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] text-[#8d8d94] block mb-0.5">
            😈 Roast line for your pay card (optional)
          </label>
          <input
            value={tx}
            onChange={(e) => setTx(e.target.value)}
            placeholder="e.g. Still owes for 2019 Uber"
            className="w-full bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
          />
        </div>

        <div className="text-[11px] text-[#ff6b57]">
          ⚠️ Anyone with the group link can see these. A pay link is safer than account numbers.
        </div>

        {msg && <div className="text-xs text-[#ff6b57]">{msg}</div>}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleSave}
            className="cursor-pointer bg-[rgba(198,255,61,0.12)] text-[#c6ff3d] font-semibold text-xs px-3.5 py-2 rounded-xl hover:bg-[rgba(198,255,61,0.2)] active:scale-95 transition"
          >
            ✅ Save
          </button>
          {isEdit && canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="cursor-pointer bg-[rgba(255,107,87,0.13)] text-[#ff6b57] font-semibold text-xs px-3.5 py-2 rounded-xl hover:bg-[rgba(255,107,87,0.2)] transition"
            >
              🗑️ Delete
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border border-[#2b2b2f] bg-transparent text-[#8d8d94] font-semibold text-xs px-3 py-2 rounded-xl hover:text-[#f4f4f5] transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
