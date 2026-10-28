import { describe, expect, it } from 'vitest';
import { THEME_PRESETS, contrast, inkFor, isLightTheme, nextPreset, presetName, sanitizeTheme } from '../theme';

describe('sanitizeTheme', () => {
  it('accepts a valid palette and drops extra fields', () => {
    const t = sanitizeTheme({ ...THEME_PRESETS[0], name: 'x', evil: '<script>' });
    expect(t).toEqual({ id: 'pintdr', bg: '#0e0e10', surface: '#17171a', text: '#f4f4f5', primary: '#ff6b57', secondary: '#c6ff3d' });
  });

  it('rejects anything that is not a plain hex colour', () => {
    expect(sanitizeTheme({ id: 'x', bg: 'red;}body{display:none', surface: '#000000', text: '#ffffff', primary: '#ff0000' })).toBeUndefined();
    expect(sanitizeTheme({ id: 'x', bg: '#000', surface: '#000000', text: '#ffffff', primary: '#ff0000' })).toBeUndefined();
    expect(sanitizeTheme(null)).toBeUndefined();
    expect(sanitizeTheme('pintdr')).toBeUndefined();
  });

  it('keeps the secondary colour optional', () => {
    const t = sanitizeTheme({ id: 'custom', bg: '#000000', surface: '#111111', text: '#FFFFFF', primary: '#FF0000', secondary: 'nope' });
    expect(t).toEqual({ id: 'custom', bg: '#000000', surface: '#111111', text: '#ffffff', primary: '#ff0000' });
  });
});

describe('presets', () => {
  it('never use more than 5 colours', () => {
    THEME_PRESETS.forEach((p) => {
      const colours = new Set([p.bg, p.surface, p.text, p.primary, p.secondary].filter(Boolean));
      expect(colours.size).toBeLessThanOrEqual(5);
    });
  });

  it('all have readable text on their cards', () => {
    THEME_PRESETS.forEach((p) => expect(contrast(p.text, p.surface), p.name).toBeGreaterThanOrEqual(7));
  });

  it('give every accent a readable button ink', () => {
    THEME_PRESETS.forEach((p) => {
      [p.primary, p.secondary].filter(Boolean).forEach((c) => {
        expect(contrast(inkFor(c as string), c as string), `${p.name} ${c}`).toBeGreaterThanOrEqual(4.5);
      });
    });
  });

  it('cycle through every preset and wrap around', () => {
    let t = THEME_PRESETS[0];
    const seen = new Set<string>();
    THEME_PRESETS.forEach(() => {
      seen.add(t.id);
      t = nextPreset(t);
    });
    expect(seen.size).toBe(THEME_PRESETS.length);
    expect(t.id).toBe(THEME_PRESETS[0].id);
    expect(nextPreset(undefined).id).toBe(THEME_PRESETS[0].id);
  });

  it('name custom palettes "Custom" and detect light themes', () => {
    expect(presetName({ id: 'custom', bg: '#000000', surface: '#000000', text: '#ffffff', primary: '#ffffff' })).toBe('Custom');
    expect(isLightTheme(THEME_PRESETS.find((p) => p.id === 'garden')!)).toBe(true);
    expect(isLightTheme(THEME_PRESETS[0])).toBe(false);
  });
});
