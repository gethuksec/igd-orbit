import type { ReactNode } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { ChartEmptyState } from './EmptyState';
import { ChartErrorState } from './ErrorState';

interface ChartCardProps {
  title: string;
  chart: ReactNode;
  legend?: ReactNode;
  onExport?: (format: 'png' | 'csv') => void;
  className?: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export function ChartCard({ 
  title, 
  chart, 
  legend, 
  onExport, 
  className = '',
  isLoading = false,
  isEmpty = false,
  error = null,
  onRetry
}: ChartCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-indonesia-red-700">{title}</h3>
        {onExport && !isLoading && !error && !isEmpty && (
          <div className="flex gap-2">
            <button
              onClick={() => onExport('png')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Ekspor PNG"
            >
              <Download className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => onExport('csv')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Ekspor CSV"
            >
              <Download className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        )}
      </div>
      <div className="w-full h-64">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-indonesia-red-600 animate-spin" />
          </div>
        ) : error ? (
          <ChartErrorState onRetry={onRetry} />
        ) : isEmpty ? (
          <ChartEmptyState />
        ) : (
          chart
        )}
      </div>
      {legend && !isLoading && !error && !isEmpty && <div className="mt-4">{legend}</div>}
    </div>
  );
}

