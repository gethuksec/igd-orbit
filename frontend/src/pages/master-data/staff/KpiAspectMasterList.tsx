import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BreadcrumbHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { hrService } from '@/services/hr.service';
import { KpiAspectTable } from '@/pages/hr/kpi/KpiAspectTable';
import { toast } from 'sonner';

/**
 * Master Data — Aspek KPI per divisi (D6 Phase 1).
 * Dept heads (L1-L3) kelola aspek + target + bobot di sini;
 * Assign KPI (Phase 2) tinggal prefill dari master ini.
 * Structural edits dibekukan BE setelah aspek dipakai periode berjalan.
 */
export default function KpiAspectMasterList() {
  const queryClient = useQueryClient();
  const [divisionId, setDivisionId] = useState('');
  const [amount, setAmount] = useState('');

  const { data: rows = [], isLoading: divLoading } = useQuery({
    queryKey: ['kpi-divisions-master'],
    queryFn: () => hrService.listKpiDivisions(),
  });

  const activeId = divisionId || rows[0]?.division?.id || '';

  const { data: config } = useQuery({
    queryKey: ['kpi-config-master', activeId],
    queryFn: () => hrService.getKpiConfig(activeId),
    enabled: !!activeId,
  });

  useEffect(() => {
    if (config && (config as any).defaultAmount !== undefined && (config as any).defaultAmount !== null) {
      setAmount(String((config as any).defaultAmount));
    } else {
      setAmount('');
    }
  }, [config]);

  const saveAmount = useMutation({
    mutationFn: () => hrService.upsertKpiConfig(activeId, { default_amount: parseFloat(amount) }),
    onSuccess: () => {
      toast.success('Default KPI divisi tersimpan');
      queryClient.invalidateQueries({ queryKey: ['kpi-config-master', activeId] });
      queryClient.invalidateQueries({ queryKey: ['kpi-divisions'] });
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Gagal menyimpan default KPI');
    },
  });

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader
        title="Aspek KPI"
        subtitle="Phase 1 — dept head kelola aspek + target + bobot per divisi"
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Divisi</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={activeId}
            onChange={(e) => setDivisionId(e.target.value)}
            className="w-full sm:max-w-sm px-3 py-2 border rounded-lg text-sm bg-background"
            disabled={divLoading || rows.length === 0}
          >
            {rows.map((r) => (
              <option key={r.division.id} value={r.division.id}>
                {r.division.name} ({r.division.code})
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Default (Rp)</span>
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
              disabled={!activeId || amount === '' || saveAmount.isPending}
              onClick={() => saveAmount.mutate()}
            >
              {saveAmount.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </CardContent>
      </Card>
      {activeId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Aspek + bobot</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <KpiAspectTable divisionId={activeId} />
            <p className="px-5 py-3 text-xs text-muted-foreground border-t">
              Aspek yang sudah dipakai periode berjalan dikunci — perubahan struktural
              berlaku untuk periode berikutnya (buat aspek baru).
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground">
            {divLoading ? 'Memuat divisi...' : 'Tidak ada divisi dalam lingkup Anda'}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
