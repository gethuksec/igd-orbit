import { CheckCircle2, Circle, Clock } from 'lucide-react';

interface StatusHistory {
  status: string;
  createdAt: string;
  notes?: string;
}

interface StatusTimelineProps {
  currentStatus: string;
  statusHistory: StatusHistory[];
}

const statusOrder = [
  'pending',
  'diagnosed',
  'quoted',
  'approved',
  'in-progress',
  'qc',
  'completed',
  'delivered',
];

const statusLabels: Record<string, string> = {
  pending: 'Received',
  diagnosed: 'Diagnosed',
  quoted: 'Quotation Sent',
  approved: 'Approved',
  'in-progress': 'In Progress',
  qc: 'Quality Check',
  completed: 'Completed',
  delivered: 'Delivered',
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
    <div className="bg-white rounded-lg shadow-md p-6">
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
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                ) : isCurrent ? (
                  <Clock className="w-6 h-6 text-blue-500 animate-pulse" />
                ) : (
                  <Circle className="w-6 h-6 text-gray-300" />
                )}
                {index < statusOrder.length - 1 && (
                  <div
                    className={`w-0.5 flex-1 mt-2 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>

              {/* Status Info */}
              <div className="flex-1 pb-6">
                <div
                  className={`font-medium ${
                    isCompleted
                      ? 'text-green-700'
                      : isCurrent
                      ? 'text-blue-700'
                      : 'text-gray-400'
                  }`}
                >
                  {statusLabels[status] || status}
                </div>
                {statusDate && (
                  <div className="text-sm text-gray-500 mt-1">
                    {formatDate(statusDate)}
                  </div>
                )}
                {isCurrent && (
                  <div className="text-sm text-blue-600 mt-1 font-medium">
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

