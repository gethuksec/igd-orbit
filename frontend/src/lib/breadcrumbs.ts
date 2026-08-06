/**
 * Central route → breadcrumb trail map (T23).
 * Trails match the sidebar structure (DashboardLayout.tsx); "Beranda" is
 * prepended automatically by getBreadcrumbs(). Patterns support :param
 * segments (e.g. '/products/:id/edit'); the most specific pattern wins.
 */

export interface Crumb {
  label: string;
  href?: string;
}

const HOME: Crumb = { label: 'Beranda', href: '/dashboard' };

const TRAILS: Record<string, Crumb[]> = {
  // ── Dashboard ────────────────────────────────────────────────
  '/dashboard': [],

  // ── Master Data ──────────────────────────────────────────────
  '/branches': [{ label: 'Cabang' }],
  '/branches/new': [{ label: 'Cabang', href: '/branches' }],
  '/branches/:id': [{ label: 'Cabang', href: '/branches' }],
  '/branches/:id/edit': [{ label: 'Cabang', href: '/branches' }],
  '/customers': [{ label: 'Master Data' }, { label: 'Pelanggan' }],
  '/customers/new': [{ label: 'Master Data' }, { label: 'Pelanggan', href: '/customers' }],
  '/customers/:id': [{ label: 'Master Data' }, { label: 'Pelanggan', href: '/customers' }],
  '/customers/:id/edit': [{ label: 'Master Data' }, { label: 'Pelanggan', href: '/customers' }],
  '/customer-tiers': [{ label: 'Master Data' }, { label: 'Customer Tiers' }],
  '/products': [{ label: 'Master Data' }, { label: 'Produk' }],
  '/products/new': [{ label: 'Master Data' }, { label: 'Produk', href: '/products' }],
  '/products/:id': [{ label: 'Master Data' }, { label: 'Produk', href: '/products' }],
  '/products/:id/edit': [{ label: 'Master Data' }, { label: 'Produk', href: '/products' }],
  '/categories': [{ label: 'Master Data' }, { label: 'Kategori' }],
  '/categories/new': [{ label: 'Master Data' }, { label: 'Kategori', href: '/categories' }],
  '/categories/:id': [{ label: 'Master Data' }, { label: 'Kategori', href: '/categories' }],
  '/categories/:id/edit': [{ label: 'Master Data' }, { label: 'Kategori', href: '/categories' }],
  '/brands': [{ label: 'Master Data' }, { label: 'Brand' }],
  '/brands/new': [{ label: 'Master Data' }, { label: 'Brand', href: '/brands' }],
  '/brands/:id': [{ label: 'Master Data' }, { label: 'Brand', href: '/brands' }],
  '/brands/:id/edit': [{ label: 'Master Data' }, { label: 'Brand', href: '/brands' }],
  '/colors': [{ label: 'Master Data' }, { label: 'Warna' }],
  '/colors/new': [{ label: 'Master Data' }, { label: 'Warna', href: '/colors' }],
  '/colors/:id': [{ label: 'Master Data' }, { label: 'Warna', href: '/colors' }],
  '/colors/:id/edit': [{ label: 'Master Data' }, { label: 'Warna', href: '/colors' }],
  '/units': [{ label: 'Master Data' }, { label: 'Satuan' }],
  '/units/new': [{ label: 'Master Data' }, { label: 'Satuan', href: '/units' }],
  '/units/:id': [{ label: 'Master Data' }, { label: 'Satuan', href: '/units' }],
  '/units/:id/edit': [{ label: 'Master Data' }, { label: 'Satuan', href: '/units' }],
  '/sizes': [{ label: 'Master Data' }, { label: 'Ukuran' }],
  '/sizes/new': [{ label: 'Master Data' }, { label: 'Ukuran', href: '/sizes' }],
  '/sizes/:id': [{ label: 'Master Data' }, { label: 'Ukuran', href: '/sizes' }],
  '/sizes/:id/edit': [{ label: 'Master Data' }, { label: 'Ukuran', href: '/sizes' }],
  '/expeditions': [{ label: 'Master Data' }, { label: 'Ekspedisi' }],
  '/expeditions/new': [{ label: 'Master Data' }, { label: 'Ekspedisi', href: '/expeditions' }],
  '/expeditions/:id': [{ label: 'Master Data' }, { label: 'Ekspedisi', href: '/expeditions' }],
  '/expeditions/:id/edit': [{ label: 'Master Data' }, { label: 'Ekspedisi', href: '/expeditions' }],
  '/suppliers': [{ label: 'Master Data' }, { label: 'Supplier' }],
  '/suppliers/new': [{ label: 'Master Data' }, { label: 'Supplier', href: '/suppliers' }],
  '/suppliers/:id': [{ label: 'Master Data' }, { label: 'Supplier', href: '/suppliers' }],
  '/suppliers/:id/edit': [{ label: 'Master Data' }, { label: 'Supplier', href: '/suppliers' }],
  '/sales-types': [{ label: 'Master Data' }, { label: 'Tipe Penjualan' }],
  '/sales-types/new': [{ label: 'Master Data' }, { label: 'Tipe Penjualan', href: '/sales-types' }],
  '/sales-types/:id': [{ label: 'Master Data' }, { label: 'Tipe Penjualan', href: '/sales-types' }],
  '/sales-types/:id/edit': [{ label: 'Master Data' }, { label: 'Tipe Penjualan', href: '/sales-types' }],
  '/payment-terms': [{ label: 'Master Data' }, { label: 'Termin Pembayaran' }],
  '/payment-terms/new': [{ label: 'Master Data' }, { label: 'Termin Pembayaran', href: '/payment-terms' }],
  '/payment-terms/:id': [{ label: 'Master Data' }, { label: 'Termin Pembayaran', href: '/payment-terms' }],
  '/payment-terms/:id/edit': [{ label: 'Master Data' }, { label: 'Termin Pembayaran', href: '/payment-terms' }],
  '/service-types': [{ label: 'Master Data' }, { label: 'Layanan' }],
  '/service-types/new': [{ label: 'Master Data' }, { label: 'Layanan', href: '/service-types' }],
  '/service-types/:id': [{ label: 'Master Data' }, { label: 'Layanan', href: '/service-types' }],
  '/service-types/:id/edit': [{ label: 'Master Data' }, { label: 'Layanan', href: '/service-types' }],
  '/service-checkpoints': [{ label: 'Master Data' }, { label: 'Kelengkapan' }],

  // ── Penjualan ────────────────────────────────────────────────
  '/sales': [{ label: 'Penjualan' }],
  '/sales/history': [{ label: 'Penjualan' }, { label: 'Riwayat Penjualan' }],
  '/sales/returns': [{ label: 'Penjualan' }, { label: 'Retur Penjualan' }],
  '/sales/returns/new': [{ label: 'Penjualan' }, { label: 'Retur Penjualan', href: '/sales/returns' }],
  '/sales/transactions/:id': [{ label: 'Penjualan' }, { label: 'Riwayat Penjualan', href: '/sales/history' }],

  // ── Servis ───────────────────────────────────────────────────
  '/services': [{ label: 'Servis' }],
  '/service-orders': [{ label: 'Servis' }, { label: 'Semua Service Order' }],
  '/service-orders/my': [{ label: 'Servis' }, { label: 'Service Saya' }],
  '/service-orders/new': [{ label: 'Servis' }, { label: 'Semua Service Order', href: '/service-orders' }],
  '/service-orders/:id': [{ label: 'Servis' }, { label: 'Semua Service Order', href: '/service-orders' }],
  '/service-orders/:id/edit': [{ label: 'Servis' }, { label: 'Semua Service Order', href: '/service-orders' }],
  '/service-returns': [{ label: 'Servis' }, { label: 'Retur & Komplain' }],
  '/service-returns/new': [{ label: 'Servis' }, { label: 'Retur & Komplain', href: '/service-returns' }],
  '/service-returns/:id': [{ label: 'Servis' }, { label: 'Retur & Komplain', href: '/service-returns' }],

  // ── Gudang ───────────────────────────────────────────────────
  '/warehouse': [{ label: 'Gudang' }],
  '/inventory/stock': [{ label: 'Gudang' }, { label: 'Stok' }],
  '/inventory/transfer': [{ label: 'Gudang' }, { label: 'Transfer Stok' }],
  '/inventory/transfer/new': [{ label: 'Gudang' }, { label: 'Transfer Stok', href: '/inventory/transfer' }],
  '/inventory/transfer/:id': [{ label: 'Gudang' }, { label: 'Transfer Stok', href: '/inventory/transfer' }],
  '/inventory/opname': [{ label: 'Gudang' }, { label: 'Stock Opname' }],
  '/inventory/opname/new': [{ label: 'Gudang' }, { label: 'Stock Opname', href: '/inventory/opname' }],
  '/inventory/opname/:id': [{ label: 'Gudang' }, { label: 'Stock Opname', href: '/inventory/opname' }],
  '/inventory/opname/:id/count': [{ label: 'Gudang' }, { label: 'Stock Opname', href: '/inventory/opname' }],
  '/inventory/adjustment': [{ label: 'Gudang' }, { label: 'Stock Adjustment' }],
  '/inventory/movements': [{ label: 'Gudang' }, { label: 'Riwayat Perpindahan' }],
  '/inventory/alerts': [{ label: 'Gudang' }, { label: 'Peringatan Stok Rendah' }],

  // ── Keuangan ─────────────────────────────────────────────────
  '/finance': [{ label: 'Keuangan' }],
  '/finance/coa': [{ label: 'Keuangan' }, { label: 'Chart of Accounts' }],
  '/finance/coa/:id': [{ label: 'Keuangan' }, { label: 'Chart of Accounts', href: '/finance/coa' }],
  '/finance/journal': [{ label: 'Keuangan' }, { label: 'Jurnal Umum' }],
  '/finance/journal/new': [{ label: 'Keuangan' }, { label: 'Jurnal Umum', href: '/finance/journal' }],
  '/finance/journal/:id': [{ label: 'Keuangan' }, { label: 'Jurnal Umum', href: '/finance/journal' }],
  '/finance/journal/:id/edit': [{ label: 'Keuangan' }, { label: 'Jurnal Umum', href: '/finance/journal' }],
  '/finance/expenses': [{ label: 'Keuangan' }, { label: 'Pengeluaran' }],
  '/finance/expenses/new': [{ label: 'Keuangan' }, { label: 'Pengeluaran', href: '/finance/expenses' }],
  '/finance/expenses/:id': [{ label: 'Keuangan' }, { label: 'Pengeluaran', href: '/finance/expenses' }],
  '/finance/expenses/:id/edit': [{ label: 'Keuangan' }, { label: 'Pengeluaran', href: '/finance/expenses' }],
  '/finance/petty-cash': [{ label: 'Keuangan' }, { label: 'Petty Cash' }],
  '/finance/petty-cash/new': [{ label: 'Keuangan' }, { label: 'Petty Cash', href: '/finance/petty-cash' }],
  '/finance/petty-cash/:id': [{ label: 'Keuangan' }, { label: 'Petty Cash', href: '/finance/petty-cash' }],
  '/finance/ar': [{ label: 'Keuangan' }, { label: 'Accounts Receivable' }],
  '/finance/ar/:customerId': [{ label: 'Keuangan' }, { label: 'Accounts Receivable', href: '/finance/ar' }],
  '/finance/reports': [{ label: 'Keuangan' }, { label: 'Laporan Keuangan' }],

  // ── Pembelian ────────────────────────────────────────────────
  '/purchasing': [{ label: 'Pembelian' }],
  '/purchasing/suppliers': [{ label: 'Pembelian' }, { label: 'Supplier' }],
  '/purchasing/suppliers/new': [{ label: 'Pembelian' }, { label: 'Supplier', href: '/purchasing/suppliers' }],
  '/purchasing/suppliers/:id': [{ label: 'Pembelian' }, { label: 'Supplier', href: '/purchasing/suppliers' }],
  '/purchasing/suppliers/:id/edit': [{ label: 'Pembelian' }, { label: 'Supplier', href: '/purchasing/suppliers' }],
  '/purchasing/po': [{ label: 'Pembelian' }, { label: 'Purchase Order' }],
  '/purchasing/po/new': [{ label: 'Pembelian' }, { label: 'Purchase Order', href: '/purchasing/po' }],
  '/purchasing/po/:id': [{ label: 'Pembelian' }, { label: 'Purchase Order', href: '/purchasing/po' }],
  '/purchasing/po/:id/edit': [{ label: 'Pembelian' }, { label: 'Purchase Order', href: '/purchasing/po' }],
  '/purchasing/goods-receipt': [{ label: 'Pembelian' }, { label: 'Goods Receipt' }],
  '/purchasing/goods-receipt/new': [{ label: 'Pembelian' }, { label: 'Goods Receipt', href: '/purchasing/goods-receipt' }],
  '/purchasing/goods-receipt/new/:poId': [{ label: 'Pembelian' }, { label: 'Goods Receipt', href: '/purchasing/goods-receipt' }],
  '/purchasing/goods-receipt/:id': [{ label: 'Pembelian' }, { label: 'Goods Receipt', href: '/purchasing/goods-receipt' }],
  '/purchasing/gr': [{ label: 'Pembelian' }, { label: 'Goods Receipt' }],
  '/purchasing/gr/new': [{ label: 'Pembelian' }, { label: 'Goods Receipt', href: '/purchasing/gr' }],
  '/purchasing/gr/new/:poId': [{ label: 'Pembelian' }, { label: 'Goods Receipt', href: '/purchasing/gr' }],
  '/purchasing/gr/:id': [{ label: 'Pembelian' }, { label: 'Goods Receipt', href: '/purchasing/gr' }],

  // ── Karyawan ─────────────────────────────────────────────────
  '/employees': [{ label: 'Karyawan' }, { label: 'Data Karyawan' }],
  '/hr/employees': [{ label: 'Karyawan' }, { label: 'Data Karyawan' }],
  '/hr/employees/:id': [{ label: 'Karyawan' }, { label: 'Data Karyawan', href: '/hr/employees' }],
  '/hr/employees/:id/edit': [{ label: 'Karyawan' }, { label: 'Data Karyawan', href: '/hr/employees' }],
  '/hr/departments': [{ label: 'Karyawan' }, { label: 'Departemen' }],
  '/hr/attendance': [{ label: 'Karyawan' }, { label: 'Absensi' }],
  '/hr/attendance/clock': [{ label: 'Karyawan' }, { label: 'Absensi', href: '/hr/attendance' }],
  '/hr/attendance/:id': [{ label: 'Karyawan' }, { label: 'Absensi', href: '/hr/attendance' }],
  '/hr/leave': [{ label: 'Karyawan' }, { label: 'Cuti' }],
  '/hr/leave/new': [{ label: 'Karyawan' }, { label: 'Cuti', href: '/hr/leave' }],
  '/hr/leave/:id': [{ label: 'Karyawan' }, { label: 'Cuti', href: '/hr/leave' }],
  '/hr/payroll': [{ label: 'Karyawan' }, { label: 'Payroll' }],
  '/hr/payroll/calculate': [{ label: 'Karyawan' }, { label: 'Payroll', href: '/hr/payroll' }],
  '/hr/payroll/:id': [{ label: 'Karyawan' }, { label: 'Payroll', href: '/hr/payroll' }],
  '/hr/payroll/:id/payslip': [{ label: 'Karyawan' }, { label: 'Payroll', href: '/hr/payroll' }],
  '/hr/kpi': [{ label: 'Karyawan' }, { label: 'KPI' }],
  '/hr/kpi/new': [{ label: 'Karyawan' }, { label: 'KPI', href: '/hr/kpi' }],
  '/hr/kpi/:id': [{ label: 'Karyawan' }, { label: 'KPI', href: '/hr/kpi' }],

  // ── User & Role ──────────────────────────────────────────────
  '/users': [{ label: 'User & Role' }, { label: 'Users' }],
  '/users/new': [{ label: 'User & Role' }, { label: 'Users', href: '/users' }],
  '/users/:id': [{ label: 'User & Role' }, { label: 'Users', href: '/users' }],
  '/users/:id/edit': [{ label: 'User & Role' }, { label: 'Users', href: '/users' }],
  '/roles': [{ label: 'User & Role' }, { label: 'Roles' }],
  '/roles/new': [{ label: 'User & Role' }, { label: 'Roles', href: '/roles' }],
  '/roles/:id': [{ label: 'User & Role' }, { label: 'Roles', href: '/roles' }],
  '/roles/:id/edit': [{ label: 'User & Role' }, { label: 'Roles', href: '/roles' }],
  '/password-requests': [{ label: 'User & Role' }, { label: 'Password Requests' }],

  // ── Misc ─────────────────────────────────────────────────────
  '/profile': [{ label: 'Profile' }],
  '/settings': [{ label: 'Settings' }],
};

/** Most-specific-first ordering so '/inventory/opname/:id/count' beats '/inventory/opname/:id'. */
const PATTERNS = Object.keys(TRAILS).sort((a, b) => {
  const sa = a.split('/').length;
  const sb = b.split('/').length;
  if (sa !== sb) return sb - sa;
  const la = (a.match(/:/g) ?? []).length;
  const lb = (b.match(/:/g) ?? []).length;
  return la - lb;
});

function matchTrail(pathname: string): Crumb[] {
  if (TRAILS[pathname]) return TRAILS[pathname];
  const segs = pathname.split('/').filter(Boolean);
  for (const pattern of PATTERNS) {
    const pSegs = pattern.split('/').filter(Boolean);
    if (pSegs.length !== segs.length) continue;
    let ok = true;
    for (let i = 0; i < pSegs.length; i++) {
      if (pSegs[i].startsWith(':')) continue;
      if (pSegs[i] !== segs[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return TRAILS[pattern];
  }
  return [];
}

export function getBreadcrumbs(pathname: string): Crumb[] {
  return [HOME, ...matchTrail(pathname)];
}
