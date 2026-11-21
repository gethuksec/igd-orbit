import { useQuery } from '@tanstack/react-query';
import { CalendarX2, Loader2 } from 'lucide-react';
import { hrService, type Attendance } from '../../services/hr.service';

/** IGDERP-276: riwayat absensi saya (30 hari terakhir). */
export default function MHistory() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const { data, isLoading } = useQuery({
    queryKey: ['m-history'],
    queryFn: () => hrService.getAttendances({ startDate: fmt(start), endDate: fmt(end) }),
    staleTime: 60_000,
  });

  const rows: Attendance[] = (data as any)?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
        <CalendarX2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Belum ada riwayat absensi 30 hari terakhir</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r: any) => (
        <div key={r.id} className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-800">
              {new Date(r.workDate ?? r.createdAt).toLocaleDateString('id-ID', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </p>
            <p className="text-xs text-gray-500">
              {r.clockIn ? `Masuk ${String(r.clockIn).slice(11, 16)}` : '—'}
              {' · '}
              {r.clockOut ? `Pulang ${String(r.clockOut).slice(11, 16)}` : 'belum pulang'}
            </p>
          </div>
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
              r.isLate ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
            }`}
          >
            {r.isLate ? `Terlambat ${r.lateMinutes ?? ''} mnt`.trim() : r.clockOut ? 'Tepat waktu' : 'Berjalan'}
          </span>
        </div>
      ))}
    </div>
  );
}
