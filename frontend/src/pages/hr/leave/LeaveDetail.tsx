import { useParams, Link } from 'react-router-dom';
import { BreadcrumbHeader } from '@/components/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { hrService, type LeaveRequest } from '@/services/hr.service';
import { formatDate } from '@/utils/format';
import { toast } from 'sonner';
import { useState } from 'react';

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function LeaveDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const currentUser = getCurrentUser();
  const userRoles: string[] = currentUser?.roles || (currentUser?.role?.code ? [currentUser.role.code] : []);

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  // Note: Backend might need a getLeaveRequestById endpoint
  const { data: leaveRequest, isLoading, error } = useQuery({
    queryKey: ['leave-request', id],
    queryFn: async () => {
      const response = await hrService.getLeaveRequests({});
      return response.data.find((l: LeaveRequest) => l.id === id);
    },
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => hrService.approveLeave(id!, { notes: approveNotes }),
    onSuccess: () => {
      toast.success('Cuti berhasil disetujui');
      queryClient.invalidateQueries({ queryKey: ['leave-request', id] });
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      setShowApproveModal(false);
      setApproveNotes('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyetujui cuti');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => hrService.rejectLeave(id!, { reason: rejectReason, notes: '' }),
    onSuccess: () => {
      toast.success('Cuti berhasil ditolak');
      queryClient.invalidateQueries({ queryKey: ['leave-request', id] });
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      setShowRejectModal(false);
      setRejectReason('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menolak cuti');
    },
  });

  const canApprove = userRoles.some((r) => ['HS', 'SPV', 'CHR'].includes(r));
  const canReject = userRoles.some((r) => ['HS', 'SPV', 'CHR'].includes(r));

  if (isLoading) {
    return (
      <div className="w-full space-y-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <p className="mt-4 text-gray-600">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (error || !leaveRequest) {
    return (
      <div className="w-full space-y-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">Gagal memuat data cuti</p>
          <Link to="/hr/leave" className="mt-4 text-green-600 hover:underline">
            Kembali ke daftar
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800">
            <Clock className="w-4 h-4" />
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
            <CheckCircle className="w-4 h-4" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
            <XCircle className="w-4 h-4" />
            Rejected
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800">
            <XCircle className="w-4 h-4" />
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case 'annual':
        return 'Cuti Tahunan';
      case 'sick':
        return 'Sakit';
      case 'emergency':
        return 'Darurat';
      case 'unpaid':
        return 'Tanpa Gaji';
      default:
        return type;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <BreadcrumbHeader title="Detail Cuti" subtitle={leaveRequest.employee?.user?.fullName || leaveRequest.employee?.employeeCode || 'N/A'}>
        <div className="flex items-center gap-2">
            {canApprove && leaveRequest.status === 'pending' && (
              <button
                onClick={() => setShowApproveModal(true)}
                className="px-4 py-2 bg-white text-green-600 rounded-lg font-semibold hover:bg-green-50 transition-colors"
              >
                Approve
              </button>
            )}
            {canReject && leaveRequest.status === 'pending' && (
              <button
                onClick={() => setShowRejectModal(true)}
                className="px-4 py-2 bg-white text-red-600 rounded-lg font-semibold hover:bg-red-50 transition-colors"
              >
                Reject
              </button>
            )}
          </div>
      </BreadcrumbHeader>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Employee Info */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Informasi Karyawan</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Nama</p>
              <p className="text-base font-semibold text-gray-900">
                {leaveRequest.employee?.user?.fullName || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Employee Code</p>
              <p className="text-base font-semibold text-gray-900">{leaveRequest.employee?.employeeCode || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Leave Info */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Informasi Cuti</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Tipe Cuti</p>
              <p className="text-base font-semibold text-gray-900">{getLeaveTypeLabel(leaveRequest.leaveType)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Periode</p>
              <p className="text-base font-semibold text-gray-900">
                {formatDate(leaveRequest.startDate)} - {formatDate(leaveRequest.endDate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Hari</p>
              <p className="text-base font-semibold text-gray-900">{leaveRequest.totalDays} hari</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <div className="mt-1">{getStatusBadge(leaveRequest.status)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Reason */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Alasan</h2>
        <p className="text-base text-gray-900">{leaveRequest.reason}</p>
      </div>

      {/* Approval/Rejection Info */}
      {(leaveRequest.approvedAt || leaveRequest.rejectedAt) && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {leaveRequest.approvedAt ? 'Informasi Persetujuan' : 'Informasi Penolakan'}
          </h2>
          <div className="space-y-3">
            {leaveRequest.approvedAt && (
              <div>
                <p className="text-sm text-gray-600">Disetujui pada</p>
                <p className="text-base font-semibold text-gray-900">{formatDate(leaveRequest.approvedAt)}</p>
              </div>
            )}
            {leaveRequest.rejectedAt && (
              <>
                <div>
                  <p className="text-sm text-gray-600">Ditolak pada</p>
                  <p className="text-base font-semibold text-gray-900">{formatDate(leaveRequest.rejectedAt)}</p>
                </div>
                {leaveRequest.rejectionReason && (
                  <div>
                    <p className="text-sm text-gray-600">Alasan Penolakan</p>
                    <p className="text-base text-gray-900">{leaveRequest.rejectionReason}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Approve Cuti</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Catatan (Opsional)</label>
                <textarea
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Tambahkan catatan..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowApproveModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  {approveMutation.isPending ? 'Menyetujui...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Reject Cuti</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Alasan Penolakan *</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Masukkan alasan penolakan..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  onClick={() => rejectMutation.mutate()}
                  disabled={rejectMutation.isPending || !rejectReason}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {rejectMutation.isPending ? 'Menolak...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

