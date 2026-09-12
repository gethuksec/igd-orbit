import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2 } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { rolesService } from '@/services/roles.service';

// IGDERP-171: general approval settings — approver roles per category.
// SERVICE_PAYMENT_VOID gates Smart Repair payment voids (assertApprover server-side;
// blank row falls back to DEFAULT_APPROVER_ROLES).
const CATEGORY_LABEL: Record<string, string> = {
  SERVICE_PAYMENT_VOID: 'Void Pembayaran Service',
};

export default function ServiceApprovalSettings() {
  const queryClient = useQueryClient();
  const [roles, setRoles] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data: settings = [] } = useQuery({
    queryKey: ['admin-approval-settings'],
    queryFn: async () => {
      const res = await api.get('/approval-settings');
      return res.data.data || res.data || [];
    },
  });

  const { data: rolesResp } = useQuery({
    queryKey: ['admin-approval-roles'],
    queryFn: () => rolesService.getAll({ limit: 100, isActive: true }),
  });
  const allRoles: string[] = ((rolesResp as any)?.data || [])
    .map((r: any) => r.code)
    .filter(Boolean);

  useEffect(() => {
    const row = (settings as any[]).find((s) => s.category === 'SERVICE_PAYMENT_VOID');
    setRoles(row?.roles || []);
    setDirty(false);
  }, [settings]);

  const toggle = (code: string) =>
    setRoles((rs) => {
      setDirty(true);
      return rs.includes(code) ? rs.filter((r) => r !== code) : [...rs, code];
    });

  const saveMutation = useMutation({
    mutationFn: () => api.put('/approval-settings/SERVICE_PAYMENT_VOID', { roles }),
    onSuccess: () => {
      toast.success('Approver void pembayaran tersimpan');
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['admin-approval-settings'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menyimpan'),
  });

  const isCustom = roles.length > 0;

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Approval" subtitle="Atur alur persetujuan transaksi" />
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{CATEGORY_LABEL.SERVICE_PAYMENT_VOID}</h3>
          <Badge variant={isCustom ? 'default' : 'secondary'}>
            {isCustom ? 'Kustom' : 'Default (Superadmin/HS/SPV/CSO/Owner)'}
          </Badge>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Peran yang boleh me-void pembayaran Smart Repair yang salah input. Kosongkan untuk
          memakai default.
        </p>
        <Label className="mb-2 block text-muted-foreground">Peran approver</Label>
        <div className="flex flex-wrap gap-2">
          {allRoles.map((code) => {
            const on = roles.includes(code);
            return (
              <Button
                key={code}
                type="button"
                size="sm"
                variant={on ? 'default' : 'outline'}
                onClick={() => toggle(code)}
              >
                {code}
              </Button>
            );
          })}
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !dirty}>
            {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            Simpan
          </Button>
        </div>
      </div>
    </div>
  );
}
