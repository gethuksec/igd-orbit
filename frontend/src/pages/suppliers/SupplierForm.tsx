import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  X,
  Loader2,
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
} from 'lucide-react';
import { suppliersService } from '../../services/suppliers.service';
import { toast } from 'sonner';

export default function SupplierForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const [activeTab, setActiveTab] = useState('basic');

  const [formData, setFormData] = useState({
    customerType: 'wholesale', // Always wholesale for suppliers
    name: '',
    phone: '',
    alternatePhone: '',
    email: '',
    address: '',
    subdistrict: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'Indonesia',
    idType: '',
    idNumber: '',
    taxId: '',
    taxName: '',
    taxIdType: '',
    taxAddress: '',
    idTKU: '',
    taxTransactionDetail: '',
    notes: '',
    contactPerson: '',
  });

  const { data: supplier, isLoading: loadingSupplier } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => suppliersService.getById(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (supplier) {
      setFormData({
        customerType: 'wholesale', // Always wholesale
        name: supplier.name || '',
        phone: supplier.phone || '',
        alternatePhone: (supplier as any).alternatePhone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        subdistrict: (supplier as any).subdistrict || '',
        city: (supplier as any).city || '',
        province: (supplier as any).province || '',
        postalCode: (supplier as any).postalCode || '',
        country: (supplier as any).country || 'Indonesia',
        idType: (supplier as any).idType || '',
        idNumber: (supplier as any).idNumber || '',
        taxId: (supplier as any).taxId || '',
        taxName: (supplier as any).taxName || '',
        taxIdType: (supplier as any).taxIdType || '',
        taxAddress: (supplier as any).taxAddress || '',
        idTKU: (supplier as any).idTKU || '',
        taxTransactionDetail: (supplier as any).taxTransactionDetail || '',
        notes: (supplier as any).notes || '',
        contactPerson: (supplier as any).contactPerson || '',
      });
    }
  }, [supplier]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const submitData: any = {
        customerType: 'wholesale', // Always wholesale for suppliers
        name: data.name,
        phone: data.phone,
        alternatePhone: data.alternatePhone || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
        subdistrict: data.subdistrict || undefined,
        city: data.city || undefined,
        province: data.province || undefined,
        postalCode: data.postalCode || undefined,
        country: data.country || undefined,
        idType: data.idType || undefined,
        idNumber: data.idNumber || undefined,
        taxId: data.taxId || undefined,
        taxName: data.taxName || undefined,
        taxIdType: data.taxIdType || undefined,
        taxAddress: data.taxAddress || undefined,
        idTKU: data.idTKU || undefined,
        taxTransactionDetail: data.taxTransactionDetail || undefined,
        notes: data.notes || undefined,
        contactPerson: data.contactPerson || undefined,
      };
      
      if (isEdit) {
        return suppliersService.update(id!, submitData);
      } else {
        return suppliersService.create(submitData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success(isEdit ? 'Supplier berhasil diupdate' : 'Supplier berhasil ditambahkan');
      navigate('/suppliers');
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

  if (loadingSupplier) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: 'basic', label: 'Informasi Dasar', icon: Building2 },
    { id: 'address', label: 'Alamat & Lokasi', icon: MapPin },
    { id: 'identity', label: 'Identitas & Pajak', icon: CreditCard },
  ];

  return (
    <div className="w-full space-y-4">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/suppliers')}
              className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-4xl font-bold mb-2">
                {isEdit ? 'Edit Supplier' : 'Tambah Supplier'}
              </h1>
              <p className="text-primary-100 text-lg">
                {isEdit ? 'Ubah informasi supplier' : 'Tambahkan supplier baru'}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/suppliers')}
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
                    Nama Supplier <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    required
                    placeholder="Masukkan nama supplier"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    placeholder="Masukkan nama contact person"
                  />
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
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">No HP (Alternate)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      value={formData.alternatePhone}
                      onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                      className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                      placeholder="08xx-xxxx-xxxx"
                    />
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
                  <input
                    type="text"
                    value={formData.subdistrict}
                    onChange={(e) => setFormData({ ...formData, subdistrict: e.target.value })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    placeholder="Masukkan kecamatan"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Kota</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    placeholder="Masukkan kota"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Provinsi</label>
                  <input
                    type="text"
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                    placeholder="Masukkan provinsi"
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

          {/* Notes in Identity Tab */}
          {activeTab === 'identity' && (
            <div className="mt-6 pt-6 border-t border-gray-200">
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
          )}

          {/* Form Actions */}
          <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/suppliers')}
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
              <span>{isEdit ? 'Simpan Perubahan' : 'Simpan Supplier'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
