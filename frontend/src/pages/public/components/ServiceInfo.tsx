import { Badge } from '@/components/ui/badge';
import { Calendar, Smartphone } from 'lucide-react';

interface ServiceInfoProps {
  serviceNumber: string;
  deviceType: string;
  deviceUnit?: string;
  status: string;
  receivedDate: string;
  promisedDate?: string;
  estimatedCompletion?: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200',
  diagnosed: 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200',
  'in-progress': 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200',
  qc: 'bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-200',
  ready: 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200',
  done: 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200',
  cancelled: 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200',
  'ready-cancel': 'bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-200',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  diagnosed: 'Diagnosed',
  'in-progress': 'In Progress',
  qc: 'Quality Check',
  ready: 'Ready',
  done: 'Done',
  cancelled: 'Cancelled',
  'ready-cancel': 'Ready Cancel',
};

export default function ServiceInfo({
  serviceNumber,
  deviceType,
  deviceUnit,
  status,
  receivedDate,
  promisedDate,
  estimatedCompletion,
}: ServiceInfoProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const statusColor = statusColors[status] || 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
  const statusLabel = statusLabels[status] || status;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 space-y-4">
      {/* Service Number */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{serviceNumber}</h2>
        <Badge className={statusColor}>{statusLabel}</Badge>
      </div>

      {/* Device Information */}
      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Smartphone className="w-5 h-5" />
          Device Information
        </h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Type:</span> {deviceType}
          </div>
          {deviceUnit && (
            <div>
              <span className="font-medium">Unit:</span> {deviceUnit}
            </div>
          )}
        </div>
      </div>

      {/* Dates */}
      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Timeline
        </h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Received:</span>{' '}
            {formatDate(receivedDate)}
          </div>
          {promisedDate && (
            <div>
              <span className="font-medium">Promised Completion:</span>{' '}
              {formatDate(promisedDate)}
            </div>
          )}
          {estimatedCompletion && (
            <div>
              <span className="font-medium">Estimated Completion:</span>{' '}
              {formatDate(estimatedCompletion)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

