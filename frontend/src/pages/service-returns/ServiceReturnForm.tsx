import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, ArrowLeft, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { serviceReturnsService, type CreateServiceReturnDto } from '../../services/service-returns.service';
import { serviceOrdersService } from '../../services/service-orders.service';
import { toast } from 'sonner';
import { useBranchFilter, BranchFilterSelect } from '@/components/branch/BranchFilter';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';

export default function ServiceReturnForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { branchId, setBranchId } = useBranchFilter();
  const serviceOrderIdFromUrl = searchParams.get('serviceOrderId');

  const [selectedServiceOrderId, setSelectedServiceOrderId] = useState<string>(
    serviceOrderIdFromUrl || '',
  );
  const [formData, setFormData] = useState<CreateServiceReturnDto>({
    serviceOrderId: serviceOrderIdFromUrl || '',
    returnType: 're-service',
    returnReason: '',
    customerComplaint: '',
  });

  // Fetch service order if ID provided
  const { data: serviceOrder, isLoading: loadingServiceOrder } = useQuery({
    queryKey: ['service-order', selectedServiceOrderId],
    queryFn: () => serviceOrdersService.getById(selectedServiceOrderId),
    enabled: !!selectedServiceOrderId,
  });

  // Check if selected service order already has active return
  const { data: existingReturnsForOrder } = useQuery({
    queryKey: ['service-returns', 'by-order', selectedServiceOrderId],
    queryFn: () =>
      serviceReturnsService.getAll({
        page: 1,
        limit: 100,
      }),
    enabled: !!selectedServiceOrderId,
    select: (data) => {
      // Filter returns for this specific service order
      return data.data?.filter((ret: any) => ret.serviceOrderId === selectedServiceOrderId) || [];
    },
  });

  const hasActiveReturnForSelectedOrder = existingReturnsForOrder?.some(
    (ret: any) => ret.status !== 'rejected',
  );

  // Fetch delivered service orders for dropdown
  const { data: deliveredOrders } = useQuery({
    queryKey: ['delivered-service-orders', branchId],
    queryFn: () =>
      serviceOrdersService.getAll({
        page: 1,
        limit: 100,
        status: 'delivered',
        branchId: branchId || undefined,
      }),
    enabled: !serviceOrderIdFromUrl,
  });

  // Fetch all service returns to check which service orders already have active returns
  const { data: allServiceReturns } = useQuery({
    queryKey: ['service-returns', 'all-for-filter'],
    queryFn: () =>
      serviceReturnsService.getAll({
        page: 1,
        limit: 1000, // Get all to check
      }),
    enabled: !serviceOrderIdFromUrl && !!deliveredOrders,
  });

  // Get service order IDs that already have active returns (not rejected)
  const serviceOrdersWithActiveReturns = new Set(
    allServiceReturns?.data
      ?.filter((ret: any) => ret.status !== 'rejected')
      .map((ret: any) => ret.serviceOrderId) || [],
  );

  // Filter delivered orders to exclude those with active returns
  const availableOrders = deliveredOrders?.data?.filter(
    (order: any) => !serviceOrdersWithActiveReturns.has(order.id),
  ) || [];

  useEffect(() => {
    if (serviceOrder) {
      setFormData((prev) => ({
        ...prev,
        serviceOrderId: serviceOrder.id,
      }));
    }
  }, [serviceOrder]);

  const createMutation = useMutation({
    mutationFn: (data: CreateServiceReturnDto) => serviceReturnsService.create(data),
    onSuccess: () => {
      toast.success('Retur service berhasil dibuat');
      queryClient.invalidateQueries({ queryKey: ['service-returns'] });
      queryClient.invalidateQueries({ queryKey: ['service-order', serviceOrder?.id] });
      navigate('/service-returns');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membuat retur service');
    },
  });

  // Calculate 30-day period and warranty
  const isWithin30Days = serviceOrder?.deliveredAt
    ? (() => {
        const delivered = new Date(serviceOrder.deliveredAt);
        const now = new Date();
        const diffTime = now.getTime() - delivered.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 30;
      })()
    : false;

  const isWithinWarranty = serviceOrder?.deliveredAt && serviceOrder?.warrantyDays
    ? (() => {
        const delivered = new Date(serviceOrder.deliveredAt);
        const warrantyExpiry = new Date(delivered);
        warrantyExpiry.setDate(warrantyExpiry.getDate() + serviceOrder.warrantyDays);
        return new Date() <= warrantyExpiry;
      })()
    : false;

  const requiresComplaint =
    formData.returnType === 'complaint' || formData.returnType === 'combination';

  const canSubmit =
    formData.serviceOrderId &&
    formData.returnType &&
    formData.returnReason &&
    (!requiresComplaint || formData.customerComplaint) &&
    isWithin30Days &&
    !hasActiveReturnForSelectedOrder;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      toast.error('Mohon lengkapi semua field yang wajib');
      return;
    }
    createMutation.mutate({
      ...formData,
      isWithinWarranty,
      isWithinReturnPeriod: isWithin30Days,
    });
  };

  return (
    <div className="w-full space-y-3">
      {/* Page Header - Enhanced */}
      <BreadcrumbHeader
        title="Buat Retur & Komplain Service"
        subtitle="Formulir untuk membuat retur atau komplain service"
      >
        <BranchFilterSelect value={branchId} onChange={setBranchId} />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/service-returns')}

        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </Button>
      </BreadcrumbHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Service Order Selection */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 border-b-2 border-gray-100 pb-3">Pilih Service Order</h2>

          {!serviceOrderIdFromUrl ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Service Order <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedServiceOrderId}
                onChange={(e) => {
                  setSelectedServiceOrderId(e.target.value);
                  setFormData((prev) => ({ ...prev, serviceOrderId: e.target.value }));
                }}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                required
              >
                <option value="">Pilih Service Order</option>
                {availableOrders.length > 0 ? (
                  availableOrders.map((order: any) => {
                    const deliveredDate = order.deliveredAt
                      ? new Date(order.deliveredAt).toLocaleDateString('id-ID')
                      : '';
                    return (
                      <option key={order.id} value={order.id}>
                        {order.serviceNumber} - {order.customerName} - {order.deviceType} ({deliveredDate})
                      </option>
                    );
                  })
                ) : (
                  <option value="" disabled>
                    Tidak ada service order yang tersedia (semua sudah memiliki retur aktif)
                  </option>
                )}
              </select>
              {availableOrders.length === 0 && deliveredOrders?.data && deliveredOrders.data.length > 0 && (
                <p className="text-sm text-amber-600 mt-2">
                  Semua service order yang delivered sudah memiliki retur aktif. Hanya service order dengan retur yang ditolak yang bisa di-retur ulang.
                </p>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 p-4 rounded-lg">
              {loadingServiceOrder ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-gray-600">Memuat data service order...</span>
                </div>
              ) : serviceOrder ? (
                <>
                  {hasActiveReturnForSelectedOrder && (
                    <div className="mb-4 bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <h3 className="text-sm font-bold text-red-900">Service Order Sudah Memiliki Retur Aktif</h3>
                          <p className="text-sm text-red-700 mt-1">
                            Service order ini sudah memiliki retur yang aktif. Harap resolve atau reject retur yang ada terlebih dahulu sebelum membuat retur baru.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Service Number:</span>
                      <span className="text-sm text-gray-900">{serviceOrder.serviceNumber}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Customer:</span>
                      <span className="text-sm text-gray-900">{serviceOrder.customerName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Device:</span>
                      <span className="text-sm text-gray-900">
                        {serviceOrder.deviceType} {serviceOrder.deviceUnit}
                      </span>
                    </div>
                    {serviceOrder.deliveredAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Delivered:</span>
                        <span className="text-sm text-gray-900">
                          {new Date(serviceOrder.deliveredAt).toLocaleDateString('id-ID')}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-red-600">Service order tidak ditemukan</p>
              )}
            </div>
          )}

          {/* Status Indicators */}
          {serviceOrder && (
            <div className="flex flex-wrap gap-2 mt-4">
              {isWithin30Days ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-xs font-semibold border border-green-200">
                  <CheckCircle2 className="w-4 h-4" />
                  Masih dalam 30 hari
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-800 rounded-full text-xs font-semibold border border-red-200">
                  <AlertCircle className="w-4 h-4" />
                  Sudah melewati 30 hari
                </span>
              )}
              {isWithinWarranty && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-100 text-primary-800 rounded-full text-xs font-semibold border border-primary-200">
                  <Clock className="w-4 h-4" />
                  Masih dalam warranty
                </span>
              )}
            </div>
          )}
        </div>

        {/* Return Type */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 border-b-2 border-gray-100 pb-3">Jenis Retur</h2>
          <div className="grid grid-cols-2 gap-3">
            {(['re-service', 'complaint', 'warranty', 'combination'] as const).map((type) => (
              <label
                key={type}
                className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:bg-primary-50 hover:border-primary-300 transition-all"
              >
                <input
                  type="radio"
                  name="returnType"
                  value={type}
                  checked={formData.returnType === type}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      returnType: e.target.value as any,
                      customerComplaint: type === 're-service' ? '' : prev.customerComplaint,
                    }))
                  }
                  className="w-5 h-5 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-900">
                  {type === 're-service' && 'Re-Service'}
                  {type === 'complaint' && 'Complaint'}
                  {type === 'warranty' && 'Warranty'}
                  {type === 'combination' && 'Combination'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Return Reason */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 border-b-2 border-gray-100 pb-3">Alasan Retur</h2>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Return Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.returnReason}
              onChange={(e) => setFormData((prev) => ({ ...prev, returnReason: e.target.value }))}
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
              placeholder="Jelaskan alasan retur..."
              required
            />
          </div>
        </div>

        {/* Customer Complaint */}
        {requiresComplaint && (
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900 border-b-2 border-gray-100 pb-3">Komplain Customer</h2>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Customer Complaint <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.customerComplaint}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, customerComplaint: e.target.value }))
                }
                rows={4}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                placeholder="Detail komplain customer..."
                required
              />
            </div>
          </div>
        )}

        {/* Warning if outside return period */}
        {serviceOrder && !isWithin30Days && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-red-900">Periode Retur Telah Berakhir</h3>
                <p className="text-sm text-red-700 mt-1">
                  Service order ini sudah melewati 30 hari dari tanggal delivery. Retur tidak dapat
                  dibuat.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <button
            type="button"
            onClick={() => navigate('/service-returns')}
            className="px-6 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-semibold transition-all"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={!canSubmit || createMutation.isPending}
            className="px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl font-semibold flex items-center gap-2"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Simpan
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

