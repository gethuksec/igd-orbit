import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Edit, Building2, Phone, Mail, MapPin, Package, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: supplier, isLoading } = useQuery({
    queryKey: ['supplier', id],
    queryFn: async () => {
      const res = await api.get(`/suppliers/${id}`);
      return res.data.data || res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Supplier tidak ditemukan</p>
        <button
          onClick={() => navigate('/suppliers')}
          className="mt-4 text-primary-600 hover:text-primary-700"
        >
          Kembali ke daftar supplier
        </button>
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
              onClick={() => navigate('/suppliers')}
              className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold mb-1">{supplier.name}</h1>
              <p className="text-primary-100">Detail Supplier</p>
            </div>
          </div>
          <Link
            to={`/suppliers/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all"
          >
            <Edit className="w-4 h-4" />
            <span>Edit</span>
          </Link>
        </div>
      </div>

      {/* Detail Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Basic Information */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Informasi Dasar</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-500">Nama Supplier</label>
              <p className="text-base font-semibold text-gray-900">{supplier.name}</p>
            </div>
            {supplier.code && (
              <div>
                <label className="text-sm text-gray-500">Kode Supplier</label>
                <p className="text-base font-semibold text-gray-900">{supplier.code}</p>
              </div>
            )}
            {supplier.contactPerson && (
              <div>
                <label className="text-sm text-gray-500">Contact Person</label>
                <p className="text-base font-semibold text-gray-900">{supplier.contactPerson}</p>
              </div>
            )}
            <div>
              <label className="text-sm text-gray-500">Status</label>
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  supplier.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {supplier.isActive ? 'Aktif' : 'Tidak Aktif'}
              </span>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Kontak</h2>
          </div>
          <div className="space-y-3">
            {supplier.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <a
                  href={`tel:${supplier.phone}`}
                  className="text-base text-primary-600 hover:text-primary-700"
                >
                  {supplier.phone}
                </a>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <a
                  href={`mailto:${supplier.email}`}
                  className="text-base text-primary-600 hover:text-primary-700"
                >
                  {supplier.email}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Address */}
        {(supplier.address || supplier.city || supplier.province) && (
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Alamat</h2>
            </div>
            <div className="space-y-2">
              {supplier.address && (
                <p className="text-base text-gray-900">{supplier.address}</p>
              )}
              <p className="text-base text-gray-600">
                {[supplier.city, supplier.province].filter(Boolean).join(', ')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

