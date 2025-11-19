import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  FileText,
} from 'lucide-react';
import { serviceReturnsService } from '../../services/service-returns.service';
import { serviceOrdersService } from '../../services/service-orders.service';
import { toast } from 'sonner';

export default function ServiceReturnForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryServiceOrderId = searchParams.get('serviceOrderId');
  const queryClient = useQueryClient();

  const [selectedServiceOrderId, setSelectedServiceOrderId] = useState<string>(queryServiceOrderId || '');
  const [returnType, setReturnType] = useState<'re-service' | 'complaint' | 'warranty' | 'combination'>('re-service');
  const [returnReason, setReturnReason] = useState('');
  const [customerComplaint, setCustomerComplaint] = useState('');
  const [expectedResolution, setExpectedResolution] = useState<'re-service' | 'refund' | 'discount' | 'replacement' | ''>('');

  // Fetch list of delivered service orders for dropdown
  const { data: deliveredOrdersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['service-orders-delivered'],
    queryFn: () => serviceOrdersService.getAll({ status: 'delivered', limit: 100 }),
  });

  // Fetch service order if selected
  const { data: serviceOrder, isLoading: isLoadingOrder } = useQuery({
    queryKey: ['service-order', selectedServiceOrderId],
    queryFn: () => serviceOrdersService.getById(selectedServiceOrderId),
    enabled: !!selectedServiceOrderId,
  });

  // Calculate if within return period and warranty
  const isWithinReturnPeriod = serviceOrder?.deliveredAt
    ? new Date(serviceOrder.deliveredAt).getTime() + 30 * 24 * 60 * 60 * 1000 >= new Date().getTime()
    : false;

  const isWithinWarranty = serviceOrder?.deliveredAt && serviceOrder?.warrantyDays
    ? new Date(serviceOrder.deliveredAt).getTime() + serviceOrder.warrantyDays * 24 * 60 * 60 * 1000 >= new Date().getTime()
    : false;

  const createReturnMutation = useMutation({
    mutationFn: serviceReturnsService.create,
    onSuccess: () => {
      toast.success('Return/complaint berhasil dibuat');
      queryClient.invalidateQueries({ queryKey: ['service-returns'] });
      queryClient.invalidateQueries({ queryKey: ['service-order', selectedServiceOrderId] });
      navigate('/service-returns');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membuat return/complaint');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedServiceOrderId) {
      toast.error('Service order harus dipilih');
      return;
    }

    if (!returnReason.trim()) {
      toast.error('Return reason diperlukan');
      return;
    }

    if ((returnType === 'complaint' || returnType === 'combination') && !customerComplaint.trim()) {
      toast.error('Customer complaint diperlukan untuk tipe complaint');
      return;
    }

    createReturnMutation.mutate({
      serviceOrderId: selectedServiceOrderId,
      returnType,
      returnReason,
      customerComplaint: customerComplaint.trim() || undefined,
      expectedResolution: expectedResolution || undefined,
    });
  };

  if (isLoadingOrder || isLoadingOrders) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (selectedServiceOrderId && !serviceOrder) {
    return (
      <div className="w-full text-center py-12">
        <p className="text-gray-600 text-lg">Service order tidak ditemukan</p>
        <button
          onClick={() => {
            setSelectedServiceOrderId('');
            navigate('/service-returns/new');
          }}
          className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
        >
          Pilih service order lain
        </button>
      </div>
    );
  }

  const deliveredOrders = deliveredOrdersData?.data || [];

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Buat Return/Complaint</h1>
              <p className="text-sm text-gray-500 mt-1">Laporkan return atau komplain service</p>
            </div>
          </div>
        </div>
      </div>

      {/* Service Order Selection */}
      {!queryServiceOrderId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            Pilih Service Order <span className="text-red-500">*</span>
          </h2>
          <select
            value={selectedServiceOrderId}
            onChange={(e) => setSelectedServiceOrderId(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
            required
          >
            <option value="">Pilih service order...</option>
            {deliveredOrders.map((order: any) => (
              <option key={order.id} value={order.id}>
                {order.serviceNumber} - {order.customerName || order.customer?.name || 'Walk-in Customer'} - {order.deviceBrand} {order.deviceModel}
                {order.deliveredAt && ` (${new Date(order.deliveredAt).toLocaleDateString('id-ID')})`}
              </option>
            ))}
          </select>
          {deliveredOrders.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">Tidak ada service order dengan status delivered</p>
          )}
        </div>
      )}

      {/* Service Order Info */}
      {serviceOrder && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            Service Order
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Service Number</p>
              <Link
                to={`/service-orders/${serviceOrder.id}`}
                className="text-sm font-semibold text-primary-600 hover:underline"
              >
                {serviceOrder.serviceNumber}
              </Link>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Customer</p>
              <p className="text-sm font-semibold text-gray-900">{serviceOrder.customerName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Device</p>
              <p className="text-sm font-semibold text-gray-900">
                {serviceOrder.deviceBrand} {serviceOrder.deviceModel}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Delivered Date</p>
              <p className="text-sm font-semibold text-gray-900">
                {serviceOrder.deliveredAt
                  ? new Date(serviceOrder.deliveredAt).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : '-'}
              </p>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="mt-4 flex gap-3">
            {isWithinReturnPeriod ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">Masih dalam 30 hari</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg border border-red-200">
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Sudah melewati 30 hari</span>
              </div>
            )}
            {isWithinWarranty && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Masih dalam warranty</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        {/* Return Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Tipe Return/Complaint <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { value: 're-service', label: 'Re-Service', desc: 'Perlu service ulang' },
              { value: 'complaint', label: 'Complaint', desc: 'Ketidakpuasan' },
              { value: 'warranty', label: 'Warranty', desc: 'Masalah dalam warranty' },
              { value: 'combination', label: 'Combination', desc: 'Re-service + Complaint' },
            ].map((type) => (
              <label
                key={type.value}
                className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  returnType === type.value
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="returnType"
                  value={type.value}
                  checked={returnType === type.value}
                  onChange={(e) => setReturnType(e.target.value as any)}
                  className="sr-only"
                />
                <span className="text-sm font-semibold text-gray-900">{type.label}</span>
                <span className="text-xs text-gray-500 mt-1">{type.desc}</span>
                {returnType === type.value && (
                  <CheckCircle2 className="absolute top-2 right-2 w-5 h-5 text-primary-600" />
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Return Reason */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Return Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="Jelaskan alasan return/complaint..."
            rows={4}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
            required
          />
        </div>

        {/* Customer Complaint (required if complaint or combination) */}
        {(returnType === 'complaint' || returnType === 'combination') && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Customer Complaint <span className="text-red-500">*</span>
            </label>
            <textarea
              value={customerComplaint}
              onChange={(e) => setCustomerComplaint(e.target.value)}
              placeholder="Detail ketidakpuasan customer..."
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
              required
            />
          </div>
        )}

        {/* Expected Resolution */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Expected Resolution (Optional)
          </label>
          <select
            value={expectedResolution}
            onChange={(e) => setExpectedResolution(e.target.value as any)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
          >
            <option value="">Pilih resolution...</option>
            <option value="re-service">Re-Service</option>
            <option value="refund">Refund</option>
            <option value="discount">Discount</option>
            <option value="replacement">Replacement</option>
          </select>
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={createReturnMutation.isPending || !isWithinReturnPeriod}
            className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {createReturnMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <span>Buat Return/Complaint</span>
            )}
          </button>
        </div>

        {!isWithinReturnPeriod && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Tidak dapat membuat return</p>
                <p className="text-sm text-red-700 mt-1">
                  Service order sudah melewati 30 hari dari tanggal delivery. Return/complaint hanya bisa dibuat dalam 30 hari setelah delivery.
                </p>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

