import { useEffect, useState } from 'react';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    // In-flow bar (NOT fixed): a fixed overlay would cover the sticky app
    // headers (dashboard + POS account menus). In flow it pushes the header
    // down so account info stays visible; it scrolls away like page banners.
    <div className="relative w-full bg-yellow-500 text-white text-center py-2">
      <p className="text-sm font-medium">
        ⚠️ Anda sedang offline. Beberapa fitur mungkin tidak tersedia.
      </p>
    </div>
  );
}

