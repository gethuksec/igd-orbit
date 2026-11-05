// IGDERP-241 (D5): unit tests for the thermal receipt HTML builder.
import { buildSalesReceiptHtml, escapeHtml, ReceiptData } from './receipt-html';

const base: ReceiptData = {
  storeName: 'IGD PONSEL',
  branchName: 'IGD Jember Kalisat',
  branchAddress: 'Jl. Raya Kalisat',
  branchPhone: '0853 66688 345',
  transactionNumber: 'TRX-20261105-ABC123',
  createdAt: new Date('2026-11-05T10:00:00+07:00'),
  cashierName: 'Kasir E2E',
  customerName: 'Budi Santoso',
  customerPhone: '081234567890',
  items: [
    { name: 'Laptop Fan ASUS/TUF', sku: 'SPR-007', quantity: 1, unitPrice: 450000 },
    { name: 'Pasta Thermal', sku: 'SPR-009', quantity: 2, unitPrice: 25000, discountAmount: 5000 },
  ],
  subtotal: 500000,
  discountAmount: 5000,
  taxAmount: 0,
  total: 495000,
  paymentMethod: 'cash',
  paidAmount: 500000,
  changeAmount: 5000,
  isPaid: true,
};

describe('receipt-html (IGDERP-241)', () => {
  it('renders number, items, totals and LUNAS stamp', () => {
    const html = buildSalesReceiptHtml(base);
    expect(html).toContain('TRX-20261105-ABC123');
    expect(html).toContain('Laptop Fan ASUS/TUF');
    expect(html).toContain('SPR-007');
    expect(html).toContain('2 x Rp25.000');
    expect(html).toContain('LUNAS');
    expect(html).toContain('TOTAL');
    // 1x450000 + (2x25000-5000) = 495000
    expect(html).toContain('Rp495.000');
    expect(html).toContain('Rp5.000'); // kembalian
    expect(html).not.toContain('BELUM TERSINKRON');
  });

  it('provisional mode shows OFF mark and no LUNAS', () => {
    const html = buildSalesReceiptHtml({ ...base, provisional: true, isPaid: false, paidAmount: 0 });
    expect(html).toContain('NOTA PENJUALAN (OFFLINE)');
    expect(html).toContain('BELUM TERSINKRON');
    expect(html).not.toContain('>LUNAS<');
  });

  it('escapes HTML in names and notes (XSS-safe for Gotenberg render)', () => {
    const html = buildSalesReceiptHtml({
      ...base,
      customerName: '<img src=x onerror=alert(1)>',
      receiptNotes: '<script>alert(2)</script>',
      items: [{ name: '<b>bold</b>', quantity: 1, unitPrice: 1000 }],
    });
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('escapeHtml handles nullish as placeholder', () => {
    expect(escapeHtml(null)).toBe('--');
    expect(escapeHtml(undefined)).toBe('--');
  });
});
