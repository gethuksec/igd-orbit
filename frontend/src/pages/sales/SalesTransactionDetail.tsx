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
  DollarSign,
  ShoppingCart,
  Calendar,
  MapPin,
  CreditCard,
  RotateCcw,
} from 'lucide-react';
import { salesService } from '../../services/sales.service';
import { formatCurrency } from '../../utils/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
        <Button
          variant="link"
          onClick={() => navigate('/sales/history')}
          className="mt-4"
        >
          Kembali ke riwayat penjualan
        </Button>
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

  const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const s = status?.toUpperCase();
    if (s === 'COMPLETED') return 'default';
    if (s === 'PENDING') return 'secondary';
    if (s === 'CANCELLED' || s === 'VOID') return 'destructive';
    return 'secondary';
  };

  const paymentStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const s = status?.toUpperCase();
    if (s === 'PAID') return 'default';
    if (s === 'PARTIAL') return 'secondary';
    if (s === 'REFUNDED') return 'outline';
    return 'secondary';
  };

  const subtotal = Number(tx.subtotal || 0);
  const discountAmount = Number(tx.discountAmount || 0);
  const taxAmount = Number(tx.taxAmount || 0);
  const total = Number(tx.total || 0);

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/sales/history')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{tx.transactionNumber}</h1>
                  <div className="flex items-center gap-3 mt-1">
                    <Badge variant={statusVariant(tx.status)}>
                      {tx.status === 'completed' ? 'Selesai' : tx.status === 'pending' ? 'Pending' : tx.status === 'cancelled' || tx.status === 'void' ? 'Dibatalkan' : tx.status}
                    </Badge>
                    {tx.paymentStatus && (
                      <Badge variant={paymentStatusVariant(tx.paymentStatus)}>
                        {tx.paymentStatus === 'paid' ? 'Lunas' : tx.paymentStatus === 'partial' ? 'Cicilan' : tx.paymentStatus === 'pending' ? 'Belum Bayar' : tx.paymentStatus === 'refunded' ? 'Dikembalikan' : tx.paymentStatus}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tx.status !== 'void' && tx.status !== 'cancelled' && (
                <Link to={`/sales/returns/new?transactionId=${id}`}>
                  <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Retur
                  </Button>
                </Link>
              )}
              <Link to={`/sales/transactions/${id}/print`} target="_blank">
                <Button>
                  <Printer className="w-4 h-4 mr-1" />
                  Cetak Nota
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Transaction Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Receipt className="w-5 h-5 text-primary-600" />
                Informasi Transaksi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-muted-foreground mb-1">Tanggal Transaksi</p>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    {formatDate(tx.createdAt)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-muted-foreground mb-1">Jenis Transaksi</p>
                  <p className="text-sm font-semibold text-foreground">
                    {tx.transactionType === 'pos' ? 'POS' : tx.transactionType?.toUpperCase() || 'POS'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-muted-foreground mb-1">Cabang</p>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    {branch.name || '--'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-muted-foreground mb-1">Kasir</p>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    {cashier.fullName || '--'}
                  </p>
                </div>
              </div>
              {tx.receiptNotes && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-muted-foreground mb-1">Catatan Nota</p>
                  <p className="text-sm text-foreground">{tx.receiptNotes}</p>
                </div>
              )}
              {tx.internalNotes && (
                <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-xs text-muted-foreground mb-1">Catatan Internal</p>
                  <p className="text-sm text-foreground">{tx.internalNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="w-5 h-5 text-primary-600" />
                Daftar Item ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">No</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Produk</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-muted-foreground uppercase">Qty</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase">Harga</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase">Diskon</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((item: any, index: number) => {
                        const itemSubtotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
                        const itemDiscount = Number(item.discountAmount || 0);
                        const itemTotal = itemSubtotal - itemDiscount;
                        return (
                          <tr key={item.id} className="hover:bg-muted/50">
                            <td className="px-4 py-3 text-sm text-foreground">{index + 1}</td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-semibold text-foreground">
                                {item.product?.name || item.productName || 'N/A'}
                              </p>
                              {item.product?.sku && (
                                <p className="text-xs text-muted-foreground font-mono">{item.product.sku}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-center text-foreground">{item.quantity}</td>
                            <td className="px-4 py-3 text-sm text-right text-foreground">
                              {formatCurrency(Number(item.unitPrice || 0))}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-foreground">
                              {itemDiscount > 0 ? formatCurrency(itemDiscount) : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-foreground">
                              {formatCurrency(itemTotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">Tidak ada item</p>
              )}
            </CardContent>
          </Card>

          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="w-5 h-5 text-primary-600" />
                Ringkasan Pembayaran
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="text-sm font-semibold text-foreground">{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Diskon</span>
                    <span className="text-sm font-semibold text-red-600">- {formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Pajak ({Number(tx.taxPercentage || 11)}%)</span>
                  <span className="text-sm font-semibold text-foreground">{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between items-center py-3 bg-primary-50 rounded-lg px-4 mt-4">
                  <span className="text-base font-bold text-foreground">Total</span>
                  <span className="text-lg font-bold text-primary-600">{formatCurrency(total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5 text-primary-600" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customer?.id ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Nama</p>
                    <p className="text-sm font-semibold text-foreground">{customer.name || '--'}</p>
                  </div>
                  {customer.phone && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Telepon</p>
                      <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        {customer.phone}
                      </p>
                    </div>
                  )}
                  {customer.email && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Email</p>
                      <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        {customer.email}
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
              ) : (
                <p className="text-sm text-muted-foreground">Walk-in Customer</p>
              )}
            </CardContent>
          </Card>

          {/* Payment Info */}
          {payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="w-5 h-5 text-primary-600" />
                  Pembayaran
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {payments.map((payment: any, index: number) => (
                    <div key={payment.id || index} className="p-3 bg-muted/50 rounded-lg border border-border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-muted-foreground">Metode</span>
                        <span className="text-sm font-semibold text-foreground">
                          {payment.paymentMethod?.toUpperCase() || 'CASH'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-muted-foreground">Jumlah</span>
                        <span className="text-sm font-bold text-primary-600">
                          {formatCurrency(Number(payment.amount || 0))}
                        </span>
                      </div>
                      {payment.paidAt && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Tanggal Bayar</span>
                          <span className="text-xs text-muted-foreground">{formatDate(payment.paidAt)}</span>
                        </div>
                      )}
                      {payment.status && (
                        <div className="mt-2">
                          <Badge variant={paymentStatusVariant(payment.status)}>
                            {payment.status === 'paid' ? 'Lunas' : payment.status === 'pending' ? 'Belum Bayar' : payment.status}
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Return Detail (voided/cancelled transaction) */}
          {(tx.status === 'void' || tx.status === 'cancelled') && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-red-600">
                  <RotateCcw className="w-5 h-5" />
                  Detail Retur
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-muted-foreground">Status</span>
                      <span className="text-sm font-semibold text-red-600">
                        {tx.status === 'void' ? 'Dibatalkan (Void)' : 'Dibatalkan'}
                      </span>
                    </div>
                    {tx.voidReason && (
                      <div>
                        <span className="text-xs text-muted-foreground">Alasan</span>
                        <p className="text-sm text-foreground mt-1">{tx.voidReason}</p>
                      </div>
                    )}
                    {tx.voidedAt && (
                      <div className="mt-2">
                        <span className="text-xs text-muted-foreground">Tanggal Retur</span>
                        <p className="text-sm text-foreground mt-1">{formatDate(tx.voidedAt)}</p>
                      </div>
                    )}
                  </div>
                  {payments.some((p: any) => p.paymentMethod === 'deposit') && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-muted-foreground mb-1">Metode Refund</p>
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
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
