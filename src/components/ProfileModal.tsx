import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { mailOk, payUrl, getSavedUserProfile } from '../utils/storage';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSave: (data: Partial<User>, isEdit: boolean) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
  onPitchHouse?: (user: User) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onSave,
  onDelete,
  canDelete,
  onPitchHouse,
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
  const [offersHouse, setOffersHouse] = useState(false);
  const [houseNote, setHouseNote] = useState('');
  const [msg, setMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmo(user.emo || '🍺');
      setLoc(user.loc || 'Medway');
      setPay(user.pay || 'Monzo');
      setPayLink(user.payLink || '');
      setPayMail(user.payMail || '');
      setAcn(user.acn || '');
      setSort(user.sort ? String(user.sort) : '');
      setAcc(user.acc ? String(user.acc) : '');
      setTx(user.tx || '');
      setOffersHouse(Boolean(user.offersHouse));
      setHouseNote(user.houseNote || '');
    } else {
      const saved = getSavedUserProfile();
      setName(saved?.name || '');
      setEmo(saved?.emo || '🍺');
      setLoc(saved?.loc || 'Local');
      setPay(saved?.pay || 'Monzo');
      setPayLink(saved?.payLink || '');
      setPayMail(saved?.payMail || '');
      setAcn(saved?.acn || '');
      setSort(saved?.sort ? String(saved.sort) : '');
      setAcc(saved?.acc ? String(saved.acc) : '');
      setTx(saved?.tx || '');
      setOffersHouse(Boolean(saved?.offersHouse));
      setHouseNote(saved?.houseNote || '');
    }
    setMsg('');
    setConfirmDelete(false);
  }, [user, isOpen]);

  const handleSave = () => {
    const cleanName = name.trim();
    if (!cleanName) {
      setMsg('⚠️ Add your name');
      return;
    }

    const dig = (s: any) => String(s || '').replace(/\D/g, '');
    let cleanSort = dig(sort);
    const cleanAcc = dig(acc);

    const d: Partial<User> = {
      ...(user?.id ? { id: user.id } : {}),
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
      offersHouse,
      houseNote: houseNote.trim(),
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
    onDelete(user.id);
    setConfirmDelete(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="mt-4 bg-[#212124] border border-[#2b2b2f] rounded-2xl p-5 transition-all space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-[#ff6b57] flex items-center gap-1.5">
          <span className="text-base leading-none">{emo || '👤'}</span>
          <span>{isEdit ? `Edit ${user?.name || name}` : 'New Profile'}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[#8d8d94] hover:text-[#f4f4f5] cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div>
            <label className="text-[11px] text-[#8d8d94] block mb-1">Your Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              className="w-full bg-[#17171a] border border-[#2b2b2f] focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-[#8d8d94] block mb-1">Emoji Avatar</label>
            <div className="flex items-center gap-2">
              <span
                className="w-8 h-8 rounded-xl bg-[#17171a] border border-[#ff6b57]/50 flex items-center justify-center text-lg leading-none shrink-0 shadow-inner select-none"
                role="img"
                aria-label="Selected emoji"
              >
                {emo || '🍺'}
              </span>
              <input
                value={emo}
                onChange={(e) => setEmo(e.target.value)}
                placeholder="🍺"
                className="w-full bg-[#17171a] border border-[#2b2b2f] focus:border-[#ff6b57] text-[#f4f4f5] px-2.5 py-2 rounded-xl text-xs outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-[#8d8d94] block mb-1">Station / Town</label>
            <input
              value={loc}
              onChange={(e) => setLoc(e.target.value)}
              placeholder="e.g. Chatham"
              className="w-full bg-[#17171a] border border-[#2b2b2f] focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-[#8d8d94] block mb-1">Pay way</label>
            <input
              value={pay}
              onChange={(e) => setPay(e.target.value)}
              placeholder="Monzo / Revolut"
              className="w-full bg-[#17171a] border border-[#2b2b2f] focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
          </div>
        </div>

        {/* Quick Emoji Avatar Selector Palette */}
        <div className="bg-[#17171a] border border-[#2b2b2f] rounded-xl p-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-[#8d8d94]">
            <span>Tap to choose an avatar emoji:</span>
            <span className="text-[#ff6b57] font-semibold flex items-center gap-1">
              <span>Selected:</span>
              <span className="text-sm leading-none">{emo || '🍺'}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              '🍺', '🍻', '🍹', '🍸', '🍷', '🍕', '🍔', '🌮',
              '🎯', '🎳', '🕹️', '🎲', '⚡', '🔥', '👑', '🦊',
              '🦁', '🚀', '🎸', '🤠', '🕶️', '☕', '🎪', '⚽',
            ].map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => setEmo(icon)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-base transition cursor-pointer select-none ${
                  emo === icon
                    ? 'bg-[#ff6b57]/25 border border-[#ff6b57] scale-110 shadow-[0_0_8px_rgba(255,107,87,0.4)]'
                    : 'bg-[#212124] border border-[#2b2b2f] hover:border-[#ff6b57]/40 hover:bg-[#252529]'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Host / House Offer Section */}
        <div className="bg-[#17171a] border border-[#2b2b2f] rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-[#c6ff3d] flex items-center gap-1.5">
                <span>🏠 Offer Up Your House</span>
              </div>
              <div className="text-[11px] text-[#8d8d94]">
                Host pre-drinks, games night, or the squad gathering at your place
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={offersHouse}
                onChange={(e) => setOffersHouse(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[#2b2b2f] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#c6ff3d]"></div>
            </label>
          </div>

          {offersHouse && (
            <div className="space-y-2 pt-1 border-t border-[#2b2b2f]/60">
              <label className="text-[11px] text-[#8d8d94] block">
                What's the house setup? (optional)
              </label>
              <input
                value={houseNote}
                onChange={(e) => setHouseNote(e.target.value)}
                placeholder="e.g. Garden, BBQ, Mario Kart, darts & BYOB fridge (fits 8 mates)"
                className="w-full bg-[#212124] border border-[#2b2b2f] focus:border-[#c6ff3d] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
              />
              {isEdit && user && onPitchHouse && (
                <button
                  type="button"
                  onClick={() => {
                    const updatedUser: User = {
                      ...user,
                      name: name.trim() || user.name,
                      emo: emo.trim() || user.emo,
                      loc: loc.trim() || user.loc,
                      pay: pay.trim() || user.pay,
                      payLink: payLink.trim(),
                      payMail: payMail.trim(),
                      acn: acn.trim(),
                      tx: tx.trim(),
                      offersHouse: true,
                      houseNote: houseNote.trim(),
                    };
                    onSave(updatedUser, true);
                    onPitchHouse(updatedUser);
                    onClose();
                  }}
                  className="cursor-pointer bg-[rgba(198,255,61,0.12)] border border-[#c6ff3d]/40 text-[#c6ff3d] hover:bg-[rgba(198,255,61,0.2)] font-semibold text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                >
                  <span>🏠 Pitch My Place to Current Shortlist Now</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-semibold text-[#ff6b57] mb-1">
            💳 How to pay you (all optional)
          </div>
          <input
            value={payLink}
            onChange={(e) => setPayLink(e.target.value)}
            placeholder="Pay link (monzo.me/you, paypal.me/you, revolut.me/you)"
            className="w-full bg-[#17171a] border border-[#2b2b2f] focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div>
            <label className="text-[11px] text-[#8d8d94] block mb-1">PayPal Email</label>
            <input
              type="email"
              value={payMail}
              onChange={(e) => setPayMail(e.target.value)}
              placeholder="Payment email"
              className="w-full bg-[#17171a] border border-[#2b2b2f] focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-[#8d8d94] block mb-1">Account Name</label>
            <input
              value={acn}
              onChange={(e) => setAcn(e.target.value)}
              placeholder="Account name"
              className="w-full bg-[#17171a] border border-[#2b2b2f] focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-[#8d8d94] block mb-1">Sort Code</label>
            <input
              inputMode="numeric"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              placeholder="12-34-56"
              className="w-full bg-[#17171a] border border-[#2b2b2f] focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-[#8d8d94] block mb-1">Account No.</label>
            <input
              inputMode="numeric"
              value={acc}
              onChange={(e) => setAcc(e.target.value)}
              placeholder="8 digits"
              className="w-full bg-[#17171a] border border-[#2b2b2f] focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] text-[#8d8d94] block mb-1">
            😈 Roast line for your pay card (optional)
          </label>
          <input
            value={tx}
            onChange={(e) => setTx(e.target.value)}
            placeholder="e.g. Still owes for 2019 Uber"
            className="w-full bg-[#17171a] border border-[#2b2b2f] focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none"
          />
        </div>

        <div className="text-[11px] text-[#ff6b57]">
          ⚠️ Anyone with the group link can see these. A pay link is safer than account numbers.
        </div>

        {msg && <div className="text-xs text-[#ff6b57]">{msg}</div>}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="cursor-pointer bg-[rgba(198,255,61,0.12)] border border-[#c6ff3d]/30 text-[#c6ff3d] font-semibold text-xs px-4 py-2 rounded-xl hover:bg-[rgba(198,255,61,0.2)] active:scale-95 transition"
            >
              ✅ Save Profile
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer border border-[#2b2b2f] bg-transparent text-[#8d8d94] font-semibold text-xs px-3.5 py-2 rounded-xl hover:text-[#f4f4f5] transition"
            >
              Cancel
            </button>
          </div>

          {isEdit && canDelete && (
            confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#ff6b57] font-semibold">Delete {user?.name}?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="cursor-pointer bg-[#ff6b57] text-[#1a0703] font-semibold text-xs px-2.5 py-1.5 rounded-lg"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="cursor-pointer bg-[#17171a] border border-[#2b2b2f] text-[#cfcfd4] text-xs px-2.5 py-1.5 rounded-lg"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="cursor-pointer bg-[rgba(255,107,87,0.13)] text-[#ff6b57] font-semibold text-xs px-3.5 py-2 rounded-xl hover:bg-[rgba(255,107,87,0.2)] transition"
              >
                🗑️ Remove Profile
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
