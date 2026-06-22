import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { salesService } from '../../services/sales.service';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

const SalesReceiptPrint = () => {
  const { id } = useParams<{ id: string }>();

  const { data: transaction, isLoading } = useQuery({
    queryKey: ['sales-transaction', id],
    queryFn: () => salesService.getById(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (!isLoading && transaction) {
      // Auto print when component loads
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [isLoading, transaction]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Transaksi tidak ditemukan</p>
      </div>
    );
  }

  const tx = transaction as any;
  const branch = tx.branch || {};
  const customer = tx.customer || {};
  const cashier = tx.cashier || {};
  const items = tx.items || [];
  const payments = tx.payments || [];

  // Format date
  const formatDate = (date: string | Date | null) => {
    if (!date) return '--';
    const d = new Date(date);
    return d.toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Calculate totals
  const subtotal = Number(tx.subtotal || 0);
  const discountAmount = Number(tx.discountAmount || 0);
  const taxAmount = Number(tx.taxAmount || 0);
  const total = Number(tx.total || 0);
  
  // Payment info
  const payment = payments[0] || {};
  const paidAmount = Number(payment.amount || 0);
  const changeAmount = paidAmount - total;
  
  // Determine status - if payment exists and status is completed, or paymentStatus is paid
  const isPaid = tx.paymentStatus === 'paid' || (tx.status === 'completed' && payments.length > 0) || (payments.length > 0 && payment.status === 'completed');

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="print-container bg-white" style={{ width: '14.8cm', maxWidth: '14.8cm', boxSizing: 'border-box' }}>
      {/* Print styles - A5 format (148mm x 210mm) */}
      <style>{`
        @media print {
          @page {
            size: A5;
            margin: 0.3cm;
          }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            width: 14.8cm !important;
            height: 21cm !important;
          }
          .no-print { 
            display: none !important; 
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            left: -9999px !important;
          }
          .print-container { 
            padding: 0.4cm !important;
            width: 14.2cm !important;
            max-width: 14.2cm !important;
            min-height: auto !important;
            max-height: 20.4cm !important;
            margin: 0 auto !important;
            font-size: 9px !important;
            line-height: 1.3 !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            page-break-inside: avoid !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            position: relative !important;
          }
          .red-white-stripe {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          table {
            font-size: 9px !important;
            border-collapse: collapse !important;
            page-break-inside: avoid !important;
            width: 100% !important;
          }
          img {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            max-width: 1.2cm !important;
            max-height: 1.2cm !important;
          }
          h1, h2, h3 {
            margin: 0.15cm 0 !important;
            line-height: 1.3 !important;
            page-break-after: avoid !important;
          }
          tr {
            line-height: 1.2 !important;
            page-break-inside: avoid !important;
          }
          td, th {
            padding: 0.08cm 0.12cm !important;
            line-height: 1.2 !important;
          }
          .section {
            page-break-inside: avoid !important;
            margin-bottom: 0.2cm !important;
          }
          p {
            margin: 0.08cm 0 !important;
            line-height: 1.2 !important;
          }
        }
        @media screen {
          .print-container {
            border: 1px solid #ddd;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
        }
      `}</style>

      {/* Garis Merah Putih - Top */}
      <div className="mb-2 flex border-t-2 border-[#dc2626] border-b border-gray-200">
        <div className="h-1 bg-[#dc2626] w-full"></div>
      </div>

      {/* Header */}
      <div className="mb-2 border-b border-gray-300 pb-2 section">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            {/* Logo */}
            <img
              src="/logo/igd-1.jpg"
              alt="IGD Ponsel Logo"
              className="h-10 w-10 object-contain flex-shrink-0"
            />
            <div>
              <h1 className="text-sm font-bold text-gray-900 leading-tight">IGD PONSEL</h1>
              <p className="text-xs text-gray-600">sparepart-accessories-service</p>
            </div>
          </div>
          <div className="text-right text-xs flex-shrink-0">
            <p className="font-semibold text-gray-900">{branch.name || 'IGD PONSEL'}</p>
            <p className="text-gray-600">{branch.address || ''}</p>
            <p className="text-gray-600">Telpon/WA. {branch.phone || '0853 66688 345'}</p>
            <p className="text-gray-600">Jam buka: Senin - Minggu 08.00 - 21.00 WIB</p>
          </div>
        </div>
      </div>

      {/* Document Type */}
      <div className="mb-2 text-center section">
        <h2 className="text-base font-bold text-gray-900">NOTA PEMBELIAN</h2>
      </div>

      {/* Transaction Details */}
      <div className="grid grid-cols-2 gap-3 mb-3 text-xs section">
        <div>
          <table className="w-full">
            <tbody>
              <tr>
                <td className="py-1 text-gray-700 font-semibold w-2/5">NOMOR NOTA</td>
                <td className="py-1 text-gray-900">: {tx.transactionNumber}</td>
              </tr>
              <tr>
                <td className="py-1 text-gray-700 font-semibold">NAMA CUSTOMER</td>
                <td className="py-1 text-gray-900">: {customer.name || 'Walk-in'}</td>
              </tr>
              <tr>
                <td className="py-1 text-gray-700 font-semibold">NO. HP</td>
                <td className="py-1 text-gray-900">: {customer.phone || '--'}</td>
              </tr>
              {customer.tier && (
                <tr>
                  <td className="py-1 text-gray-700 font-semibold">TIER</td>
                  <td className="py-1 text-gray-900">: {customer.tier.name || '--'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          <table className="w-full">
            <tbody>
              <tr>
                <td className="py-1 text-gray-700 font-semibold w-2/5">TANGGAL</td>
                <td className="py-1 text-gray-900">: {formatDate(tx.createdAt)}</td>
              </tr>
              <tr>
                <td className="py-1 text-gray-700 font-semibold">KASIR</td>
                <td className="py-1 text-gray-900">: {cashier.fullName || '--'}</td>
              </tr>
              <tr>
                <td className="py-1 text-gray-700 font-semibold">STATUS</td>
                <td className="py-1 text-gray-900">: {isPaid ? 'LUNAS' : (tx.status || 'PENDING').toUpperCase()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Items Table */}
      {items.length > 0 && (
        <div className="mb-3 section">
          <h3 className="text-xs font-bold text-gray-900 mb-2">DAFTAR PEMBELIAN</h3>
          <table className="w-full text-xs border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-2 py-1.5 text-left">NO</th>
                <th className="border border-gray-300 px-2 py-1.5 text-left">ITEM</th>
                <th className="border border-gray-300 px-2 py-1.5 text-center">QTY</th>
                <th className="border border-gray-300 px-2 py-1.5 text-right">HARGA</th>
                <th className="border border-gray-300 px-2 py-1.5 text-right">SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, index: number) => {
                const itemSubtotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
                const itemDiscount = Number(item.discountAmount || 0);
                const itemTotal = itemSubtotal - itemDiscount;
                
                return (
                  <tr key={item.id}>
                    <td className="border border-gray-300 px-2 py-1.5 text-center">{index + 1}</td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      {item.product?.name || item.productName || 'N/A'}
                      {item.product?.sku && <span className="text-gray-500"> ({item.product.sku})</span>}
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 text-center">
                      {item.quantity}
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right">
                      {formatCurrency(Number(item.unitPrice || 0))}
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right">
                      {formatCurrency(itemTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      <div className="mb-3 section">
        <h3 className="text-xs font-bold text-gray-900 mb-2">RINGKASAN PEMBAYARAN</h3>
        <table className="w-full text-xs border border-gray-300">
          <tbody>
            <tr>
              <td className="border border-gray-300 px-2 py-1.5 font-semibold">Subtotal</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right">
                {formatCurrency(subtotal)}
              </td>
            </tr>
            {discountAmount > 0 && (
              <tr>
                <td className="border border-gray-300 px-2 py-1.5 font-semibold">Diskon</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right text-red-600">
                  - {formatCurrency(discountAmount)}
                </td>
              </tr>
            )}
            <tr>
              <td className="border border-gray-300 px-2 py-1.5 font-semibold">Pajak (11%)</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right">
                {formatCurrency(taxAmount)}
              </td>
            </tr>
            <tr className="bg-primary-50 font-bold">
              <td className="border border-gray-300 px-2 py-1.5">TOTAL</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right text-sm">
                {formatCurrency(total)}
              </td>
            </tr>
            {payments.length > 0 && (
              <>
                <tr>
                  <td className="border border-gray-300 px-2 py-1.5 font-semibold">Metode Pembayaran</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right">
                    {payment.method?.toUpperCase() || 'CASH'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-2 py-1.5 font-semibold">Dibayar</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right">
                    {formatCurrency(paidAmount)}
                  </td>
                </tr>
                {changeAmount > 0 && (
                  <tr>
                    <td className="border border-gray-300 px-2 py-1.5 font-semibold">Kembalian</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right">
                      {formatCurrency(changeAmount)}
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Payment Status Stamp (if paid) */}
      {isPaid && (
        <div 
          className="absolute"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-15deg)',
            width: '6cm',
            height: '6cm',
            border: '0.2cm solid #dc2626',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(220, 38, 38, 0.05)',
            zIndex: 10,
            pointerEvents: 'none',
            opacity: 0.7,
          }}
        >
          <div className="text-center">
            <div 
              className="font-bold text-[#dc2626]"
              style={{
                fontSize: '1cm',
                lineHeight: '1.2',
                letterSpacing: '0.1cm',
              }}
            >
              LUNAS
            </div>
          </div>
        </div>
      )}

      {/* Receipt Notes */}
      {tx.receiptNotes && (
        <div className="mb-2 section">
          <h3 className="text-xs font-bold text-gray-900 mb-1">CATATAN</h3>
          <p className="text-xs text-gray-700">{tx.receiptNotes}</p>
        </div>
      )}

      {/* Terms and Conditions */}
      <div className="mb-2 text-[8px] leading-tight section">
        <h3 className="font-bold text-gray-900 mb-1">PERHATIAN:</h3>
        <ol className="list-decimal list-inside space-y-0.5 text-gray-700" style={{ lineHeight: '1.2' }}>
          <li>NOTA INI WAJIB DIBAWA SAAT RETUR ATAU KLAIM GARANSI</li>
          <li>BARANG YANG SUDAH DIBELI TIDAK DAPAT DITUKAR ATAU DIKEMBALIKAN KECUALI ADA KESEPAKATAN</li>
          <li>GARANSI MENGIKUTI KETENTUAN PRODUSEN</li>
          <li>HARAP CEK BARANG SEBELUM DIBELI</li>
          <li>TERIMA KASIH ATAS KEPERCAYAAN ANDA</li>
        </ol>
      </div>

      {/* Garis Merah Putih - Bottom */}
      <div className="mb-2 mt-2 flex border-t border-gray-200 border-b-2 border-[#dc2626]">
        <div className="h-1 bg-[#dc2626] w-full"></div>
      </div>

      {/* Footer */}
      <div className="text-[8px] text-gray-500 text-center">
        <p>
          Printed by: {cashier.fullName || 'System'} / {formatDate(new Date())}
        </p>
      </div>

      {/* Print button (hidden when printing) */}
      <div className="no-print" style={{ display: 'none' }}>
        <button
          onClick={() => window.print()}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Cetak
        </button>
        <button
          onClick={() => window.close()}
          className="ml-4 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          Tutup
        </button>
      </div>
    </div>
  );
};

export default SalesReceiptPrint;

