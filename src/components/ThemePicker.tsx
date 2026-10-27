import React, { useEffect, useState } from 'react';
import { Palette, Shuffle, X, Check, AlertTriangle } from 'lucide-react';
import { RoomTheme } from '../types';
import {
  THEME_PRESETS,
  DEFAULT_THEME,
  applyRoomTheme,
  contrast,
  nextPreset,
  presetName,
  sanitizeTheme,
} from '../utils/theme';

interface ThemePickerProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: RoomTheme;
  onApply: (theme: RoomTheme) => void;
}

const FIELDS: Array<{ key: keyof RoomTheme; label: string }> = [
  { key: 'bg', label: 'Background' },
  { key: 'surface', label: 'Cards' },
  { key: 'text', label: 'Text' },
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
];

const Swatches: React.FC<{ t: RoomTheme }> = ({ t }) => (
  <span className="flex -space-x-1.5">
    {[t.bg, t.surface, t.text, t.primary, t.secondary].filter(Boolean).map((c, i) => (
      <span key={i} className="w-5 h-5 rounded-full border border-line2" style={{ background: c }} />
    ))}
  </span>
);

export const ThemePicker: React.FC<ThemePickerProps> = ({ isOpen, onClose, theme, onApply }) => {
  const active = sanitizeTheme(theme) || DEFAULT_THEME;
  const [draft, setDraft] = useState<RoomTheme>(active);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(active);
      setEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, theme]);

  if (!isOpen) return null;

  const close = () => {
    applyRoomTheme(theme); // drop any unapplied preview
    onClose();
  };

  const preview = (t: RoomTheme) => {
    setDraft(t);
    applyRoomTheme(t);
  };

  const setColour = (key: keyof RoomTheme, value: string) =>
    preview({ ...draft, id: 'custom', [key]: value });

  const toggleSecondary = () => {
    const { secondary, ...rest } = draft;
    preview(secondary ? { ...rest, id: 'custom' } : { ...draft, id: 'custom', secondary: draft.primary });
  };

  const lowContrast = contrast(draft.text, draft.surface) < 4.5;
  const colourCount = new Set([draft.bg, draft.surface, draft.text, draft.primary, draft.secondary].filter(Boolean)).size;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card border border-line rounded-3xl p-5 max-w-sm w-full relative shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
        <button
          type="button"
          onClick={close}
          className="absolute top-4 right-4 p-1.5 rounded-full text-muted hover:text-ink hover:bg-card2 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-1 text-primary">
          <Palette className="w-5 h-5" />
          <h3 className="font-display font-extrabold text-base text-ink">Room Theme</h3>
        </div>
        <p className="text-xs text-muted mb-4">
          Changes the colours for everyone in this room.
          {active.by ? ` Last set by ${active.by}.` : ''}
        </p>

        <button
          type="button"
          onClick={() => onApply(nextPreset(active))}
          className="w-full flex items-center justify-center gap-2 cursor-pointer bg-primary text-primary-ink font-bold text-sm py-2.5 rounded-xl hover:brightness-105 active:scale-95 transition mb-4"
        >
          <Shuffle className="w-4 h-4" />
          Cycle palette
          <span className="opacity-70 font-semibold">· next: {nextPreset(active).name}</span>
        </button>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {THEME_PRESETS.map((p) => {
            const on = active.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onApply(p)}
                className={`flex flex-col items-start gap-2 p-2.5 rounded-xl border text-left cursor-pointer transition active:scale-95 ${
                  on ? 'border-primary bg-primary/10' : 'border-line bg-card2 hover:border-line2'
                }`}
              >
                <Swatches t={p} />
                <span className="flex items-center gap-1 text-xs font-bold text-ink">
                  {on && <Check className="w-3.5 h-3.5 text-primary" />}
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="border-t border-line pt-3">
          <button
            type="button"
            onClick={() => (editing ? (setEditing(false), preview(active)) : setEditing(true))}
            className="w-full flex items-center justify-between text-xs font-bold text-ink2 hover:text-ink cursor-pointer"
          >
            <span>Customise colours {active.id === 'custom' ? '(current: Custom)' : ''}</span>
            <span className="text-primary">{editing ? 'Cancel' : 'Edit'}</span>
          </button>

          {editing && (
            <div className="mt-3 space-y-2.5">
              {FIELDS.map(({ key, label }) => {
                const value = draft[key] as string | undefined;
                const optional = key === 'secondary';
                return (
                  <label key={key} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-ink2 font-semibold">{label}</span>
                    <span className="flex items-center gap-2">
                      {optional && (
                        <button
                          type="button"
                          onClick={toggleSecondary}
                          className="text-[10px] font-bold text-muted hover:text-ink cursor-pointer"
                        >
                          {value ? 'Remove' : 'Add'}
                        </button>
                      )}
                      {value ? (
                        <>
                          <span className="font-mono text-muted">{value}</span>
                          <input
                            type="color"
                            value={value}
                            onChange={(e) => setColour(key, e.target.value)}
                            className="w-9 h-9 rounded-lg border border-line bg-card2 cursor-pointer p-0.5"
                          />
                        </>
                      ) : (
                        <span className="text-muted">uses Primary</span>
                      )}
                    </span>
                  </label>
                );
              })}

              <p className="text-[11px] text-muted">
                {colourCount}-colour palette
                {lowContrast && (
                  <span className="flex items-center gap-1 mt-1 text-primary font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" /> Text may be hard to read on the cards.
                  </span>
                )}
              </p>

              <button
                type="button"
                onClick={() => {
                  onApply({ ...draft, id: 'custom' });
                  setEditing(false);
                }}
                className="w-full cursor-pointer bg-secondary text-secondary-ink font-bold text-xs py-2.5 rounded-xl hover:brightness-105 active:scale-95 transition"
              >
                Apply to room
              </button>
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted mt-3 text-center">Current: {presetName(active)}</p>
      </div>
    </div>
  );
};
