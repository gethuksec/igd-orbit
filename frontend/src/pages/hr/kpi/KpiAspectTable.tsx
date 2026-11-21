import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { hrService, type KpiAspect } from '@/services/hr.service';
import { KpiAspectFields, emptyAspectForm, type AspectFormValue } from './KpiAspectFields';

const fmt2 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Editable aspect list for one division (IGDERP-266).
 * Used by the assign wizard (step 1) and the edit Aspek tab.
 * onStats reports the active bobot sum so the wizard can gate Next.
 */
export function KpiAspectTable({
  divisionId,
  onStats,
}: {
  divisionId: string;
  onStats?: (sum: number, count: number) => void;
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<AspectFormValue>(emptyAspectForm);
  const [drafts, setDrafts] = useState<Record<string, { weight?: string; target?: string }>>({});

  const key = ['kpi-aspects', divisionId];
  const { data: aspects = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => hrService.listKpiAspects(divisionId),
    enabled: !!divisionId,
  });

  const active = aspects.filter((a) => a.isActive !== false);
  const sum = active.reduce((s, a) => s + Number(a.weight), 0);
  useEffect(() => {
    if (onStats) onStats(sum, active.length);
  }, [sum, active.length]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ['kpi-grid'] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => hrService.updateKpiAspect(id, data),
    onSuccess: invalidate,
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Gagal menyimpan aspek');
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      hrService.createKpiAspect(divisionId, {
        code: form.code,
        name: form.name,
        description: form.description || undefined,
        weight: parseFloat(form.weight),
        target_type: form.target_type,
        fixed_target: form.fixed_target === '' ? null : parseFloat(form.fixed_target),
        is_kolektif: form.is_kolektif,
        sort_order: parseInt(form.sort_order || '0', 10),
      }),
    onSuccess: () => {
      toast.success('Aspek ditambahkan');
      setAdding(false);
      setForm(emptyAspectForm);
      invalidate();
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Gagal menambah aspek');
    },
  });

  const commit = (a: KpiAspect, field: 'weight' | 'fixed_target', raw: string) => {
    const v = parseFloat(raw);
    if (Number.isNaN(v)) return;
    if (field === 'weight' && (v <= 0 || v > 1)) {
      toast.error('Bobot harus di antara 0 dan 1');
      return;
    }
    updateMutation.mutate({ id: a.id, data: { [field]: v } });
  };

  const targetOf = (a: KpiAspect) =>
    drafts[a.id]?.target ?? (a.targetType === 'FIXED' ? String(a.fixedTarget ?? '') : '');

  if (isLoading) {
    return <p className="text-sm text-muted-foreground px-5 py-8">Memuat aspek...</p>;
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kode</TableHead>
            <TableHead>Aspek</TableHead>
            <TableHead className="text-right">Bobot</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Cakupan</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {active.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-mono text-[13px]">{a.code}</TableCell>
              <TableCell className="font-medium">{a.name}</TableCell>
              <TableCell className="text-right">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={drafts[a.id]?.weight ?? String(a.weight)}
                  onChange={(e) => setDrafts({ ...drafts, [a.id]: { ...drafts[a.id], weight: e.target.value } })}
                  onBlur={(e) => commit(a, 'weight', e.target.value)}
                  className="w-20 ml-auto font-mono tabular-nums text-right"
                />
              </TableCell>
              <TableCell>
                {a.targetType === 'FIXED' ? (
                  <Input
                    type="number"
                    value={targetOf(a)}
                    onChange={(e) => setDrafts({ ...drafts, [a.id]: { ...drafts[a.id], target: e.target.value } })}
                    onBlur={(e) => commit(a, 'fixed_target', e.target.value)}
                    className="w-24 font-mono tabular-nums text-right"
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">Per periode</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {a.isKolektif ? 'Kolektif' : 'Per karyawan'}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateMutation.mutate({ id: a.id, data: { is_active: false } })}
                >
                  Hapus
                </Button>
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/50">
            <TableCell />
            <TableCell className="font-medium">Total bobot</TableCell>
            <TableCell className="text-right font-mono tabular-nums font-medium">{fmt2.format(sum)}</TableCell>
            <TableCell />
            <TableCell />
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
      <div className="flex justify-end px-5 py-4">
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          Tambah aspek
        </Button>
      </div>
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah aspek</DialogTitle>
          </DialogHeader>
          <KpiAspectFields value={form} onChange={setForm} />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setAdding(false)}>
              Batal
            </Button>
            <Button
              className="flex-1"
              disabled={createMutation.isPending || !form.code || !form.name}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Menyimpan...' : 'Tambah'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
