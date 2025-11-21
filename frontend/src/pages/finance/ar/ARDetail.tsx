import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  Receipt,
  Plus,
  XCircle,
  FileText,
} from 'lucide-react';
import {
  financeService,
  type AccountsReceivable,
} from '../../../services/finance.service';
import { toast } from 'sonner';

export default function ARDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const queryClient = useQueryClient();
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedARId, setSelectedARId] = useState<string>('');

  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    payment_amount: 0,
    payment_method: 'cash' as 'cash' | 'transfer' | 'check',
    bank_account_id: '',
    reference_number: '',
    notes: '',
  });

  const { data: arList, isLoading, error } = useQuery({
    queryKey: ['customer-ar', customerId],
    queryFn: () => financeService.getCustomerAR(customerId!),
    enabled: !!customerId,
  });

  const paymentMutation = useMutation({
    mutationFn: (data: any) => financeService.recordARPayment(selectedARId, data),
    onSuccess: () => {
      toast.success('Pembayaran berhasil dicatat');
      queryClient.invalidateQueries({ queryKey: ['customer-ar', customerId] });
      queryClient.invalidateQueries({ queryKey: ['ar-aging-report'] });
      setShowPaymentForm(false);
      setPaymentForm({
        payment_date: new Date().toISOString().split('T')[0],
        payment_amount: 0,
        payment_method: 'cash',
        bank_account_id: '',
        reference_number: '',
        notes: '',
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal mencatat pembayaran');
    },
  });

  const writeOffMutation = useMutation({
    mutationFn: (data: { write_off_date: string; reason: string; notes?: string }) => {
      const ar = arList?.find((ar) => ar.id === selectedARId);
      if (!ar) throw new Error('AR not found');
      return financeService.writeOffAR(selectedARId, data);
    },
    onSuccess: () => {
      toast.success('Write-off berhasil');
      queryClient.invalidateQueries({ queryKey: ['customer-ar', customerId] });
      queryClient.invalidateQueries({ queryKey: ['ar-aging-report'] });
      setSelectedARId('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal write-off');
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getAgingColor = (days: number) => {
    if (days <= 30) return 'text-green-600';
    if (days <= 60) return 'text-yellow-600';
    if (days <= 90) return 'text-orange-600';
    return 'text-red-600';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'partial':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'written_off':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="w-full space-y-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-16 text-center">
          <Loader2 className="w-16 h-16 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold text-lg">Memuat detail piutang...</p>
        </div>
      </div>
    );
  }

  if (error || !arList || arList.length === 0) {
    return (
      <div className="w-full space-y-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-16 text-center">
          <Receipt className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-semibold text-lg">
            {(error as Error)?.message || 'Tidak ada piutang ditemukan'}
          </p>
          <Link
            to="/finance/ar"
            className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke AR Aging Report
          </Link>
        </div>
      </div>
    );
  }

  const customer = arList[0]?.customer;
  const totalOutstanding = arList.reduce((sum, ar) => sum + ar.outstandingAmount, 0);

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/finance/ar"
              className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold mb-1">Detail Piutang</h1>
              <p className="text-primary-100">
                {customer?.name || 'Customer'} - Total Outstanding: {formatCurrency(totalOutstanding)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Info */}
      {customer && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Informasi Customer</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nama</label>
              <div className="text-base text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                {customer.name}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Telepon</label>
              <div className="text-base text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                {customer.phone || '-'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Total Outstanding</label>
              <div className="text-lg font-bold text-primary-600 bg-primary-50 px-4 py-2 rounded-lg border border-primary-200">
                {formatCurrency(totalOutstanding)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AR Items */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            Invoice Items ({arList.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 via-gray-50 to-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Invoice
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Tanggal
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Original Amount
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Paid Amount
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Outstanding
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Aging Days
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {arList.map((ar: AccountsReceivable) => (
                <tr
                  key={ar.id}
                  className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={
                        ar.transactionType === 'SALES'
                          ? `/sales/transactions/${ar.transactionId}`
                          : `/service-orders/${ar.transactionId}`
                      }
                      className="font-mono text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline"
                    >
                      {ar.transactionNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(ar.invoiceDate).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="text-xs text-gray-500">
                      Due: {new Date(ar.dueDate).toLocaleDateString('id-ID')}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatCurrency(ar.originalAmount)}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="text-sm font-semibold text-green-600">
                      {formatCurrency(ar.paidAmount)}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="text-sm font-bold text-gray-900">
                      {formatCurrency(ar.outstandingAmount)}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className={`text-sm font-semibold ${getAgingColor(ar.agingDays)}`}>
                      {ar.agingDays} days
                    </div>
                    <div className="text-xs text-gray-500">{ar.agingBucket}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                        ar.status,
                      )}`}
                    >
                      {ar.status === 'open'
                        ? 'Open'
                        : ar.status === 'partial'
                          ? 'Partial'
                          : ar.status === 'paid'
                            ? 'Paid'
                            : 'Written Off'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      {ar.status !== 'paid' && ar.status !== 'written_off' && (
                        <button
                          onClick={() => {
                            setSelectedARId(ar.id);
                            setPaymentForm({
                              ...paymentForm,
                              payment_amount: ar.outstandingAmount,
                            });
                            setShowPaymentForm(true);
                          }}
                          className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 hover:underline text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Pay</span>
                        </button>
                      )}
                      {ar.status !== 'paid' && ar.status !== 'written_off' && (
                        <button
                          onClick={() => {
                            const reason = prompt('Masukkan alasan write-off:');
                            if (reason) {
                              writeOffMutation.mutate({
                                write_off_date: new Date().toISOString().split('T')[0],
                                reason,
                              });
                            }
                          }}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 hover:underline text-sm"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Write Off</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Form Modal */}
      {showPaymentForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Record Payment</h2>
              <button
                onClick={() => setShowPaymentForm(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                paymentMutation.mutate(paymentForm);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tanggal Pembayaran <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, payment_date: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jumlah Pembayaran <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={paymentForm.payment_amount || ''}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      payment_amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Metode Pembayaran <span className="text-red-500">*</span>
                </label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      payment_method: e.target.value as 'cash' | 'transfer' | 'check',
                    })
                  }
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="cash">Cash</option>
                  <option value="transfer">Transfer</option>
                  <option value="check">Check</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reference Number
                </label>
                <input
                  type="text"
                  value={paymentForm.reference_number}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, reference_number: e.target.value })
                  }
                  placeholder="Nomor referensi (opsional)"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Catatan</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Tambahkan catatan (opsional)..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPaymentForm(false)}
                  className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={paymentMutation.isPending}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {paymentMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Simpan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

