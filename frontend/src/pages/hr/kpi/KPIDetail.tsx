import { useParams, Link } from 'react-router-dom';
import { BreadcrumbHeader } from '@/components/shared';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Lock, Clock } from 'lucide-react';
import { hrService } from '@/services/hr.service';
import { formatCurrency } from '@/utils/format';

/**
 * Staff read-only KPI view (IGDERP-266).
 * Route /hr/kpi/:id where :id is the user id — shows locked periods only.
 */
export default function KPIDetail() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['kpi-employee', id],
    queryFn: () => hrService.getEmployeeKpi(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="w-full space-y-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full space-y-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">Gagal memuat data KPI</p>
          <Link to="/hr/kpi" className="mt-4 text-purple-600 hover:underline">
            Kembali
          </Link>
        </div>
      </div>
    );
  }

  const periods: any[] = data.periods || [];

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader title="KPI Saya" subtitle={data.employee?.employeeCode || ''} />
      {periods.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Belum ada periode KPI yang dikunci untuk Anda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {periods.map((p: any) => (
            <div
              key={`${p.periodYear}-${p.periodMonth}`}
              className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="font-bold text-lg">
                  {new Date(2000, p.periodMonth - 1).toLocaleString('id-ID', { month: 'long' })} {p.periodYear}
                </p>
                {p.status === 'locked' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 dark:bg-green-950 rounded-full px-2 py-1">
                    <Lock className="w-3 h-3" /> Terkunci
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-100 dark:bg-yellow-950 rounded-full px-2 py-1">
                    <Clock className="w-3 h-3" /> {p.status === 'excluded' ? 'Tanpa KPI (masa percobaan)' : 'Berjalan'}
                  </span>
                )}
              </div>
              {p.reason && <p className="text-sm text-gray-500 mb-2">{p.reason}</p>}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500">Total skor</p>
                  <p className="text-xl font-bold">{p.total != null ? Number(p.total).toFixed(2) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Nilai</p>
                  <p className="text-xl font-bold text-purple-600">{p.nilai != null ? Number(p.nilai).toFixed(1) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Bonus</p>
                  <p className="text-xl font-bold text-green-600">{p.bonus != null ? formatCurrency(p.bonus) : '—'}</p>
                </div>
              </div>
              {p.note && <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 italic">“{p.note}”</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
