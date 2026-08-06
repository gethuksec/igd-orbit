import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Lock, KeyRound } from 'lucide-react';
import { rolesService, type Role } from '../../../services/roles.service';
import { toast } from 'sonner';
import { Modal } from '../../../components/ui/modal';

interface RoleFormModalProps {
  open: boolean;
  /** Existing role (edit mode) or null (create mode) */
  role: Role | null;
  onClose: () => void;
}

export function RoleFormModal({ open, role, onClose }: RoleFormModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!role;
  const isSuperAdminRole = role?.code === 'SUPERADMIN';

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    level: 5,
    isActive: true,
  });

  useEffect(() => {
    if (open) {
      setFormData({
        code: role?.code || '',
        name: role?.name || '',
        description: role?.description || '',
        level: role?.level ?? 5,
        isActive: role?.isActive ?? true,
      });
    }
  }, [open, role]);

  const mutation = useMutation({
    mutationFn: ({ form }: { form: typeof formData; goToPerms: boolean }) => {
      const submitData: any = {
        name: form.name,
        description: form.description || undefined,
        level: form.level,
      };
      if (isEdit) {
        submitData.isActive = form.isActive;
      } else {
        submitData.code = form.code;
        submitData.isSystemRole = false;
      }
      return isEdit ? rolesService.update(role!.id, submitData) : rolesService.create(submitData);
    },
    onSuccess: (saved, variables) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success(isEdit ? 'Role berhasil diupdate' : 'Role berhasil ditambahkan');
      onClose();
      // "Simpan & Kelola Hak Default" → navigate to the permission page after create
      if (variables.goToPerms) {
        navigate(`/roles/${saved.id}/permissions`);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || `Gagal ${isEdit ? 'mengupdate' : 'menambahkan'} role`);
    },
  });

  const handleSubmit = (e: React.FormEvent, goToPerms = false) => {
    e.preventDefault();
    mutation.mutate({ form: formData, goToPerms });
  };

  const openPermissionPage = () => {
    if (role) {
      onClose();
      navigate(`/roles/${role.id}/permissions`);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Role' : 'Tambah Role Baru'} size="md">
      {isSuperAdminRole && (
        <div className="rounded-xl border-2 border-yellow-200 bg-yellow-50 p-4 mb-4 text-center">
          <Lock className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-yellow-700 mb-1">Role SUPERADMIN Terkunci Penuh</h3>
          <p className="text-xs text-yellow-600">
            SUPERADMIN memiliki akses penuh ke seluruh sistem. Data dan hak aksesnya tidak dapat diubah.
          </p>
        </div>
      )}

      <form onSubmit={(e) => handleSubmit(e)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Kode Role <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              required
              disabled={isEdit || isSuperAdminRole}
              pattern="[A-Z0-9_]+"
              placeholder="CR, HS, SPV, etc"
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all font-mono text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
            />
            {isEdit && (
              <p className="text-xs text-gray-500 mt-1">Kode tidak bisa diubah setelah role dibuat</p>
            )}
            {!isEdit && (
              <p className="text-xs text-gray-500 mt-1">Hanya huruf besar, angka, dan underscore</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nama Role <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={isSuperAdminRole}
              placeholder="Cashier, Head of Store, etc"
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Level Hierarki <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
              required
              disabled={isSuperAdminRole}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              <option value={0}>0 - SUPERADMIN</option>
              <option value={1}>1 - OWNER</option>
              <option value={2}>2 - C-LEVEL (CFO, CHR, CSO, CMO)</option>
              <option value={3}>3 - SPV (Supervisor)</option>
              <option value={4}>4 - HS (Head of Store)</option>
              <option value={5}>5 - AR (Assistant Region)</option>
              <option value={6}>6 - Entry Level (CS, TC, SODO, ASA, SMO, AS, CR)</option>
            </select>
          </div>

          {isEdit && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
              <select
                value={formData.isActive ? 'active' : 'inactive'}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                disabled={isSuperAdminRole}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
              >
                <option value="active">Aktif</option>
                <option value="inactive">Non-Aktif</option>
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Deskripsi</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            disabled={isSuperAdminRole}
            placeholder="Deskripsi role dan tanggung jawabnya..."
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
          />
        </div>

        {!isSuperAdminRole && (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
            <div className="flex items-start gap-2">
              <KeyRound className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-purple-800">
                  <b>Default Permissions:</b>{' '}
                  {isEdit ? (
                    <>
                      {role?.defaultPermissions?.length ?? 0} hak terdaftar.{' '}
                      <button
                        type="button"
                        onClick={openPermissionPage}
                        className="font-semibold text-purple-700 underline underline-offset-2 hover:text-purple-900"
                      >
                        Kelola Hak Default →
                      </button>
                    </>
                  ) : (
                    'Role baru belum punya hak akses. Gunakan tombol di bawah untuk menyimpan role lalu mengatur haknya di halaman Kelola Hak Default.'
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 flex-wrap">
          {!isSuperAdminRole && (
            <>
              {isEdit ? (
                <button
                  type="button"
                  onClick={openPermissionPage}
                  className="px-3 py-2 text-xs font-semibold text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-50"
                >
                  Kelola Hak Default →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  disabled={mutation.isPending}
                  className="px-3 py-2 text-xs font-semibold text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-50 disabled:opacity-50"
                >
                  Simpan &amp; Kelola Hak Default →
                </button>
              )}
              <button
                type="submit"
                disabled={mutation.isPending}
                className="px-3 py-2 text-xs font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {mutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {isEdit ? 'Simpan' : 'Simpan Role'}
              </button>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}
