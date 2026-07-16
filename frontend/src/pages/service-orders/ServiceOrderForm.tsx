import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, X, Loader2, ArrowLeft, Wrench, User, Package, Search, Plus } from 'lucide-react';
import { serviceOrdersService } from '../../services/service-orders.service';
import { api } from '../../services/api';
import { salesService } from '../../services/sales.service';
import { customersService } from '../../services/customers.service';
import { toast } from 'sonner';
import kecamatanJember from '@/data/kecamatan-jember.json';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';

// Common device units for combobox suggestions
const COMMON_DEVICE_UNITS = [
  'Samsung Galaxy A52',
  'Samsung Galaxy A54',
  'Samsung Galaxy S23',
  'Samsung Galaxy S24',
  'iPhone 13',
  'iPhone 14',
  'iPhone 15',
  'Xiaomi Redmi Note 12',
  'Xiaomi Redmi Note 13',
  'OPPO Reno 10',
  'OPPO A78',
  'Vivo V29',
  'Realme 11 Pro',
  'ASUS ROG Phone 7',
  'Google Pixel 8',
  'MacBook Air M1',
  'MacBook Air M2',
  'MacBook Pro M3',
  'ASUS Vivobook 14',
  'Lenovo ThinkPad X1',
  'HP Pavilion 15',
  'Dell Inspiron 16',
  'iPad Air 5',
  'iPad Pro 12.9',
  'Samsung Galaxy Tab S9',
];

// Service type code defaults
const SERVICE_TYPE_DEFAULTS: Record<string, { code: string; hasSubType: boolean }> = {
  'SVC-INTERFACE': { code: 'SVC-INTERFACE', hasSubType: true },
  'SVC-HARDWARE': { code: 'SVC-HARDWARE', hasSubType: true },
  'SVC-SOFTWARE': { code: 'SVC-SOFTWARE', hasSubType: true },
};

export default function ServiceOrderForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const customerIdFromUrl = searchParams.get('customerId');

  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);

  // Pre-form step state
  const [showPreForm, setShowPreForm] = useState(!isEdit);
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState('');
  const [selectedSubType, setSelectedSubType] = useState<'quick' | 'inap' | ''>('');

  // Device unit combobox
  const [deviceUnitFilter, setDeviceUnitFilter] = useState('');
  const [showDeviceUnits, setShowDeviceUnits] = useState(false);

  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerSubdistrict: '',
    deviceType: 'handphone' as 'handphone' | 'laptop' | 'tablet' | 'other',
    deviceUnit: '',
    deviceColor: '',
    deviceSerial: '',
    deviceImei: '',
    devicePassword: '',
    deviceCondition: '',
    complaint: '',
    initialDiagnosis: '',
    serviceTypeId: '',
    serviceSubType: '' as 'quick' | 'inap' | '',
    estimatedCost: 0,
    priority: 'normal' as 'normal' | 'urgent',
    promisedDate: '',
    customerNotes: '',
    assignedTechnicianId: '',
  });

  // Fetch technicians for dropdown
  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      const res = await api.get('/users', { params: { role: 'TC' } });
      return res.data.data || res.data || [];
    },
    enabled: true,
  });

  // Fetch customer data if customerId is provided in URL
  const { data: customerFromUrl } = useQuery({
    queryKey: ['customer', customerIdFromUrl],
    queryFn: () => customersService.getById(customerIdFromUrl!),
    enabled: !!customerIdFromUrl && !isEdit,
  });

  // Customer search query
  const { data: customerSearchResults = [] } = useQuery({
    queryKey: ['customers', 'search', customerSearchQuery],
    queryFn: () => salesService.searchCustomers(customerSearchQuery),
    enabled: customerSearchQuery.length >= 2 && showCustomerSearch,
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
        customerId: (serviceOrder as any).customerId || '',
        customerName: (serviceOrder as any).customerName || '',
        customerPhone: (serviceOrder as any).customerPhone || '',
        customerEmail: (serviceOrder as any).customerEmail || '',
        customerSubdistrict: (serviceOrder as any)?.customer?.subdistrict || '',
        deviceType: (serviceOrder as any).deviceType || 'handphone',
        deviceUnit: (serviceOrder as any).deviceUnit || '',
        deviceColor: (serviceOrder as any).deviceColor || '',
        deviceSerial: (serviceOrder as any).deviceSerial || '',
        deviceImei: (serviceOrder as any).deviceImei || '',
        devicePassword: '',
        deviceCondition: (serviceOrder as any).deviceCondition || '',
        complaint: (serviceOrder as any).complaint || '',
        initialDiagnosis: (serviceOrder as any).initialDiagnosis || '',
        serviceTypeId: (serviceOrder as any).serviceTypeId || '',
        serviceSubType: (serviceOrder as any).serviceSubType || '',
        estimatedCost: (serviceOrder as any).estimatedCost || 0,
        priority: (serviceOrder as any).priority || 'normal',
        promisedDate: (serviceOrder as any).promisedDate 
          ? new Date((serviceOrder as any).promisedDate).toISOString().split('T')[0] 
          : '',
        customerNotes: (serviceOrder as any).customerNotes || '',
        assignedTechnicianId: (serviceOrder as any).assignedTechnicianId || '',
      });
      // Populate pre-form from existing data
      if ((serviceOrder as any).serviceTypeId) {
        setSelectedServiceTypeId((serviceOrder as any).serviceTypeId);
      }
      if ((serviceOrder as any).serviceSubType) {
        setSelectedSubType((serviceOrder as any).serviceSubType);
      }
    } else if (customerFromUrl && !isEdit) {
      // Auto-fill customer data from URL parameter
      setFormData((prev) => ({
        ...prev,
        customerId: customerFromUrl.id || '',
        customerName: customerFromUrl.name || '',
        customerPhone: customerFromUrl.phone || '',
        customerEmail: customerFromUrl.email || '',
        customerSubdistrict: (customerFromUrl as any).subdistrict || '',
      }));
    }
  }, [serviceOrder, customerFromUrl, isEdit]);

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

  // Filtered device units based on input
  const filteredDeviceUnits = deviceUnitFilter
    ? COMMON_DEVICE_UNITS.filter((unit) =>
        unit.toLowerCase().includes(deviceUnitFilter.toLowerCase()),
      )
    : COMMON_DEVICE_UNITS;

  const handlePreFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceTypeId) {
      toast.error('Kategori (Service Type) wajib dipilih');
      return;
    }
    // Check if selected service type requires sub type
    const selectedType = (serviceTypes || []).find((st: any) => st.id === selectedServiceTypeId);
    const typeCode = selectedType?.code || '';
    const defaults = Object.values(SERVICE_TYPE_DEFAULTS).find((d) => d.code === typeCode);
    if (defaults?.hasSubType && !selectedSubType) {
      toast.error('Tipe (Quick/INAP) wajib dipilih');
      return;
    }
    // Populate main form
    setFormData((prev) => ({
      ...prev,
      serviceTypeId: selectedServiceTypeId,
      serviceSubType: selectedSubType as 'quick' | 'inap' | '',
    }));
    setShowPreForm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic client-side validation
    if (!formData.serviceTypeId) {
      toast.error('Service Type wajib dipilih');
      return;
    }

    if (!formData.promisedDate) {
      toast.error('Estimasi Selesai wajib diisi');
      return;
    }

    if (!isEdit && !formData.assignedTechnicianId) {
      toast.error('Teknisi wajib dipilih');
      return;
    }

    // Validate promised date based on priority
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const promisedDate = new Date(formData.promisedDate);
    promisedDate.setHours(0, 0, 0, 0);
    const daysDiff = Math.ceil((promisedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (formData.priority === 'urgent' && daysDiff > 1) {
      toast.error('Prioritas urgent: Estimasi Selesai maksimal 1 hari dari hari ini');
      return;
    }

    if (formData.priority === 'normal' && daysDiff > 14) {
      toast.error('Prioritas normal: Estimasi Selesai maksimal 14 hari (2 pekan) dari hari ini');
      return;
    }

    if (daysDiff < 0) {
      toast.error('Estimasi Selesai tidak boleh lebih kecil dari hari ini');
      return;
    }

    // Clean up empty strings for optional fields
    const submitData = { ...formData };

    mutation.mutate(submitData);
  };

  if (loadingServiceOrder) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  // Pre-form step: Select Kategori and Tipe
  if (showPreForm && !isEdit) {
    return (
      <div className="w-full space-y-3">
        {/* Page Header */}
        <PageHeader
          title="Tambah Service Order"
          subtitle="Pilih kategori dan tipe service"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/service-orders')}
            className="text-white/80 hover:text-white hover:bg-white/20"
          >
            <X className="w-4 h-4 mr-2" />
            Batal
          </Button>
        </PageHeader>

        {/* Pre-form Card */}
        <form onSubmit={handlePreFormSubmit} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Pilih Kategori & Tipe Service</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kategori (Service Type) <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedServiceTypeId}
                  onChange={(e) => {
                    setSelectedServiceTypeId(e.target.value);
                    setSelectedSubType('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                >
                  <option value="">Pilih Kategori Service</option>
                  {(serviceTypes || []).map((st: any) => (
                    <option key={st.id} value={st.id}>
                      {st.name} {st.code ? `(${st.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipe <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedSubType('quick')}
                  className={`p-4 border-2 rounded-xl text-center transition-all ${
                    selectedSubType === 'quick'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <div className="text-lg font-semibold">Quick</div>
                  <div className="text-sm mt-1">Service cepat (1-2 jam)</div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSubType('inap')}
                  className={`p-4 border-2 rounded-xl text-center transition-all ${
                    selectedSubType === 'inap'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <div className="text-lg font-semibold">INAP</div>
                  <div className="text-sm mt-1">Service menginap (&gt;1 hari)</div>
                </button>
              </div>
            </div>
          </div>
          </div>

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
              className="px-6 py-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg hover:from-primary-700 hover:to-primary-600 transition-all shadow-md flex items-center gap-2"
            >
              Lanjutkan
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <PageHeader
        title={isEdit ? 'Edit Service Order' : 'Tambah Service Order'}
        subtitle={isEdit ? 'Ubah informasi service order' : 'Lengkapi data service order'}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (!isEdit) {
              setShowPreForm(true);
              return;
            }
            navigate('/service-orders');
          }}
          className="text-white/80 hover:text-white hover:bg-white/20"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/service-orders')}
          className="text-white/80 hover:text-white hover:bg-white/20"
        >
          <X className="w-4 h-4 mr-2" />
          Batal
        </Button>
      </PageHeader>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        {/* Customer Information */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
                <User className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Informasi Customer</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowCreateCustomerModal(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Customer Baru</span>
            </button>
          </div>

          {/* Customer Search */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cari Customer dari Master Data
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={customerSearchQuery}
                onChange={(e) => {
                  setCustomerSearchQuery(e.target.value);
                  setShowCustomerSearch(true);
                }}
                onFocus={() => setShowCustomerSearch(true)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Cari nama, telepon, atau kode customer..."
              />
              
              {/* Search Results Dropdown */}
              {showCustomerSearch && customerSearchQuery.length >= 2 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                  {customerSearchResults.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">
                      Tidak ada customer ditemukan.
                    </div>
                  ) : (
                    customerSearchResults.map((customer: any) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            customerId: customer.id || '',
                            customerName: customer.name || '',
                            customerPhone: customer.phone || '',
                            customerEmail: customer.email || '',
                            customerSubdistrict: (customer as any).subdistrict || '',
                          });
                          setCustomerSearchQuery('');
                          setShowCustomerSearch(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{customer.name}</div>
                            <div className="text-sm text-gray-500 mt-1">
                              {customer.phone} {customer.email ? `· ${customer.email}` : ''}
                            </div>
                            {customer.customerCode && (
                              <div className="text-xs text-gray-400 mt-1 font-mono">
                                {customer.customerCode}
                              </div>
                            )}
                          </div>
                          {customer.tier && (
                            <span className="px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded">
                              {typeof customer.tier === 'object' ? customer.tier.name : customer.tier}
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Customer {!isEdit && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                required={!isEdit}
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                disabled={isEdit}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${isEdit ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'border-gray-300'}`}
                placeholder="Nama customer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telepon {!isEdit && <span className="text-red-500">*</span>}
              </label>
              <input
                type="tel"
                required={!isEdit}
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                disabled={isEdit}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${isEdit ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'border-gray-300'}`}
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
                disabled={isEdit}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${isEdit ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'border-gray-300'}`}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kecamatan
              </label>
              <select
                value={formData.customerSubdistrict}
                onChange={(e) => setFormData({ ...formData, customerSubdistrict: e.target.value })}
                disabled={isEdit}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white ${isEdit ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
              >
                <option value="">Pilih Kecamatan</option>
                {kecamatanJember.map((kec: string) => (
                  <option key={kec} value={kec}>{kec}</option>
                ))}
              </select>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="handphone">Handphone</option>
                <option value="laptop">Laptop</option>
                <option value="tablet">Tablet</option>
                <option value="other">Lainnya</option>
              </select>
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit Perangkat
              </label>
              <input
                type="text"
                value={deviceUnitFilter || formData.deviceUnit}
                onChange={(e) => {
                  setDeviceUnitFilter(e.target.value);
                  setFormData({ ...formData, deviceUnit: e.target.value });
                  setShowDeviceUnits(true);
                }}
                onFocus={() => setShowDeviceUnits(true)}
                onBlur={() => {
                  // Delay hiding to allow click on dropdown
                  setTimeout(() => setShowDeviceUnits(false), 200);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Cari atau ketik unit perangkat..."
              />
              {showDeviceUnits && filteredDeviceUnits.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                  {filteredDeviceUnits.map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onMouseDown={() => {
                        setFormData({ ...formData, deviceUnit: unit });
                        setDeviceUnitFilter(unit);
                        setShowDeviceUnits(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Warna Perangkat
              </label>
              <input
                type="text"
                value={formData.deviceColor}
                onChange={(e) => setFormData({ ...formData, deviceColor: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Hitam, Putih, Silver, dll"
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
                Password Perangkat
              </label>
              <input
                type="password"
                value={formData.devicePassword}
                onChange={(e) => setFormData({ ...formData, devicePassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Password (akan dienkripsi)"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kondisi Perangkat
              </label>
              <textarea
                value={formData.deviceCondition}
                onChange={(e) => setFormData({ ...formData, deviceCondition: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Deskripsikan kondisi fisik perangkat secara detail..."
              />
            </div>
          </div>

          {/* Customer Notes moved to Device Section */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catatan Customer
            </label>
            <textarea
              value={formData.customerNotes}
              onChange={(e) => setFormData({ ...formData, customerNotes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Catatan tambahan dari customer"
            />
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
                Keterangan <span className="text-red-500">*</span>
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
                  Service Type <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.serviceTypeId}
                  onChange={(e) => setFormData({ ...formData, serviceTypeId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
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
                  Tipe Service
                </label>
                <select
                  value={formData.serviceSubType}
                  onChange={(e) => setFormData({ ...formData, serviceSubType: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                >
                  <option value="">Pilih Tipe</option>
                  <option value="quick">Quick</option>
                  <option value="inap">INAP</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prioritas
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => {
                    const newPriority = e.target.value as 'normal' | 'urgent';
                    setFormData({ 
                      ...formData, 
                      priority: newPriority,
                      // Reset promisedDate when priority changes to ensure validation
                      promisedDate: '',
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
                {formData.priority === 'urgent' && (
                  <p className="text-xs text-orange-600 mt-1">
                    ⚠️ Prioritas urgent: Service harus selesai dalam 1 hari
                  </p>
                )}
                {formData.priority === 'normal' && (
                  <p className="text-xs text-gray-500 mt-1">
                    ℹ️ Prioritas normal: Maksimal 2 minggu (14 hari)
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Cost (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.estimatedCost}
                  onChange={(e) => setFormData({ ...formData, estimatedCost: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimasi Selesai <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.promisedDate}
                  onChange={(e) => setFormData({ ...formData, promisedDate: e.target.value })}
                  min={(() => {
                    const today = new Date();
                    return today.toISOString().split('T')[0];
                  })()}
                  max={(() => {
                    const today = new Date();
                    if (formData.priority === 'urgent') {
                      // Urgent: maksimal 1 hari dari sekarang
                      const maxDate = new Date(today);
                      maxDate.setDate(maxDate.getDate() + 1);
                      return maxDate.toISOString().split('T')[0];
                    } else {
                      // Normal: maksimal 14 hari (2 pekan) dari sekarang
                      const maxDate = new Date(today);
                      maxDate.setDate(maxDate.getDate() + 14);
                      return maxDate.toISOString().split('T')[0];
                    }
                  })()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {formData.priority === 'urgent' && (
                  <p className="text-xs text-gray-500 mt-1">
                    Pilih tanggal maksimal 1 hari dari hari ini
                  </p>
                )}
                {formData.priority === 'normal' && (
                  <p className="text-xs text-gray-500 mt-1">
                    Pilih tanggal maksimal 14 hari (2 pekan) dari hari ini
                  </p>
                )}
              </div>
            </div>

            {/* Assigned Technician dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign Teknisi {!isEdit && <span className="text-red-500">*</span>}
                </label>
                <select
                  value={formData.assignedTechnicianId}
                  onChange={(e) => setFormData({ ...formData, assignedTechnicianId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                >
                  <option value="">Pilih Teknisi</option>
                  {Array.isArray(technicians) && technicians.map((tech: any) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.fullName || tech.name || tech.email}
                    </option>
                  ))}
                </select>
              </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              if (!isEdit) {
                setShowPreForm(true);
                return;
              }
              navigate('/service-orders');
            }}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {!isEdit ? 'Kembali' : 'Batal'}
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

      {/* Create Customer Modal */}
      {showCreateCustomerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowCreateCustomerModal(false)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Buat Customer Baru</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const newCustomer = await customersService.create({
                    name: formData.customerName,
                    phone: formData.customerPhone,
                    email: formData.customerEmail || undefined,
                    subdistrict: formData.customerSubdistrict || undefined,
                    city: 'Jember',
                    province: 'Jawa Timur',
                  });
                  // Set customerId after creating new customer
                  setFormData({
                    ...formData,
                    customerId: newCustomer.id || '',
                  });
                  setShowCreateCustomerModal(false);
                  toast.success('Customer berhasil dibuat');
                } catch (error: any) {
                  toast.error(error.response?.data?.message || 'Gagal membuat customer');
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-2">
                  Nama <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Telepon <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Kecamatan</label>
                <select
                  value={formData.customerSubdistrict}
                  onChange={(e) => setFormData({ ...formData, customerSubdistrict: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                >
                  <option value="">Pilih Kecamatan</option>
                  {kecamatanJember.map((kec: string) => (
                    <option key={kec} value={kec}>{kec}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCustomerModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Buat Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
