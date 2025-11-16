import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Edit, Wrench, User, Phone, Mail, Package, Loader2 } from 'lucide-react';
import { serviceOrdersService } from '../../services/service-orders.service';

export default function ServiceOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: serviceOrder, isLoading } = useQuery({
    queryKey: ['service-order', id],
    queryFn: () => serviceOrdersService.getById(id!),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!serviceOrder) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Service order tidak ditemukan</p>
        <button
          onClick={() => navigate('/service-orders')}
          className="mt-4 text-primary-600 hover:text-primary-700"
        >
          Kembali ke daftar service order
        </button>
      </div>
    );
  }

  const order = serviceOrder as any;

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

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
                {order.serviceNumber || 'Service Order'}
              </h1>
              <p className="text-primary-100">Detail Service Order</p>
            </div>
          </div>
          <Link
            to={`/service-orders/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all"
          >
            <Edit className="w-4 h-4" />
            <span>Edit</span>
          </Link>
        </div>
      </div>

      {/* Status Badge */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm text-gray-500">Status</label>
            <div className="mt-1">
              <span
                className={`inline-block px-4 py-2 rounded-lg text-sm font-semibold border ${getStatusColor(
                  order.status || 'PENDING',
                )}`}
              >
                {order.status || 'PENDING'}
              </span>
            </div>
          </div>
          {order.createdAt && (
            <div className="text-right">
              <label className="text-sm text-gray-500">Tanggal Dibuat</label>
              <p className="text-base font-semibold text-gray-900">
                {new Date(order.createdAt).toLocaleDateString('id-ID')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Customer Information */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
              <User className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Informasi Customer</h2>
          </div>
          <div className="space-y-3">
            {order.customerName && (
              <div>
                <label className="text-sm text-gray-500">Nama</label>
                <p className="text-base font-semibold text-gray-900">{order.customerName}</p>
              </div>
            )}
            {order.customerPhone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <a
                  href={`tel:${order.customerPhone}`}
                  className="text-base text-primary-600 hover:text-primary-700"
                >
                  {order.customerPhone}
                </a>
              </div>
            )}
            {order.customerEmail && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <a
                  href={`mailto:${order.customerEmail}`}
                  className="text-base text-primary-600 hover:text-primary-700"
                >
                  {order.customerEmail}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Device Information */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Informasi Perangkat</h2>
          </div>
          <div className="space-y-3">
            {order.deviceType && (
              <div>
                <label className="text-sm text-gray-500">Jenis Perangkat</label>
                <p className="text-base font-semibold text-gray-900">{order.deviceType}</p>
              </div>
            )}
            {order.deviceBrand && (
              <div>
                <label className="text-sm text-gray-500">Brand</label>
                <p className="text-base font-semibold text-gray-900">{order.deviceBrand}</p>
              </div>
            )}
            {order.deviceModel && (
              <div>
                <label className="text-sm text-gray-500">Model</label>
                <p className="text-base font-semibold text-gray-900">{order.deviceModel}</p>
              </div>
            )}
            {order.deviceSerial && (
              <div>
                <label className="text-sm text-gray-500">Serial Number</label>
                <p className="text-base font-semibold text-gray-900">{order.deviceSerial}</p>
              </div>
            )}
          </div>
        </div>

        {/* Service Information */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Informasi Service</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {order.complaint && (
              <div className="md:col-span-2">
                <label className="text-sm text-gray-500">Keluhan</label>
                <p className="text-base text-gray-900 mt-1">{order.complaint}</p>
              </div>
            )}
            {order.initialDiagnosis && (
              <div className="md:col-span-2">
                <label className="text-sm text-gray-500">Diagnosis Awal</label>
                <p className="text-base text-gray-900 mt-1">{order.initialDiagnosis}</p>
              </div>
            )}
            {order.estimatedCost && (
              <div>
                <label className="text-sm text-gray-500">Estimasi Biaya</label>
                <p className="text-base font-semibold text-gray-900">
                  {new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                  }).format(order.estimatedCost)}
                </p>
              </div>
            )}
            {order.priority && (
              <div>
                <label className="text-sm text-gray-500">Prioritas</label>
                <p className="text-base font-semibold text-gray-900 uppercase">{order.priority}</p>
              </div>
            )}
            {order.promisedDate && (
              <div>
                <label className="text-sm text-gray-500">Promised Date</label>
                <p className="text-base font-semibold text-gray-900">
                  {new Date(order.promisedDate).toLocaleDateString('id-ID')}
                </p>
              </div>
            )}
            {order.customerNotes && (
              <div className="md:col-span-2">
                <label className="text-sm text-gray-500">Catatan Customer</label>
                <p className="text-base text-gray-900 mt-1">{order.customerNotes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

