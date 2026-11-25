import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BreadcrumbHeader, DataTable, type Column } from '@/components/shared';
import { Eye } from 'lucide-react';
import { hrService } from '@/services/hr.service';
import { api } from '@/services/api';

interface DivSummary {
  division: any;
  deptName: string;
  active: number;
  sum: number;
  amount: number | null;
}

const EPS = 1e-9;

/**
 * Master Data — Aspek KPI division list (mock v9 A).
 * Template: DataTable, Aksi left icon-only (centered), non-name columns centered.
 * The eye icon navigates to the division page; no detail state here.
 * Only dept heads (HS/SPV scoped) + CHR see this page.
 */
export default function KpiAspectMasterList() {
  const navigate = useNavigate();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['kpi-divisions-master'],
    queryFn: () => hrService.listKpiDivisions(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments-options'],
    queryFn: async () => {
      const res = await api.get('/departments');
      return (res.data?.data ?? []) as { id: string; name: string }[];
    },
  });

  const deptNameOf = (id?: string) => departments.find((d) => d.id === id)?.name || '—';

  const { data: summaries = [], isLoading: sumLoading } = useQuery({
    queryKey: ['kpi-master-summary', rows.map((r: any) => r.division.id).join(',')],
    queryFn: async (): Promise<DivSummary[]> =>
      Promise.all(
        rows.map(async (r: any) => {
          const [aspects, cfg] = await Promise.all([
            hrService.listKpiAspects(r.division.id),
            hrService.getKpiConfig(r.division.id).catch(() => null),
          ]);
          const active = (aspects || []).filter((a: any) => a.isActive !== false);
          const sum = active.reduce((s: number, a: any) => s + Number(a.weight || 0), 0);
          const amt = (cfg as any)?.defaultAmount ?? (cfg as any)?.config?.defaultAmount ?? null;
          return {
            division: r.division,
            deptName: deptNameOf(r.division.departmentId),
            active: active.length,
            sum,
            amount: amt !== null && amt !== undefined ? Number(amt) : null,
          };
        }),
      ),
    enabled: rows.length > 0,
  });

  const columns: Column<DivSummary>[] = [
    {
      key: 'division',
      header: 'Divisi',
      cell: (s) => (
        <div>
          <p className="font-medium">{s.division?.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{s.deptName}</p>
        </div>
      ),
    },
    {
      key: 'aspects',
      header: 'Aspek',
      headerClassName: 'text-center',
      className: 'text-center font-mono tabular-nums',
      cell: (s) => (s.active > 0 ? `${s.active} aktif` : '—'),
    },
    {
      key: 'weights',
      header: 'Bobot',
      headerClassName: 'text-center',
      className: 'text-center font-mono tabular-nums',
      cell: (s) => (
        <span style={{ color: Math.abs(s.sum - 1) > EPS ? '#b91c1c' : undefined }}>
          {s.sum.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Pengali',
      headerClassName: 'text-center',
      className: 'text-center font-mono tabular-nums',
      cell: (s) => (s.amount !== null ? `Rp${s.amount.toLocaleString('id-ID')}` : '—'),
    },
  ];

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader
        title="Aspek KPI"
        subtitle="Phase 1 — pilih divisi untuk kelola aspek + target + bobot"
      />
      <DataTable
        actionsPosition="left"
        columns={columns}
        data={summaries}
        keyExtractor={(s) => s.division.id}
        isLoading={isLoading || sumLoading}
        emptyMessage="Tidak ada divisi dalam lingkup Anda"
        actions={(s) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              title="Buka"
              onClick={() => navigate(`/hr/master-data/kpi/${s.division.id}`)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
        )}
      />
      <p className="text-xs text-muted-foreground">
        Bobot di bawah 1,00 menandai barisan — Assign di menu KPI tetap nonaktif sampai diperbaiki di sini.
      </p>
    </div>
  );
}
