import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setInstallPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-xl border-2 border-indonesia-red-600 p-4 max-w-sm z-50">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-indonesia-red-50 rounded-lg flex items-center justify-center">
            <Download className="w-6 h-6 text-indonesia-red-600" />
          </div>
        </div>
        <div className="ml-3 flex-1">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Pasang Aplikasi IGD ERP
            </h3>
            <button
              onClick={() => setShowPrompt(false)}
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
              onClick={() => setShowPrompt(false)}
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

