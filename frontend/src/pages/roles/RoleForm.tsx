import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, ArrowLeft, Shield } from 'lucide-react';
import { rolesService } from '../../services/roles.service';
import { toast } from 'sonner';

export default function RoleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    level: 5, // Default level for new roles (entry level)
    isActive: true,
    parentRoleId: '' as string | undefined,
  });

  const { data: role, isLoading: loadingRole } = useQuery({
    queryKey: ['role', id],
    queryFn: () => rolesService.getById(id!),
    enabled: !!id,
  });

  const { data: rolesData } = useQuery({
    queryKey: ['roles-for-parent'],
    queryFn: () => rolesService.getAll({ limit: 1000 }),
  });

  const availableRoles = rolesData?.data || [];

  useEffect(() => {
    if (role) {
      setFormData({
        code: role.code || '',
        name: role.name || '',
        description: role.description || '',
        level: role.level ?? 5,
        isActive: role.isActive ?? true,
        parentRoleId: (role as any).parentRoleId || undefined,
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
      };

      if (!isEdit) {
        submitData.code = data.code;
        submitData.isSystemRole = false; // New roles are never system roles
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/roles">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEdit ? 'Edit Role' : 'Tambah Role Baru'}
            </h1>
            <p className="text-gray-600 mt-1">
              {isEdit ? 'Ubah informasi role' : 'Tambahkan role baru ke sistem'}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-6">
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white"
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

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Parent Role (Turunan dari)
              </label>
              <select
                value={formData.parentRoleId || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    parentRoleId: e.target.value || undefined,
                  })
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white"
              >
                <option value="">Tidak ada (Root Role)</option>
                {availableRoles
                  .filter((r) => !id || r.id !== id) // Exclude current role if editing
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code}) - Tier {r.level}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Pilih role parent untuk membuat hierarki. Role ini akan menjadi turunan dari role yang dipilih.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Deskripsi</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                placeholder="Deskripsi role dan tanggung jawabnya..."
              />
            </div>

            {isEdit && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                <select
                  value={formData.isActive ? 'active' : 'inactive'}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white"
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Non-Aktif</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Link to="/roles">
            <button
              type="button"
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Batal
            </button>
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg hover:from-primary-700 hover:to-primary-600 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Simpan
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

