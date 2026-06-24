import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Printer,
  Receipt,
  User,
  Phone,
  Mail,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  DollarSign,
  ShoppingCart,
  Calendar,
  MapPin,
  CreditCard,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { salesService } from '../../services/sales.service';
import { formatCurrency } from '../../utils/format';

export default function SalesTransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: transaction, isLoading } = useQuery({
    queryKey: ['sales-transaction', id],
    queryFn: () => salesService.getById(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="w-full text-center py-12">
        <p className="text-gray-600 text-lg">Transaksi tidak ditemukan</p>
        <button
          onClick={() => navigate('/sales/history')}
          className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
        >
          Kembali ke riwayat penjualan
        </button>
      </div>
    );
  }

  const tx = transaction as any;
  const branch = tx.branch || {};
  const customer = tx.customer || {};
  const cashier = tx.cashier || {};
  const items = tx.items || [];
  const payments = tx.payments || [];

  const formatDate = (date: string | Date | null) => {
    if (!date) return '--';
    const d = new Date(date);
    return d.toLocaleString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
            <CheckCircle2 className="w-3 h-3" />
            Selesai
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'CANCELLED':
      case 'VOID':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
            <XCircle className="w-3 h-3" />
            Dibatalkan
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
            {status || 'Unknown'}
          </span>
        );
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
            <CheckCircle2 className="w-3 h-3" />
            Lunas
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
            <Clock className="w-3 h-3" />
            Cicilan
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
            <Clock className="w-3 h-3" />
            Belum Bayar
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">
            <XCircle className="w-3 h-3" />
            Dikembalikan
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
            {status || 'Unknown'}
          </span>
        );
    }
  };

  const subtotal = Number(tx.subtotal || 0);
  const discountAmount = Number(tx.discountAmount || 0);
  const taxAmount = Number(tx.taxAmount || 0);
  const total = Number(tx.total || 0);

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/sales/history')}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{tx.transactionNumber}</h1>
                <div className="flex items-center gap-3 mt-1">
                  {getStatusBadge(tx.status)}
                  {getPaymentStatusBadge(tx.paymentStatus)}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tx.status !== 'void' && tx.status !== 'cancelled' && (
              <Link to={`/sales/returns/new?transactionId=${id}`}>
                <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-all shadow-sm">
                  <RotateCcw className="w-4 h-4" />
                  <span>Retur</span>
                </button>
              </Link>
            )}
            <Link to={`/sales/transactions/${id}/print`} target="_blank">
              <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-all shadow-sm">
                <Printer className="w-4 h-4" />
                <span>Cetak Nota</span>
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Transaction Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary-600" />
              Informasi Transaksi
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Tanggal Transaksi</p>
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {formatDate(tx.createdAt)}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Jenis Transaksi</p>
                <p className="text-sm font-semibold text-gray-900">
                  {tx.transactionType === 'pos' ? 'POS' : tx.transactionType?.toUpperCase() || 'POS'}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Cabang</p>
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {branch.name || '--'}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Kasir</p>
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {cashier.fullName || '--'}
                </p>
              </div>
            </div>
            {tx.receiptNotes && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-gray-500 mb-1">Catatan Nota</p>
                <p className="text-sm text-gray-900">{tx.receiptNotes}</p>
              </div>
            )}
            {tx.internalNotes && (
              <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-xs text-gray-500 mb-1">Catatan Internal</p>
                <p className="text-sm text-gray-900">{tx.internalNotes}</p>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary-600" />
              Daftar Item ({items.length})
            </h2>
            {items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">No</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Produk</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Harga</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Diskon</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item: any, index: number) => {
                      const itemSubtotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
                      const itemDiscount = Number(item.discountAmount || 0);
                      const itemTotal = itemSubtotal - itemDiscount;
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {item.product?.name || item.productName || 'N/A'}
                              </p>
                              {item.product?.sku && (
                                <p className="text-xs text-gray-500 font-mono">{item.product.sku}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-900">{item.quantity}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {formatCurrency(Number(item.unitPrice || 0))}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {itemDiscount > 0 ? formatCurrency(itemDiscount) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            {formatCurrency(itemTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Tidak ada item</p>
            )}
          </div>

          {/* Payment Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary-600" />
              Ringkasan Pembayaran
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm text-gray-600">Subtotal</span>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Diskon</span>
                  <span className="text-sm font-semibold text-red-600">- {formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm text-gray-600">Pajak ({Number(tx.taxPercentage || 11)}%)</span>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between items-center py-3 bg-primary-50 rounded-lg px-4 mt-4">
                <span className="text-base font-bold text-gray-900">Total</span>
                <span className="text-lg font-bold text-primary-600">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Customer & Payment */}
        <div className="space-y-4">
          {/* Customer Info */}
          {customer && customer.id ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-primary-600" />
                Customer
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Nama</p>
                  <p className="text-sm font-semibold text-gray-900">{customer.name || '--'}</p>
                </div>
                {customer.phone && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Telepon</p>
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {customer.phone}
                    </p>
                  </div>
                )}
                {customer.email && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Email</p>
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {customer.email}
                    </p>
                  </div>
                )}
                {customer.customerCode && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Kode Customer</p>
                    <p className="text-sm font-semibold text-gray-900 font-mono">{customer.customerCode}</p>
                  </div>
                )}
                {customer.tier && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Tier</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {typeof customer.tier === 'object' ? customer.tier.name : customer.tier}
                    </p>
                  </div>
                )}
                <Link
                  to={`/customers/${customer.id}`}
                  className="block mt-4 text-center px-4 py-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors text-sm font-medium"
                >
                  Lihat Detail Customer
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-primary-600" />
                Customer
              </h2>
              <p className="text-sm text-gray-500">Walk-in Customer</p>
            </div>
          )}

          {/* Payment Info */}
          {payments.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary-600" />
                Pembayaran
              </h2>
              <div className="space-y-3">
                {payments.map((payment: any, index: number) => (
                  <div key={payment.id || index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-500">Metode</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {payment.paymentMethod?.toUpperCase() || 'CASH'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-500">Jumlah</span>
                      <span className="text-sm font-bold text-primary-600">
                        {formatCurrency(Number(payment.amount || 0))}
                      </span>
                    </div>
                    {payment.paidAt && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Tanggal Bayar</span>
                        <span className="text-xs text-gray-600">{formatDate(payment.paidAt)}</span>
                      </div>
                    )}
                    {payment.status && (
                      <div className="mt-2">
                        {getPaymentStatusBadge(payment.status)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Retur Detail — only if transaction is voided */}
          {(tx.status === 'void' || tx.status === 'cancelled') && (
            <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-red-600" />
                Detail Retur
              </h2>
              <div className="space-y-3">
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-500">Status</span>
                    <span className="text-sm font-semibold text-red-600">
                      {tx.status === 'void' ? 'Dibatalkan (Void)' : 'Dibatalkan'}
                    </span>
                  </div>
                  {tx.voidReason && (
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-500">Alasan</span>
                      <span className="text-sm text-gray-900 text-right">{tx.voidReason}</span>
                    </div>
                  )}
                  {tx.voidedAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Tanggal Retur</span>
                      <span className="text-xs text-gray-600">{formatDate(tx.voidedAt)}</span>
                    </div>
                  )}
                </div>
                {payments.some((p: any) => p.paymentMethod === 'deposit') && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-gray-500 mb-1">Metode Refund</p>
                    <p className="text-sm font-semibold text-blue-700">
                      Deposit (Saldo) — {formatCurrency(
                        payments
                          .filter((p: any) => p.paymentMethod === 'deposit')
                          .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

