import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowLeft, Banknote, CheckCircle, XCircle, Clock, AlertCircle, DollarSign, FileText } from 'lucide-react';
import { hrService } from '@/services/hr.service';
import { formatCurrency } from '@/utils/format';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function PayrollDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const currentUser = getCurrentUser();
  const userRoles: string[] = currentUser?.roles || (currentUser?.role?.code ? [currentUser.role.code] : []);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const { data: payroll, isLoading, error } = useQuery({
    queryKey: ['payroll', id],
    queryFn: () => hrService.getPayroll(id!),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => hrService.approvePayroll(id!),
    onSuccess: (response) => {
      console.log('Approve success:', response);
      toast.success(response?.message || 'Payroll berhasil disetujui');
      
      // If response includes updated data, update the cache directly
      if (response?.data) {
        queryClient.setQueryData(['payroll', id], response.data);
      }
      
      // Invalidate and refetch immediately
      queryClient.invalidateQueries({ queryKey: ['payroll', id] });
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      // Force refetch
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['payroll', id] });
      }, 100);
    },
    onError: (error: any) => {
      console.error('Approve error:', error);
      toast.error(error.response?.data?.message || 'Gagal menyetujui payroll');
    },
  });

  const processMutation = useMutation({
    mutationFn: () => hrService.processPayment(id!),
    onSuccess: (response) => {
      console.log('Process payment success:', response);
      toast.success(response?.message || 'Pembayaran payroll berhasil diproses');
      
      // If response includes updated data, update the cache directly
      if (response?.data) {
        queryClient.setQueryData(['payroll', id], response.data);
      }
      
      queryClient.invalidateQueries({ queryKey: ['payroll', id] });
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['payroll', id] });
      }, 100);
    },
    onError: (error: any) => {
      console.error('Process payment error:', error);
      toast.error(error.response?.data?.message || 'Gagal memproses pembayaran');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason?: string) => hrService.cancelPayroll(id!, reason),
    onSuccess: (response) => {
      console.log('Cancel success:', response);
      toast.success(response?.message || 'Payroll berhasil dibatalkan');
      
      // If response includes updated data, update the cache directly
      if (response?.data) {
        queryClient.setQueryData(['payroll', id], response.data);
      }
      
      queryClient.invalidateQueries({ queryKey: ['payroll', id] });
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['payroll', id] });
      }, 100);
    },
    onError: (error: any) => {
      console.error('Cancel error:', error);
      toast.error(error.response?.data?.message || 'Gagal membatalkan payroll');
    },
  });


  const isCHR = userRoles.some((r) => r === 'CHR');
  const isCFO = userRoles.some((r) => r === 'CFO');
  
  // CHR can approve if status is draft and not yet approved by CHR
  const canCHRApprove = isCHR && payroll?.status === 'draft' && !payroll?.approvedBy;
  // CFO can approve if status is draft, already approved by CHR, but not yet approved by CFO
  const canCFOApprove = isCFO && payroll?.status === 'draft' && payroll?.approvedBy && !payroll?.approvedBy2;
  const canApprove = canCHRApprove || canCFOApprove;
  // Process payment only if status is approved
  const canProcess = isCFO && payroll?.status === 'approved';
  // Cancel only if status is draft
  const canCancel = (isCHR || isCFO) && payroll?.status === 'draft';

  if (isLoading) {
    return (
      <div className="w-full space-y-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (error || !payroll) {
    return (
      <div className="w-full space-y-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">Gagal memuat data payroll</p>
          <Link to="/hr/payroll" className="mt-4 text-primary-600 hover:underline">
            Kembali ke daftar
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800">
            <Clock className="w-4 h-4" />
            Draft
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-primary-100 text-primary-800">
            <CheckCircle className="w-4 h-4" />
            Approved
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-primary-100 text-primary-800">
            <DollarSign className="w-4 h-4" />
            Paid
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
            <XCircle className="w-4 h-4" />
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/hr/payroll"
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <Banknote className="w-10 h-10" />
                Detail Payroll
              </h1>
              <p className="text-primary-100 text-lg">
                {payroll.payrollNumber} - {payroll.employee?.user?.fullName || payroll.employee?.employeeCode || 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canApprove && (
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="px-4 py-2 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-colors disabled:opacity-50"
              >
                {approveMutation.isPending 
                  ? 'Menyetujui...' 
                  : canCHRApprove 
                    ? 'Approve (CHR)' 
                    : canCFOApprove 
                      ? 'Approve (CFO)' 
                      : 'Approve'}
              </button>
            )}
            {payroll.status === 'draft' && payroll.approvedBy && !payroll.approvedBy2 && (
              <span className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-semibold">
                Menunggu Approval CFO
              </span>
            )}
            {canCancel && (
              <button
                onClick={() => setCancelModalOpen(true)}
                disabled={cancelMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            {canProcess && payroll.status === 'approved' && (
              <button
                onClick={() => processMutation.mutate()}
                disabled={processMutation.isPending}
                className="px-4 py-2 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-colors disabled:opacity-50"
              >
                {processMutation.isPending ? 'Memproses...' : 'Process Payment'}
              </button>
            )}
            {payroll.status === 'paid' && (
              <Link
                to={`/hr/payroll/${id}/payslip`}
                className="px-4 py-2 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-colors flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Lihat Payslip
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <p className="text-sm text-gray-600 mb-1">Total Earnings</p>
          <p className="text-2xl font-bold text-primary-600">{formatCurrency(payroll.totalEarnings)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <p className="text-sm text-gray-600 mb-1">Total Deductions</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(payroll.totalDeductions)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <p className="text-sm text-gray-600 mb-1">Nett Salary</p>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(payroll.nettSalary)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <p className="text-sm text-gray-600 mb-1">Status</p>
          <div className="mt-1">{getStatusBadge(payroll.status)}</div>
        </div>
      </div>

      {/* Employee & Period Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Informasi Karyawan</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Nama</p>
              <p className="text-base font-semibold text-gray-900">
                {payroll.employee?.user?.fullName || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Employee Code</p>
              <p className="text-base font-semibold text-gray-900">{payroll.employee?.employeeCode || 'N/A'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Periode</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Bulan & Tahun</p>
              <p className="text-base font-semibold text-gray-900">
                {new Date(2000, payroll.periodMonth - 1).toLocaleString('id-ID', { month: 'long' })}{' '}
                {payroll.periodYear}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Payroll Number</p>
              <p className="text-base font-mono font-semibold text-gray-900">{payroll.payrollNumber}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Summary */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Ringkasan Absensi</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-sm text-gray-600">Hari Kerja</p>
            <p className="text-xl font-bold text-gray-900">{payroll.attendanceDays}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Terlambat</p>
            <p className="text-xl font-bold text-red-600">{payroll.lateCount}x</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Pulang Cepat</p>
            <p className="text-xl font-bold text-orange-600">{payroll.earlyLeaveCount}x</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Absen</p>
            <p className="text-xl font-bold text-red-600">{payroll.absenceCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Overtime</p>
            <p className="text-xl font-bold text-primary-600">{payroll.overtimeHours} jam</p>
          </div>
        </div>
      </div>

      {/* Payroll Components */}
      {payroll.components && payroll.components.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Komponen Payroll</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tipe</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Nama</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Jumlah</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Taxable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payroll.components.map((component) => (
                  <tr key={component.id}>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          component.componentType === 'earning'
                            ? 'bg-primary-100 text-primary-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {component.componentType === 'earning' ? 'Earning' : 'Deduction'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{component.componentName}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      {formatCurrency(component.amount)}
                    </td>
                    <td className="px-4 py-3">
                      {component.isTaxable ? (
                        <span className="text-xs text-gray-600">Yes</span>
                      ) : (
                        <span className="text-xs text-gray-400">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notes */}
      {payroll.notes && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Catatan</h2>
          <p className="text-base text-gray-900">{payroll.notes}</p>
        </div>
      )}

      {/* Cancel Modal */}
      <Modal
        open={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setCancelReason('');
        }}
        title="Batalkan Payroll"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-red-100 rounded-full">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-700 mb-2">
                Apakah Anda yakin ingin membatalkan payroll <strong>{payroll?.payrollNumber}</strong>?
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Tindakan ini akan mengubah status payroll menjadi cancelled. Hanya payroll dengan status draft yang dapat dibatalkan.
              </p>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Alasan Pembatalan (Opsional)
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Masukkan alasan pembatalan..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setCancelModalOpen(false);
                setCancelReason('');
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={() => {
                cancelMutation.mutate(cancelReason || undefined);
                setCancelModalOpen(false);
                setCancelReason('');
              }}
              disabled={cancelMutation.isPending}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {cancelMutation.isPending ? 'Membatalkan...' : 'Ya, Batalkan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

