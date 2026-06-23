import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { serviceOrdersService } from '../../services/service-orders.service';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

const ServiceOrderPrint = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'quotation'; // 'quotation' or 'invoice'

  const { data: serviceOrder, isLoading } = useQuery({
    queryKey: ['service-order', id],
    queryFn: () => serviceOrdersService.getById(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (!isLoading && serviceOrder) {
      // Auto print when component loads
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [isLoading, serviceOrder]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!serviceOrder) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Service order tidak ditemukan</p>
      </div>
    );
  }

  const order = serviceOrder as any;
  const branch = order.branch || {};
  const customer = order.customer || {};
  const technician = order.assignedTechnician || {};

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
  // Total = (approvedPrice or quotedPrice - discountAmount) * 1.11
  const quotedPrice = Number(order.quotedPrice || 0);
  const approvedPrice = Number(order.customerApprovedPrice || quotedPrice);
  const discountAmount = Number(order.discountAmount || 0);
  const finalPrice = approvedPrice - discountAmount;
  const taxAmount = Math.round(finalPrice * 0.11);
  const totalPrice = Math.round(finalPrice * 1.11);
  
  // Breakdown for display
  const laborCost = Number(order.laborCost || 0);
  const partsCost = Number(order.partsCost || 0);
  const otherCost = Number(order.otherCost || 0);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="print-container p-1 max-w-[14.8cm] mx-auto bg-white" style={{ width: '14.8cm', height: '20.4cm', maxHeight: '20.4cm', boxSizing: 'border-box' }}>
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
            padding: 0.3cm;
            width: 14.8cm;
            max-height: 20.4cm;
            margin: 0 auto;
            font-size: 8px;
            line-height: 1.3;
            page-break-after: avoid;
            page-break-before: avoid;
            page-break-inside: avoid;
            overflow: hidden;
            box-sizing: border-box;
            position: relative;
          }
          .red-white-stripe {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          table {
            font-size: 8px;
            border-collapse: collapse;
            page-break-inside: avoid;
          }
          img {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          h1, h2, h3 {
            margin: 0.15cm 0;
            line-height: 1.3;
            page-break-after: avoid;
          }
          tr {
            line-height: 1.2;
            page-break-inside: avoid;
          }
          td, th {
            padding: 0.05cm 0.1cm;
            line-height: 1.1;
          }
          .section {
            page-break-inside: avoid;
          }
        }
        @media screen {
          .print-container {
            border: 1px solid #ddd;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
        }
      `}</style>

      {/* Garis Merah Putih - Top (Estetik & Hemat Tinta) */}
      <div className="mb-0.5 flex border-t-2 border-[#dc2626] border-b border-gray-200">
        <div className="h-0.5 bg-[#dc2626] w-full"></div>
      </div>

      {/* Header - Ultra Compact for A5 */}
      <div className="mb-1 border-b border-gray-300 pb-1 section">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            {/* Logo */}
            <img
              src="/logo/igd-1.jpg"
              alt="IGD Ponsel Logo"
              className="h-12 w-12 object-contain flex-shrink-0"
              style={{ maxHeight: '1cm', maxWidth: '1cm' }}
            />
            <div>
              <h1 className="text-[10px] font-bold text-gray-900 leading-tight">IGD PONSEL</h1>
              <p className="text-[8px] text-gray-600">sparepart-accessories-service</p>
            </div>
          </div>
          <div className="text-right text-[8px] flex-shrink-0">
            <p className="font-semibold text-gray-900">{branch.name || 'IGD PONSEL'}</p>
            <p className="text-gray-600">{branch.address || ''}</p>
            <p className="text-gray-600">Telpon/WA. {branch.phone || '0853 66688 345'}</p>
            <p className="text-gray-600">Jam buka: Senin - Minggu 08.00 - 21.00 WIB</p>
          </div>
        </div>
      </div>

      {/* Document Type */}
      <div className="mb-0.5 text-center section">
        <h2 className="text-[8px] font-bold text-gray-900">
          {type === 'invoice' ? 'NOTA PEMBAYARAN SERVICE' : 'QUOTATION SERVICE'}
        </h2>
      </div>

      {/* Service Order Details - Ultra Compact for A5 */}
      <div className="grid grid-cols-2 gap-1 mb-1 text-[7px] section">
        <div>
          <table className="w-full">
            <tbody>
              <tr>
                <td className="py-0.5 text-gray-700 font-semibold w-2/5 text-[7px]">NOMOR NOTA</td>
                <td className="py-0.5 text-gray-900 text-[7px]">: {order.serviceNumber}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-gray-700 font-semibold text-[7px]">NAMA CUSTOMER</td>
                <td className="py-0.5 text-gray-900 text-[7px]">: {order.customerName || customer.name || 'Walk-in'}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-gray-700 font-semibold text-[7px]">NO. HP</td>
                <td className="py-0.5 text-gray-900 text-[7px]">: {order.customerPhone || customer.phone || '--'}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-gray-700 font-semibold text-[7px]">MEREK TYPE</td>
                <td className="py-0.5 text-gray-900 text-[7px]">: {order.deviceUnit || '--'}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-gray-700 font-semibold text-[7px]">IMEI/SN</td>
                <td className="py-0.5 text-gray-900 text-[7px]">: {order.deviceSerialNumber || '--'}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-gray-700 font-semibold text-[7px]">KERUSAKAN</td>
                <td className="py-0.5 text-gray-900 text-[7px]">: {order.issueType || '--'}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-gray-700 font-semibold text-[7px]">KETERANGAN</td>
                <td className="py-0.5 text-gray-900 text-[7px]">: {order.issueDescription || '--'}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-gray-700 font-semibold text-[7px]">KELENGKAPAN</td>
                <td className="py-0.5 text-gray-900 text-[7px]">: {order.accessories || '--'}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-gray-700 font-semibold text-[7px]">KONDISI</td>
                <td className="py-0.5 text-gray-900 text-[7px]">: {order.deviceCondition || '--'}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-gray-700 font-semibold text-[7px]">TEKNISI</td>
                <td className="py-0.5 text-gray-900 text-[7px]">: {technician.name || '--'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <table className="w-full">
            <tbody>
              <tr>
                <td className="py-0.5 text-gray-700 font-semibold w-2/5 text-[7px]">SANDI</td>
                <td className="py-0.5 text-gray-900 text-[7px]">: {order.devicePassword || '--'}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-gray-700 font-semibold text-[7px]">BIAYA</td>
                <td className="py-0.5 text-gray-900 font-bold text-[7px]">: {formatCurrency(finalPrice)}</td>
              </tr>
              {discountAmount > 0 && (
                <tr>
                  <td className="py-0.5 text-gray-700 font-semibold text-[7px]">DISKON</td>
                  <td className="py-0.5 text-gray-900 text-[7px]">: - {formatCurrency(discountAmount)}</td>
                </tr>
              )}
              {order.promoCode && (
                <tr>
                  <td className="py-0.5 text-gray-700 font-semibold text-[7px]">KODE PROMO</td>
                  <td className="py-0.5 text-gray-900 text-[7px]">: {order.promoCode}</td>
                </tr>
              )}
              <tr>
                <td className="py-0.5 text-gray-700 font-semibold text-[7px]">TGL. MASUK</td>
                <td className="py-0.5 text-gray-900 text-[7px]">: {formatDate(order.createdAt)}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-gray-700 font-semibold text-[7px]">TGL. KELUAR</td>
                <td className="py-0.5 text-gray-900 text-[7px]">
                  : {order.deliveredAt ? formatDate(order.deliveredAt) : '--'}
                </td>
              </tr>
              {type === 'quotation' && order.quotationNumber && (
                <tr>
                  <td className="py-0.5 text-gray-700 font-semibold text-[7px]">QUOTATION</td>
                  <td className="py-0.5 text-gray-900 text-[7px]">: {order.quotationNumber}</td>
                </tr>
              )}
              {type === 'invoice' && order.invoiceNumber && (
                <tr>
                  <td className="py-0.5 text-gray-700 font-semibold text-[7px]">INVOICE</td>
                  <td className="py-0.5 text-gray-900 text-[7px]">: {order.invoiceNumber}</td>
                </tr>
              )}
              {order.warrantyDays > 0 && (
                <tr>
                  <td className="py-0.5 text-gray-700 font-semibold text-[7px]">GARANSI</td>
                  <td className="py-0.5 text-gray-900 text-[7px]">: {order.warrantyDays} Hari</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Spare Parts Table - Ultra Compact for A5 */}
      {order.partsUsed && Array.isArray(order.partsUsed) && order.partsUsed.length > 0 && (
        <div className="mb-1 section">
          <h3 className="text-[7px] font-bold text-gray-900 mb-0.5">TABEL PEMBELIAN SPAREPART</h3>
          <table className="w-full text-[7px] border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-1 py-0.5 text-left text-[7px]">NO</th>
                <th className="border border-gray-300 px-1 py-0.5 text-left text-[7px]">JENIS</th>
                <th className="border border-gray-300 px-1 py-0.5 text-left text-[7px]">ITEM</th>
                <th className="border border-gray-300 px-1 py-0.5 text-center text-[7px]">QTY</th>
                <th className="border border-gray-300 px-1 py-0.5 text-right text-[7px]">HARGA</th>
              </tr>
            </thead>
            <tbody>
              {order.partsUsed.map((part: any, index: number) => {
                const purchaseType = part.purchaseType || 'internal';
                return (
                  <tr key={part.id}>
                    <td className="border border-gray-300 px-1 py-0.5 text-center text-[7px]">{index + 1}</td>
                    <td className="border border-gray-300 px-1 py-0.5 text-[7px]">
                      {purchaseType === 'internal' ? 'Internal' : 'Eksternal'}
                    </td>
                    <td className="border border-gray-300 px-1 py-0.5 text-[7px]">
                      {part.product?.name || 'N/A'}
                    </td>
                    <td className="border border-gray-300 px-1 py-0.5 text-center text-[7px]">
                      {part.quantity}
                    </td>
                    <td className="border border-gray-300 px-1 py-0.5 text-right text-[7px]">
                      {formatCurrency(Number(part.unitPrice || 0))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {(() => {
                const internalTotal = order.partsUsed
                  .filter((p: any) => (p.purchaseType || 'internal') === 'internal')
                  .reduce((sum: number, p: any) => sum + Number(p.totalPrice || 0), 0);
                const externalTotal = order.partsUsed
                  .filter((p: any) => (p.purchaseType || 'internal') === 'external')
                  .reduce((sum: number, p: any) => sum + Number(p.totalPrice || 0), 0);
                return (
                  <>
                    <tr className="bg-gray-50 font-semibold">
                      <td colSpan={3} className="border border-gray-300 px-1 py-0.5 text-[7px]">
                        PEMBELIAN INTERNAL
                      </td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center text-[7px]">-</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-right text-[7px]">
                        {formatCurrency(internalTotal)}
                      </td>
                    </tr>
                    <tr className="bg-gray-50 font-semibold">
                      <td colSpan={3} className="border border-gray-300 px-1 py-0.5 text-[7px]">
                        PEMBELIAN EKSTERNAL
                      </td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center text-[7px]">-</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-right text-[7px]">
                        {formatCurrency(externalTotal)}
                      </td>
                    </tr>
                    <tr className="bg-gray-50 font-semibold">
                      <td colSpan={3} className="border border-gray-300 px-1 py-0.5 text-[7px]">
                        TOTAL PEMBELIAN
                      </td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center text-[7px]">-</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-right text-[7px]">
                        {formatCurrency(partsCost)}
                      </td>
                    </tr>
                    <tr className="bg-gray-100 font-bold">
                      <td colSpan={3} className="border border-gray-300 px-1 py-0.5 text-[7px]">
                        LABA (BIAYA SERVICE - PEMBELIAN SPP)
                      </td>
                      <td className="border border-gray-300 px-1 py-0.5 text-center text-[7px]">-</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-right text-[7px]">
                        {formatCurrency(laborCost - partsCost)}
                      </td>
                    </tr>
                  </>
                );
              })()}
            </tfoot>
          </table>
        </div>
      )}

      {/* Cost Summary - Ultra Compact for A5 */}
      <div className="mb-1 section">
        <h3 className="text-[7px] font-bold text-gray-900 mb-0.5">RINGKASAN BIAYA</h3>
        <table className="w-full text-[7px] border border-gray-300">
          <tbody>
            <tr>
              <td className="border border-gray-300 px-1 py-0.5 font-semibold text-[7px]">Biaya Jasa</td>
              <td className="border border-gray-300 px-1 py-0.5 text-right text-[7px]">
                {formatCurrency(laborCost)}
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-1 py-0.5 font-semibold text-[7px]">Biaya Sparepart</td>
              <td className="border border-gray-300 px-1 py-0.5 text-right text-[7px]">
                {formatCurrency(partsCost)}
              </td>
            </tr>
            {otherCost > 0 && (
              <tr>
                <td className="border border-gray-300 px-1 py-0.5 font-semibold text-[7px]">Biaya Lain-lain</td>
                <td className="border border-gray-300 px-1 py-0.5 text-right text-[7px]">
                  {formatCurrency(otherCost)}
                </td>
              </tr>
            )}
            {discountAmount > 0 && (
              <tr>
                <td className="border border-gray-300 px-1 py-0.5 font-semibold text-[7px]">Diskon</td>
                <td className="border border-gray-300 px-1 py-0.5 text-right text-red-600 text-[7px]">
                  - {formatCurrency(discountAmount)}
                </td>
              </tr>
            )}
            {order.promoCode && (
              <tr>
                <td className="border border-gray-300 px-1 py-0.5 font-semibold text-[7px]">Kode Promo</td>
                <td className="border border-gray-300 px-1 py-0.5 text-right text-[7px]">{order.promoCode}</td>
              </tr>
            )}
            <tr>
              <td className="border border-gray-300 px-1 py-0.5 font-semibold text-[7px]">Harga Setelah Diskon</td>
              <td className="border border-gray-300 px-1 py-0.5 text-right text-[7px]">
                {formatCurrency(finalPrice)}
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-1 py-0.5 font-semibold text-[7px]">Pajak (11%)</td>
              <td className="border border-gray-300 px-1 py-0.5 text-right text-[7px]">
                {formatCurrency(taxAmount)}
              </td>
            </tr>
            <tr className="bg-primary-50 font-bold">
              <td className="border border-gray-300 px-1 py-0.5 text-[7px]">TOTAL</td>
              <td className="border border-gray-300 px-1 py-0.5 text-right text-[8px]">
                {formatCurrency(totalPrice)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Payment Info (for invoice) - Ultra Compact */}
      {type === 'invoice' && order.paymentStatus === 'paid' && (
        <>
          {/* Stempel LUNAS - Bulat di tengah */}
          <div 
            className="absolute"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-15deg)',
              width: '8cm',
              height: '8cm',
              border: '0.15cm solid #dc2626',
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
                  fontSize: '1.2cm',
                  lineHeight: '1.2',
                  letterSpacing: '0.1cm',
                }}
              >
                LUNAS
              </div>
            </div>
          </div>
          
          {/* Payment details - Hidden karena sudah ada stempel */}
        </>
      )}

      {/* Terms and Conditions - Ultra Compact for A5 */}
      <div className="mb-1 text-[6px] leading-tight section">
        <h3 className="font-bold text-gray-900 mb-0.5">PERHATIAN:</h3>
        <ol className="list-decimal list-inside space-y-0 text-gray-700" style={{ lineHeight: '1.2' }}>
          <li>NOTA INI WAJIB DIBAWA SAAT PENGAMBILAN BARANG YANG DIPERBAIKI, PENGAMBILAN TANPA NOTA TIDAK KAMI LAYANI</li>
          <li>PEMBAYARAN BIAYA SERVICE HARUS LUNAS</li>
          <li>BARANG YANG DISERVICE BILA TERNYATA BERTAMBAH JENIS KERUSAKAN DILUAR KESEPAKATAN AWAL AKAN DIKENAKAN BIAYA TAMBAHAN</li>
          <li>KAMI TIDAK BERTANGGUNGJAWAB ATAS KEHILANGAN DATA CUSTOMER UNTUK SEMUA KERUSAKAN SOFTWARE</li>
          <li>BARANG YANG SUDAH DIKONFIRMASI DAN TIDAK DIAMBIL SELAMA 1 BULAN (30 HARI), DILUAR TANGGUNGJAWAB KAMI</li>
          <li>KAMI TIDAK MELAYANI SERVICE ATAS BARANG DARI HASIL TINDAK PIDANA</li>
          <li>GARANSI TIDAK BERLAKU: a. MENGUBAH ISI NOTA b. SEGEL GARANSI HILANG ATAU RUSAK c. JATUH ATAU TERBENTUR BENDA KERAS d. KESALAHAN PEMAKAI YANG TIDAK SEMESTINYA e. KENA AIR ATAU TERBAKAR f. GARANSI PENGGANTIAN LCD ATAU TOUCHSCREEN TIDAK BERLAKU APABILA JATUH, PECAH, RETAK, KENA AIR, KONSLETING (KESALAHAN PENGGUNA)</li>
        </ol>
      </div>

      {/* Signatures - Ultra Compact for A5 */}
      <div className="mb-1 section">
        <table className="w-full text-[7px]">
          <thead>
            <tr>
              <th className="border border-gray-300 px-1 py-0.5">CUSTOMER</th>
              <th className="border border-gray-300 px-1 py-0.5">CUST. SERVICE</th>
              <th className="border border-gray-300 px-1 py-0.5">TEKNISI</th>
              <th className="border border-gray-300 px-1 py-0.5">Q. CONTROL</th>
              <th className="border border-gray-300 px-1 py-0.5">PENGAMBIL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-1 py-2 text-center text-[7px]">
                {order.customerName || customer.name || ''}
              </td>
              <td className="border border-gray-300 px-1 py-2 text-center text-[7px]">--</td>
              <td className="border border-gray-300 px-1 py-2 text-center text-[7px]">
                {technician.name || '--'}
              </td>
              <td className="border border-gray-300 px-1 py-2 text-center text-[7px]">--</td>
              <td className="border border-gray-300 px-1 py-2 text-center text-[7px]">--</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Garis Merah Putih - Bottom (Estetik & Hemat Tinta) */}
      <div className="mb-0.5 mt-1 flex border-t border-gray-200 border-b-2 border-[#dc2626]">
        <div className="h-0.5 bg-[#dc2626] w-full"></div>
      </div>

      {/* Footer - Ultra Compact */}
      <div className="text-[6px] text-gray-500 text-center">
        <p>
          Printed by: {order.createdBy || 'System'} / {formatDate(new Date())}
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

export default ServiceOrderPrint;

