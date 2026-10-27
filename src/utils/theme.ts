export type ThemeMode = 'dark';

export const applyThemeClass = (_theme?: string): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light');
  root.classList.add('dark');
  root.setAttribute('data-theme', 'dark');
};

export const getSavedTheme = (): ThemeMode => 'dark';

export const setSavedTheme = (_theme?: string): void => {
  try {
    localStorage.removeItem('pintdr_theme');
  } catch (e) {
    // ignore
  }
  applyThemeClass();
};
