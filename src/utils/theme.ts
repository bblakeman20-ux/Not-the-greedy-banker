import { RoomTheme } from '../types';

// A room palette is at most 5 colours: page background, card surface, text,
// primary accent and an optional secondary accent. Borders, muted text and
// button ink are derived from these (see index.css), so a palette never
// grows beyond what is picked here.

export interface ThemePreset extends RoomTheme {
  name: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'pintdr', name: 'Pintdr', bg: '#0e0e10', surface: '#17171a', text: '#f4f4f5', primary: '#ff6b57', secondary: '#c6ff3d' },
  { id: 'stout', name: 'Stout', bg: '#120d0a', surface: '#1c1511', text: '#f5ece1', primary: '#d9a05b' },
  { id: 'midnight', name: 'Midnight', bg: '#0b1020', surface: '#141a2e', text: '#eef1ff', primary: '#7c9cff', secondary: '#ffcc4d' },
  { id: 'neon', name: 'Neon Arcade', bg: '#0d0a14', surface: '#171223', text: '#f5f0ff', primary: '#ff3ea5', secondary: '#3ef0ff' },
  { id: 'racing', name: 'Racing Green', bg: '#0c1410', surface: '#14201a', text: '#f1f5ee', primary: '#e3b23c' },
  { id: 'mono', name: 'Mono', bg: '#0a0a0a', surface: '#161616', text: '#f5f5f5', primary: '#f5f5f5' },
  { id: 'arcade', name: 'Retro Arcade', bg: '#06061c', surface: '#10103f', text: '#fff6d6', primary: '#ffd400', secondary: '#ff6b9d' },
  { id: 'garden', name: 'Beer Garden', bg: '#f4f1ea', surface: '#ffffff', text: '#1d1b16', primary: '#2f7d4f', secondary: '#ad5e0d' },
  { id: 'seaside', name: 'Seaside', bg: '#edf5f7', surface: '#ffffff', text: '#102a33', primary: '#0f7c90', secondary: '#c8472a' },
  { id: 'lavender', name: 'Lavender Haze', bg: '#eceef6', surface: '#f8f8fc', text: '#2e3047', primary: '#5f5ca6', secondary: '#46719a' },
  { id: 'oat', name: 'Oat Milk', bg: '#f3ece1', surface: '#fbf7f0', text: '#3e352c', primary: '#975b50', secondary: '#4f7457' },
];

export const DEFAULT_THEME: ThemePreset = THEME_PRESETS[0];

const HEX = /^#[0-9a-f]{6}$/i;

const toRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const toHex = (rgb: number[]): string =>
  '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

export const luminance = (hex: string): number => {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Readable text for a button filled with `fill`: a near-black or near-white
// tinted slightly towards the fill so it sits in the palette.
export const inkFor = (fill: string): string => {
  const dark = contrast(fill, '#000000') >= contrast(fill, '#ffffff');
  const base = dark ? [0, 0, 0] : [255, 255, 255];
  const tint = toRgb(fill);
  const tinted = toHex(base.map((v, i) => v * 0.9 + tint[i] * 0.1));
  // Drop the tint if it would push the text below readable contrast
  return contrast(tinted, fill) >= 4.5 ? tinted : toHex(base);
};

export const isLightTheme = (t: RoomTheme): boolean => luminance(t.bg) > 0.4;

// Room data comes from whoever is in the room, so only accept plain hex colours.
export const sanitizeTheme = (t: any): RoomTheme | undefined => {
  if (!t || typeof t !== 'object') return undefined;
  const pick = (k: string) => (typeof t[k] === 'string' && HEX.test(t[k]) ? t[k].toLowerCase() : null);
  const bg = pick('bg');
  const surface = pick('surface');
  const text = pick('text');
  const primary = pick('primary');
  if (!bg || !surface || !text || !primary) return undefined;
  const out: RoomTheme = { id: typeof t.id === 'string' ? t.id.slice(0, 32) : 'custom', bg, surface, text, primary };
  const secondary = pick('secondary');
  if (secondary) out.secondary = secondary;
  if (typeof t.by === 'string') out.by = t.by.slice(0, 40);
  if (typeof t.at === 'number') out.at = t.at;
  return out;
};

export const presetName = (t?: RoomTheme): string =>
  THEME_PRESETS.find((p) => p.id === t?.id)?.name || 'Custom';

export const nextPreset = (t?: RoomTheme): ThemePreset => {
  const i = THEME_PRESETS.findIndex((p) => p.id === t?.id);
  return THEME_PRESETS[(i + 1) % THEME_PRESETS.length];
};

let current: RoomTheme = DEFAULT_THEME;

export const applyRoomTheme = (theme?: RoomTheme): void => {
  if (typeof document === 'undefined') return;
  const t = sanitizeTheme(theme) || DEFAULT_THEME;
  current = t;
  const secondary = t.secondary || t.primary;
  const root = document.documentElement;
  const vars: Record<string, string> = {
    '--bg': t.bg,
    '--surface': t.surface,
    '--text': t.text,
    '--accent': t.primary,
    '--accent-ink': inkFor(t.primary),
    '--good': secondary,
    '--good-ink': inkFor(secondary),
  };
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  const light = isLightTheme(t);
  root.style.setProperty('--shade', light ? 'rgba(30, 30, 50, 0.08)' : 'rgba(0, 0, 0, 0.4)');
  root.classList.toggle('dark', !light);
  root.classList.toggle('light', light);
  root.setAttribute('data-theme', light ? 'light' : 'dark');
  root.style.colorScheme = light ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg);
};

export const themeConfetti = (): string[] => [current.primary, current.secondary || current.text, current.text];
