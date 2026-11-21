import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BellOff, ChevronRight, Loader2 } from 'lucide-react';
import { hrService } from '../../services/hr.service';
import { shiftsService } from '../../services/shifts.service';
import { isManagerLike, useMe } from './MobileShell';

interface Note {
  id: string;
  title: string;
  sub: string;
  to: string;
}

/** IGDERP-276d: mockup-faithful Inbox — notification center composed from
 *  real signals (no push infra yet): approvals, leave decisions, schedule,
 *  checkout reminder. Managers review via /m/approvals. */
export default function MInbox() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const mgr = isManagerLike(me);

  const { data: approvals } = useQuery({
    queryKey: ['m-inbox-approvals'],
    queryFn: () => hrService.getPendingApprovals(),
    enabled: mgr,
    staleTime: 60_000,
    retry: false,
  });
  const { data: leaves, isLoading } = useQuery({
    queryKey: ['m-inbox-leaves'],
    queryFn: () => hrService.getLeaveRequests({ limit: 5 } as any),
    staleTime: 60_000,
    retry: false,
  });
  const { data: assignments } = useQuery({
    queryKey: ['m-inbox-shifts', me?.id],
    queryFn: () => shiftsService.getAssignments({ employeeId: me?.id, limit: 3 }),
    enabled: !!me?.id,
    staleTime: 300_000,
    retry: false,
  });

  const notes: Note[] = [];
  const awaiting = (approvals as any)?.awaitingDecision ?? 0;
  if (mgr && awaiting > 0) {
    notes.push({
      id: 'appr',
      title: `${awaiting} pengajuan menunggu`,
      sub: 'Ketuk untuk meninjau',
      to: '/m/approvals',
    });
  }
  for (const l of (((leaves as any)?.data ?? []) as any[]).slice(0, 3)) {
    const st = String(l.status || '').toLowerCase();
    if (!st.includes('approve') && !st.includes('reject') && st !== 'disetujui' && st !== 'ditolak')
      continue;
    const ok = st.includes('approve') || st === 'disetujui';
    notes.push({
      id: `lv-${l.id}`,
      title: `Cuti ${String(l.startDate ?? '').slice(0, 10)} ${ok ? 'disetujui' : 'ditolak'}`,
      sub: l.approverNote || l.leaveType || 'HR',
      to: `/m/cuti/${l.id}`,
    });
  }
  const upcoming = ((assignments as any)?.data ?? [])[0];
  if (upcoming?.shift) {
    notes.push({
      id: 'sched',
      title: 'Jadwal terbaru terbit',
      sub: `${upcoming.shift.name} · ${String(upcoming.shift.clockIn).slice(0, 5)}–${String(upcoming.shift.clockOut).slice(0, 5)}`,
      to: '/m/jadwal',
    });
  }

  return (
    <div className="-mx-4 -mt-3">
      <div className="bg-white px-5 pt-12 pb-3 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {notes.length ? `${notes.length} belum dibaca` : 'Tidak ada notifikasi'}
        </p>
      </div>
      <div className="px-4 mt-3 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : !notes.length ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <BellOff className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Belum ada notifikasi</p>
          </div>
        ) : (
          notes.map((n) => (
            <button
              key={n.id}
              onClick={() => navigate(n.to)}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900">{n.title}</p>
                <p className="text-xs text-gray-500 truncate">{n.sub}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
