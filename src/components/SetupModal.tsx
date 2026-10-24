import React, { useState } from 'react';
import { AppConfig } from '../types';
import {
  copyStr,
  DEFAULT_FIREBASE_DB,
  generateRoomCode,
  getRecentRooms,
  saveRecentRoom,
} from '../utils/storage';
import { Sparkles, Share2, Copy, Check, RotateCw, PlusCircle, Database } from 'lucide-react';

interface SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSave: (newCfg: AppConfig) => void;
}

export const SetupModal: React.FC<SetupModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
}) => {
  const [db, setDb] = useState(config.db || DEFAULT_FIREBASE_DB);
  const [rm, setRm] = useState(config.rm);
  const [md, setMd] = useState(config.md);
  const [key, setKey] = useState(config.key);
  const [msg, setMsg] = useState('');
  const [recentRooms, setRecentRooms] = useState<string[]>(getRecentRooms());

  if (!isOpen) return null;

  const isCentralDb = !db || db === DEFAULT_FIREBASE_DB;

  const handleRandomRoom = () => {
    const code = generateRoomCode();
    setRm(code);
    setMsg('🎲 New squad room generated! Tap Save & Connect to jump in.');
  };

  const handleCreateNewRoom = () => {
    const code = generateRoomCode();
    setRm(code);
    saveRecentRoom(code);
    setRecentRooms(getRecentRooms());
    const cleanDb = db.trim().replace(/\/$/, '');
    onSave({
      ...config,
      db: cleanDb,
      rm: code,
      md: md.trim() || 'gemini-flash-latest',
      key: key.trim(),
    });
    // Update address bar
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('room', code);
      window.history.replaceState({}, '', newUrl.pathname + newUrl.search + newUrl.hash);
    }
    setMsg(`✨ Created new room "${code}" and connected!`);
  };

  const handleSelectRecentRoom = (roomCode: string) => {
    setRm(roomCode);
    const cleanDb = db.trim().replace(/\/$/, '');
    onSave({
      ...config,
      db: cleanDb,
      rm: roomCode,
      md: md.trim() || 'gemini-flash-latest',
      key: key.trim(),
    });
    // Update address bar
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('room', roomCode);
      window.history.replaceState({}, '', newUrl.pathname + newUrl.search + newUrl.hash);
    }
    setMsg(`⚡ Switched to room "${roomCode}"`);
  };

  const handleSave = () => {
    const cleanDb = db.trim().replace(/\/$/, '');
    const cleanRm = rm.trim() || 'medway-squad';
    const cleanMd = md.trim() || 'gemini-flash-latest';
    const cleanKey = key.trim();

    saveRecentRoom(cleanRm);
    setRecentRooms(getRecentRooms());

    onSave({
      ...config,
      db: cleanDb,
      rm: cleanRm,
      md: cleanMd,
      key: cleanKey,
    });

    // Update URL if room changed
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('room', cleanRm);
      window.history.replaceState({}, '', newUrl.pathname + newUrl.search + newUrl.hash);
    }

    if (cleanRm.replace(/\W/g, '').length < 12) {
      setMsg('✅ Saved – ⚠️ Short codes might conflict; use 🎲 for a unique squad code.');
    } else {
      setMsg('✅ Saved & Connected!');
    }
  };

  const handleShareLink = async () => {
    handleSave();
    const cleanDb = db.trim().replace(/\/$/, '');
    const cleanRm = rm.trim() || 'medway-squad';
    const isCustomDb = cleanDb && cleanDb !== DEFAULT_FIREBASE_DB;

    const link =
      `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(cleanRm)}` +
      (isCustomDb ? `&db=${encodeURIComponent(cleanDb)}` : '');

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Not The Greedy Banker',
          text: `🍻 Join our plan on Not The Greedy Banker (Room: ${cleanRm})`,
          url: link,
        });
        setMsg('✅ Shared squad link!');
        return;
      } catch (e: any) {
        if (e.name === 'AbortError') return;
      }
    }

    const copied = await copyStr(`🍻 Join our plan on Not The Greedy Banker\n${link}`);
    setMsg(
      copied
        ? '📋 Link copied – paste it into WhatsApp or Messenger!'
        : "❌ Couldn't copy link"
    );
  };

  return (
    <div className="mt-3 bg-[#212124] border border-[#2b2b2f] rounded-2xl p-4 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[#ff6b57]" />
          <h2 className="text-xs font-bold text-[#ff6b57]">
            Backend & Room Sync
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[#8d8d94] hover:text-[#f4f4f5] cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Backend Status Banner */}
      <div className="bg-[#17171a] border border-[#2b2b2f] rounded-xl p-3 mb-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-[#f4f4f5]">
            <span className="w-2 h-2 rounded-full bg-[#c6ff3d] animate-pulse"></span>
            <span>{isCentralDb ? 'Central Firebase Backend' : 'Custom Database'}</span>
          </div>
          <span className="text-[10px] text-[#c6ff3d] bg-[rgba(198,255,61,0.12)] px-2 py-0.5 rounded-full font-mono">
            Zero friend setup
          </span>
        </div>
        <p className="text-[11px] text-[#8d8d94] mt-1 leading-relaxed">
          {isCentralDb
            ? 'Friends who open your link or scan your QR code automatically join your live room without having to configure any database settings.'
            : 'Connecting to your custom private Firebase Realtime Database.'}
        </p>
      </div>

      <div className="space-y-3">
        {/* Room Code with Fast Generator & Recent Rooms */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-semibold text-[#8d8d94]">
              Active Room Code
            </label>
            <button
              type="button"
              onClick={handleCreateNewRoom}
              className="text-[11px] text-[#ff6b57] hover:underline cursor-pointer flex items-center gap-1"
            >
              <PlusCircle className="w-3 h-3" />
              <span>+ Create New Room</span>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              value={rm}
              onChange={(e) => setRm(e.target.value)}
              placeholder="squad-friday-bash-xxxx"
              className="flex-1 bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs font-mono outline-none transition"
            />
            <button
              type="button"
              onClick={handleRandomRoom}
              title="Generate new room code"
              className="cursor-pointer border border-[#2b2b2f] bg-[#17171a] text-[#f4f4f5] font-semibold text-xs px-2.5 py-2 rounded-xl hover:border-[#3b3b40] transition flex items-center gap-1"
            >
              <span>🎲</span>
            </button>
          </div>

          {/* Recent Rooms Switcher */}
          {recentRooms.length > 1 && (
            <div className="mt-2">
              <span className="text-[10px] text-[#8d8d94] block mb-1">Recent Rooms:</span>
              <div className="flex flex-wrap gap-1.5">
                {recentRooms.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleSelectRecentRoom(r)}
                    className={`text-[10px] font-mono px-2 py-1 rounded-lg border transition cursor-pointer ${
                      r === rm
                        ? 'border-[#ff6b57] bg-[rgba(255,107,87,0.15)] text-[#ff6b57]'
                        : 'border-[#2b2b2f] bg-[#17171a] text-[#8d8d94] hover:text-[#f4f4f5]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Database URL (Optional override) */}
        <div>
          <label className="text-[11px] font-semibold text-[#8d8d94] block mb-1">
            Firebase RTDB URL <span className="text-[#8d8d94] font-normal">(Leave blank for central server)</span>
          </label>
          <input
            value={db}
            onChange={(e) => setDb(e.target.value)}
            placeholder="https://...-rtdb.europe-west1.firebasedatabase.app"
            className="w-full bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none transition"
          />
        </div>

        {/* Gemini Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-semibold text-[#8d8d94] block mb-1">
              Gemini Model
            </label>
            <input
              value={md}
              onChange={(e) => setMd(e.target.value)}
              placeholder="gemini-flash-latest"
              className="w-full bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none transition"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {[
                { id: 'gemini-flash-latest', label: '⚡ Latest' },
                { id: 'gemini-3.8-flash', label: '3.8 Flash' },
                { id: 'gemini-3.1-flash-lite', label: '3.1 Lite' },
                { id: 'gemini-4-argon', label: '4 Argon' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMd(m.id)}
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition cursor-pointer ${
                    md === m.id
                      ? 'border-[#ff6b57] bg-[rgba(255,107,87,0.15)] text-[#ff6b57]'
                      : 'border-[#2b2b2f] bg-[#17171a] text-[#8d8d94] hover:text-[#f4f4f5]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#8d8d94] block mb-1">
              Gemini API Key <span className="text-[#8d8d94] font-normal">(for Gerg AI)</span>
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="AIzaSy... (optional)"
              className="w-full bg-[#17171a] border border-transparent focus:border-[#ff6b57] text-[#f4f4f5] px-3 py-2 rounded-xl text-xs outline-none transition"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleSave}
            className="cursor-pointer bg-[#ff6b57] text-[#1a0703] font-semibold text-xs px-3.5 py-2 rounded-xl hover:brightness-105 active:scale-95 transition"
          >
            💾 Save & Connect
          </button>
          <button
            type="button"
            onClick={handleShareLink}
            className="cursor-pointer border border-[#2b2b2f] bg-[#17171a] text-[#f4f4f5] font-semibold text-xs px-3.5 py-2 rounded-xl hover:border-[#3b3b40] active:scale-95 transition flex items-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5 text-[#ff6b57]" />
            <span>💬 Share Squad Link</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border border-[#2b2b2f] bg-transparent text-[#8d8d94] font-semibold text-xs px-3 py-2 rounded-xl hover:text-[#f4f4f5] transition"
          >
            Close
          </button>
        </div>

        {msg && <div className="text-xs text-[#c6ff3d] mt-1">{msg}</div>}
        <div className="text-[11px] text-[#8d8d94]">
          📲 Tip: Share ⬆️ → "Add to Home Screen" to install as an app on your phone.
        </div>
      </div>
    </div>
  );
};
