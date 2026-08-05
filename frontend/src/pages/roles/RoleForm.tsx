import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, ArrowLeft, Shield, KeyRound, Lock } from 'lucide-react';
import { rolesService } from '../../services/roles.service';
import { toast } from 'sonner';
import PermissionAccordion from '@/components/shared/PermissionAccordion';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';

export default function RoleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    level: 5,
    isActive: true,
    parentRoleId: '' as string | undefined,
    defaultPermissions: [] as string[],
  });

  const { data: role, isLoading: loadingRole } = useQuery({
    queryKey: ['role', id],
    queryFn: () => rolesService.getById(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (role) {
      setFormData({
        code: role.code || '',
        name: role.name || '',
        description: role.description || '',
        level: role.level ?? 5,
        isActive: role.isActive ?? true,
        parentRoleId: (role as any).parentRoleId || undefined,
        defaultPermissions: (role as any).defaultPermissions || [],
      });
    }
  }, [role]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const submitData: any = {
        name: data.name,
        description: data.description || undefined,
        level: data.level,
        isActive: data.isActive,
        parentRoleId: data.parentRoleId || undefined,
        defaultPermissions: data.defaultPermissions,
      };

      // SUPERADMIN permissions are immutable — don't send them so the backend only updates non-permission fields
      if (role?.code === 'SUPERADMIN') {
        delete submitData.defaultPermissions;
      }

      if (!isEdit) {
        submitData.code = data.code;
        submitData.isSystemRole = false;
      }

      return isEdit ? rolesService.update(id!, submitData) : rolesService.create(submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success(isEdit ? 'Role berhasil diupdate' : 'Role berhasil ditambahkan');
      navigate('/roles');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || `Gagal ${isEdit ? 'mengupdate' : 'menambahkan'} role`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (loadingRole) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? 'Edit Role' : 'Tambah Role Baru'}
        subtitle={isEdit ? 'Ubah informasi dan izin akses role' : 'Tambahkan role baru dan atur izin aksesnya'}
      >
        <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/20">
          <Link to="/roles">
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Link>
        </Button>
      </PageHeader>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-6">
        {/* D-SEC: SUPERADMIN role is fully immutable — entire form locked */}
        {role?.code === 'SUPERADMIN' && (
          <div className="rounded-xl border-2 border-yellow-200 bg-yellow-50 p-4 flex items-start gap-3">
            <Lock className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-700">Role SUPERADMIN Terkunci Penuh</h3>
              <p className="text-sm text-yellow-600">
                Seluruh field role ini tidak dapat diubah melalui aplikasi — hanya dapat diedit
                langsung di database.
              </p>
            </div>
          </div>
        )}

        {/* Basic Info */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Informasi Role
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!isEdit && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Kode Role <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  required
                  pattern="[A-Z0-9_]+"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all font-mono"
                  placeholder="CR, HS, SPV, etc"
                />
                <p className="text-xs text-gray-500 mt-1">Hanya huruf besar, angka, dan underscore</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nama Role <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={role?.code === 'SUPERADMIN'}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                placeholder="Cashier, Head of Store, etc"
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
                disabled={role?.code === 'SUPERADMIN'}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
              >
                <option value={0}>0 - SUPERADMIN</option>
                <option value={1}>1 - OWNER</option>
                <option value={2}>2 - C-LEVEL (CFO, CHR, CSO, CMO)</option>
                <option value={3}>3 - SPV (Supervisor)</option>
                <option value={4}>4 - HS (Head of Store)</option>
                <option value={5}>5 - AR (Assistant Region)</option>
                <option value={6}>6 - Entry Level (CS, TC, SODO, ASA, SMO, AS, CR)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Tingkat hierarki role dalam organisasi</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Deskripsi</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                disabled={role?.code === 'SUPERADMIN'}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                placeholder="Deskripsi role dan tanggung jawabnya..."
              />
            </div>

            {isEdit && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                <select
                  value={formData.isActive ? 'active' : 'inactive'}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                  disabled={role?.code === 'SUPERADMIN'}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Non-Aktif</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Permission Accordion */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Izin Akses
            {role?.code === 'SUPERADMIN' && (
              <span className="ml-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold border border-yellow-200">
                <Lock className="w-3 h-3" />
                Terkunci
              </span>
            )}
          </h2>
          {role?.code === 'SUPERADMIN' ? (
            <div className="rounded-xl border-2 border-yellow-200 bg-yellow-50 p-6 text-center">
              <Lock className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-yellow-700 mb-1">Izin SUPERADMIN Terkunci</h3>
              <p className="text-sm text-yellow-600 max-w-md mx-auto">
                SUPERADMIN memiliki akses penuh ke seluruh sistem. Hak aksesnya tidak dapat
                diubah untuk menjaga keamanan dan integritas sistem.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 -mt-2">
                Centang izin yang dimiliki role ini. Menu sidebar akan otomatis menyesuaikan.
              </p>
              <PermissionAccordion
                value={formData.defaultPermissions}
                onChange={(keys) => setFormData({ ...formData, defaultPermissions: keys })}
              />
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button asChild variant="outline">
            <Link to="/roles">Batal</Link>
          </Button>
          <Button type="submit" disabled={mutation.isPending || role?.code === 'SUPERADMIN'}>
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Simpan
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
