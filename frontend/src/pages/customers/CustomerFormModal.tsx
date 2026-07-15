import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  X,
  Loader2,
  User,
  Phone,
  Mail,
  MapPin,
  Award,
  CreditCard,
  FileText,
  Calendar,
} from 'lucide-react';
import { customersService } from '../../services/customers.service';
import { toast } from 'sonner';
import kecamatanJember from '@/data/kecamatan-jember.json';
import { Button } from '@/components/ui/button';

interface CustomerFormModalProps {
  open: boolean;
  onClose: () => void;
  customerId?: string;
}

const defaultFormData = {
  customerType: 'retail',
  name: '',
  phone: '',
  alternatePhone: '',
  email: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  subdistrict: '',
  city: 'Jember',
  province: 'Jawa Timur',
  postalCode: '',
  country: 'Indonesia',
  religion: '',
  idType: '',
  idNumber: '',
  taxId: '',
  taxName: '',
  taxIdType: '',
  taxAddress: '',
  idTKU: '',
  taxTransactionDetail: '',
  creditLimit: 0,
  creditLimitNoteCount: 0,
  paymentTermDays: 0,
  tier: 'REGULAR',
  notes: '',
};

export default function CustomerFormModal({ open, onClose, customerId }: CustomerFormModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!customerId;
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState(defaultFormData);

  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customersService.getById(customerId!),
    enabled: !!customerId && open,
  });

  // Reset form on open/close
  useEffect(() => {
    if (!open) {
      setFormData(defaultFormData);
      setActiveTab('basic');
    }
  }, [open]);

  // Populate form when editing
  useEffect(() => {
    if (customer) {
      setFormData({
        customerType: customer.customerType || 'retail',
        name: customer.name || '',
        phone: customer.phone || '',
        alternatePhone: (customer as any).alternatePhone || '',
        email: customer.email || '',
        dateOfBirth: (customer as any).dateOfBirth
          ? new Date((customer as any).dateOfBirth).toISOString().split('T')[0]
          : '',
        gender: (customer as any).gender || '',
        address: customer.address || '',
        subdistrict: (customer as any).subdistrict || '',
        city: (customer as any).city || '',
        province: (customer as any).province || '',
        postalCode: (customer as any).postalCode || '',
        country: (customer as any).country || 'Indonesia',
        religion: (customer as any).religion || '',
        idType: (customer as any).idType || '',
        idNumber: (customer as any).idNumber || '',
        taxId: (customer as any).taxId || '',
        taxName: (customer as any).taxName || '',
        taxIdType: (customer as any).taxIdType || '',
        taxAddress: (customer as any).taxAddress || '',
        idTKU: (customer as any).idTKU || '',
        taxTransactionDetail: (customer as any).taxTransactionDetail || '',
        creditLimit: customer.creditLimit || 0,
        creditLimitNoteCount: (customer as any).creditLimitNoteCount || 0,
        paymentTermDays: (customer as any).paymentTermDays || 0,
        tier:
          typeof customer.tier === 'object' && customer.tier !== null
            ? customer.tier.code
            : customer.tier || 'REGULAR',
        notes: (customer as any).notes || '',
      });
    }
  }, [customer]);

  const mutation = useMutation({
    mutationFn: async (data: typeof defaultFormData) => {
      const submitData: any = {
        customerType: data.customerType,
        name: data.name,
        phone: data.phone,
        email: data.email || undefined,
        dateOfBirth: data.dateOfBirth || undefined,
        gender: data.gender || undefined,
        address: data.address || undefined,
        subdistrict: data.subdistrict || undefined,
        city: 'Jember',
        province: 'Jawa Timur',
        postalCode: data.postalCode || undefined,
        country: data.country || undefined,
        religion: data.religion || undefined,
        idType: data.idType || undefined,
        idNumber: data.idNumber || undefined,
        taxId: data.taxId || undefined,
        taxName: data.taxName || undefined,
        taxIdType: data.taxIdType || undefined,
        taxAddress: data.taxAddress || undefined,
        idTKU: data.idTKU || undefined,
        taxTransactionDetail: data.taxTransactionDetail || undefined,
        creditLimit: data.creditLimit || 0,
        creditLimitNoteCount: data.creditLimitNoteCount || 0,
        paymentTermDays: data.paymentTermDays || 0,
        notes: data.notes || undefined,
      };

      if (data.tier) {
        submitData.tierCode = data.tier;
      }

      return isEdit
        ? customersService.update(customerId!, submitData)
        : customersService.create(submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      toast.success(isEdit ? 'Pelanggan berhasil diupdate' : 'Pelanggan berhasil ditambahkan');
      onClose();
    },
    onError: (error: any) => {
      const errorResponse = error.response?.data;
      let errorMessage = 'Terjadi kesalahan saat menyimpan data';

      if (errorResponse?.message) {
        errorMessage = errorResponse.message;
      } else if (errorResponse?.errors) {
        const errors = Array.isArray(errorResponse.errors)
          ? errorResponse.errors
          : Object.values(errorResponse.errors).flat();
        errorMessage = errors.join(', ');
      } else if (errorResponse?.error) {
        errorMessage = errorResponse.error;
      }

      toast.error(errorMessage);
    },
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      mutation.mutate(formData);
    },
    [formData, mutation],
  );

  // Handle Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const tabs = [
    { id: 'basic', label: 'Informasi Dasar', icon: User },
    { id: 'address', label: 'Alamat & Lokasi', icon: MapPin },
    { id: 'identity', label: 'Identitas & Pajak', icon: CreditCard },
    { id: 'credit', label: 'Kredit & Plafon', icon: Award },
  ];

  const update = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-6 pb-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[calc(100vh-3rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {isEdit ? 'Edit Pelanggan' : 'Tambah Pelanggan'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {isEdit ? 'Ubah informasi pelanggan' : 'Tambahkan pelanggan baru'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sticky Tabs */}
        <div className="border-b border-gray-200 shrink-0">
          <div className="flex overflow-x-auto px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3.5 font-semibold transition-all whitespace-nowrap text-sm ${
                    activeTab === tab.id
                      ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                      : 'text-gray-500 hover:text-primary-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading State */}
        {loadingCustomer && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        )}

        {/* Scrollable Form Body */}
        {!loadingCustomer && (
          <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-6 flex-1">
            {/* Basic Information */}
            {activeTab === 'basic' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Nama <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => update('name', e.target.value)}
                      className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                      required
                      placeholder="Masukkan nama pelanggan"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Jenis Pelanggan <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.customerType}
                      onChange={(e) => update('customerType', e.target.value)}
                      className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
                      required
                    >
                      <option value="retail">Retail</option>
                      <option value="wholesale">Wholesale</option>
                      <option value="corporate">Corporate</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Telepon <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => update('phone', e.target.value)}
                        className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                        required
                        placeholder="08xx-xxxx-xxxx"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Kecamatan <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <MapPin className="h-5 w-5 text-gray-400" />
                      </div>
                      <select
                        value={formData.subdistrict}
                        onChange={(e) => update('subdistrict', e.target.value)}
                        className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
                        required
                      >
                        <option value="">Pilih Kecamatan</option>
                        {kecamatanJember.map((kec: string) => (
                          <option key={kec} value={kec}>
                            {kec}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => update('email', e.target.value)}
                        className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Tier</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Award className="h-5 w-5 text-gray-400" />
                      </div>
                      <select
                        value={formData.tier}
                        onChange={(e) => update('tier', e.target.value)}
                        className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
                      >
                        <option value="REGULAR">Regular</option>
                        <option value="SILVER">Silver</option>
                        <option value="GOLD">Gold</option>
                        <option value="PLATINUM">Platinum</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Address & Location */}
            {activeTab === 'address' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Alamat</label>
                    <div className="relative">
                      <div className="absolute top-4 left-4 pointer-events-none">
                        <MapPin className="h-5 w-5 text-gray-400" />
                      </div>
                      <textarea
                        value={formData.address}
                        onChange={(e) => update('address', e.target.value)}
                        rows={3}
                        className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all resize-none"
                        placeholder="Masukkan alamat lengkap"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Kecamatan</label>
                    <select
                      value={formData.subdistrict}
                      onChange={(e) => update('subdistrict', e.target.value)}
                      className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
                    >
                      <option value="">Pilih Kecamatan</option>
                      {kecamatanJember.map((kec: string) => (
                        <option key={kec} value={kec}>
                          {kec}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Kota</label>
                    <input
                      type="text"
                      value="Jember"
                      readOnly
                      className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-500 text-base cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Provinsi</label>
                    <input
                      type="text"
                      value="Jawa Timur"
                      readOnly
                      className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-500 text-base cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Kode Pos</label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) => update('postalCode', e.target.value)}
                      className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                      placeholder="Masukkan kode pos"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Negara</label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => update('country', e.target.value)}
                      className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                      placeholder="Masukkan negara"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Tanggal Lahir</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Calendar className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => update('dateOfBirth', e.target.value)}
                        className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Jenis Kelamin</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => update('gender', e.target.value)}
                      className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
                    >
                      <option value="">Pilih Jenis Kelamin</option>
                      <option value="L">Laki-laki</option>
                      <option value="P">Perempuan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Agama</label>
                    <input
                      type="text"
                      value={formData.religion}
                      onChange={(e) => update('religion', e.target.value)}
                      className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                      placeholder="Masukkan agama"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Identity & Tax */}
            {activeTab === 'identity' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Jenis Identitas</label>
                    <select
                      value={formData.idType}
                      onChange={(e) => update('idType', e.target.value)}
                      className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
                    >
                      <option value="">Pilih Jenis Identitas</option>
                      <option value="KTP">KTP</option>
                      <option value="SIM">SIM</option>
                      <option value="PASSPORT">Passport</option>
                      <option value="KITAS">KITAS</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Nomor Identitas</label>
                    <input
                      type="text"
                      value={formData.idNumber}
                      onChange={(e) => update('idNumber', e.target.value)}
                      className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                      placeholder="Masukkan nomor identitas"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Nama (Pajak)</label>
                    <input
                      type="text"
                      value={formData.taxName}
                      onChange={(e) => update('taxName', e.target.value)}
                      className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                      placeholder="Masukkan nama untuk pajak"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Jenis Identitas Pajak</label>
                    <select
                      value={formData.taxIdType}
                      onChange={(e) => update('taxIdType', e.target.value)}
                      className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
                    >
                      <option value="">Pilih Jenis Identitas Pajak</option>
                      <option value="NPWP">NPWP</option>
                      <option value="KTP">KTP</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">No NPWP/KTP</label>
                    <input
                      type="text"
                      value={formData.taxId}
                      onChange={(e) => update('taxId', e.target.value)}
                      className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                      placeholder="Masukkan nomor NPWP/KTP"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">IDTKU</label>
                    <input
                      type="text"
                      value={formData.idTKU}
                      onChange={(e) => update('idTKU', e.target.value)}
                      className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                      placeholder="Masukkan IDTKU"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Detail Transaksi Pajak</label>
                    <input
                      type="text"
                      value={formData.taxTransactionDetail}
                      onChange={(e) => update('taxTransactionDetail', e.target.value)}
                      className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                      placeholder="01/02/03..dst"
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Alamat (Pajak)</label>
                    <div className="relative">
                      <div className="absolute top-4 left-4 pointer-events-none">
                        <MapPin className="h-5 w-5 text-gray-400" />
                      </div>
                      <textarea
                        value={formData.taxAddress}
                        onChange={(e) => update('taxAddress', e.target.value)}
                        rows={3}
                        className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all resize-none"
                        placeholder="Masukkan alamat untuk pajak"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Credit & Limit */}
            {activeTab === 'credit' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Plafon Nilai (Credit Limit)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <CreditCard className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="number"
                        value={formData.creditLimit}
                        onChange={(e) => update('creditLimit', parseFloat(e.target.value) || 0)}
                        className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                        placeholder="0"
                        min={0}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Plafon Jumlah Nota</label>
                    <input
                      type="number"
                      value={formData.creditLimitNoteCount}
                      onChange={(e) => update('creditLimitNoteCount', parseInt(e.target.value) || 0)}
                      className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                      placeholder="0"
                      min={0}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Payment Term (Hari)</label>
                    <input
                      type="number"
                      value={formData.paymentTermDays}
                      onChange={(e) => update('paymentTermDays', parseInt(e.target.value) || 0)}
                      className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                      placeholder="0"
                      min={0}
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Keterangan</label>
                    <div className="relative">
                      <div className="absolute top-4 left-4 pointer-events-none">
                        <FileText className="h-5 w-5 text-gray-400" />
                      </div>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => update('notes', e.target.value)}
                        rows={4}
                        className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all resize-none"
                        placeholder="Masukkan keterangan tambahan"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </form>
        )}

        {/* Sticky Footer */}
        {!loadingCustomer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-2xl">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={mutation.isPending}
              className="flex items-center gap-2"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isEdit ? 'Simpan Perubahan' : 'Simpan Pelanggan'}</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
