import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Loader2 } from 'lucide-react';
import { shiftsService } from '../../services/shifts.service';
import { useMe } from './MobileShell';

/** IGDERP-276: jadwal shift saya (penugasan aktif). */
export default function MSchedule() {
  const { data: me } = useMe();
  const empId = me?.employee?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['m-schedule', empId],
    queryFn: () => shiftsService.getAssignments({ employeeId: empId, limit: 50 }),
    enabled: !!empId,
    staleTime: 60_000,
  });

  const rows = data?.data ?? [];

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
        <CalendarClock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Belum ada jadwal shift untuk Anda</p>
      </div>
    );
  }

  const dayName = (n: number) => ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][n] ?? n;

  return (
    <div className="space-y-2">
      {rows.map((a) => (
        <div key={a.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm text-gray-800">{a.shift?.name ?? 'Shift'}</p>
            <p className="text-xs font-semibold text-red-600">
              {a.shift?.clockIn?.slice(0, 5)}–{a.shift?.clockOut?.slice(0, 5)}
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {(a.weekdays ?? []).map(dayName).join(' · ')}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {String(a.startDate).slice(0, 10)}
            {a.endDate ? ` s/d ${String(a.endDate).slice(0, 10)}` : ' — seterusnya'}
          </p>
        </div>
      ))}
    </div>
  );
}
