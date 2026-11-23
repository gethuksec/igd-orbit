import { useState } from 'react';
import { BreadcrumbHeader } from '@/components/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, CheckCircle, XCircle, Loader2, Inbox } from 'lucide-react';
import { hrService, type PendingApproval } from '@/services/hr.service';
import { formatDate } from '@/utils/format';
import { toast } from 'sonner';

const KIND_LABEL: Record<string, string> = {
  leave: 'Cuti',
  overtime: 'Lembur',
  shift_swap: 'Tukar Shift',
  libur: 'Libur',
};

export default function ApprovalsInbox() {
  const queryClient = useQueryClient();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['approvals-pending'],
    queryFn: () => hrService.getPendingApprovals(),
  });

  const items: PendingApproval[] = data?.data || [];

  const approveMutation = useMutation({
    mutationFn: (item: PendingApproval) => {
      const id = item.id;
      if (item.kind === 'leave') return item.status === 'pending' ? hrService.approveLeave(id, {}) : hrService.approveLeaveHr(id);
      if (item.kind === 'overtime') return item.status === 'pending' ? hrService.approveOvertime(id) : hrService.approveOvertimeHr(id);
      if (item.kind === 'shift_swap') return item.status === 'pending' ? hrService.approveShiftSwap(id) : hrService.approveShiftSwapHr(id);
      // libur single-step: reuse libur service approve endpoint
      return import('@/services/libur.service').then((m) => m.liburService.approveRequest(id));
    },
    onSuccess: () => {
      toast.success('Disetujui');
      queryClient.invalidateQueries({ queryKey: ['approvals-pending'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyetujui');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ item, reason }: { item: PendingApproval; reason: string }) => {
      const id = item.id;
      if (item.kind === 'leave') return hrService.rejectLeave(id, { reason });
      if (item.kind === 'overtime') return hrService.rejectOvertime(id, reason);
      if (item.kind === 'shift_swap') return hrService.rejectShiftSwap(id, reason);
      return import('@/services/libur.service').then((m) => m.liburService.rejectRequest(id, reason));
    },
    onSuccess: () => {
      toast.success('Ditolak');
      setRejectId(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['approvals-pending'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menolak');
    },
  });

  return (
    <div className="w-full space-y-4 max-w-2xl mx-auto">
      <BreadcrumbHeader
        title="Persetujuan"
        subtitle={data ? `${data.awaitingDecision} menunggu keputusan Anda` : 'Memuat...'}
      />

      {isLoading ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center text-gray-500">
          <Inbox className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          Tidak ada pengajuan menunggu
        </div>
      ) : (
        items.map((item) => (
          <div key={`${item.kind}-${item.id}`} className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold px-2 py-0.5 bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 rounded-full">
                    {KIND_LABEL[item.kind] || item.kind}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                    {item.status === 'pending' ? 'Pending' : 'Disetujui Atasan'}
                  </span>
                </div>
                <p className="font-bold text-gray-900 dark:text-gray-100 mt-1.5">{item.requester.name || item.requester.employeeCode}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{item.summary}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDate(item.createdAt)}</p>
              </div>
            </div>

            {item.canDecide ? (
              rejectId === item.id ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    placeholder="Alasan penolakan..."
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => { setRejectId(null); setRejectReason(''); }} className="flex-1 py-2.5 border rounded-lg font-semibold text-sm">
                      Batal
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate({ item, reason: rejectReason })}
                      disabled={!rejectReason.trim() || rejectMutation.isPending}
                      className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Tolak
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => approveMutation.mutate(item)}
                    disabled={approveMutation.isPending}
                    className="flex-1 py-3 bg-green-600 text-white rounded-lg font-bold text-sm active:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {item.status === 'pending' ? 'Setujui' : 'Final Approve'}
                  </button>
                  <button
                    onClick={() => setRejectId(item.id)}
                    className="flex-1 py-3 border border-red-300 text-red-600 rounded-lg font-bold text-sm active:bg-red-50 flex items-center justify-center gap-1"
                  >
                    <XCircle className="w-4 h-4" /> Tolak
                  </button>
                </div>
              )
            ) : (
              <p className="mt-3 text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Menunggu persetujuan pihak lain
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
