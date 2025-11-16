import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, X, Loader2, ArrowLeft, Wrench, User, Package } from 'lucide-react';
import { serviceOrdersService } from '../../services/service-orders.service';
import { api } from '../../services/api';
import { toast } from 'sonner';

export default function ServiceOrderForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAlternatePhone: '',
    deviceType: 'handphone' as 'handphone' | 'laptop' | 'tablet' | 'other',
    deviceBrand: '',
    deviceModel: '',
    deviceSerial: '',
    deviceImei: '',
    devicePassword: '',
    deviceCondition: '',
    complaint: '',
    initialDiagnosis: '',
    serviceTypeId: '',
    estimatedCost: 0,
    priority: 'normal' as 'normal' | 'urgent',
    promisedDate: '',
    customerNotes: '',
  });

  const { data: serviceOrder, isLoading: loadingServiceOrder } = useQuery({
    queryKey: ['service-order', id],
    queryFn: () => serviceOrdersService.getById(id!),
    enabled: !!id,
  });

  const { data: serviceTypes } = useQuery({
    queryKey: ['service-types'],
    queryFn: async () => {
      const res = await api.get('/service-types');
      return res.data.data || res.data;
    },
  });

  useEffect(() => {
    if (serviceOrder) {
      setFormData({
        customerName: (serviceOrder as any).customerName || '',
        customerPhone: (serviceOrder as any).customerPhone || '',
        customerEmail: (serviceOrder as any).customerEmail || '',
        customerAlternatePhone: (serviceOrder as any).customerAlternatePhone || '',
        deviceType: (serviceOrder as any).deviceType || 'handphone',
        deviceBrand: (serviceOrder as any).deviceBrand || '',
        deviceModel: (serviceOrder as any).deviceModel || '',
        deviceSerial: (serviceOrder as any).deviceSerial || '',
        deviceImei: (serviceOrder as any).deviceImei || '',
        devicePassword: '',
        deviceCondition: (serviceOrder as any).deviceCondition || '',
        complaint: (serviceOrder as any).complaint || '',
        initialDiagnosis: (serviceOrder as any).initialDiagnosis || '',
        serviceTypeId: (serviceOrder as any).serviceTypeId || '',
        estimatedCost: (serviceOrder as any).estimatedCost || 0,
        priority: (serviceOrder as any).priority || 'normal',
        promisedDate: (serviceOrder as any).promisedDate || '',
        customerNotes: (serviceOrder as any).customerNotes || '',
      });
    }
  }, [serviceOrder]);

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (isEdit) {
        return serviceOrdersService.update(id!, data);
      }
      return serviceOrdersService.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      toast.success(isEdit ? 'Service order berhasil diupdate' : 'Service order berhasil dibuat');
      navigate('/service-orders');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Terjadi kesalahan');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (loadingServiceOrder) {
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
              onClick={() => navigate('/service-orders')}
              className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold mb-1">
                {isEdit ? 'Edit Service Order' : 'Tambah Service Order'}
              </h1>
              <p className="text-primary-100">
                {isEdit ? 'Ubah informasi service order' : 'Buat service order baru'}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/service-orders')}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all"
          >
            <X className="w-4 h-4" />
            <span>Batal</span>
          </button>
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        {/* Customer Information */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
              <User className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Informasi Customer</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Customer <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Nama customer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telepon <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="081234567890"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.customerEmail}
                onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telepon Alternatif
              </label>
              <input
                type="tel"
                value={formData.customerAlternatePhone}
                onChange={(e) => setFormData({ ...formData, customerAlternatePhone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="081234567891"
              />
            </div>
          </div>
        </div>

        {/* Device Information */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Informasi Perangkat</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jenis Perangkat <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.deviceType}
                onChange={(e) => setFormData({ ...formData, deviceType: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="handphone">Handphone</option>
                <option value="laptop">Laptop</option>
                <option value="tablet">Tablet</option>
                <option value="other">Lainnya</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand
              </label>
              <input
                type="text"
                value={formData.deviceBrand}
                onChange={(e) => setFormData({ ...formData, deviceBrand: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Samsung, Apple, ASUS, dll"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              <input
                type="text"
                value={formData.deviceModel}
                onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Model perangkat"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Serial Number
              </label>
              <input
                type="text"
                value={formData.deviceSerial}
                onChange={(e) => setFormData({ ...formData, deviceSerial: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Serial number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IMEI
              </label>
              <input
                type="text"
                value={formData.deviceImei}
                onChange={(e) => setFormData({ ...formData, deviceImei: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="IMEI (untuk handphone)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kondisi Perangkat
              </label>
              <input
                type="text"
                value={formData.deviceCondition}
                onChange={(e) => setFormData({ ...formData, deviceCondition: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Kondisi fisik perangkat"
              />
            </div>
          </div>
        </div>

        {/* Service Information */}
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Informasi Service</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Keluhan <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                value={formData.complaint}
                onChange={(e) => setFormData({ ...formData, complaint: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Deskripsikan keluhan atau kerusakan..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Type
                </label>
                <select
                  value={formData.serviceTypeId}
                  onChange={(e) => setFormData({ ...formData, serviceTypeId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Pilih Service Type</option>
                  {(serviceTypes || []).map((st: any) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prioritas
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimasi Biaya
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.estimatedCost}
                  onChange={(e) => setFormData({ ...formData, estimatedCost: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Promised Date
                </label>
                <input
                  type="date"
                  value={formData.promisedDate}
                  onChange={(e) => setFormData({ ...formData, promisedDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catatan Customer
              </label>
              <textarea
                value={formData.customerNotes}
                onChange={(e) => setFormData({ ...formData, customerNotes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Catatan tambahan dari customer"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/service-orders')}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-6 py-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg hover:from-primary-700 hover:to-primary-600 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
          >
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
          </button>
        </div>
      </form>
    </div>
  );
}

