import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, ArrowLeft, User, Phone, Mail } from 'lucide-react';
import { usersService } from '../../services/users.service';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function UserForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    isActive: true,
  });

  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ['user', id],
    queryFn: () => usersService.getById(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        password: '', // Don't prefill password
        fullName: user.fullName || '',
        phone: user.phone || '',
        isActive: user.isActive ?? true,
      });
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const submitData: any = {
        email: data.email,
        fullName: data.fullName,
        phone: data.phone || undefined,
        isActive: data.isActive,
      };

      if (!isEdit && data.password) {
        submitData.password = data.password;
      }

      return isEdit ? usersService.update(id!, submitData) : usersService.create(submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(isEdit ? 'Pengguna berhasil diupdate' : 'Pengguna berhasil ditambahkan');
      navigate('/users');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || `Gagal ${isEdit ? 'mengupdate' : 'menambahkan'} pengguna`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isEdit && !formData.password) {
      toast.error('Password wajib diisi untuk pengguna baru');
      return;
    }

    mutation.mutate(formData);
  };

  if (loadingUser) {
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
          <Link to="/users">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEdit ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}
            </h1>
            <p className="text-gray-600 mt-1">
              {isEdit ? 'Ubah informasi pengguna' : 'Tambahkan pengguna baru ke sistem'}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-5 h-5" />
            Informasi Dasar
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                placeholder="Masukkan nama lengkap"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder="user@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Telepon
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder="081234567890"
                />
              </div>
            </div>

            {!isEdit && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!isEdit}
                  minLength={6}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder="Minimal 6 karakter"
                />
                <p className="text-xs text-gray-500 mt-1">Password minimal 6 karakter</p>
              </div>
            )}

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
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Link to="/users">
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

