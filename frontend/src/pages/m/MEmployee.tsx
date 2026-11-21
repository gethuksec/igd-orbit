import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Loader2, Users } from 'lucide-react';
import { usersService } from '../../services/users.service';
import { hrService } from '../../services/hr.service';
import { isManagerLike, useMe } from './MobileShell';

const PASTELS = [
  'bg-pink-100 text-pink-700',
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
];

function initialsOf(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** IGDERP-276d: mockup-faithful Employee directory — white header,
 *  outlet + headcount, cards with initials / name / role / Cuti badge. */
export default function MEmployee() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const mgr = isManagerLike(me);

  const { data, isLoading } = useQuery({
    queryKey: ['m-employee'],
    queryFn: () => usersService.getAll({ limit: 100 }),
    staleTime: 60_000,
  });
  // Managers: badge colleagues on approved leave covering today.
  const { data: leaves } = useQuery({
    queryKey: ['m-employee-leaves'],
    queryFn: () => hrService.getLeaveRequests({ status: 'approved', limit: 100 } as any),
    enabled: mgr,
    staleTime: 300_000,
    retry: false,
  });

  const rows: any[] = (data as any)?.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const onLeaveIds = new Set(
    (((leaves as any)?.data ?? []) as any[])
      .filter(
        (l) =>
          String(l.startDate ?? '').slice(0, 10) <= today &&
          today <= String(l.endDate ?? '').slice(0, 10)
      )
      .map((l) => l.userId || l.employee?.userId || l.employeeId)
      .filter(Boolean)
  );

  const outlet = me?.userBranches?.[0]?.branch?.name || '';

  return (
    <div className="-mx-4 -mt-3">
      <div className="bg-white px-5 pt-12 pb-3 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Employee</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {[outlet, `${rows.length} karyawan`].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="px-4 mt-3 space-y-2 pb-2">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : !rows.length ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Tidak ada karyawan ditemukan</p>
          </div>
        ) : (
          rows.map((u: any, i: number) => {
            const empName = u.employee?.fullName || u.fullName || u.email || '?';
            const role = u.employee?.position || u.userBranches?.[0]?.branch?.name || u.email;
            const uid = u.id || u.employee?.userId;
            return (
              <button
                key={u.id ?? i}
                onClick={() => u.id && navigate(`/m/employee/${u.id}`)}
                className="w-full bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 flex items-center gap-3 text-left"
              >
                <div
                  className={`w-10 h-10 rounded-full font-bold flex items-center justify-center shrink-0 ${PASTELS[i % PASTELS.length]}`}
                >
                  {initialsOf(empName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 truncate">{empName}</p>
                  <p className="text-xs text-gray-500 truncate">{role}</p>
                </div>
                {uid && onLeaveIds.has(uid) && (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-100 rounded-full px-2.5 py-1 shrink-0">
                    Cuti
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
