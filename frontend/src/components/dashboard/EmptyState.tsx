import type { LucideIcon } from 'lucide-react';
import { Package, BarChart3 } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon = Package, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4 max-w-md">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-indonesia-red-600 text-white rounded-lg hover:bg-indonesia-red-700 font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export function ChartEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-4">
      <BarChart3 className="w-12 h-12 text-gray-300 mb-2" />
      <p className="text-sm text-gray-500">Tidak ada data untuk ditampilkan</p>
    </div>
  );
}

export function TableEmptyState({ message = 'Tidak ada data' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Package className="w-12 h-12 text-gray-300 mb-2" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

