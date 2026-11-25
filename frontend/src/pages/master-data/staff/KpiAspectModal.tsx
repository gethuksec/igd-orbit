import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { hrService, type KpiAspect } from '@/services/hr.service';
import { KpiAspectFields, emptyAspectForm, type AspectFormValue } from '@/pages/hr/kpi/KpiAspectFields';

/**
 * Tambah/Edit aspect modal (mock v9 C/D).
 * Lives on the division page — no /new or /edit routes.
 * Create: trimmed fields, always aktif. Edit: + Status toggle.
 */
export function KpiAspectModal({
  divisionId,
  aspect,
  open,
  onClose,
}: {
  divisionId: string;
  aspect: KpiAspect | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!aspect;
  const [form, setForm] = useState<AspectFormValue>(emptyAspectForm);

  useEffect(() => {
    if (open) {
      setForm(
        aspect
          ? {
              name: aspect.name ?? '',
              description: aspect.description ?? '',
              weight: String(aspect.weight ?? ''),
              fixed_target:
                aspect.fixedTarget !== null && aspect.fixedTarget !== undefined
                  ? String(aspect.fixedTarget)
                  : '',
              is_active: aspect.isActive !== false,
            }
          : emptyAspectForm,
      );
    }
  }, [open, aspect?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['kpi-aspects', divisionId] });
    queryClient.invalidateQueries({ queryKey: ['kpi-master-summary'] });
    queryClient.invalidateQueries({ queryKey: ['kpi-grid'] });
  };

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? hrService.updateKpiAspect(aspect!.id, {
            name: form.name,
            description: form.description || null,
            weight: parseFloat(form.weight),
            fixed_target: form.fixed_target === '' ? null : parseFloat(form.fixed_target),
            is_active: form.is_active,
          })
        : hrService.createKpiAspect(divisionId, {
            name: form.name,
            description: form.description || undefined,
            weight: parseFloat(form.weight),
            fixed_target: form.fixed_target === '' ? null : parseFloat(form.fixed_target),
          }),
    onSuccess: () => {
      toast.success(isEdit ? 'Aspek tersimpan' : 'Aspek ditambahkan');
      invalidate();
      onClose();
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || (isEdit ? 'Gagal menyimpan aspek' : 'Gagal menambah aspek'));
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit aspek — ${aspect?.name || '...'}` : 'Tambah aspek'}</DialogTitle>
        </DialogHeader>
        <KpiAspectFields value={form} onChange={setForm} showActive={isEdit} />
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Batal
          </Button>
          <Button
            className="flex-1"
            disabled={mutation.isPending || !form.name}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Menyimpan...' : isEdit ? 'Simpan perubahan' : 'Tambah aspek'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
