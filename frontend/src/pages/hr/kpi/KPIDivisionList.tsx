import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BreadcrumbHeader, DataTable, type Column } from '@/components/shared';
import { StatusDot } from '@/components/shared/StatusDot';
import { Button } from '@/components/ui/button';
import { hrService, type KpiDivisionRow } from '@/services/hr.service';

/**
 * KPI division list (IGDERP-266): one row per division for the running
 * month. Super roles see all divisions, superiors see their own.
 */
export default function KPIDivisionList() {
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['kpi-divisions'],
    queryFn: () => hrService.listKpiDivisions(),
  });

  const statusOf = (s: KpiDivisionRow['status']) =>
    s === 'approved' ? (
      <StatusDot tone="bad">Approved by HR</StatusDot>
    ) : s === 'assigned' ? (
      <StatusDot tone="warn">Assigned</StatusDot>
    ) : (
      <StatusDot tone="off">Belum assign</StatusDot>
    );

  const columns: Column<KpiDivisionRow>[] = [
    {
      key: 'division',
      header: 'Divisi',
      cell: (r) => (
        <div>
          <p className="font-medium">{r.division?.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{r.division?.code}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => statusOf(r.status),
    },
    {
      key: 'employees',
      header: 'Karyawan',
      headerClassName: 'text-right',
      className: 'text-right font-mono tabular-nums',
      cell: (r) => (r.employeeCount > 0 ? String(r.employeeCount) : '—'),
    },
  ];

  const actions = (r: KpiDivisionRow) =>
    r.status === 'unassigned' ? (
      <Button
        size="sm"
        variant="outline"
        className="text-primary border-primary"
        onClick={() => navigate(`/hr/kpi/assign?division=${r.division.id}`)}
      >
        Assign
      </Button>
    ) : (
      <Button size="sm" variant="outline" onClick={() => navigate(`/hr/kpi/division/${r.division.id}`)}>
        {r.status === 'approved' ? 'Lihat' : 'Edit'}
      </Button>
    );

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader title="KPI divisi" subtitle="Periode berjalan, satu baris per divisi" />
      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={(r) => r.division.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada divisi dalam lingkup Anda"
        actions={actions}
      />
    </div>
  );
}
