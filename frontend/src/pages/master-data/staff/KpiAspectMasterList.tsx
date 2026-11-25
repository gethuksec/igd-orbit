import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BreadcrumbHeader, DataTable, type Column } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye } from 'lucide-react';
import { hrService } from '@/services/hr.service';
import { api } from '@/services/api';
import { KpiAspectTable } from '@/pages/hr/kpi/KpiAspectTable';
import { toast } from 'sonner';

interface DivSummary {
  division: any;
  deptName: string;
  active: number;
  sum: number;
  amount: number | null;
}

const EPS = 1e-9;

/**
 * Master Data — Aspek KPI (template: DataTable, Aksi left icon-only).
 * Default view: division table; the eye icon opens the aspect detail.
 * Only dept heads (HS/SPV scoped) + CHR see this page.
 */
export default function KpiAspectMasterList() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [amount, setAmount] = useState('');

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

  const selected = summaries.find((s) => s.division.id === selectedId) ||
    rows.find((r: any) => r.division.id === selectedId)?.division;

  const { data: config } = useQuery({
    queryKey: ['kpi-config-master', selectedId],
    queryFn: () => hrService.getKpiConfig(selectedId),
    enabled: !!selectedId,
  });

  useEffect(() => {
    const v = (config as any)?.defaultAmount;
    setAmount(v !== undefined && v !== null ? String(v) : '');
  }, [config, selectedId]);

  const saveAmount = useMutation({
    mutationFn: () => hrService.upsertKpiConfig(selectedId, { default_amount: parseFloat(amount) }),
    onSuccess: () => {
      toast.success('Pengali KPI divisi tersimpan');
      queryClient.invalidateQueries({ queryKey: ['kpi-config-master', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['kpi-master-summary'] });
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Gagal menyimpan pengali KPI');
    },
  });

  if (selectedId) {
    const div = (selected as DivSummary)?.division ?? (selected as any) ?? {};
    return (
      <div className="w-full space-y-6">
        <BreadcrumbHeader
          title={`Aspek KPI — ${div?.name || '...'}`}
          subtitle="Phase 1 — dept head kelola aspek + target + bobot"
        >
          <Button variant="outline" size="sm" onClick={() => setSelectedId('')}>
            Kembali ke daftar divisi
          </Button>
        </BreadcrumbHeader>
        <Card>
          <CardContent className="flex items-center gap-2 py-4">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Pengali (Rp)</span>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="mis. 700000"
              inputMode="decimal"
              className="w-40"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={amount === '' || saveAmount.isPending}
              onClick={() => saveAmount.mutate()}
            >
              {saveAmount.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Aspek + bobot</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <KpiAspectTable divisionId={selectedId} />
            <p className="px-5 py-3 text-xs text-muted-foreground border-t">
              Aspek yang sudah dipakai periode berjalan dikunci — perubahan struktural
              berlaku untuk periode berikutnya (buat aspek baru).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
      headerClassName: 'text-right',
      className: 'text-right font-mono tabular-nums',
      cell: (s) => (s.active > 0 ? `${s.active} aktif` : '—'),
    },
    {
      key: 'weights',
      header: 'Bobot',
      headerClassName: 'text-right',
      className: 'text-right font-mono tabular-nums',
      cell: (s) => (
        <span style={{ color: Math.abs(s.sum - 1) > EPS ? '#b91c1c' : undefined }}>
          {s.sum.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Pengali',
      headerClassName: 'text-right',
      className: 'text-right font-mono tabular-nums',
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
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              title="Buka"
              onClick={() => setSelectedId(s.division.id)}
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
