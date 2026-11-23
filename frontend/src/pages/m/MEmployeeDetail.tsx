import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { usersService } from '../../services/users.service';

/** IGDERP-276d: employee detail (mockup employee-detail) — real user data. */
export default function MEmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: u, isLoading } = useQuery({
    queryKey: ['m-employee', id],
    queryFn: () => usersService.getById(id as string),
    enabled: !!id,
    staleTime: 60_000,
  });

  const emp: any = (u as any)?.data ?? u;
  const name = emp?.employee?.fullName || emp?.fullName || emp?.email || '-';
  const rows: Array<[string, string]> = [
    ['Nama lengkap', name],
    ['Jabatan', emp?.employee?.position || '-'],
    ['Kode karyawan', emp?.employee?.employeeCode || '-'],
    ['Email', emp?.email || '-'],
    ['Telepon', emp?.employee?.phone || emp?.phone || '-'],
    [
      'Outlet',
      emp?.userBranches?.map((b: any) => b.branch?.name).filter(Boolean).join(', ') || '-',
    ],
  ];

  return (
    <div className="-mx-4 -mt-3">
      <div className="bg-white px-5 pt-12 pb-3 border-b border-gray-100 flex items-center gap-2">
        <button onClick={() => navigate(-1)} aria-label="Kembali" className="p-1 -ml-1">
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Detail karyawan</h1>
      </div>
      <div className="px-4 mt-3">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-700 text-xl font-bold flex items-center justify-center mb-3">
              {name[0].toUpperCase()}
            </div>
            {rows.map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between py-2.5 border-b border-dashed border-gray-200 last:border-0"
              >
                <span className="text-sm text-gray-500">{k}</span>
                <span className="text-sm font-semibold text-gray-900 text-right">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
