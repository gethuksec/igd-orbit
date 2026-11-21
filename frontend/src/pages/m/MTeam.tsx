import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Loader2, Search, Users } from 'lucide-react';
import { usersService } from '../../services/users.service';

/** IGDERP-276: tim — daftar karyawan (cari + lihat). */
export default function MTeam() {
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['m-team', q],
    queryFn: () => usersService.getAll({ search: q || undefined, limit: 50 }),
    staleTime: 60_000,
  });

  const rows: any[] = (data as any)?.data ?? [];

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama..."
          className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm"
        />
      </div>
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
        rows.map((u: any) => (
          <div key={u.id} className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 font-bold flex items-center justify-center shrink-0">
              {(u.employee?.fullName || u.fullName || u.email || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-800 truncate">
                {u.employee?.fullName || u.fullName || u.email}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {u.employee?.position || u.userBranches?.[0]?.branch?.name || u.email}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
