// IGDERP-241 (D5): server-side 80mm thermal receipt HTML.
// Pure builder — shared by the Gotenberg PDF path and unit-tested without it.
// Keep this dependency-free so the template stays identical everywhere.

export interface ReceiptLineItem {
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
}

export interface ReceiptData {
  storeName: string;
  storeTagline?: string;
  branchName?: string;
  branchAddress?: string;
  branchPhone?: string;
  transactionNumber: string;
  createdAt: string | Date;
  cashierName?: string;
  customerName?: string;
  customerPhone?: string;
  items: ReceiptLineItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paymentMethod?: string;
  paidAmount?: number;
  changeAmount?: number;
  isPaid: boolean;
  receiptNotes?: string;
  /** Offline queue print: OFF- number + provisional mark, no LUNAS stamp. */
  provisional?: boolean;
}

export function escapeHtml(s: string | number | null | undefined): string {
  return String(s ?? '--').replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function formatIDR(n: number): string {
  return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
}

function formatDate(d: string | Date): string {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '--';
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

export function buildSalesReceiptHtml(d: ReceiptData): string {
  const rows = d.items
    .map((it, i) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unitPrice) || 0;
      const disc = Number(it.discountAmount) || 0;
      const line = qty * price - disc;
      const name = escapeHtml(it.name).slice(0, 42);
      const sku = it.sku ? `<div class="sku">${escapeHtml(it.sku)}</div>` : '';
      const discLine = disc > 0 ? `<div class="row"><span>Diskon item</span><span>-${formatIDR(disc)}</span></div>` : '';
      return `<div class="item"><div class="row"><span>${i + 1}. ${name}</span></div>${sku}<div class="row"><span>${qty} x ${formatIDR(price)}</span><span>${formatIDR(line)}</span></div>${discLine}</div>`;
    })
    .join('\n');

  const paid = Number(d.paidAmount) || 0;
  const change = d.changeAmount ?? (paid > 0 ? paid - d.total : 0);
  const stamp = d.provisional
    ? `<div class="stamp provisional">BELUM TERSINKRON</div>`
    : d.isPaid
      ? `<div class="stamp paid">LUNAS</div>`
      : '';

  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 72mm; font-family: "Courier New", Courier, monospace; font-size: 11px; line-height: 1.45; color: #000; padding: 2mm; }
  .center { text-align: center; }
  .store { font-size: 15px; font-weight: bold; }
  .sep { border-top: 1px dashed #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  .item { margin: 3px 0; }
  .sku { font-size: 10px; }
  .total { font-size: 14px; font-weight: bold; }
  .stamp { text-align: center; font-size: 16px; font-weight: bold; border: 2px solid #000; border-radius: 6px; padding: 2px 0; margin: 6px 0; letter-spacing: 2px; }
  .notes { margin-top: 4px; }
  .small { font-size: 10px; }
</style></head><body>
  <div class="center"><div class="store">${escapeHtml(d.storeName)}</div><div>${escapeHtml(d.storeTagline ?? 'sparepart-accessories-service')}</div><div>${escapeHtml(d.branchName ?? '')}</div><div class="small">${escapeHtml(d.branchAddress ?? '')}</div><div class="small">${escapeHtml(d.branchPhone ?? '')}</div></div>
  <div class="sep"></div>
  <div class="center"><strong>${d.provisional ? 'NOTA PENJUALAN (OFFLINE)' : 'NOTA PENJUALAN'}</strong></div>
  <div class="row"><span>No</span><span>${escapeHtml(d.transactionNumber)}</span></div>
  <div class="row"><span>Tgl</span><span>${formatDate(d.createdAt)}</span></div>
  <div class="row"><span>Kasir</span><span>${escapeHtml(d.cashierName ?? 'System')}</span></div>
  <div class="row"><span>Customer</span><span>${escapeHtml(d.customerName ?? 'Walk-in')}</span></div>
  ${stamp}
  <div class="sep"></div>
  ${rows}
  <div class="sep"></div>
  <div class="row"><span>Subtotal</span><span>${formatIDR(d.subtotal)}</span></div>
  ${d.discountAmount > 0 ? `<div class="row"><span>Diskon</span><span>-${formatIDR(d.discountAmount)}</span></div>` : ''}
  ${d.taxAmount > 0 ? `<div class="row"><span>Pajak</span><span>${formatIDR(d.taxAmount)}</span></div>` : ''}
  <div class="row total"><span>TOTAL</span><span>${formatIDR(d.total)}</span></div>
  ${d.paymentMethod && paid > 0 ? `<div class="row"><span>Bayar (${escapeHtml(d.paymentMethod.toUpperCase())})</span><span>${formatIDR(paid)}</span></div>` : ''}
  ${paid > 0 ? `<div class="row"><span>Kembalian</span><span>${formatIDR(change)}</span></div>` : ''}
  ${d.receiptNotes ? `<div class="notes">Catatan: ${escapeHtml(d.receiptNotes)}</div>` : ''}
  <div class="sep"></div>
  <div class="center small">NOTA WAJIB DIBAWA SAAT RETUR/KLAIM GARANSI<br>BARANG SUDAH DIBELI TIDAK DAPAT DITUKAR/DIKEMBALIKAN<br>KECUALI ADA KESEPAKATAN — TERIMA KASIH</div>
</body></html>`;
}
