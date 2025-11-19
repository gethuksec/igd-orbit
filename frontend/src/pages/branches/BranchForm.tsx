import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, ArrowLeft, Store, MapPin, Phone, Clock, UserCog } from 'lucide-react';
import { branchesService } from '../../services/branches.service';
import { api } from '../../services/api';
import { toast } from 'sonner';

export default function BranchForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    name: '',
    type: 'store',
    phone: '',
    email: '',
    address: '',
    city: '',
    province: '',
    headOfServiceId: '',
    isActive: true,
    isWarehouse: false,
    operatingHours: {} as Record<string, any>,
  });

  const { data: branch, isLoading: loadingBranch } = useQuery({
    queryKey: ['branch', id],
    queryFn: () => branchesService.getById(id!),
    enabled: !!id,
  });

  const { data: hsUsers = [], isLoading: loadingHSUsers } = useQuery({
    queryKey: ['hs-users'],
    queryFn: async () => {
      const response = await api.get('/branches/hs-users/list');
      return response.data;
    },
  });

  useEffect(() => {
    if (branch) {
      setFormData({
        name: branch.name || '',
        type: branch.type || 'store',
        phone: branch.phone || '',
        email: branch.email || '',
        address: branch.address || '',
        city: branch.city || '',
        province: branch.province || '',
        headOfServiceId: branch.headOfServiceId || '',
        isActive: branch.isActive !== false,
        isWarehouse: branch.isWarehouse || false,
        operatingHours: branch.operatingHours || {},
      });
    }
  }, [branch]);

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (isEdit) {
        return branchesService.update(id!, data);
      }
      return branchesService.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast.success(isEdit ? 'Cabang berhasil diupdate' : 'Cabang berhasil ditambahkan');
      navigate('/branches');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Terjadi kesalahan');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (loadingBranch) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/branches')}
              className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold mb-1">
                {isEdit ? 'Edit Cabang' : 'Tambah Cabang Baru'}
              </h1>
              <p className="text-primary-100">{isEdit ? 'Ubah informasi cabang' : 'Tambahkan cabang baru ke sistem'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        {/* Informasi Dasar */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Store className="w-5 h-5 text-primary-600" />
            Informasi Dasar
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Nama Cabang <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                placeholder="Contoh: Cabang Jakarta Pusat"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Tipe Cabang
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
              >
                <option value="store">Toko</option>
                <option value="warehouse">Gudang</option>
                <option value="office">Kantor</option>
              </select>
            </div>
          </div>

          {isEdit && branch?.code && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Kode Cabang</label>
              <input
                type="text"
                value={branch.code}
                disabled
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-base font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">Kode cabang tidak dapat diubah</p>
            </div>
          )}
        </div>

        {/* Alamat & Lokasi */}
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary-600" />
            Alamat & Lokasi
          </h2>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Alamat Lengkap</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
              placeholder="Jl. Contoh No. 123"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Kota</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                placeholder="Jakarta"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Provinsi</label>
              <input
                type="text"
                value={formData.province}
                onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                placeholder="DKI Jakarta"
              />
            </div>
          </div>
        </div>

        {/* Head of Service */}
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <UserCog className="w-5 h-5 text-primary-600" />
            Head of Service (HS)
          </h2>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Head of Service <span className="text-red-500">*</span>
            </label>
            {loadingHSUsers ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Memuat data HS...
              </div>
            ) : (
              <select
                required
                value={formData.headOfServiceId}
                onChange={(e) => setFormData({ ...formData, headOfServiceId: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
              >
                <option value="">Pilih Head of Service</option>
                {hsUsers.map((user: any) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName || user.email} {user.phone ? `(${user.phone})` : ''}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Pilih user dengan role HS (Head of Store) yang bertanggung jawab untuk cabang ini
            </p>
          </div>
        </div>

        {/* Kontak */}
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary-600" />
            Kontak
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Telepon</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                placeholder="081234567890"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                placeholder="cabang@example.com"
              />
            </div>
          </div>
        </div>

        {/* Pengaturan */}
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-600" />
            Pengaturan
          </h2>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Cabang Aktif</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isWarehouse}
                onChange={(e) => setFormData({ ...formData, isWarehouse: e.target.checked })}
                className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Memiliki Gudang</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/branches')}
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
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

