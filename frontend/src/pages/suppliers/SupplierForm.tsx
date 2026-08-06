import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  Loader2,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { BreadcrumbHeader } from '@/components/shared';
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
      <BreadcrumbHeader
        title={isEdit ? 'Edit Supplier' : 'Tambah Supplier'}
        subtitle={isEdit ? 'Ubah informasi supplier' : 'Tambahkan supplier baru'}
      >

      </BreadcrumbHeader>

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
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Masukkan nama supplier"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">
                    Contact Person
                  </label>
                  <Input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
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
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                      placeholder="08xx-xxxx-xxxx"
                      className="pl-12"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">No HP (Alternate)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      type="tel"
                      value={formData.alternatePhone}
                      onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                      placeholder="08xx-xxxx-xxxx"
                      className="pl-12"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Email</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                      className="pl-12"
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
                    <Textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={4}
                      placeholder="Masukkan alamat lengkap"
                      className="pl-12"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Kecamatan</label>
                  <Input
                    type="text"
                    value={formData.subdistrict}
                    onChange={(e) => setFormData({ ...formData, subdistrict: e.target.value })}
                    placeholder="Masukkan kecamatan"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Kota</label>
                  <Input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Masukkan kota"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Provinsi</label>
                  <Input
                    type="text"
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    placeholder="Masukkan provinsi"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Kode Pos</label>
                  <Input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    placeholder="Masukkan kode pos"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Negara</label>
                  <Input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
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
                  <Select
                    value={formData.idType}
                    onChange={(e) => setFormData({ ...formData, idType: e.target.value })}
                  >
                    <option value="">Pilih Jenis Identitas</option>
                    <option value="KTP">KTP</option>
                    <option value="SIM">SIM</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="KITAS">KITAS</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Nomor Identitas</label>
                  <Input
                    type="text"
                    value={formData.idNumber}
                    onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                    placeholder="Masukkan nomor identitas"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Nama (Pajak)</label>
                  <Input
                    type="text"
                    value={formData.taxName}
                    onChange={(e) => setFormData({ ...formData, taxName: e.target.value })}
                    placeholder="Masukkan nama untuk pajak"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Jenis Identitas Pajak</label>
                  <Select
                    value={formData.taxIdType}
                    onChange={(e) => setFormData({ ...formData, taxIdType: e.target.value })}
                  >
                    <option value="">Pilih Jenis Identitas Pajak</option>
                    <option value="NPWP">NPWP</option>
                    <option value="KTP">KTP</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">No NPWP/KTP</label>
                  <Input
                    type="text"
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                    placeholder="Masukkan nomor NPWP/KTP"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">IDTKU</label>
                  <Input
                    type="text"
                    value={formData.idTKU}
                    onChange={(e) => setFormData({ ...formData, idTKU: e.target.value })}
                    placeholder="Masukkan IDTKU"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Detail Transaksi Pajak</label>
                  <Input
                    type="text"
                    value={formData.taxTransactionDetail}
                    onChange={(e) => setFormData({ ...formData, taxTransactionDetail: e.target.value })}
                    placeholder="01/02/03..dst"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2.5">Alamat (Pajak)</label>
                  <div className="relative">
                    <div className="absolute top-4 left-4 pointer-events-none">
                      <MapPin className="h-5 w-5 text-gray-400" />
                    </div>
                    <Textarea
                      value={formData.taxAddress}
                      onChange={(e) => setFormData({ ...formData, taxAddress: e.target.value })}
                      rows={4}
                      placeholder="Masukkan alamat untuk pajak"
                      className="pl-12"
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
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={6}
                  placeholder="Masukkan keterangan tambahan"
                  className="pl-12"
                />
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/suppliers')}
              className="px-6 py-3 text-base font-semibold"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-2 px-8 py-3 text-base font-bold bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 shadow-lg hover:shadow-xl"
            >
              {mutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>{isEdit ? 'Simpan Perubahan' : 'Simpan Supplier'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
