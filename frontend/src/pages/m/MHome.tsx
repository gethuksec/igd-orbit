import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightLeft,
  CalendarClock,
  ClipboardList,
  Clock,
  FileText,
  Inbox,
  Loader2,
} from 'lucide-react';
import { hrService } from '../../services/hr.service';
import { isManagerLike, useMe } from './MobileShell';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** IGDERP-276: beranda — today's clock status, quick actions, pending approvals. */
export default function MHome() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const mgr = isManagerLike(me);

  const today = todayStr();
  const { data: att, isLoading } = useQuery({
    queryKey: ['m-today', today],
    queryFn: () => hrService.getAttendances({ startDate: today, endDate: today }),
    staleTime: 30_000,
  });
  const { data: approvals } = useQuery({
    queryKey: ['m-pending'],
    queryFn: () => hrService.getPendingApprovals(),
    enabled: mgr,
    staleTime: 60_000,
  });

  const rec = (att as any)?.data?.[0];
  const clockedIn = !!rec?.clockIn;
  const clockedOut = !!rec?.clockOut;

  const actions = [
    { label: 'Absen', icon: Clock, to: '/m/absen', primary: true },
    { label: 'Cuti', icon: FileText, to: '/m/cuti' },
    { label: 'Slip Gaji', icon: ClipboardList, to: '/m/slip' },
    { label: 'Tukar Shift', icon: ArrowRightLeft, to: '/m/shift' },
  ];

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-400 mt-1" />
            ) : (
              <p className="font-bold text-gray-800 mt-0.5">
                {!rec && 'Belum absen hari ini'}
                {clockedIn && !clockedOut && `Masuk ${String(rec.clockIn).slice(11, 16)}`}
                {clockedOut && `Pulang ${String(rec.clockOut).slice(11, 16)}`}
              </p>
            )}
          </div>
          <button
            onClick={() => navigate('/m/absen')}
            className="px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold"
          >
            {clockedIn && !clockedOut ? 'Pulang' : 'Absen'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={() => navigate(a.to)}
            className="bg-white rounded-2xl py-3.5 flex flex-col items-center gap-1.5 shadow-sm border border-gray-100"
          >
            <span className={`p-2 rounded-xl ${a.primary ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600'}`}>
              <a.icon className="w-5 h-5" />
            </span>
            <span className="text-[11px] font-semibold text-gray-700">{a.label}</span>
          </button>
        ))}
      </div>

      {mgr && (approvals as any)?.awaitingDecision > 0 && (
        <button
          onClick={() => navigate('/m/masuk')}
          className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-left"
        >
          <Inbox className="w-6 h-6 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold text-sm text-amber-800">
              {(approvals as any).awaitingDecision} pengajuan menunggu keputusan
            </p>
            <p className="text-xs text-amber-600">Ketuk untuk meninjau</p>
          </div>
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => navigate('/m/jadwal')}
          className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm border border-gray-100 text-left"
        >
          <CalendarClock className="w-6 h-6 text-red-600 shrink-0" />
          <span className="text-sm font-semibold text-gray-700">Jadwal Saya</span>
        </button>
        <button
          onClick={() => navigate('/m/riwayat')}
          className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm border border-gray-100 text-left"
        >
          <Clock className="w-6 h-6 text-red-600 shrink-0" />
          <span className="text-sm font-semibold text-gray-700">Riwayat Absen</span>
        </button>
      </div>
    </div>
  );
}
