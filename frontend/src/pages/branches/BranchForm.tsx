import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, ArrowLeft, Store, MapPin, Phone, Clock, UserCog } from 'lucide-react';
import { branchesService } from '../../services/branches.service';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function BranchForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    name: '',
    group: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    province: '',
    director: '',
    contactPerson: '',
    mobilePhone: '',
    headOfServiceId: '',
    isActive: true,
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
        group: branch.group || '',
        phone: branch.phone || '',
        email: branch.email || '',
        address: branch.address || '',
        city: branch.city || '',
        province: branch.province || '',
        director: branch.director || '',
        contactPerson: branch.contactPerson || '',
        mobilePhone: branch.mobilePhone || '',
        headOfServiceId: branch.headOfServiceId || '',
        isActive: branch.isActive !== false,
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
      <PageHeader
        title={isEdit ? 'Edit Cabang' : 'Tambah Cabang Baru'}
        subtitle={isEdit ? 'Ubah informasi cabang' : 'Tambahkan cabang baru ke sistem'}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/branches')}
          className="text-white/80 hover:text-white hover:bg-white/20"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Kembali
        </Button>
      </PageHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Informasi Dasar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="w-5 h-5 text-primary-600" />
              Informasi Dasar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Cabang <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Cabang Jakarta Pusat"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grup
                </label>
                <Input
                  type="text"
                  value={formData.group}
                  onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                  placeholder="Contoh: Pusat, Cabang"
                />
              </div>
            </div>

            {isEdit && branch?.code && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kode Cabang</label>
                <Input
                  type="text"
                  value={branch.code}
                  disabled
                  className="bg-gray-50 font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">Kode cabang tidak dapat diubah</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alamat & Lokasi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary-600" />
              Alamat & Lokasi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Lengkap</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                placeholder="Jl. Contoh No. 123"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kota</label>
                <Input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Jakarta"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provinsi</label>
                <Input
                  type="text"
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  placeholder="DKI Jakarta"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Head of Service */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5 text-primary-600" />
              Head of Service (HS)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
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
          </CardContent>
        </Card>

        {/* Kontak */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary-600" />
              Kontak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telepon</label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="081234567890"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="cabang@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Direktur</label>
                <Input
                  type="text"
                  value={formData.director}
                  onChange={(e) => setFormData({ ...formData, director: e.target.value })}
                  placeholder="Nama direktur"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <Input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  placeholder="Nama contact person"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. HP Contact Person</label>
                <Input
                  type="tel"
                  value={formData.mobilePhone}
                  onChange={(e) => setFormData({ ...formData, mobilePhone: e.target.value })}
                  placeholder="081234567890"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pengaturan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-600" />
              Pengaturan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm text-gray-600">{formData.isActive ? 'Aktif' : 'Tidak Aktif'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/branches')}
            className="flex-1"
            disabled={mutation.isPending}
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1" />
                Simpan
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
