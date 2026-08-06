import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Trash2, Plus, Lock, KeyRound, X } from 'lucide-react';
import { usersService, type User, type UserRole } from '../../../services/users.service';
import { rolesService } from '../../../services/roles.service';
import { publicService } from '../../../services/public.service';
import { toast } from 'sonner';
import { Modal } from '../../../components/ui/modal';
import { labelForPermission } from '../../../utils/permissionLabels';

interface PenugasanRow {
  key: string;
  ubId: string | null; // existing UserBranch id (null = new)
  roleId: string;
  branchId: string;
  denied: string[];
}

interface UserFormModalProps {
  open: boolean;
  /** Existing user (edit mode) or null (create mode) */
  user: User | null;
  onClose: () => void;
  onSaved?: () => void;
}

let rowSeq = 0;
const nextKey = () => `row-${++rowSeq}`;

export function UserFormModal({ open, user, onClose, onSaved }: UserFormModalProps) {
  const isEdit = !!user;
  const queryClient = useQueryClient();

  const [basic, setBasic] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    isActive: true,
    canChangePassword: true,
  });
  const [rows, setRows] = useState<PenugasanRow[]>([]);
  const [expandedDeny, setExpandedDeny] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesService.getAll({ limit: 100, isActive: true }),
  });
  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => publicService.getBranches(),
  });

  // roleId for an existing assignment = match by code (transformer returns code, not roleId)
  const codeToRoleId = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rolesData?.data || []) map.set(r.code, r.id);
    return map;
  }, [rolesData]);

  useEffect(() => {
    if (!open) return;
    if (user) {
      setBasic({
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || '',
        password: '',
        isActive: user.isActive ?? true,
        canChangePassword: user.canChangePassword ?? true,
      });
      setRows(
        (user.roles || []).map((ur: UserRole) => ({
          key: nextKey(),
          ubId: ur.id,
          roleId: codeToRoleId.get(ur.code) || '',
          branchId: ur.branchId || '',
          denied: (ur as any).deniedPermissions || [],
        })),
      );
    } else {
      setBasic({ fullName: '', email: '', phone: '', password: '', isActive: true, canChangePassword: true });
      setRows([]);
    }
    setExpandedDeny(null);
  }, [open, user, codeToRoleId]);

  const addRow = () => {
    setRows((prev) => [...prev, { key: nextKey(), ubId: null, roleId: '', branchId: '', denied: [] }]);
  };
  const updateRow = (key: string, patch: Partial<PenugasanRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      // 1) Basic info
      let userId = user?.id;
      if (isEdit) {
        await usersService.update(user!.id, {
          email: basic.email,
          fullName: basic.fullName,
          phone: basic.phone || undefined,
          isActive: basic.isActive,
          canChangePassword: basic.canChangePassword,
        });
      } else {
        if (!basic.password) throw new Error('PASSWORD_REQUIRED');
        const created = await usersService.create({
          email: basic.email,
          password: basic.password,
          fullName: basic.fullName,
          phone: basic.phone || undefined,
          isActive: basic.isActive,
          canChangePassword: basic.canChangePassword,
        });
        userId = created.id;
      }

      // 2) Penugasan diff
      const originals = new Map<string, PenugasanRow>();
      for (const ur of user?.roles || []) {
        originals.set(ur.id, {
          key: '',
          ubId: ur.id,
          roleId: codeToRoleId.get(ur.code) || '',
          branchId: ur.branchId || '',
          denied: (ur as any).deniedPermissions || [],
        });
      }

      for (const row of rows) {
        if (!row.roleId || !row.branchId) continue; // incomplete row — skip
        const denied = row.denied.length ? row.denied : undefined;
        if (row.ubId) {
          const orig = originals.get(row.ubId);
          const unchanged =
            orig &&
            orig.roleId === row.roleId &&
            orig.branchId === row.branchId &&
            JSON.stringify([...orig.denied].sort()) === JSON.stringify([...row.denied].sort());
          if (unchanged) {
            continue;
          }
          // Changed → remove old assignment, re-assign (no PUT for denies)
          await usersService.removeRole(userId!, row.ubId);
          await usersService.assignRole(userId!, { roleId: row.roleId, branchId: row.branchId, deniedPermissions: denied });
        } else {
          await usersService.assignRole(userId!, { roleId: row.roleId, branchId: row.branchId, deniedPermissions: denied });
        }
      }

      // Removed rows (existing ubIds no longer present in the new rows)
      for (const ur of user?.roles || []) {
        if (!rows.some((r) => r.ubId === ur.id)) {
          await usersService.removeRole(userId!, ur.id);
        }
      }

      return userId;
    },
    onSuccess: (userId) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      toast.success(isEdit ? 'Pengguna berhasil diupdate' : 'Pengguna berhasil ditambahkan');
      onClose();
      onSaved?.();
    },
    onError: (error: any) => {
      if (error?.message === 'PASSWORD_REQUIRED') {
        toast.error('Password wajib diisi untuk pengguna baru');
      } else {
        toast.error(error.response?.data?.message || 'Gagal menyimpan pengguna');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!basic.fullName || !basic.email) {
      toast.error('Nama lengkap dan email wajib diisi');
      return;
    }
    setSaving(true);
    mutation.mutate(undefined, { onSettled: () => setSaving(false) });
  };

  // Deny picker: default permissions of the selected role (deny-only rule)
  const denySourceFor = (row: PenugasanRow): string[] | undefined => {
    if (!row.roleId) return undefined;
    const role = rolesData?.data.find((r) => r.id === row.roleId);
    return role?.defaultPermissions;
  };
  const isSuperAdminRow = (row: PenugasanRow) => {
    const role = rolesData?.data.find((r) => r.id === row.roleId);
    return role?.code === 'SUPERADMIN';
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Pengguna' : 'Tambah Pengguna Baru'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {/* Basic info */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary-600" /> Informasi Dasar
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={basic.fullName}
                onChange={(e) => setBasic({ ...basic, fullName: e.target.value })}
                required
                placeholder="Masukkan nama lengkap"
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={basic.email}
                onChange={(e) => setBasic({ ...basic, email: e.target.value })}
                required
                placeholder="user@example.com"
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Telepon</label>
              <input
                type="tel"
                value={basic.phone}
                onChange={(e) => setBasic({ ...basic, phone: e.target.value })}
                placeholder="081234567890"
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
            </div>
            {!isEdit && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={basic.password}
                  onChange={(e) => setBasic({ ...basic, password: e.target.value })}
                  minLength={6}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
              <select
                value={basic.isActive ? 'active' : 'inactive'}
                onChange={(e) => setBasic({ ...basic, isActive: e.target.value === 'active' })}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white text-sm"
              >
                <option value="active">Aktif</option>
                <option value="inactive">Non-Aktif</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="canChangePassword"
                checked={basic.canChangePassword}
                onChange={(e) => setBasic({ ...basic, canChangePassword: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="canChangePassword" className="text-xs font-semibold text-gray-700 cursor-pointer">
                Izinkan user mengubah password sendiri
              </label>
            </div>
          </div>
        </div>

        {/* Penugasan Cabang & Role */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary-600" /> Penugasan Cabang &amp; Role
            </h3>
            <button
              type="button"
              onClick={addRow}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 border border-primary-300 rounded-lg px-2.5 py-1.5 hover:bg-primary-50"
            >
              + Tambah Penugasan
            </button>
          </div>
          <p className="text-[11px] text-gray-400">
            Satu user = banyak baris penugasan. Contoh: beri CS akses ke 2 outlet → tambah baris kedua dengan outlet lain.
          </p>

          {rows.length === 0 && (
            <div className="text-center py-6 border border-dashed border-gray-300 rounded-lg text-sm text-gray-400">
              Belum ada penugasan — klik "+ Tambah Penugasan"
            </div>
          )}

          <div className="space-y-3">
            {rows.map((row) => {
              const superAdminRow = isSuperAdminRow(row);
              const denySource = denySourceFor(row);
              const role = rolesData?.data.find((r) => r.id === row.roleId);
              return (
                <div key={row.key} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">Role</label>
                      <select
                        value={row.roleId}
                        onChange={(e) => {
                          updateRow(row.key, { roleId: e.target.value, denied: [] });
                          setExpandedDeny(null);
                        }}
                        disabled={superAdminRow}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm disabled:bg-gray-100 disabled:text-gray-500"
                      >
                        <option value="">Pilih role...</option>
                        {rolesData?.data.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">Outlet</label>
                      <select
                        value={row.branchId}
                        onChange={(e) => updateRow(row.key, { branchId: e.target.value })}
                        disabled={superAdminRow}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm disabled:bg-gray-100 disabled:text-gray-500"
                      >
                        <option value="">Pilih outlet...</option>
                        {branches?.map((b: any) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      {superAdminRow && (
                        <span className="text-[10px] bg-yellow-100 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                          <Lock className="w-3 h-3" /> SUPERADMIN
                        </span>
                      )}
                      {!superAdminRow && (
                        <button
                          type="button"
                          onClick={() => removeRow(row.key)}
                          className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg"
                          title="Hapus penugasan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Deny chips */}
                  {!superAdminRow && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-gray-500 font-medium">Ditolak (deny-only):</span>
                      {row.denied.length === 0 && (
                        <span className="text-[11px] text-gray-400">tidak ada</span>
                      )}
                      {row.denied.map((k) => (
                        <span
                          key={k}
                          className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-md flex flex-col leading-tight"
                          title={k}
                        >
                          <span className="text-[11px] font-semibold">{labelForPermission(k)}</span>
                          <span className="text-[10px] font-mono text-red-400">{k}</span>
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => setExpandedDeny(expandedDeny === row.key ? null : row.key)}
                        disabled={!row.roleId}
                        className="text-[11px] text-red-500 hover:underline font-semibold disabled:text-gray-300 disabled:no-underline"
                      >
                        + Atur
                      </button>
                    </div>
                  )}

                  {/* Deny picker */}
                  {expandedDeny === row.key && denySource && (
                    <div className="border border-gray-200 bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-gray-600">
                          Hak default role <span className="font-mono">{role?.code}</span> — centang untuk mencabut (deny-only)
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedDeny(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-400 mb-2">
                        Hak yang dicabut tidak boleh melebihi default role. Mencabut hak di luar default → ditolak sistem (400).
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1 max-h-52 overflow-y-auto">
                        {denySource.map((k) => {
                          const denied = row.denied.includes(k);
                          return (
                            <label
                              key={k}
                              className={`flex items-center gap-2 py-1 px-2 rounded-md text-sm ${
                                denied ? 'bg-red-50' : 'hover:bg-gray-100'
                              } cursor-pointer`}
                            >
                              <input
                                type="checkbox"
                                checked={denied}
                                onChange={(e) =>
                                  updateRow(row.key, {
                                    denied: e.target.checked
                                      ? [...row.denied, k]
                                      : row.denied.filter((d) => d !== k),
                                  })
                                }
                                className="w-4 h-4 accent-red-600"
                              />
                              <span className="flex flex-col leading-tight min-w-0">
                                <span className="text-xs text-gray-700 truncate">{labelForPermission(k)}</span>
                                <span className="text-[10px] font-mono text-gray-400 truncate">{k}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> {isEdit ? 'Simpan' : 'Simpan & Buat User'}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
