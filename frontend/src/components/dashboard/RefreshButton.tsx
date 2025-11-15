import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { formatRelativeTime } from '../../utils/format';

interface RefreshButtonProps {
  onRefresh: () => void;
  autoRefreshInterval?: number; // in seconds
  lastUpdated?: Date;
}

export function RefreshButton({
  onRefresh,
  autoRefreshInterval,
  lastUpdated,
}: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);

  useEffect(() => {
    if (autoRefreshEnabled && autoRefreshInterval) {
      const interval = setInterval(() => {
        onRefresh();
      }, autoRefreshInterval * 1000);

      return () => clearInterval(interval);
    }
  }, [autoRefreshEnabled, autoRefreshInterval, onRefresh]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  return (
    <div className="flex items-center gap-4">
      {lastUpdated && (
        <span className="text-sm text-gray-500">
          Terakhir diperbarui: {formatRelativeTime(lastUpdated)}
        </span>
      )}
      {autoRefreshInterval && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoRefreshEnabled}
            onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
            className="rounded border-gray-300 text-indonesia-red-600 focus:ring-indonesia-red-500"
          />
          <span className="text-sm text-gray-600">
            Auto-refresh ({autoRefreshInterval}s)
          </span>
        </label>
      )}
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-2 px-4 py-2 bg-indonesia-red-600 hover:bg-indonesia-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? 'Memuat...' : 'Refresh'}
      </button>
    </div>
  );
}

