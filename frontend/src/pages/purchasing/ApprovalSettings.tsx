import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Save, Loader2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { purchasingService } from '@/services/purchasing.service';
import { usersService } from '@/services/users.service';

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Super Admin',
  OWNER: 'Owner',
  MGR: 'Manajer',
  CFO: 'CFO',
  CMO: 'CMO',
  CSO: 'CSO',
  SPV: 'Supervisor',
  HS: 'Head Store',
  SODO: 'SODO',
  ASA: 'Asisten',
};

/** Roles eligible as approvers (shown as quick-pick chips). */
const APPROVER_ROLES = ['SUPERADMIN', 'OWNER', 'MGR', 'CFO', 'CSO', 'SPV', 'HS', 'CHR'];
/** Roles shown in the per-user picker. */
const PICKER_ROLE_CODES = ['HS', 'SPV', 'CSO', 'OWNER', 'CFO', 'MGR', 'CHR'];

const CATEGORY_LABEL: Record<string, string> = {
  PURCHASE_INVOICE: 'Purchase Invoice',
  GOODS_RECEIPT: 'Goods Receipt',
};

export default function ApprovalSettingsPage() {
  const queryClient = useQueryClient();
  const { data: approvalSettings = [] } = useQuery({
    queryKey: ['approval-settings'],
    queryFn: () => purchasingService.getApprovalSettings(),
  });
  const { data: usersResp } = useQuery({
    queryKey: ['users', 'approval-picker'],
    queryFn: () => usersService.getAll({ limit: 100, sort: 'name', order: 'asc' }),
  });

  const approverUsers = useMemo(() => {
    const items: any[] = (usersResp as any)?.data || [];
    return items.filter((u: any) =>
      (u.roles || []).some((r: any) => PICKER_ROLE_CODES.includes(r.code)),
    );
  }, [usersResp]);

  const [draft, setDraft] = useState<Record<string, any>>({});

  useEffect(() => {
    if (approvalSettings.length && Object.keys(draft).length === 0) {
      setDraft(
        Object.fromEntries(
          approvalSettings.map((s: any) => [
            s.category,
            { roles: s.roles || [], userIds: s.userIds || [], mandatoryInvoice: !!s.mandatoryInvoice },
          ]),
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalSettings]);

  const toggleIn = (category: string, key: 'roles' | 'userIds', value: string) => {
    setDraft((d: any) => {
      const base = d[category] || { roles: [], userIds: [], mandatoryInvoice: false };
      const cur: string[] = base[key] || [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...d, [category]: { ...base, [key]: next } };
    });
  };

  const toggleMandatoryInvoice = (category: string) => {
    setDraft((d: any) => ({
      ...d,
      [category]: { ...(d[category] || { roles: [], userIds: [] }), mandatoryInvoice: !d[category]?.mandatoryInvoice },
    }));
  };

  const saveMutation = useMutation({
    mutationFn: (payload: { category: string; roles: string[]; userIds: string[]; mandatoryInvoice: boolean }) =>
      purchasingService.updateApprovalSetting(payload.category, {
        roles: payload.roles,
        userIds: payload.userIds,
        mandatoryInvoice: payload.mandatoryInvoice,
      }),
  });

  const handleSave = () => {
    const payloads = ['PURCHASE_INVOICE', 'GOODS_RECEIPT']
      .filter((c) => draft[c])
      .map((c) => ({
        category: c,
        roles: draft[c].roles || [],
        userIds: draft[c].userIds || [],
        mandatoryInvoice: !!draft[c].mandatoryInvoice,
      }));
    if (!payloads.length) {
      toast.error('Tidak ada pengaturan untuk disimpan');
      return;
    }
    Promise.all(payloads.map((p) => saveMutation.mutateAsync(p)))
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['approval-settings'] });
        toast.success('Pengaturan persetujuan tersimpan');
      })
      .catch((e) => toast.error(e?.response?.data?.message || 'Gagal menyimpan pengaturan'));
  };

  return (
    <div className="space-y-6">
      <BreadcrumbHeader title="Persetujuan Pembelian" />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <CardTitle>Persetujuan Pembelian</CardTitle>
          </div>
          <CardDescription>
            Atur siapa yang menyetujui dokumen pembelian. Kosongkan semua peran & pengguna untuk
            kembali ke perilaku default (HS / SPV / CSO / Owner + Super Admin).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(['PURCHASE_INVOICE', 'GOODS_RECEIPT'] as const).map((cat) => {
            const s = draft[cat] || { roles: [], userIds: [], mandatoryInvoice: false };
            const isCustom = (s.roles?.length ?? 0) > 0 || (s.userIds?.length ?? 0) > 0;
            return (
              <div key={cat} className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{CATEGORY_LABEL[cat]}</h3>
                  <Badge variant={isCustom ? 'default' : 'secondary'}>
                    {isCustom ? 'Kustom' : 'Default'}
                  </Badge>
                </div>

                <Label className="mb-2 block text-muted-foreground">Peran approver</Label>
                <div className="flex flex-wrap gap-2">
                  {APPROVER_ROLES.map((role) => {
                    const on = (s.roles || []).includes(role);
                    return (
                      <Button
                        key={role}
                        type="button"
                        size="sm"
                        variant={on ? 'default' : 'outline'}
                        onClick={() => toggleIn(cat, 'roles', role)}
                      >
                        {ROLE_LABELS[role] || role}
                      </Button>
                    );
                  })}
                </div>

                <Separator className="my-4" />
                <Label className="mb-2 block text-muted-foreground">Pengguna tertentu (opsional)</Label>
                {approverUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada pengguna dengan peran approver.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {approverUsers.map((u: any) => {
                      const on = (s.userIds || []).includes(u.id);
                      const role = (u.roles || []).find((r: any) => PICKER_ROLE_CODES.includes(r.code))?.code || '';
                      return (
                        <Button
                          key={u.id}
                          type="button"
                          size="sm"
                          variant={on ? 'default' : 'outline'}
                          onClick={() => toggleIn(cat, 'userIds', u.id)}
                          title={u.email}
                        >
                          <UserRound className="w-3.5 h-3.5" />
                          {u.fullName || u.name || u.email?.split('@')[0]}
                          {role && <span className="text-[10px] opacity-80">· {role}</span>}
                        </Button>
                      );
                    })}
                  </div>
                )}

                {cat === 'GOODS_RECEIPT' && (
                  <div className="mt-5 flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
                    <div>
                      <Label>Invoice wajib sebelum approve</Label>
                      <p className="text-xs text-muted-foreground">
                        #81 — opsional secara default; aktifkan bila klien meminta.
                      </p>
                    </div>
                    <Switch
                      checked={!!s.mandatoryInvoice}
                      onCheckedChange={() => toggleMandatoryInvoice(cat)}
                    />
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Simpan Pengaturan
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
