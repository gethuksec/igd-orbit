import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BreadcrumbHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { hrService, type KpiAspect } from '@/services/hr.service';
import { KpiAspectTable } from '@/pages/hr/kpi/KpiAspectTable';
import { KpiAspectModal } from './KpiAspectModal';

/**
 * Master Data — Aspek KPI division page (mock v9 B).
 * Route: /hr/master-data/kpi/:divisionId
 * Pengali card (editable here only) + aspect table.
 * Tambah/Edit are modals on this page — create/edit stay here, never the list.
 */
export default function KpiAspectDivision() {
  const { divisionId = '' } = useParams<{ divisionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<KpiAspect | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ['kpi-divisions-master'],
    queryFn: () => hrService.listKpiDivisions(),
  });
  const division = rows.find((r: any) => r.division.id === divisionId)?.division;

  const { data: config } = useQuery({
    queryKey: ['kpi-config-master', divisionId],
    queryFn: () => hrService.getKpiConfig(divisionId),
    enabled: !!divisionId,
  });

  useEffect(() => {
    const v = (config as any)?.defaultAmount ?? (config as any)?.config?.defaultAmount;
    setAmount(v !== undefined && v !== null ? String(v) : '');
  }, [config, divisionId]);

  const saveAmount = useMutation({
    mutationFn: () => hrService.upsertKpiConfig(divisionId, { default_amount: parseFloat(amount) }),
    onSuccess: () => {
      toast.success('Pengali KPI divisi tersimpan');
      queryClient.invalidateQueries({ queryKey: ['kpi-config-master', divisionId] });
      queryClient.invalidateQueries({ queryKey: ['kpi-master-summary'] });
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Gagal menyimpan pengali KPI');
    },
  });

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader
        title={`Aspek KPI — ${division?.name || '...'}`}
        subtitle="Phase 1 — dept head kelola aspek + target + bobot"
      >
        <Button variant="outline" size="sm" onClick={() => navigate('/hr/master-data/kpi')}>
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
          <KpiAspectTable
            divisionId={divisionId}
            onCreate={() => setCreateOpen(true)}
            onEdit={(a) => setEditing(a)}
          />
        </CardContent>
      </Card>
      <KpiAspectModal divisionId={divisionId} aspect={null} open={createOpen} onClose={() => setCreateOpen(false)} />
      <KpiAspectModal divisionId={divisionId} aspect={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}
