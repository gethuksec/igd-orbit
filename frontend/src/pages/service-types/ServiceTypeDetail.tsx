import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Edit, Wrench, Clock, DollarSign, Loader2, Package } from 'lucide-react';
import { serviceTypesService } from '../../services/service-types.service';

export default function ServiceTypeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: serviceType, isLoading } = useQuery({
    queryKey: ['service-type', id],
    queryFn: () => serviceTypesService.getById(id!),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!serviceType) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Layanan tidak ditemukan</p>
        <button
          onClick={() => navigate('/service-types')}
          className="mt-4 text-primary-600 hover:text-primary-700"
        >
          Kembali ke daftar layanan
        </button>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatSLA = (hours: number) => {
    if (hours < 24) {
      return `${hours} jam`;
    }
    return `${Math.floor(hours / 24)} hari`;
  };

  return (
    <div className="w-full space-y-4">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/service-types')}
              className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold mb-1">{serviceType.name}</h1>
              <p className="text-primary-100">Detail Layanan</p>
            </div>
          </div>
          <Link
            to={`/service-types/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all"
          >
            <Edit className="w-4 h-4" />
            <span>Edit</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Informasi Layanan */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary-600" />
              Informasi Layanan
            </h2>
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Kode Layanan</p>
                <p className="text-sm font-semibold text-gray-900 font-mono">{serviceType.code}</p>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Nama Layanan</p>
                <p className="text-sm font-semibold text-gray-900">{serviceType.name}</p>
              </div>

              {serviceType.description && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Deskripsi</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{serviceType.description}</p>
                </div>
              )}

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    serviceType.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {serviceType.isActive ? 'Aktif' : 'Tidak Aktif'}
                </span>
              </div>
            </div>
          </div>

          {/* Pricing Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary-600" />
              Informasi Harga
            </h2>
            <div className="space-y-3">
              <div className="p-3 bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg border border-primary-200">
                <p className="text-xs text-primary-600 mb-1">Harga Dasar</p>
                <p className="text-lg font-bold text-primary-900">{formatPrice(serviceType.basePrice)}</p>
              </div>

              {serviceType.minPrice && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Harga Minimum</p>
                  <p className="text-sm font-semibold text-gray-900">{formatPrice(serviceType.minPrice)}</p>
                </div>
              )}

              {serviceType.maxPrice && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Harga Maksimum</p>
                  <p className="text-sm font-semibold text-gray-900">{formatPrice(serviceType.maxPrice)}</p>
                </div>
              )}

              {serviceType.minPrice && serviceType.maxPrice && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 mb-1">Rentang Harga</p>
                  <p className="text-sm font-bold text-blue-900">
                    {formatPrice(serviceType.minPrice)} - {formatPrice(serviceType.maxPrice)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - SLA & Statistics */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-600" />
              SLA (Service Level Agreement)
            </h2>
            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-600 mb-1">Waktu Pengerjaan</p>
              <p className="text-2xl font-bold text-blue-900">{formatSLA(serviceType.slaHours)}</p>
              <p className="text-xs text-blue-600 mt-1">({serviceType.slaHours} jam)</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary-600" />
              Statistik
            </h2>
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Total Service Order</p>
                <p className="text-2xl font-bold text-gray-900">{serviceType.serviceOrderCount || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Menggunakan layanan ini</p>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Informasi Tambahan</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Dibuat</span>
                <span className="font-semibold text-gray-900">
                  {new Date(serviceType.createdAt).toLocaleDateString('id-ID', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Diupdate</span>
                <span className="font-semibold text-gray-900">
                  {new Date(serviceType.updatedAt).toLocaleDateString('id-ID', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

