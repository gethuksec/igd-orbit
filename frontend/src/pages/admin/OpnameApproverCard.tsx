import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { rolesService } from '@/services/roles.service';
import { toast } from 'sonner';
import { api } from '@/services/api';

/**
 * IGDERP-236 (OP4): Stock Opname approver — shared card rendered on
 * Administrator → Approval (sidebar entry) and mirrored on General.
 * Global default = a LIVE role code (default HS/Headstore); per-outlet person
 * override. Session start pre-fills from this; approval enforces it (403).
 */
export default function OpnameApproverCard() {
  const queryClient = useQueryClient();
  const [roleDraft, setRoleDraft] = useState<string | null>(null);
  const [overrideOutlet, setOverrideOutlet] = useState('');
  const [overrideUser, setOverrideUser] = useState('');

  const { data: setting, isLoading } = useQuery({
    queryKey: ['opname-approver-setting'],
    queryFn: () => inventoryService.getApproverSetting(),
  });

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches');
      return res.data.data || res.data;
    },
  });
  const branches: any[] = Array.isArray(branchesData) ? branchesData : [];

  const { data: usersData } = useQuery({
    queryKey: ['users-all'],
    queryFn: async () => {
      const res = await api.get('/users', { params: { page: 1, limit: 100 } });
      return res.data.data || res.data || [];
    },
  });
  const users: any[] = Array.isArray(usersData) ? usersData : [];

  const { data: rolesResp } = useQuery({
    queryKey: ['admin-approval-roles'],
    queryFn: () => rolesService.getAll({ limit: 100, isActive: true }),
  });
  const liveRoles: string[] = ((rolesResp as any)?.data || [])
    .map((r: any) => r.code)
    .filter(Boolean);

  const effectiveRole = roleDraft ?? setting?.defaultRole ?? 'HS';
  const roleOptions = useMemo(() => {
    const opts = liveRoles.length > 0 ? [...liveRoles] : ['HS'];
    if (setting?.defaultRole && !opts.includes(setting.defaultRole)) opts.unshift(setting.defaultRole);
    return opts;
  }, [liveRoles, setting]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['opname-approver-setting'] });

  const saveRole = useMutation({
    mutationFn: (role: string) => inventoryService.upsertApproverSetting({ role }),
    onSuccess: () => {
      toast.success('Peran approver default disimpan');
      setRoleDraft(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Gagal menyimpan'),
  });

  const saveOverride = useMutation({
    mutationFn: () =>
      inventoryService.upsertApproverSetting({ outletId: overrideOutlet, userId: overrideUser }),
    onSuccess: () => {
      toast.success('Override approver outlet disimpan');
      setOverrideOutlet('');
      setOverrideUser('');
      invalidate();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Gagal menyimpan'),
  });

  const clearOverride = useMutation({
    mutationFn: (outletId: string) =>
      inventoryService.upsertApproverSetting({ outletId, userId: null }),
    onSuccess: () => {
      toast.success('Override dihapus — kembali ke default');
      invalidate();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Gagal menghapus'),
  });

  const userName = (id: string) => {
    const u = users.find((x: any) => x.id === id);
    return u ? u.fullName || u.username || id : id;
  };
  const outletName = (id: string) => branches.find((b: any) => b.id === id)?.name || id;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Stock Opname Approver</h2>
        <p className="text-sm text-gray-500">
          Approver default sesi opname baru + override per outlet. Approval ditolak (403) untuk
          selain approver yang ditetapkan (kecuali OWNER/SUPERADMIN).
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Peran approver default (headstore)
              </label>
              <select
                value={effectiveRole}
                onChange={(e) => setRoleDraft(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              disabled={!roleDraft || roleDraft === setting?.defaultRole || saveRole.isPending}
              onClick={() => roleDraft && saveRole.mutate(roleDraft)}
            >
              {saveRole.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="ml-1">Simpan peran</span>
            </Button>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Override per outlet</h3>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Outlet</label>
                <select
                  value={overrideOutlet}
                  onChange={(e) => setOverrideOutlet(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
                >
                  <option value="">Pilih outlet</option>
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Approver</label>
                <select
                  value={overrideUser}
                  onChange={(e) => setOverrideUser(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
                >
                  <option value="">Pilih pengguna</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName || u.username}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                size="sm"
                disabled={!overrideOutlet || !overrideUser || saveOverride.isPending}
                onClick={() => saveOverride.mutate()}
              >
                {saveOverride.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span className="ml-1">Simpan override</span>
              </Button>
            </div>

            {(setting?.overrides ?? []).length > 0 && (
              <div className="mt-3 space-y-1.5">
                {(setting?.overrides ?? []).map((o: any) => (
                  <div
                    key={o.outletId}
                    className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm"
                  >
                    <span>
                      <b>{outletName(o.outletId)}</b> → {userName(o.userId)}
                    </span>
                    <button
                      onClick={() => clearOverride.mutate(o.outletId)}
                      disabled={clearOverride.isPending}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="Hapus override (kembali ke default)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
