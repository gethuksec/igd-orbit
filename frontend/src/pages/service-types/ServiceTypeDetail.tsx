import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit, Wrench, Clock, DollarSign, Package, Calendar, Loader2 } from "lucide-react";
import { serviceTypesService } from "../../services/service-types.service";
import { PageHeader } from "@/components/shared";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function ServiceTypeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: serviceType, isLoading } = useQuery({
    queryKey: ["service-type", id],
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
          onClick={() => navigate("/service-types")}
          className="mt-4 text-primary-600 hover:text-primary-700"
        >
          Kembali ke daftar layanan
        </button>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/service-types")}
          className="flex-shrink-0 p-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg shadow-lg hover:from-primary-500 hover:to-primary-400 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <PageHeader title={serviceType.name} subtitle="Detail Layanan">
            <Link
              to={`/service-types/${id}/edit`}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all"
            >
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </Link>
          </PageHeader>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Informasi Layanan */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Wrench className="w-5 h-5 text-primary-600" />
              <CardTitle>Informasi Layanan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {serviceType.isActive ? "Aktif" : "Tidak Aktif"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary-600" />
              <CardTitle>Informasi Harga</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
            </CardContent>
          </Card>
        </div>

        {/* Right Column - SLA & Statistics */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Clock className="w-5 h-5 text-primary-600" />
              <CardTitle>SLA (Service Level Agreement)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-600 mb-1">Waktu Pengerjaan</p>
                <p className="text-2xl font-bold text-blue-900">{formatSLA(serviceType.slaHours)}</p>
                <p className="text-xs text-blue-600 mt-1">({serviceType.slaHours} jam)</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Package className="w-5 h-5 text-primary-600" />
              <CardTitle>Statistik</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Total Service Order</p>
                <p className="text-2xl font-bold text-gray-900">{serviceType.serviceOrderCount || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Menggunakan layanan ini</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              <CardTitle>Informasi Tambahan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Dibuat</span>
                <span className="font-semibold text-gray-900">
                  {new Date(serviceType.createdAt).toLocaleDateString("id-ID", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Diupdate</span>
                <span className="font-semibold text-gray-900">
                  {new Date(serviceType.updatedAt).toLocaleDateString("id-ID", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
