import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Loader2, X } from 'lucide-react';
import { salesService, type SalesTransaction } from '../../services/sales.service';
import { useBranchFilter, BranchFilterSelect } from '@/components/branch/BranchFilter';
import { BreadcrumbHeader } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '../../utils/format';

export default function ReturnForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const transactionId = searchParams.get('transactionId');
  const { branchId, setBranchId } = useBranchFilter();
  const queryClient = useQueryClient();

  const [transactionSearch, setTransactionSearch] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<SalesTransaction | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'deposit'>('cash');

  const { data: preloadedTransaction, isLoading: loadingPreloaded } = useQuery({
    queryKey: ['sales-transaction', transactionId],
    queryFn: () => salesService.getById(transactionId!),
    enabled: !!transactionId,
  });

  useEffect(() => {
    if (preloadedTransaction) {
      setSelectedTransaction(preloadedTransaction as any);
    }
  }, [preloadedTransaction]);

  const { data: transactionSearchResults } = useQuery({
    queryKey: ['sales-transactions-search', transactionSearch, branchId],
    queryFn: () =>
      salesService.getAll({
        page: 1,
        limit: 10,
        search: transactionSearch || undefined,
        branchId: branchId || undefined,
      }),
    enabled: !transactionId && transactionSearch.length >= 3,
  });

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

  if (loadingPreloaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <BreadcrumbHeader title="Buat Retur Penjualan" subtitle="Pilih transaksi dan masukkan alasan retur">
        <BranchFilterSelect value={branchId} onChange={setBranchId} />
      </BreadcrumbHeader>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Transaction Search */}
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Cari Transaksi <span className="text-red-500">*</span>
              </label>
              {!transactionId && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
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
                <div className="mt-2 border border-border rounded-lg max-h-60 overflow-y-auto">
                  {transactionSearchResults.data
                    .filter((t: SalesTransaction) => t.status !== 'void' && t.status !== 'cancelled')
                    .map((transaction: SalesTransaction) => (
                      <div
                        key={transaction.id}
                        onClick={() => setSelectedTransaction(transaction)}
                        className={`p-3 border-b border-border cursor-pointer hover:bg-muted/50 ${
                          selectedTransaction?.id === transaction.id ? 'bg-primary-50 border-primary-200' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-foreground">{transaction.transactionNumber}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {transaction.customer?.name || 'Walk-in'} · {formatDate(transaction.createdAt)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {transaction.itemCount || transaction.items?.length || 0} item ·{' '}
                              {transaction.branch?.name || 'N/A'}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-sm font-bold text-primary-600">
                              {formatCurrency(transaction.total || transaction.totalPrice || 0)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {transaction.paymentStatus === 'paid' ? 'Lunas' : 'Belum Lunas'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  {transactionSearchResults.data.filter(
                    (t: SalesTransaction) => t.status !== 'void' && t.status !== 'cancelled',
                  ).length === 0 && (
                    <div className="p-4 text-center text-sm text-muted-foreground">Tidak ada transaksi ditemukan</div>
                  )}
                </div>
              )}

              {selectedTransaction && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-1">
                        {selectedTransaction.transactionNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedTransaction.customer?.name || 'Walk-in'} · {formatDate(selectedTransaction.createdAt)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedTransaction.itemCount || selectedTransaction.items?.length || 0} item ·{' '}
                        {formatCurrency(selectedTransaction.total || selectedTransaction.totalPrice || 0)}
                      </p>
                    </div>
                    {!transactionId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedTransaction(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Return Reason */}
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Alasan Retur <span className="text-red-500">*</span>
              </label>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Masukkan alasan retur..."
                rows={4}
                className="w-full px-4 py-2 border-2 border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-background"
              />
            </div>

            {/* Refund Method */}
            {selectedTransaction && selectedTransaction.customer && (
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">
                  Metode Pengembalian Dana
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={refundMethod === 'cash' ? 'default' : 'outline'}
                    onClick={() => setRefundMethod('cash')}
                    className="h-auto py-3"
                  >
                    Tunai / Cash
                  </Button>
                  <Button
                    type="button"
                    variant={refundMethod === 'deposit' ? 'default' : 'outline'}
                    onClick={() => setRefundMethod('deposit')}
                    className="h-auto py-3"
                  >
                    Deposit (Saldo)
                  </Button>
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
            <div className="flex gap-2 pt-4 border-t border-border">
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
        </CardContent>
      </Card>
    </div>
  );
}
