import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Loader2 } from 'lucide-react';
import { hrService, leaveTypeName } from '../../services/hr.service';
import { useMe } from './MobileShell';

function pill(status: string) {
  const s = status.toLowerCase();
  if (s.includes('approve') || s === 'disetujui' || s === 'hadir') return 'bg-green-100 text-green-700';
  if (s.includes('reject') || s === 'ditolak') return 'bg-red-100 text-red-700';
  if (s.includes('pending') || s === 'menunggu') return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-600';
}

/** IGDERP-276d: mockup-faithful Request hub — Kuota card, "Ajukan baru",
 *  my recent requests (cuti, tukar shift, lembur) with detail links. */
export default function MRequest() {
  const navigate = useNavigate();
  const { data: me } = useMe();

  const { data: balance } = useQuery({
    queryKey: ['m-quota', me?.id],
    queryFn: () => hrService.getLeaveBalance(me?.id as string),
    enabled: !!me?.id,
    staleTime: 300_000,
    retry: false,
  });
  const { data: leaves, isLoading: lLoading } = useQuery({
    queryKey: ['m-my-leaves'],
    queryFn: () => hrService.getLeaveRequests({ limit: 5 } as any),
    staleTime: 60_000,
    retry: false,
  });
  const { data: swaps } = useQuery({
    queryKey: ['m-my-swaps'],
    queryFn: () => hrService.getShiftSwaps({}),
    staleTime: 60_000,
    retry: false,
  });

  const bal: any = (balance as any)?.data ?? balance;
  const quotaTxt = bal?.annual
    ? `Sisa ${bal.annual.remaining ?? '-'} dari ${bal.annual.quota ?? '-'} hari`
    : 'Kuota cuti tahunan';

  const items: Array<{ id: string; kind: string; title: string; sub: string; status: string; to: string }> = [
    ...(((leaves as any)?.data ?? []) as any[]).map((l: any) => ({
      id: String(l.id),
      kind: 'Cuti',
      title: `${leaveTypeName(l.leaveType) || 'Cuti'} · ${String(l.startDate ?? '').slice(0, 10)}`,
      sub: l.reason || '',
      status: l.status || 'pending',
      to: `/m/cuti/${l.id}`,
    })),
    ...(((swaps as any)?.data ?? []) as any[]).map((s: any) => ({
      id: String(s.id),
      kind: 'Shift',
      title: `Tukar shift · ${String(s.requestDate ?? s.createdAt ?? '').slice(0, 10)}`,
      sub: s.reason || '',
      status: s.status || 'pending',
      to: '/m/shift',
    })),
  ].slice(0, 8);

  return (
    <div className="-mx-4 -mt-3">
      <div className="bg-white px-5 pt-12 pb-3 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Request</h1>
      </div>
      <div className="px-4 mt-3 space-y-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
          <span className="font-semibold text-gray-900">Kuota</span>
          <span className="text-xs text-gray-500 bg-green-100 text-green-700 rounded-full px-2.5 py-1 font-semibold">
            {quotaTxt}
          </span>
        </div>
        <button
          onClick={() => navigate('/m/request/new')}
          className="w-full py-3 bg-[#F04438] text-white rounded-xl font-semibold"
        >
          Ajukan baru
        </button>
        {lLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : !items.length ? (
          <p className="text-center text-sm text-gray-400 py-8">Belum ada pengajuan</p>
        ) : (
          items.map((it) => (
            <button
              key={`${it.kind}-${it.id}`}
              onClick={() => navigate(it.to)}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-gray-400 uppercase">{it.kind}</p>
                <p className="text-sm font-bold text-gray-900 truncate">{it.title}</p>
                {!!it.sub && <p className="text-xs text-gray-500 truncate">{it.sub}</p>}
              </div>
              <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 shrink-0 ${pill(it.status)}`}>
                {it.status}
              </span>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
