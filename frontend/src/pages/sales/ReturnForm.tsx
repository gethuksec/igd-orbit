import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Search, Loader2, X } from 'lucide-react';
import { salesService, type SalesTransaction } from '../../services/sales.service';
import { useBranchStore } from '@/stores/branchStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ReturnForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const transactionId = searchParams.get('transactionId');
  const { currentBranchId } = useBranchStore();
  const queryClient = useQueryClient();

  const [transactionSearch, setTransactionSearch] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<SalesTransaction | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'deposit'>('cash');

  // If transactionId is provided, fetch it
  const { data: preloadedTransaction, isLoading: loadingPreloaded } = useQuery({
    queryKey: ['sales-transaction', transactionId],
    queryFn: () => salesService.getById(transactionId!),
    enabled: !!transactionId,
  });

  // Set selected transaction when preloaded data is available
  useEffect(() => {
    if (preloadedTransaction) {
      setSelectedTransaction(preloadedTransaction as any);
    }
  }, [preloadedTransaction]);

  // Search transactions
  const { data: transactionSearchResults } = useQuery({
    queryKey: ['sales-transactions-search', transactionSearch, currentBranchId],
    queryFn: () =>
      salesService.getAll({
        page: 1,
        limit: 10,
        search: transactionSearch || undefined,
        branchId: currentBranchId || undefined,
      }),
    enabled: !transactionId && transactionSearch.length >= 3,
  });

  // Void transaction mutation
  const voidTransactionMutation = useMutation({
    mutationFn: ({ transactionId, reason }: { transactionId: string; reason: string }) =>
      salesService.voidTransaction(transactionId, reason),
    onSuccess: () => {
      toast.success('Retur berhasil dibuat');
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] });
      queryClient.invalidateQueries({ queryKey: ['sales-transactions'] });
      navigate('/sales/returns');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membuat retur');
    },
  });

  // Return as deposit mutation
  const returnAsDepositMutation = useMutation({
    mutationFn: ({ customerId, amount, referenceId, notes }: { customerId: string; amount: number; referenceId: string; notes: string }) =>
      salesService.createReturnDeposit({ customerId, amount, referenceId, notes }),
    onSuccess: () => {
      toast.success('Dana retur berhasil dikreditkan sebagai deposit');
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] });
      queryClient.invalidateQueries({ queryKey: ['sales-transactions'] });
      navigate('/sales/returns');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membuat deposit retur');
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loadingPreloaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/sales/returns')}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Buat Retur Penjualan</h1>
              <p className="text-sm text-gray-500 mt-1">Pilih transaksi dan masukkan alasan retur</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="space-y-6">
          {/* Transaction Search */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Cari Transaksi <span className="text-red-500">*</span>
            </label>
            {!transactionId && (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                  type="text"
                  value={transactionSearch}
                  onChange={(e) => {
                    setTransactionSearch(e.target.value);
                    setSelectedTransaction(null);
                  }}
                  placeholder="Cari nomor transaksi..."
                  className="pl-10"
                />
              </div>
            )}
            {transactionSearch.length >= 3 && transactionSearchResults?.data && !transactionId && (
              <div className="mt-2 border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                {transactionSearchResults.data
                  .filter((t: SalesTransaction) => t.status !== 'void' && t.status !== 'cancelled')
                  .map((transaction: SalesTransaction) => (
                    <div
                      key={transaction.id}
                      onClick={() => setSelectedTransaction(transaction)}
                      className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                        selectedTransaction?.id === transaction.id ? 'bg-primary-50 border-primary-200' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">{transaction.transactionNumber}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {transaction.customer?.name || 'Walk-in'} · {formatDate(transaction.createdAt)}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {transaction.itemCount || transaction.items?.length || 0} item ·{' '}
                            {transaction.branch?.name || 'N/A'}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-sm font-bold text-primary-600">
                            {formatCurrency(transaction.total || transaction.totalPrice || 0)}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {transaction.paymentStatus === 'paid' ? 'Lunas' : 'Belum Lunas'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                {transactionSearchResults.data.filter(
                  (t: SalesTransaction) => t.status !== 'void' && t.status !== 'cancelled',
                ).length === 0 && (
                  <div className="p-4 text-center text-sm text-gray-500">Tidak ada transaksi ditemukan</div>
                )}
              </div>
            )}

            {/* Selected Transaction Display */}
            {selectedTransaction && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">
                      {selectedTransaction.transactionNumber}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedTransaction.customer?.name || 'Walk-in'} · {formatDate(selectedTransaction.createdAt)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedTransaction.itemCount || selectedTransaction.items?.length || 0} item ·{' '}
                      {formatCurrency(selectedTransaction.total || selectedTransaction.totalPrice || 0)}
                    </p>
                  </div>
                  {!transactionId && (
                    <button
                      onClick={() => setSelectedTransaction(null)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Return Reason */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Alasan Retur <span className="text-red-500">*</span>
            </label>
            <textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Masukkan alasan retur..."
              rows={4}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>

          {/* Refund Method */}
          {selectedTransaction && selectedTransaction.customer && (
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Metode Pengembalian Dana
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRefundMethod('cash')}
                  className={`px-4 py-3 rounded-lg border-2 transition-colors ${
                    refundMethod === 'cash'
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  Tunai / Cash
                </button>
                <button
                  type="button"
                  onClick={() => setRefundMethod('deposit')}
                  className={`px-4 py-3 rounded-lg border-2 transition-colors ${
                    refundMethod === 'deposit'
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  Deposit (Saldo)
                </button>
              </div>
              {refundMethod === 'deposit' && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700">
                    Dana retur akan dikreditkan ke saldo deposit pelanggan dan dapat digunakan untuk pembelian berikutnya.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-gray-200">
            <Button
              type="button"
              onClick={() => navigate('/sales/returns')}
              variant="outline"
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              onClick={() => {
                if (!selectedTransaction) {
                  toast.error('Pilih transaksi terlebih dahulu');
                  return;
                }
                if (!returnReason.trim()) {
                  toast.error('Alasan retur wajib diisi');
                  return;
                }
                if (refundMethod === 'deposit' && selectedTransaction.customer?.id) {
                  returnAsDepositMutation.mutate({
                    customerId: selectedTransaction.customer.id,
                    amount: selectedTransaction.total || selectedTransaction.totalPrice || 0,
                    referenceId: selectedTransaction.id,
                    notes: returnReason.trim(),
                  });
                } else {
                  voidTransactionMutation.mutate({
                    transactionId: selectedTransaction.id,
                    reason: returnReason.trim(),
                  });
                }
              }}
              disabled={!selectedTransaction || !returnReason.trim() || voidTransactionMutation.isPending}
              className="flex-1"
            >
              {voidTransactionMutation.isPending ? 'Memproses...' : 'Buat Retur'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

