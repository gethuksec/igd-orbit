// ─── Permission display labels ─────────────────────────────────
// Single source of truth for human-readable names of permission keys.
// Mirrors backend PERMISSION_CATALOG (permissions.util.ts) + the FE
// permission-catalog tree. Any key not listed here falls back to a
// humanized version of the key itself.

export const PERMISSION_LABELS: Record<string, string> = {
  // Menu visibility
  'menu.dashboard': 'Menu Dashboard',
  'menu.pos': 'Menu POS',
  'menu.service': 'Menu Service',
  'menu.sales': 'Menu Sales',
  'menu.master-data': 'Menu Master Data',
  'menu.inventory': 'Menu Inventory',
  'menu.finance': 'Menu Finance',
  'menu.purchasing': 'Menu Purchasing',
  'menu.hr': 'Menu HR',
  'menu.users': 'Menu Users',
  'menu.branches': 'Menu Cabang',

  // Generic actions
  'action.view': 'Lihat Data',
  'action.pos.create': 'Tambah Transaksi POS',
  'action.pos.edit': 'Edit Transaksi POS',
  'action.service.view': 'Lihat Servis',
  'action.service.create': 'Tambah Servis',
  'action.service.edit': 'Edit Servis',
  'action.service.delete': 'Hapus Servis',
  'action.service.assign': 'Assign Servis ke Teknisi',
  'action.service.smart_repair.create': 'Buat Smart Repair',

  // Dashboard
  'dashboard.view': 'Akses Dashboard',
  'dashboard.*.view': 'Akses Dashboard (semua sub-halaman)',

  // Master data
  'master_data.customer.view': 'Lihat Pelanggan',
  'master_data.customer.create': 'Tambah Pelanggan',
  'master_data.customer.edit': 'Edit Pelanggan',
  'master_data.customer.delete': 'Hapus Pelanggan',
  'master_data.product.view': 'Lihat Produk',
  'master_data.product.create': 'Tambah Produk',
  'master_data.product.edit': 'Edit Produk',
  'master_data.product.delete': 'Hapus Produk',
  'master_data.supplier.view': 'Lihat Supplier',
  'master_data.supplier.create': 'Tambah Supplier',
  'master_data.supplier.edit': 'Edit Supplier',
  'master_data.supplier.delete': 'Hapus Supplier',
  'master_data.category.view': 'Lihat Kategori',
  'master_data.category.create': 'Tambah Kategori',
  'master_data.category.edit': 'Edit Kategori',
  'master_data.category.delete': 'Hapus Kategori',
  'master_data.brand.view': 'Lihat Brand',
  'master_data.brand.create': 'Tambah Brand',
  'master_data.brand.edit': 'Edit Brand',
  'master_data.brand.delete': 'Hapus Brand',
  'master_data.attribute.view': 'Lihat Atribut (Warna/Satuan/Ukuran/dll)',
  'master_data.attribute.create': 'Tambah Atribut',
  'master_data.attribute.edit': 'Edit Atribut',
  'master_data.attribute.delete': 'Hapus Atribut',
  'master_data.service_type.view': 'Lihat Tipe Servis',
  'master_data.service_type.create': 'Tambah Tipe Servis',
  'master_data.service_type.edit': 'Edit Tipe Servis',
  'master_data.service_type.delete': 'Hapus Tipe Servis',
  'master_data.*.view': 'Lihat Master Data (semua)',

  // Sales / POS
  'sales.history.view': 'Lihat Riwayat Penjualan',
  'sales.return.create': 'Buat Retur Penjualan',
  'sales.return.edit': 'Edit Retur Penjualan',
  'sales.pos.view': 'Lihat Halaman POS',
  'sales.pos.create': 'Tambah Transaksi POS',
  'sales.pos.edit': 'Edit Transaksi POS',
  'sales.pos.delete': 'Hapus Transaksi POS',
  'sales.returns.create': 'Buat Retur (returns)',
  'sales.*.view': 'Lihat Semua Data Sales',
  'sales.*.create': 'Tambah Semua Data Sales',

  // Service
  'service.order.view': 'Lihat Semua Service Order',
  'service.order.my': 'Lihat Service Saya',
  'service.checkpoint.view': 'Lihat Checkpoint Servis',
  'service.checkpoint.create': 'Tambah Checkpoint',
  'service.checkpoint.edit': 'Edit Checkpoint',
  'service.checkpoint.delete': 'Hapus Checkpoint',
  'service.return.create': 'Buat Retur Servis',
  'service.return.edit': 'Edit Retur Servis',
  'service.*.view': 'Lihat Semua Data Servis',

  // Inventory
  'inventory.stock.view': 'Lihat Stok',
  'inventory.stock.adjust': 'Sesuaikan Stok',
  'inventory.transfer.create': 'Buat Transfer Stok',
  'inventory.transfer.approve': 'Setujui Transfer Stok',
  'inventory.opname.create': 'Buat Stock Opname',
  'inventory.opname.approve': 'Setujui Stock Opname',
  'inventory.history.view': 'Lihat Riwayat Perpindahan',
  'inventory.alert.view': 'Lihat Peringatan Stok',
  'inventory.*.view': 'Lihat Semua Data Inventory',

  // Finance
  'finance.coa.view': 'Lihat Chart of Accounts',
  'finance.coa.create': 'Tambah COA',
  'finance.coa.edit': 'Edit COA',
  'finance.journal.create': 'Buat Jurnal Umum',
  'finance.expense.create': 'Kelola Pengeluaran',
  'finance.petty_cash.create': 'Kelola Petty Cash',
  'finance.ar.create': 'Kelola Piutang (AR)',
  'finance.report.view': 'Lihat Laporan Keuangan',
  'finance.*.view': 'Lihat Semua Data Keuangan',

  // Purchasing
  'purchasing.supplier.view': 'Lihat Supplier (Pembelian)',
  'purchasing.supplier.create': 'Tambah Supplier (Pembelian)',
  'purchasing.supplier.edit': 'Edit Supplier (Pembelian)',
  'purchasing.po.create': 'Buat Purchase Order',
  'purchasing.po.approve': 'Setujui Purchase Order',
  'purchasing.po.receive': 'Terima Barang (Goods Receipt)',
  'purchasing.*.view': 'Lihat Semua Data Pembelian',

  // HR
  'hr.employee.view': 'Lihat Karyawan',
  'hr.employee.create': 'Tambah Karyawan',
  'hr.employee.edit': 'Edit Karyawan',
  'hr.employee.deactivate': 'Nonaktifkan Karyawan',
  'hr.attendance.view': 'Lihat Absensi',
  'hr.leave.approve': 'Setujui Cuti',
  'hr.payroll.view': 'Lihat Payroll',
  'hr.kpi.create': 'Kelola KPI',
  'hr.*.view': 'Lihat Semua Data HR',

  // Users / Roles / Branches
  'users.user.view': 'Lihat User',
  'users.user.create': 'Tambah User',
  'users.user.edit': 'Edit User',
  'users.user.deactivate': 'Nonaktifkan User',
  'users.password.approve': 'Setujui Request Password',
  'roles.role.view': 'Lihat Role',
  'roles.role.create': 'Tambah Role',
  'roles.role.edit': 'Edit Role',
  'roles.role.delete': 'Hapus Role',
  'users.*.view': 'Lihat Semua Data User',
  'roles.*.view': 'Lihat Semua Data Role',
  'branch.view': 'Lihat Cabang',
};

/**
 * Static list of every key in the backend PERMISSION_CATALOG
 * (backend/src/shared/utils/permissions.util.ts). Used for totals on
 * the permission page. Keep in sync when the BE catalog changes.
 */
export const PERMISSION_CATALOG_KEYS: string[] = Object.keys(PERMISSION_LABELS);

/** Fallback: turn a key into a readable-ish string. */
export function humanizePermissionKey(key: string): string {
  return key
    .replace(/\.\*/g, ' (semua)')
    .replace(/[._]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Display name for a permission key (fallback: humanized key). */
export function labelForPermission(key: string): string {
  return PERMISSION_LABELS[key] || humanizePermissionKey(key);
}

/** Module group for a permission key (permission page grouping). */
export function groupForPermission(key: string): string {
  if (key.startsWith('menu.')) return 'Menu & Navigasi';
  if (key.startsWith('master_data.') || key.startsWith('branch.')) return 'Master Data';
  if (key.startsWith('dashboard.')) return 'Dashboard';
  if (key.startsWith('sales.') || key.startsWith('action.pos')) return 'Penjualan / POS';
  if (key.startsWith('service.') || key.startsWith('action.service')) return 'Servis';
  if (key.startsWith('inventory.')) return 'Inventory';
  if (key.startsWith('finance.')) return 'Keuangan';
  if (key.startsWith('purchasing.')) return 'Pembelian';
  if (key.startsWith('hr.')) return 'Karyawan / HR';
  if (key.startsWith('users.') || key.startsWith('roles.')) return 'User & Role';
  if (key.startsWith('action.')) return 'Aksi Umum';
  return 'Lainnya';
}

export const PERMISSION_GROUP_ORDER = [
  'Dashboard',
  'Master Data',
  'Penjualan / POS',
  'Servis',
  'Inventory',
  'Keuangan',
  'Pembelian',
  'Karyawan / HR',
  'User & Role',
  'Menu & Navigasi',
  'Aksi Umum',
  'Lainnya',
];
