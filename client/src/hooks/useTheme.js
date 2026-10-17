import { useState, useEffect } from 'react';

const THEME_STORAGE_KEY = 'arham_fintech_theme';

/**
 * Custom hook to manage Light (White) and Dark (Black) theme state
 * Persists user preference in localStorage and synchronizes data-theme attribute on document root
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        return saved;
      }
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {
      // Ignore storage errors in private browsing modes
    }
    return 'light';
  });

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.style.colorScheme = theme;
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setLightTheme = () => setTheme('light');
  const setDarkTheme = () => setTheme('dark');

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme,
    setTheme,
    setLightTheme,
    setDarkTheme
  };
}
