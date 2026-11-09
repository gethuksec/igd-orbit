import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'orbit-install-dismissed-at';
const DONE_KEY = 'orbit-install-done';
// 30-day snooze after user taps "Nanti" / X
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

// Routes where the install prompt must never appear:
// - public pages (landing, login, tracking, intake)
// - print sheets (receipt / service / label / offline) — also excluded from print output via print:hidden
function isSuppressedRoute(pathname: string): boolean {
  if (pathname === '/' || pathname === '/login') return true;
  if (
    pathname === '/track' ||
    pathname.startsWith('/track/') ||
    pathname.startsWith('/s/') ||
    pathname.startsWith('/r/')
  )
    return true;
  if (
    pathname.includes('/print') ||
    pathname.includes('/offline-receipt') ||
    pathname.includes('/label-print')
  )
    return true;
  return false;
}

function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS Safari
  if ((window.navigator as unknown as { standalone?: boolean }).standalone === true)
    return true;
  return false;
}

function isSnoozed(): boolean {
  try {
    if (localStorage.getItem(DONE_KEY) === '1') return true;
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? '0');
    if (at > 0 && Date.now() - at < SNOOZE_MS) return true;
  } catch {
    // localStorage unavailable (private mode) — don't suppress
  }
  return false;
}

export function InstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    // Already installed → never prompt again
    if (isStandalone()) {
      try {
        localStorage.setItem(DONE_KEY, '1');
      } catch {
        /* ignore */
      }
      return;
    }
    if (isSnoozed()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };
    const installed = () => {
      try {
        localStorage.setItem(DONE_KEY, '1');
      } catch {
        /* ignore */
      }
      setShowPrompt(false);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installed);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShowPrompt(false);
  };

  const handleInstall = async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === 'accepted') {
      try {
        localStorage.setItem(DONE_KEY, '1');
      } catch {
        /* ignore */
      }
      setShowPrompt(false);
    } else {
      dismiss();
    }
    setInstallPrompt(null);
  };

  if (!showPrompt) return null;
  // Never overlay public pages or print sheets
  if (isSuppressedRoute(pathname)) return null;
  if (isStandalone()) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-xl border-2 border-indonesia-red-600 p-4 max-w-sm z-50 print:hidden">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-indonesia-red-50 rounded-lg flex items-center justify-center">
            <Download className="w-6 h-6 text-indonesia-red-600" />
          </div>
        </div>
        <div className="ml-3 flex-1">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Pasang Aplikasi ORBIT
            </h3>
            <button
              onClick={dismiss}
              className="ml-2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Akses lebih cepat dengan memasang aplikasi di perangkat Anda
          </p>
          <div className="mt-4 flex space-x-2">
            <button
              onClick={handleInstall}
              className="bg-indonesia-red-600 hover:bg-indonesia-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Pasang
            </button>
            <button
              onClick={dismiss}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Nanti
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
