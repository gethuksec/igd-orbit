import { useParams, Link } from 'react-router-dom';
import { BreadcrumbHeader } from '@/components/shared';
import { StatusDot } from '@/components/shared/StatusDot';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Clock } from 'lucide-react';
import { hrService } from '@/services/hr.service';

const fmt2 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtRp = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

/**
 * Staff read-only KPI view (IGDERP-266).
 * Route /hr/kpi/employee/:id where :id is the user id — approved periods only.
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
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">Memuat data...</CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full space-y-6">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive">Gagal memuat data KPI</p>
            <Link to="/hr/kpi" className="mt-4 inline-block text-primary hover:underline text-sm">
              Kembali
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const periods: any[] = data.periods || [];

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader title="KPI saya" subtitle={data.employee?.employeeCode || ''} />
      {periods.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Belum ada periode KPI yang di-approve untuk Anda</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {periods.map((p: any) => (
            <Card key={`${p.periodYear}-${p.periodMonth}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-medium text-lg">
                    {new Date(2000, p.periodMonth - 1).toLocaleString('id-ID', { month: 'long' })} {p.periodYear}
                  </p>
                  {p.status === 'approved' || p.status === 'locked' ? (
                    <StatusDot tone="bad">Approved by HR</StatusDot>
                  ) : (
                    <StatusDot tone="warn">{p.status === 'excluded' ? 'Tanpa KPI (masa percobaan)' : 'Berjalan'}</StatusDot>
                  )}
                </div>
                {p.reason && <p className="text-sm text-muted-foreground mb-2">{p.reason}</p>}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total skor</p>
                    <p className="font-mono tabular-nums text-xl text-muted-foreground">
                      {p.total != null ? fmt2.format(p.total) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Nilai</p>
                    <p className="font-mono tabular-nums text-xl font-medium">
                      {p.nilai != null ? fmt2.format(p.nilai) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Bonus</p>
                    <p className="font-mono tabular-nums text-xl">{p.bonus != null ? fmtRp.format(p.bonus) : '—'}</p>
                  </div>
                </div>
                {p.note && <p className="mt-4 text-sm text-muted-foreground italic">“{p.note}”</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
