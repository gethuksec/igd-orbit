import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Clock,
  X,
} from 'lucide-react';
import { serviceReturnsService } from '../../services/service-returns.service';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function ServiceReturnDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = getCurrentUser();
  const userRoles: string[] =
    currentUser?.roles || (currentUser?.role?.code ? [currentUser.role.code] : []);

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReServiceModal, setShowReServiceModal] = useState(false);
  const [approveData, setApproveData] = useState({
    resolutionType: 're-service' as 're-service' | 'refund' | 'discount' | 'replacement',
    resolution: '',
    refundAmount: '',
  });
  const [rejectReason, setRejectReason] = useState('');
  const [reServiceData, setReServiceData] = useState({
    serviceTypeId: '',
    notes: '',
  });

  const { data: returnItem, isLoading } = useQuery({
    queryKey: ['service-return', id],
    queryFn: () => serviceReturnsService.getById(id!),
    enabled: !!id,
  });

  const { data: serviceTypes } = useQuery({
    queryKey: ['service-types'],
    queryFn: async () => {
      const res = await api.get('/service-types');
      return res.data.data || res.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      serviceReturnsService.approve(id!, {
        resolutionType: approveData.resolutionType,
        resolution: approveData.resolution,
        refundAmount: approveData.refundAmount ? parseFloat(approveData.refundAmount) : undefined,
      }),
    onSuccess: () => {
      toast.success('Retur berhasil disetujui');
      queryClient.invalidateQueries({ queryKey: ['service-return', id] });
      queryClient.invalidateQueries({ queryKey: ['service-returns'] });
      setShowApproveModal(false);
      setApproveData({ resolutionType: 're-service', resolution: '', refundAmount: '' });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyetujui retur');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => serviceReturnsService.reject(id!, { rejectionReason: rejectReason }),
    onSuccess: () => {
      toast.success('Retur berhasil ditolak');
      queryClient.invalidateQueries({ queryKey: ['service-return', id] });
      queryClient.invalidateQueries({ queryKey: ['service-returns'] });
      setShowRejectModal(false);
      setRejectReason('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menolak retur');
    },
  });

  const reServiceMutation = useMutation({
    mutationFn: () =>
      serviceReturnsService.createReService(id!, {
        serviceTypeId: reServiceData.serviceTypeId || undefined,
        priority: 'urgent',
        notes: reServiceData.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Re-service order berhasil dibuat');
      queryClient.invalidateQueries({ queryKey: ['service-return', id] });
      queryClient.invalidateQueries({ queryKey: ['service-returns'] });
      setShowReServiceModal(false);
      setReServiceData({ serviceTypeId: '', notes: '' });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membuat re-service order');
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () => serviceReturnsService.resolve(id!),
    onSuccess: () => {
      toast.success('Retur berhasil diselesaikan');
      queryClient.invalidateQueries({ queryKey: ['service-return', id] });
      queryClient.invalidateQueries({ queryKey: ['service-returns'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyelesaikan retur');
    },
  });

  const canApprove = userRoles.some((r) => ['HS', 'SPV', 'CMO', 'CSO'].includes(r));
  const canReject = canApprove;
  const canResolve = canApprove;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-gray-500" />
      </div>
    );
  }

  if (!returnItem) {
    return (
      <div className="p-6 text-center text-red-600 dark:text-red-400">
        Retur service tidak ditemukan
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
      case 'investigating':
        return 'bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800';
      case 'approved':
        return 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800';
      case 'rejected':
        return 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800';
      case 'resolved':
        return 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700';
    }
  };

  const getReturnTypeLabel = (type: string) => {
    switch (type) {
      case 're-service':
        return 'Re-Service';
      case 'complaint':
        return 'Complaint';
      case 'warranty':
        return 'Warranty';
      case 'combination':
        return 'Combination';
      default:
        return type;
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Page Header - Enhanced */}
      <BreadcrumbHeader
        title={returnItem.returnNumber}
        subtitle="Detail Retur & Komplain Service"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/service-returns')}

        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span
          className={`inline-flex px-4 py-2 text-sm font-bold rounded-full border-2 ${getStatusColor(
            returnItem.status,
          )} bg-white/10 backdrop-blur-sm`}
        >
          {returnItem.status.toUpperCase()}
        </span>
      </BreadcrumbHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Return Information */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 border-b-2 border-gray-100 dark:border-gray-800 pb-3">Informasi Retur</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Return Number</label>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{returnItem.returnNumber}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Return Type</label>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                  {getReturnTypeLabel(returnItem.returnType)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{returnItem.status}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Returned Date</label>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                  {new Date(returnItem.returnedAt).toLocaleDateString('id-ID', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Return Reason</label>
              <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 whitespace-pre-wrap">
                {returnItem.returnReason}
              </p>
            </div>
            {returnItem.customerComplaint && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Customer Complaint</label>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 whitespace-pre-wrap">
                  {returnItem.customerComplaint}
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {returnItem.isWithinReturnPeriod && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 rounded text-xs">
                  <CheckCircle2 className="w-3 h-3" />
                  Dalam 30 hari
                </span>
              )}
              {returnItem.isWithinWarranty && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 rounded text-xs">
                  <Clock className="w-3 h-3" />
                  Dalam warranty
                </span>
              )}
            </div>
          </div>

          {/* Original Service Order */}
          {returnItem.serviceOrder && (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6 space-y-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 border-b-2 border-gray-100 dark:border-gray-800 pb-3">Service Order Asal</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Service Number:</span>
                  <Link
                    to={`/service-orders/${returnItem.serviceOrder.id}`}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    {returnItem.serviceOrder.serviceNumber}
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Customer:</span>
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {returnItem.serviceOrder.customerName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Device:</span>
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {returnItem.serviceOrder.deviceType}{' '}
                    {returnItem.serviceOrder.deviceUnit}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Resolution */}
          {returnItem.resolution && (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6 space-y-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 border-b-2 border-gray-100 dark:border-gray-800 pb-3">Resolution</h2>
              <div className="space-y-2">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Resolution Type</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{returnItem.resolutionType}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Resolution Notes</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 whitespace-pre-wrap">
                    {returnItem.resolution}
                  </p>
                </div>
                {returnItem.refundAmount && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Refund Amount</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                      Rp {returnItem.refundAmount.toLocaleString('id-ID')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rejection Reason */}
          {returnItem.rejectionReason && (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">Rejection Reason</h2>
              <p className="text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap">
                {returnItem.rejectionReason}
              </p>
            </div>
          )}

          {/* New Service Order */}
          {returnItem.newServiceOrder && (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6 space-y-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 border-b-2 border-gray-100 dark:border-gray-800 pb-3">Re-Service Order</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Service Number:</span>
                  <Link
                    to={`/service-orders/${returnItem.newServiceOrder.id}`}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    {returnItem.newServiceOrder.serviceNumber}
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Status:</span>
                  <span className="text-sm text-gray-900 dark:text-gray-100">{returnItem.newServiceOrder.status}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          {(returnItem.status === 'pending' || returnItem.status === 'investigating') && (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6 space-y-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">Actions</h3>
              {canApprove && (
                <button
                  onClick={() => setShowApproveModal(true)}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-md hover:shadow-lg font-semibold"
                >
                  Approve
                </button>
              )}
              {canReject && (
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="w-full px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-md hover:shadow-lg font-semibold"
                >
                  Reject
                </button>
              )}
            </div>
          )}

          {returnItem.status === 'approved' && !returnItem.newServiceOrderId && (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6 space-y-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">Actions</h3>
              <button
                onClick={() => setShowReServiceModal(true)}
                className="w-full px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all shadow-md hover:shadow-lg font-semibold"
              >
                Create Re-Service
              </button>
            </div>
          )}

          {/* Resolve - Only for approved returns (not rejected) */}
          {returnItem.status === 'approved' && canResolve && (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6 space-y-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">Actions</h3>
              <button
                onClick={() => resolveMutation.mutate()}
                disabled={resolveMutation.isPending}
                className="w-full px-4 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-all shadow-md hover:shadow-lg font-semibold"
              >
                {resolveMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Resolving...
                  </>
                ) : (
                  'Resolve'
                )}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Resolve setelah re-service selesai atau refund sudah diproses
              </p>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 border-b-2 border-gray-100 dark:border-gray-800 pb-3">Timeline</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Created</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(returnItem.createdAt).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
              {returnItem.approvedAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Approved</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(returnItem.approvedAt).toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              )}
              {returnItem.rejectedAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Rejected</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(returnItem.rejectedAt).toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              )}
              {returnItem.resolvedAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-1.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Resolved</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(returnItem.resolvedAt).toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b-2 border-gray-100 dark:border-gray-800 pb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Approve Return</h3>
              <button
                onClick={() => setShowApproveModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Resolution Type <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <select
                  value={approveData.resolutionType}
                  onChange={(e) =>
                    setApproveData((prev) => ({
                      ...prev,
                      resolutionType: e.target.value as any,
                    }))
                  }
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                >
                  <option value="re-service">Re-Service</option>
                  <option value="refund">Refund</option>
                  <option value="discount">Discount</option>
                  <option value="replacement">Replacement</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Resolution Notes <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <textarea
                  value={approveData.resolution}
                  onChange={(e) =>
                    setApproveData((prev) => ({ ...prev, resolution: e.target.value }))
                  }
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                  placeholder="Jelaskan resolution..."
                  required
                />
              </div>
              {approveData.resolutionType === 'refund' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Refund Amount
                  </label>
                  <input
                    type="number"
                    value={approveData.refundAmount}
                    onChange={(e) =>
                      setApproveData((prev) => ({ ...prev, refundAmount: e.target.value }))
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                    placeholder="0"
                  />
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-6 py-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => approveMutation.mutate()}
                disabled={!approveData.resolution || approveMutation.isPending}
                className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 font-semibold shadow-md hover:shadow-lg transition-all"
              >
                {approveMutation.isPending ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b-2 border-gray-100 dark:border-gray-800 pb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Reject Return</h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Rejection Reason <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                placeholder="Jelaskan alasan penolakan..."
                required
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-6 py-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectMutation.mutate()}
                disabled={!rejectReason || rejectMutation.isPending}
                className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-semibold shadow-md hover:shadow-lg transition-all"
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Re-Service Modal */}
      {showReServiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b-2 border-gray-100 dark:border-gray-800 pb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Create Re-Service Order</h3>
              <button
                onClick={() => setShowReServiceModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Service Type
                </label>
                <select
                  value={reServiceData.serviceTypeId}
                  onChange={(e) =>
                    setReServiceData((prev) => ({ ...prev, serviceTypeId: e.target.value }))
                  }
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                >
                  <option value="">Pilih Service Type (Optional)</option>
                  {serviceTypes?.map((type: any) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notes</label>
                <textarea
                  value={reServiceData.notes}
                  onChange={(e) =>
                    setReServiceData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                  placeholder="Catatan tambahan..."
                />
              </div>
              <div className="bg-primary-50 dark:bg-primary-950 border-2 border-primary-200 dark:border-primary-800 rounded-xl p-4">
                <p className="text-sm text-primary-800 dark:text-primary-200 font-medium">
                  Priority akan otomatis di-set ke <strong>Urgent</strong>
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setShowReServiceModal(false)}
                className="px-6 py-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => reServiceMutation.mutate()}
                disabled={reServiceMutation.isPending}
                className="px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-semibold shadow-md hover:shadow-lg transition-all"
              >
                {reServiceMutation.isPending ? 'Creating...' : 'Create Re-Service'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

