import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BreadcrumbHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { hrService } from '@/services/hr.service';
import { KpiAspectFields, emptyAspectForm, type AspectFormValue } from '@/pages/hr/kpi/KpiAspectFields';

/**
 * Dedicated aspek edit page (mock v6 C).
 * Trimmed fields only; deactivation lives here in the nonaktif zone.
 */
export default function KpiAspectEdit() {
  const { divisionId = '', aspectId = '' } = useParams<{ divisionId: string; aspectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AspectFormValue>(emptyAspectForm);

  const back = () => navigate('/hr/master-data/kpi');

  const { data: aspects = [], isLoading } = useQuery({
    queryKey: ['kpi-aspects', divisionId],
    queryFn: () => hrService.listKpiAspects(divisionId),
    enabled: !!divisionId,
  });
  const aspect = aspects.find((a) => a.id === aspectId);

  useEffect(() => {
    if (aspect) {
      setForm({
        name: aspect.name ?? '',
        description: aspect.description ?? '',
        weight: String(aspect.weight ?? ''),
        fixed_target: aspect.fixedTarget !== null && aspect.fixedTarget !== undefined ? String(aspect.fixedTarget) : '',
        is_active: aspect.isActive !== false,
      });
    }
  }, [aspect?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['kpi-aspects', divisionId] });
    queryClient.invalidateQueries({ queryKey: ['kpi-master-summary'] });
    queryClient.invalidateQueries({ queryKey: ['kpi-grid'] });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      hrService.updateKpiAspect(aspectId, {
        name: form.name,
        description: form.description || null,
        weight: parseFloat(form.weight),
        fixed_target: form.fixed_target === '' ? null : parseFloat(form.fixed_target),
        is_active: form.is_active,
      }),
    onSuccess: () => {
      toast.success('Aspek tersimpan');
      invalidate();
      back();
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Gagal menyimpan aspek');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => hrService.updateKpiAspect(aspectId, { is_active: false }),
    onSuccess: () => {
      toast.success('Aspek dinonaktifkan');
      invalidate();
      back();
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Gagal menonaktifkan aspek');
    },
  });

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader title={`Edit aspek — ${aspect?.name || '...'}`} subtitle="Master Data Aspek KPI">
        <Button variant="outline" size="sm" onClick={back}>
          Kembali
        </Button>
      </BreadcrumbHeader>
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4">Memuat aspek...</p>
          ) : !aspect ? (
            <p className="text-sm text-destructive py-4">Aspek tidak ditemukan</p>
          ) : (
            <>
              <KpiAspectFields value={form} onChange={setForm} />
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={back}>
                  Batal
                </Button>
                <Button
                  className="flex-1"
                  disabled={saveMutation.isPending || !form.name}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? 'Menyimpan...' : 'Simpan perubahan'}
                </Button>
              </div>
              <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm space-y-2">
                <p className="font-medium">Zona nonaktif</p>
                <p className="text-muted-foreground text-xs">
                  Nonaktifkan aspek dari sini (riwayat periode berjalan tetap tersimpan).
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={deactivateMutation.isPending}
                  onClick={() => deactivateMutation.mutate()}
                >
                  {deactivateMutation.isPending ? 'Memproses...' : 'Nonaktifkan aspek'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
