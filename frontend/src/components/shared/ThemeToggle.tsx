import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { cn } from '@/lib/utils';

/**
 * Header theme toggle (IGDERP-257, unslop pass): one button that activates /
 * deactivates the dark theme with a single click. Sun/Moon cross-fade
 * follows the resolved theme. The Auto option lives in
 * Pengaturan → Preferensi → Tema only, so there is exactly one affordance
 * per surface.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { mode, resolved, setMode } = useThemeStore();
  const isDark = resolved === 'dark';

  const toggle = () => {
    // From Auto, land on the explicit opposite of what is currently shown.
    if (mode === 'auto') {
      setMode(isDark ? 'light' : 'dark');
      return;
    }
    setMode(isDark ? 'light' : 'dark');
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isDark}
      title={isDark ? 'Nonaktifkan tema gelap' : 'Aktifkan tema gelap'}
      aria-label={isDark ? 'Nonaktifkan tema gelap' : 'Aktifkan tema gelap'}
      className={cn(
        'relative inline-flex h-10 w-10 items-center justify-center rounded-md text-sm font-medium transition-colors duration-150',
        'hover:bg-accent hover:text-accent-foreground active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-transform duration-150 dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-transform duration-150 dark:rotate-0 dark:scale-100" />
    </button>
  );
}
