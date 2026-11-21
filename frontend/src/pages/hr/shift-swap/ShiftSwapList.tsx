import { useState } from 'react';
import { BreadcrumbHeader } from '@/components/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Clock, Loader2, Inbox, XCircle } from 'lucide-react';
import { hrService, type ShiftSwapRequest } from '@/services/hr.service';
import { formatDate } from '@/utils/format';
import { toast } from 'sonner';

export default function ShiftSwapList() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['shift-swaps', statusFilter],
    queryFn: () => hrService.getShiftSwaps(statusFilter ? { status: statusFilter } : undefined),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => hrService.cancelShiftSwap(id),
    onSuccess: () => {
      toast.success('Pengajuan dibatalkan');
      queryClient.invalidateQueries({ queryKey: ['shift-swaps'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membatalkan');
    },
  });

  const rows: ShiftSwapRequest[] = data?.data || [];

  const badge = (status: string) => {
    if (status === 'pending')
      return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">Pending</span>;
    if (status === 'manager_approved')
      return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">Disetujui Atasan</span>;
    if (status === 'approved')
      return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">Approved</span>;
    if (status === 'rejected')
      return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800">Rejected</span>;
    return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{status}</span>;
  };

  return (
    <div className="w-full space-y-4 max-w-2xl mx-auto">
      <BreadcrumbHeader title="Tukar Shift" subtitle="Pengajuan tukar shift dengan rekan">
        <Link
          to="/hr/shift-swap/new"
          className="px-4 py-2.5 bg-primary-600 text-white rounded-lg font-bold text-sm active:bg-primary-700"
        >
          + Ajukan
        </Link>
      </BreadcrumbHeader>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { v: '', l: 'Semua' },
          { v: 'pending', l: 'Pending' },
          { v: 'manager_approved', l: 'Disetujui Atasan' },
          { v: 'approved', l: 'Approved' },
          { v: 'rejected', l: 'Rejected' },
        ].map((o) => (
          <button
            key={o.v}
            onClick={() => setStatusFilter(o.v)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${
              statusFilter === o.v ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-900 border text-gray-600 dark:text-gray-300'
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center text-gray-500">
          <Inbox className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          Belum ada pengajuan tukar shift
        </div>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <ArrowLeftRight className="w-5 h-5 text-primary-600 shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                    {r.fromShift?.name || '?'} → {r.toShift?.name || '?'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(r.date)} · dengan {r.targetEmployee?.user?.fullName || r.targetEmployee?.employeeCode || '?'}
                  </p>
                </div>
              </div>
              {badge(r.status)}
            </div>
            {r.reason && <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{r.reason}</p>}
            {['pending', 'manager_approved'].includes(r.status) && (
              <button
                onClick={() => cancelMutation.mutate(r.id)}
                disabled={cancelMutation.isPending}
                className="mt-3 w-full py-2.5 border border-red-300 text-red-600 rounded-lg font-semibold text-sm flex items-center justify-center gap-1 active:bg-red-50"
              >
                <XCircle className="w-4 h-4" /> Batalkan pengajuan
              </button>
            )}
            {!['pending', 'manager_approved', 'cancelled'].includes(r.status) && (
              <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Status final
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
