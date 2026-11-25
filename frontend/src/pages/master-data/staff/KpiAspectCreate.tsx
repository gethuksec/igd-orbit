import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BreadcrumbHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { hrService } from '@/services/hr.service';
import { KpiAspectFields, emptyAspectForm, type AspectFormValue } from '@/pages/hr/kpi/KpiAspectFields';

/**
 * Dedicated aspek create page (mock v6 D).
 * Same trimmed form as edit, minus Status — new aspects are always active.
 */
export default function KpiAspectCreate() {
  const { divisionId = '' } = useParams<{ divisionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AspectFormValue>(emptyAspectForm);

  const back = () => navigate('/hr/master-data/kpi');

  const createMutation = useMutation({
    mutationFn: () =>
      hrService.createKpiAspect(divisionId, {
        name: form.name,
        description: form.description || undefined,
        weight: parseFloat(form.weight),
        fixed_target: form.fixed_target === '' ? null : parseFloat(form.fixed_target),
      }),
    onSuccess: () => {
      toast.success('Aspek ditambahkan');
      queryClient.invalidateQueries({ queryKey: ['kpi-aspects', divisionId] });
      queryClient.invalidateQueries({ queryKey: ['kpi-master-summary'] });
      back();
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Gagal menambah aspek');
    },
  });

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader
        title="Tambah aspek"
        subtitle="Aspek baru selalu aktif — nonaktifkan belakangan dari halaman edit bila perlu."
      >
        <Button variant="outline" size="sm" onClick={back}>
          Kembali
        </Button>
      </BreadcrumbHeader>
      <Card>
        <CardContent className="pt-6">
          <KpiAspectFields value={form} onChange={setForm} showActive={false} />
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={back}>
              Batal
            </Button>
            <Button
              className="flex-1"
              disabled={createMutation.isPending || !form.name}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Menyimpan...' : 'Tambah aspek'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
