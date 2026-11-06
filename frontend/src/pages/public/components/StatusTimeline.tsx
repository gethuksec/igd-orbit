import { CheckCircle2, Circle, Clock } from 'lucide-react';

interface StatusHistory {
  status: string;
  createdAt: string;
  notes?: string;
  changedByUser?: {
    id: string;
    fullName: string | null;
    email: string | null;
  };
}

interface StatusTimelineProps {
  currentStatus: string;
  statusHistory: StatusHistory[];
}

const statusOrder = [
  'pending',
  'diagnosed',
  'in-progress',
  'qc',
  'ready',
  'done',
];

const statusLabels: Record<string, string> = {
  pending: 'Received',
  diagnosed: 'Diagnosed',
  'in-progress': 'In Progress',
  qc: 'Quality Check',
  ready: 'Ready',
  done: 'Done',
};

export default function StatusTimeline({ currentStatus, statusHistory }: StatusTimelineProps) {
  const getStatusIndex = (status: string) => {
    return statusOrder.indexOf(status);
  };

  const getStatusDate = (status: string) => {
    const history = statusHistory.find((h) => h.status === status);
    return history?.createdAt;
  };

  const currentIndex = getStatusIndex(currentStatus);

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-6">Service Status Timeline</h3>
      <div className="space-y-6">
        {statusOrder.map((status, index) => {
          const statusIndex = getStatusIndex(status);
          const isCompleted = statusIndex < currentIndex;
          const isCurrent = statusIndex === currentIndex;
          const statusDate = getStatusDate(status);

          return (
            <div key={status} className="flex gap-4">
              {/* Timeline Line */}
              <div className="flex flex-col items-center">
                {isCompleted ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500 dark:text-green-400" />
                ) : isCurrent ? (
                  <Clock className="w-6 h-6 text-blue-500 dark:text-blue-400 animate-pulse" />
                ) : (
                  <Circle className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                )}
                {index < statusOrder.length - 1 && (
                  <div
                    className={`w-0.5 flex-1 mt-2 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </div>

              {/* Status Info */}
              <div className="flex-1 pb-6">
                <div
                  className={`font-medium ${
                    isCompleted
                      ? 'text-green-700 dark:text-green-300'
                      : isCurrent
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {statusLabels[status] || status}
                </div>
                {statusDate && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {formatDate(statusDate)}
                  </div>
                )}
                {/* Show user info */}
                {(() => {
                  const history = statusHistory.find((h) => h.status === status);
                  if (history?.changedByUser) {
                    const user = history.changedByUser;
                    return (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span className="font-semibold">Oleh: </span>
                        {user.fullName || user.email || 'Unknown'}
                      </div>
                    );
                  }
                  return null;
                })()}
                {/* Show notes if available */}
                {(() => {
                  const history = statusHistory.find((h) => h.status === status);
                  return history?.notes ? (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 p-2 bg-gray-50 dark:bg-gray-950 rounded border border-gray-200 dark:border-gray-700">
                      <span className="font-semibold">Catatan: </span>
                      {history.notes}
                    </div>
                  ) : null;
                })()}
                {isCurrent && (
                  <div className="text-sm text-blue-600 dark:text-blue-400 mt-1 font-medium">
                    Current Status
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

