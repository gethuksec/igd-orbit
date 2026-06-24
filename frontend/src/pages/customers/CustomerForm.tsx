import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  X,
  Loader2,
  ArrowLeft,
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

export default function CustomerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const [activeTab, setActiveTab] = useState('basic');

  const [formData, setFormData] = useState({
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
    tier: 'REGULAR', // Will be converted to tierId
    notes: '',
  });

  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersService.getById(id!),
    enabled: !!id,
  });

  // Tier conversion will be handled in the submit handler via tierCode

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
    mutationFn: async (data: any) => {
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
      
      // Convert tier code to tierCode field for backend
      if (data.tier) {
        submitData.tierCode = data.tier; // Backend will lookup tier ID from code
      }
      
      return isEdit
        ? customersService.update(id!, submitData)
        : customersService.create(submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      toast.success(isEdit ? 'Pelanggan berhasil diupdate' : 'Pelanggan berhasil ditambahkan');
      navigate('/customers');
    },
    onError: (error: any) => {
      // Extract validation errors from backend
      const errorResponse = error.response?.data;
      let errorMessage = 'Terjadi kesalahan saat menyimpan data';
      
      if (errorResponse?.message) {
        // Single error message
        errorMessage = errorResponse.message;
      } else if (errorResponse?.errors) {
        // Multiple validation errors (from class-validator)
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (loadingCustomer) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: 'basic', label: 'Informasi Dasar', icon: User },
    { id: 'address', label: 'Alamat & Lokasi', icon: MapPin },
    { id: 'identity', label: 'Identitas & Pajak', icon: CreditCard },
    { id: 'credit', label: 'Kredit & Plafon', icon: Award },
  ];

  return (
    <div className="w-full space-y-4">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/customers')}
              className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-4xl font-bold mb-2">
                {isEdit ? 'Edit Pelanggan' : 'Tambah Pelanggan'}
              </h1>
              <p className="text-primary-100 text-lg">
                {isEdit ? 'Ubah informasi pelanggan' : 'Tambahkan pelanggan baru'}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/customers')}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all border border-white/20 font-medium"
          >
            <X className="w-4 h-4" />
            <span>Batal</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                      : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8">
          {/* Tab: Basic Information */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">
                    Nama <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    required
                    placeholder="Masukkan nama pelanggan"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">
                    Jenis Pelanggan <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.customerType}
                    onChange={(e) => setFormData({ ...formData, customerType: e.target.value })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
                    required
                  >
                    <option value="retail">Retail</option>
                    <option value="wholesale">Wholesale</option>
                    <option value="corporate">Corporate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">
                    Telepon <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                      required
                      placeholder="08xx-xxxx-xxxx"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">
                    Kecamatan <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <MapPin className="h-5 w-5 text-gray-400" />
                    </div>
                    <select
                      value={formData.subdistrict}
                      onChange={(e) => setFormData({ ...formData, subdistrict: e.target.value })}
                      className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
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
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Email</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                      placeholder="email@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Tier</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Award className="h-5 w-5 text-gray-400" />
                    </div>
                    <select
                      value={formData.tier}
                      onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                      className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
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

          {/* Tab: Address & Location - Combined with Personal Data */}
          {activeTab === 'address' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Alamat</label>
                  <div className="relative">
                    <div className="absolute top-4 left-4 pointer-events-none">
                      <MapPin className="h-5 w-5 text-gray-400" />
                    </div>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={4}
                      className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all resize-none"
                      placeholder="Masukkan alamat lengkap"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Kecamatan</label>
                  <select
                    value={formData.subdistrict}
                    onChange={(e) => setFormData({ ...formData, subdistrict: e.target.value })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
                  >
                    <option value="">Pilih Kecamatan</option>
                    {kecamatanJember.map((kec) => (
                      <option key={kec} value={kec}>
                        {kec}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Kota</label>
                  <input
                    type="text"
                    value="Jember"
                    readOnly
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-500 text-base cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Provinsi</label>
                  <input
                    type="text"
                    value="Jawa Timur"
                    readOnly
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-500 text-base cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Kode Pos</label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    placeholder="Masukkan kode pos"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Negara</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    placeholder="Masukkan negara"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Tanggal Lahir</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Jenis Kelamin</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
                  >
                    <option value="">Pilih Jenis Kelamin</option>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Agama</label>
                  <input
                    type="text"
                    value={formData.religion}
                    onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    placeholder="Masukkan agama"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab: Identity & Tax - Combined */}
          {activeTab === 'identity' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Jenis Identitas</label>
                  <select
                    value={formData.idType}
                    onChange={(e) => setFormData({ ...formData, idType: e.target.value })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
                  >
                    <option value="">Pilih Jenis Identitas</option>
                    <option value="KTP">KTP</option>
                    <option value="SIM">SIM</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="KITAS">KITAS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Nomor Identitas</label>
                  <input
                    type="text"
                    value={formData.idNumber}
                    onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    placeholder="Masukkan nomor identitas"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Nama (Pajak)</label>
                  <input
                    type="text"
                    value={formData.taxName}
                    onChange={(e) => setFormData({ ...formData, taxName: e.target.value })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    placeholder="Masukkan nama untuk pajak"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Jenis Identitas Pajak</label>
                  <select
                    value={formData.taxIdType}
                    onChange={(e) => setFormData({ ...formData, taxIdType: e.target.value })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
                  >
                    <option value="">Pilih Jenis Identitas Pajak</option>
                    <option value="NPWP">NPWP</option>
                    <option value="KTP">KTP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">No NPWP/KTP</label>
                  <input
                    type="text"
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    placeholder="Masukkan nomor NPWP/KTP"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">IDTKU</label>
                  <input
                    type="text"
                    value={formData.idTKU}
                    onChange={(e) => setFormData({ ...formData, idTKU: e.target.value })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    placeholder="Masukkan IDTKU"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Detail Transaksi Pajak</label>
                  <input
                    type="text"
                    value={formData.taxTransactionDetail}
                    onChange={(e) => setFormData({ ...formData, taxTransactionDetail: e.target.value })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    placeholder="01/02/03..dst"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Alamat (Pajak)</label>
                  <div className="relative">
                    <div className="absolute top-4 left-4 pointer-events-none">
                      <MapPin className="h-5 w-5 text-gray-400" />
                    </div>
                    <textarea
                      value={formData.taxAddress}
                      onChange={(e) => setFormData({ ...formData, taxAddress: e.target.value })}
                      rows={4}
                      className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all resize-none"
                      placeholder="Masukkan alamat untuk pajak"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Credit & Limit - Combined with Notes */}
          {activeTab === 'credit' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Plafon Nilai (Credit Limit)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <CreditCard className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      value={formData.creditLimit}
                      onChange={(e) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
                      className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                      placeholder="0"
                      min={0}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Plafon Jumlah Nota</label>
                  <input
                    type="number"
                    value={formData.creditLimitNoteCount}
                    onChange={(e) =>
                      setFormData({ ...formData, creditLimitNoteCount: parseInt(e.target.value) || 0 })
                    }
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    placeholder="0"
                    min={0}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Payment Term (Hari)</label>
                  <input
                    type="number"
                    value={formData.paymentTermDays}
                    onChange={(e) => setFormData({ ...formData, paymentTermDays: parseInt(e.target.value) || 0 })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    placeholder="0"
                    min={0}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Keterangan</label>
                  <div className="relative">
                    <div className="absolute top-4 left-4 pointer-events-none">
                      <FileText className="h-5 w-5 text-gray-400" />
                    </div>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={6}
                      className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all resize-none"
                      placeholder="Masukkan keterangan tambahan"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* Form Actions */}
          <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/customers')}
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
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>{isEdit ? 'Simpan Perubahan' : 'Simpan Pelanggan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
