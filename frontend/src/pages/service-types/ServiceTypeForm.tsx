import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, Wrench, Clock, DollarSign } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { serviceTypesService } from '../../services/service-types.service';
import { toast } from 'sonner';

export default function ServiceTypeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    basePrice: 0,
    minPrice: '',
    maxPrice: '',
    slaDays: 1,
    slaHoursRemainder: 0,
    isActive: true,
  });

  const { data: serviceType, isLoading: loadingServiceType } = useQuery({
    queryKey: ['service-type', id],
    queryFn: () => serviceTypesService.getById(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (serviceType) {
      const hours = serviceType.slaHours || 24;
      setFormData({
        name: serviceType.name || '',
        description: serviceType.description || '',
        basePrice: serviceType.basePrice || 0,
        minPrice: serviceType.minPrice ? String(serviceType.minPrice) : '',
        maxPrice: serviceType.maxPrice ? String(serviceType.maxPrice) : '',
        slaDays: Math.floor(hours / 24),
        slaHoursRemainder: hours % 24,
        isActive: serviceType.isActive !== false,
      });
    }
  }, [serviceType]);

  const mutation = useMutation({
    mutationFn: (data: any) => {
      // Calculate SLA hours from days and hours remainder
      const slaHours = Number(data.slaDays) * 24 + Number(data.slaHoursRemainder);

      const submitData: any = {
        name: data.name,
        description: data.description || undefined,
        basePrice: Number(data.basePrice),
        slaHours: slaHours,
        isActive: data.isActive,
      };

      if (data.minPrice) {
        submitData.minPrice = Number(data.minPrice);
      }
      if (data.maxPrice) {
        submitData.maxPrice = Number(data.maxPrice);
      }

      if (isEdit) {
        return serviceTypesService.update(id!, submitData);
      }
      return serviceTypesService.create(submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-types'] });
      toast.success(isEdit ? 'Layanan berhasil diupdate' : 'Layanan berhasil ditambahkan');
      navigate('/service-types');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Terjadi kesalahan');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (loadingServiceType) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <BreadcrumbHeader
        title={isEdit ? 'Edit Layanan' : 'Tambah Layanan'}
        subtitle={isEdit ? 'Ubah informasi layanan' : 'Tambahkan layanan baru'}
      >

      </BreadcrumbHeader>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Informasi Layanan</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isEdit && serviceType?.code && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Kode Layanan
                </label>
                <input
                  type="text"
                  value={serviceType.code}
                  disabled
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                  placeholder="Kode layanan (auto-generated)"
                />
                <p className="text-xs text-gray-500 mt-1">Kode layanan dibuat otomatis dan tidak dapat diubah</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Nama Layanan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                placeholder="Screen Replacement (HP)"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">Deskripsi</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all resize-none"
                placeholder="Deskripsi layanan"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Harga Dasar <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  required
                  min="0"
                  step="1000"
                  value={formData.basePrice}
                  onChange={(e) => setFormData({ ...formData, basePrice: Number(e.target.value) })}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                  placeholder="300000"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Harga Minimum (Opsional)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.minPrice}
                onChange={(e) => setFormData({ ...formData, minPrice: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                placeholder="150000"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Harga Maksimum (Opsional)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.maxPrice}
                onChange={(e) => setFormData({ ...formData, maxPrice: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                placeholder="500000"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                SLA (Service Level Agreement) <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Clock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    required
                    min="0"
                    max="30"
                    value={formData.slaDays}
                    onChange={(e) => {
                      const days = Number(e.target.value);
                      setFormData({ ...formData, slaDays: days });
                    }}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    placeholder="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Hari (0-30)</p>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="0"
                    max="23"
                    value={formData.slaHoursRemainder}
                    onChange={(e) => {
                      const hours = Number(e.target.value);
                      setFormData({ ...formData, slaHoursRemainder: hours });
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Jam (0-23)</p>
                </div>
              </div>
              <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-600">
                  Total: <span className="font-semibold">{formData.slaDays * 24 + formData.slaHoursRemainder} jam</span>
                  {formData.slaDays > 0 && ` (${formData.slaDays} hari${formData.slaHoursRemainder > 0 ? ` ${formData.slaHoursRemainder} jam` : ''})`}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Status</label>
              <select
                value={formData.isActive ? 'active' : 'inactive'}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all bg-white"
              >
                <option value="active">Aktif</option>
                <option value="inactive">Tidak Aktif</option>
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/service-types')}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-white hover:border-primary-500 hover:text-primary-600 transition-all font-semibold"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl font-bold hover:from-primary-700 hover:to-primary-600 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
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

