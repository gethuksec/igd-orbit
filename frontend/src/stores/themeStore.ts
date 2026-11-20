import { create } from 'zustand';

/**
 * 3-way theme state (IGDERP-257): Auto / Light / Dark.
 *
 * - `mode` is the user's choice, persisted to localStorage (`igd-theme`).
 * - `resolved` is the effective theme; in `auto` it follows the OS
 *   `prefers-color-scheme` media query (live, via listener below).
 * - The `dark` class on <html> is the single Tailwind `darkMode: ['class']`
 *   switch; applied here AND by the inline script in index.html so the first
 *   paint already has the right theme (no white flash on reload).
 */
export type ThemeMode = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'igd-theme';

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function resolveMode(mode: ThemeMode): ResolvedTheme {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return systemPrefersDark() ? 'dark' : 'light';
}

function loadMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'auto') return raw;
  } catch {
    // private mode etc. — fall through to default
  }
  return 'auto';
}

export function applyResolvedTheme(resolved: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.style.colorScheme = resolved;
  try {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? '#030712' : '#dc2626');
  } catch {
    // non-fatal
  }
}

interface ThemeState {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const initialMode = loadMode();

export const useThemeStore = create<ThemeState>((set) => ({
  mode: initialMode,
  resolved: resolveMode(initialMode),
  setMode: (mode) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // non-fatal
    }
    const resolved = resolveMode(mode);
    applyResolvedTheme(resolved);
    set({ mode, resolved });
  },
}));

// Keep the class in sync on store init (module load runs before first paint
// in practice; index.html's inline script covers the true first-paint case).
applyResolvedTheme(resolveMode(initialMode));

// Follow OS changes live while in auto mode.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().mode !== 'auto') return;
    const resolved = resolveMode('auto');
    applyResolvedTheme(resolved);
    useThemeStore.setState({ resolved });
  });
}
