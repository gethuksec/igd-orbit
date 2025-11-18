import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ 
  title = 'Terjadi Kesalahan', 
  message = 'Gagal memuat data. Silakan coba lagi.',
  onRetry 
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-4 max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-indonesia-red-600 text-white rounded-lg hover:bg-indonesia-red-700 font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Coba Lagi
        </button>
      )}
    </div>
  );
}

export function ChartErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-4">
      <AlertCircle className="w-12 h-12 text-red-300 mb-2" />
      <p className="text-sm text-gray-500 mb-2">Gagal memuat chart</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs text-indonesia-red-600 hover:text-indonesia-red-700 underline"
        >
          Coba lagi
        </button>
      )}
    </div>
  );
}

