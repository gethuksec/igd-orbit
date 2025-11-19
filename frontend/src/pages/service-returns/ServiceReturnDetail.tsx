import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Wrench,
  FileText,
} from 'lucide-react';
import { serviceReturnsService } from '../../services/service-returns.service';
import { toast } from 'sonner';
import { formatCurrency } from '../../utils/format';
import { Modal } from '@/components/ui/modal';

export default function ServiceReturnDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReServiceModal, setShowReServiceModal] = useState(false);
  const [approveResolution, setApproveResolution] = useState('');
  const [approveResolutionType, setApproveResolutionType] = useState<'re-service' | 'refund' | 'discount' | 'replacement' | ''>('');
  const [rejectReason, setRejectReason] = useState('');
  const [reServiceNotes, setReServiceNotes] = useState('');

  const { data: serviceReturn, isLoading } = useQuery({
    queryKey: ['service-return', id],
    queryFn: () => serviceReturnsService.getById(id!),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: (dto: any) => serviceReturnsService.approve(id!, dto),
    onSuccess: () => {
      toast.success('Return berhasil disetujui');
      queryClient.invalidateQueries({ queryKey: ['service-return', id] });
      queryClient.invalidateQueries({ queryKey: ['service-returns'] });
      setShowApproveModal(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyetujui return');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (dto: any) => serviceReturnsService.reject(id!, dto),
    onSuccess: () => {
      toast.success('Return berhasil ditolak');
      queryClient.invalidateQueries({ queryKey: ['service-return', id] });
      queryClient.invalidateQueries({ queryKey: ['service-returns'] });
      setShowRejectModal(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menolak return');
    },
  });

  const createReServiceMutation = useMutation({
    mutationFn: (dto: any) => serviceReturnsService.createReService(id!, dto),
    onSuccess: () => {
      toast.success('Re-service order berhasil dibuat');
      queryClient.invalidateQueries({ queryKey: ['service-return', id] });
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      setShowReServiceModal(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membuat re-service order');
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () => serviceReturnsService.resolve(id!),
    onSuccess: () => {
      toast.success('Return berhasil diselesaikan');
      queryClient.invalidateQueries({ queryKey: ['service-return', id] });
      queryClient.invalidateQueries({ queryKey: ['service-returns'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyelesaikan return');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!serviceReturn) {
    return (
      <div className="w-full text-center py-12">
        <p className="text-gray-600 text-lg">Return tidak ditemukan</p>
        <button
          onClick={() => navigate('/service-returns')}
          className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
        >
          Kembali ke daftar return
        </button>
      </div>
    );
  }

  const formatDate = (date: string | null) => {
    if (!date) return '--';
    return new Date(date).toLocaleString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'INVESTIGATING':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <AlertTriangle className="w-3 h-3" />
            Investigating
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
            <CheckCircle2 className="w-3 h-3" />
            Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
            <CheckCircle2 className="w-3 h-3" />
            Resolved
          </span>
        );
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const getTypeLabel = (type: string) => {
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

  const canApprove = serviceReturn.status === 'pending' || serviceReturn.status === 'investigating';
  const canReject = serviceReturn.status === 'pending' || serviceReturn.status === 'investigating';
  const canCreateReService = serviceReturn.status === 'approved' && !serviceReturn.newServiceOrderId;
  const canResolve = serviceReturn.status === 'approved' && serviceReturn.newServiceOrderId;

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/service-returns')}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{serviceReturn.returnNumber}</h1>
              <div className="flex items-center gap-3 mt-1">
                {getStatusBadge(serviceReturn.status)}
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {getTypeLabel(serviceReturn.returnType)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canApprove && (
              <button
                onClick={() => setShowApproveModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all"
              >
                Approve
              </button>
            )}
            {canReject && (
              <button
                onClick={() => setShowRejectModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-all"
              >
                Reject
              </button>
            )}
            {canCreateReService && (
              <button
                onClick={() => setShowReServiceModal(true)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-all"
              >
                Create Re-Service
              </button>
            )}
            {canResolve && (
              <button
                onClick={() => resolveMutation.mutate()}
                disabled={resolveMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {resolveMutation.isPending ? 'Resolving...' : 'Resolve'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Return Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600" />
              Informasi Return
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Return Reason</p>
                <p className="text-sm font-semibold text-gray-900">{serviceReturn.returnReason}</p>
              </div>
              {serviceReturn.customerComplaint && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Customer Complaint</p>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{serviceReturn.customerComplaint}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Returned At</p>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(serviceReturn.returnedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Created At</p>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(serviceReturn.createdAt)}</p>
                </div>
              </div>
              <div className="flex gap-3">
                {serviceReturn.isWithinReturnPeriod && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                    Dalam 30 hari
                  </span>
                )}
                {serviceReturn.isWithinWarranty && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                    Dalam Warranty
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Original Service Order */}
          {serviceReturn.serviceOrder && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary-600" />
                Original Service Order
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Service Number</p>
                  <Link
                    to={`/service-orders/${serviceReturn.serviceOrder.id}`}
                    className="text-sm font-semibold text-primary-600 hover:underline"
                  >
                    {serviceReturn.serviceOrder.serviceNumber}
                  </Link>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Customer</p>
                  <p className="text-sm font-semibold text-gray-900">{serviceReturn.serviceOrder.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Device</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {serviceReturn.serviceOrder.deviceBrand} {serviceReturn.serviceOrder.deviceModel}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Resolution */}
          {serviceReturn.resolution && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Resolution</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Resolution Type</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {serviceReturn.resolutionType?.toUpperCase() || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Resolution</p>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{serviceReturn.resolution}</p>
                </div>
                {serviceReturn.refundAmount && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Refund Amount</p>
                    <p className="text-sm font-semibold text-primary-600">
                      {formatCurrency(serviceReturn.refundAmount)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Re-Service Order */}
          {serviceReturn.newServiceOrder && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Re-Service Order</h2>
              <div>
                <p className="text-xs text-gray-500 mb-1">Service Number</p>
                <Link
                  to={`/service-orders/${serviceReturn.newServiceOrder.id}`}
                  className="text-sm font-semibold text-primary-600 hover:underline"
                >
                  {serviceReturn.newServiceOrder.serviceNumber}
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Approval Info */}
          {serviceReturn.approvedBy && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Approval</h2>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Approved At</p>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(serviceReturn.approvedAt || null)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Rejection Info */}
          {serviceReturn.rejectedBy && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Rejection</h2>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Rejected At</p>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(serviceReturn.rejectedAt || null)}</p>
                </div>
                {serviceReturn.rejectionReason && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Reason</p>
                    <p className="text-sm text-gray-900">{serviceReturn.rejectionReason}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Approve Modal */}
      <Modal open={showApproveModal} onClose={() => setShowApproveModal(false)} title="Approve Return" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Resolution Type</label>
            <select
              value={approveResolutionType}
              onChange={(e) => setApproveResolutionType(e.target.value as any)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Pilih resolution...</option>
              <option value="re-service">Re-Service</option>
              <option value="refund">Refund</option>
              <option value="discount">Discount</option>
              <option value="replacement">Replacement</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Resolution Notes</label>
            <textarea
              value={approveResolution}
              onChange={(e) => setApproveResolution(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Catatan resolution..."
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowApproveModal(false)}
              className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              onClick={() =>
                approveMutation.mutate({
                  resolution: approveResolution || undefined,
                  resolutionType: approveResolutionType || undefined,
                })
              }
              disabled={approveMutation.isPending}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal open={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject Return" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Rejection Reason *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Alasan penolakan..."
              required
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowRejectModal(false)}
              className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              onClick={() => rejectMutation.mutate({ rejectionReason: rejectReason })}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Re-Service Modal */}
      <Modal open={showReServiceModal} onClose={() => setShowReServiceModal(false)} title="Create Re-Service Order" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
            <textarea
              value={reServiceNotes}
              onChange={(e) => setReServiceNotes(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Catatan untuk re-service order..."
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowReServiceModal(false)}
              className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              onClick={() => createReServiceMutation.mutate({ notes: reServiceNotes || undefined })}
              disabled={createReServiceMutation.isPending}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {createReServiceMutation.isPending ? 'Creating...' : 'Create Re-Service'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

