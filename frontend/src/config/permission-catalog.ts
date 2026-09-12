// ─── Permission Catalog ───────────────────────────────────
// Sidebar tree structure matching DashboardLayout menus
// Each leaf has a `key` that maps to a real permission string.
// Items that share a key with other items are controlled by that shared key.
// Future: add field-level layer (Level 4) under relevant actions.
//
// Restructured 2026-08-22 per client sidebar reference:
//   Dashboard | Master Data | Expense | Quotation | Service | Inventory
//   | Finance | Staff | Report | Administrator
// New modules behind placeholder pages reuse existing module keys so they
// are visible to roles that already hold the module wildcard.

import type { PermissionNode } from '@/types/permission';

export const PERMISSION_CATALOG: PermissionNode[] = [
  // ── Dashboard ──
  {
    label: 'Dashboard',
    children: [
      {
        label: 'Dashboard',
        children: [
          { label: 'Akses Dashboard', key: 'dashboard.view' },
        ],
      },
    ],
  },

  // ── Master Data ──
  {
    label: 'Master Data',
    children: [
      {
        label: 'Customer',
        children: [
          { label: 'Pelanggan', key: 'master_data.customer.view' },
          { label: 'Tipe Customer', key: 'master_data.attribute.view' },
          { label: 'Level', key: 'master_data.attribute.view' },
          { label: 'Termin', key: 'master_data.attribute.view' },
        ],
      },
      {
        label: 'Product',
        children: [
          { label: 'Produk', key: 'master_data.product.view' },
          { label: 'Kategori', key: 'master_data.category.view' },
          { label: 'Merek', key: 'master_data.brand.view' },
          { label: 'Warna', key: 'master_data.attribute.view' },
          { label: 'Satuan', key: 'master_data.attribute.view' },
          { label: 'Ukuran', key: 'master_data.attribute.view' },
        ],
      },
      {
        label: 'Logistik',
        children: [
          { label: 'Supplier', key: 'master_data.supplier.view' },
          { label: 'Ekspedisi', key: 'master_data.attribute.view' },
        ],
      },
      {
        label: 'Outlet',
        children: [
          { label: 'Lihat Outlet', key: 'master_data.branch.view' },
        ],
      },
      {
        label: 'Gudang',
        children: [
          { label: 'Lihat Gudang', key: 'master_data.warehouse.view' },
        ],
      },
      {
        label: 'Servis',
        children: [
          { label: 'Layanan', key: 'master_data.service_type.view' },
          { label: 'Kelengkapan', key: 'service.checkpoint.view' },
        ],
      },
    ],
  },

  // ── Expense (was Pembelian) ──
  {
    label: 'Expense',
    children: [
      {
        label: 'Faktur',
        children: [
          { label: 'Kelola Faktur', key: 'purchasing.invoice.view' },
        ],
      },
      {
        label: 'Purchase Order',
        children: [
          { label: 'Buat PO', key: 'purchasing.po.create' },
          { label: 'Setujui PO', key: 'purchasing.po.approve' },
          { label: 'Terima Barang', key: 'purchasing.po.receive' },
        ],
      },
      {
        label: 'Goods Receipt',
        children: [
          { label: 'Terima Barang', key: 'purchasing.po.receive' },
        ],
      },
      {
        label: 'Retur',
        children: [
          { label: 'Buat Retur', key: 'purchasing.return.view' },
        ],
      },
      {
        label: 'Supplier',
        children: [
          { label: 'Lihat', key: 'purchasing.supplier.view' },
          { label: 'Tambah', key: 'purchasing.supplier.create' },
          { label: 'Edit', key: 'purchasing.supplier.edit' },
        ],
      },
    ],
  },

  // ── Quotation (was Penjualan) ──
  {
    label: 'Quotation',
    children: [
      {
        label: 'POS',
        children: [
          { label: 'Buat Transaksi', key: 'action.pos.create' },
          { label: 'Edit Transaksi', key: 'action.pos.edit' },
        ],
      },
      {
        label: 'Riwayat Penjualan',
        children: [
          { label: 'Lihat Riwayat', key: 'sales.history.view' },
        ],
      },
      {
        label: 'Retur Penjualan',
        children: [
          { label: 'Lihat Daftar Retur', key: 'sales.retur.view' },
          { label: 'Buat Retur', key: 'sales.retur.create' },
        ],
      },
    ],
  },

  // ── Service (was Servis) ──
  {
    label: 'Service',
    children: [
      {
        label: 'Smart Repair',
        children: [
          { label: 'Buat Smart Repair', key: 'action.service.smart_repair.create' },
          { label: 'Ubah Harga Service', key: 'service.price.edit' }, // IGDERP-187: price override (tier auto-fill is default)
        ],
      },
      {
        label: 'Semua Service Order',
        children: [
          { label: 'Lihat Semua', key: 'service.order.view' },
        ],
      },
      {
        label: 'Service Saya',
        children: [
          { label: 'Lihat Tugas Saya', key: 'service.order.my' },
        ],
      },
      {
        label: 'Tambah Service',
        children: [
          { label: 'Buat Service', key: 'action.service.create' },
        ],
      },
      {
        label: 'Retur & Komplain',
        children: [
          { label: 'Buat Retur', key: 'service.return.create' },
          { label: 'Edit Retur', key: 'service.return.edit' },
        ],
      },
    ],
  },

  // ── Inventory (was Gudang) ──
  {
    label: 'Inventory',
    children: [
      {
        label: 'Stok',
        children: [
          { label: 'Lihat Stok', key: 'inventory.stock.view' },
          { label: 'Sesuaikan Stok', key: 'inventory.stock.adjust' },
        ],
      },
      {
        label: 'Request',
        children: [
          { label: 'Buat Request', key: 'inventory.request.view' },
          { label: 'Setujui Request', key: 'inventory.request.approve' },
        ],
      },
      {
        label: 'Stok Masuk',
        children: [
          { label: 'Buat Stok Masuk', key: 'inventory.stock_in.create' },
        ],
      },
      {
        label: 'Stok Keluar',
        children: [
          { label: 'Buat Stok Keluar', key: 'inventory.stock_out.create' },
        ],
      },
      {
        label: 'Transfer Stok',
        children: [
          { label: 'Buat Transfer', key: 'inventory.transfer.create' },
          { label: 'Setujui Transfer', key: 'inventory.transfer.approve' },
        ],
      },
      {
        label: 'Mutasi Stok',
        children: [
          { label: 'Buat Mutasi', key: 'inventory.mutasi.create' },
        ],
      },
      {
        label: 'Opname',
        children: [
          { label: 'Buat Opname', key: 'inventory.opname.create' },
          { label: 'Setujui Opname', key: 'inventory.opname.approve' },
        ],
      },
      {
        label: 'Stock Adjustment',
        children: [
          { label: 'Sesuaikan Stok', key: 'inventory.stock.adjust' },
        ],
      },
      {
        label: 'Aktivitas Produk',
        children: [
          { label: 'Lihat Riwayat', key: 'inventory.history.view' },
        ],
      },
      {
        label: 'Peringatan Stok Rendah',
        children: [
          { label: 'Lihat Peringatan', key: 'inventory.alert.view' },
        ],
      },
    ],
  },

  // ── Finance (was Keuangan) ──
  {
    label: 'Finance',
    children: [
      {
        label: 'Chart of Accounts',
        children: [
          { label: 'Lihat', key: 'finance.coa.view' },
          { label: 'Tambah', key: 'finance.coa.create' },
          { label: 'Edit', key: 'finance.coa.edit' },
        ],
      },
      {
        label: 'Mutasi',
        children: [
          { label: 'Buat Jurnal', key: 'finance.journal.create' },
        ],
      },
      {
        label: 'Hutang',
        children: [
          { label: 'Kelola Hutang', key: 'finance.ap.view' },
        ],
      },
      {
        label: 'Piutang',
        children: [
          { label: 'Kelola Piutang', key: 'finance.ar.create' },
        ],
      },
      {
        label: 'Aset',
        children: [
          { label: 'Kelola Aset', key: 'finance.asset.view' },
        ],
      },
      {
        label: 'Prive',
        children: [
          { label: 'Kelola Prive', key: 'finance.prive.view' },
        ],
      },
      {
        label: 'Pengeluaran',
        children: [
          { label: 'Kelola Pengeluaran', key: 'finance.expense.create' },
        ],
      },
      {
        label: 'Petty Cash',
        children: [
          { label: 'Kelola Petty Cash', key: 'finance.petty_cash.create' },
        ],
      },
      {
        label: 'Laporan Keuangan',
        children: [
          { label: 'Lihat Laporan', key: 'finance.report.view' },
        ],
      },
    ],
  },

  // ── Staff (was Karyawan) ──
  {
    label: 'Staff',
    children: [
      {
        label: 'Data Karyawan',
        children: [
          { label: 'Lihat', key: 'hr.employee.view' },
          { label: 'Tambah', key: 'hr.employee.create' },
          { label: 'Edit', key: 'hr.employee.edit' },
          { label: 'Nonaktifkan', key: 'hr.employee.deactivate' },
        ],
      },
      {
        label: 'Presensi',
        children: [
          { label: 'Lihat Absensi', key: 'hr.attendance.view' },
        ],
      },
      {
        label: 'Kasbon',
        children: [
          { label: 'Kelola Kasbon', key: 'hr.kasbon.view' },
        ],
      },
      {
        label: 'Departemen',
        children: [
          { label: 'Lihat', key: 'hr.employee.view' },
          { label: 'Tambah', key: 'hr.employee.create' },
          { label: 'Edit', key: 'hr.employee.edit' },
        ],
      },
      {
        label: 'Divisi',
        children: [
          { label: 'Lihat Divisi', key: 'hr.division.view' },
        ],
      },
      {
        label: 'Cuti',
        children: [
          { label: 'Setujui Cuti', key: 'hr.leave.approve' },
        ],
      },
      {
        label: 'KPI',
        children: [
          { label: 'Kelola KPI', key: 'hr.kpi.create' },
        ],
      },
      {
        label: 'Payroll',
        children: [
          { label: 'Lihat Payroll', key: 'hr.payroll.view' },
        ],
      },
    ],
  },

  // ── Report (new) ──
  {
    label: 'Report',
    children: [
      {
        label: 'Expense',
        children: [{ label: 'Lihat Laporan', key: 'finance.report.view' }],
      },
      {
        label: 'Quotation',
        children: [{ label: 'Lihat Laporan', key: 'sales.history.view' }],
      },
      {
        label: 'Service',
        children: [{ label: 'Lihat Laporan', key: 'service.order.view' }],
      },
      {
        label: 'Inventory',
        children: [{ label: 'Lihat Laporan', key: 'inventory.stock.view' }],
      },
      {
        label: 'Staff',
        children: [{ label: 'Lihat Laporan', key: 'hr.employee.view' }],
      },
      {
        label: 'Outlet',
        children: [{ label: 'Lihat Laporan', key: 'master_data.branch.view' }],
      },
    ],
  },

  // ── Administrator (was User & Role) ──
  {
    label: 'Administrator',
    children: [
      {
        label: 'Users',
        children: [
          { label: 'Lihat Users', key: 'users.user.view' },
          { label: 'Tambah User', key: 'users.user.create' },
          { label: 'Edit User', key: 'users.user.edit' },
          { label: 'Nonaktifkan User', key: 'users.user.deactivate' },
        ],
      },
      {
        label: 'Roles',
        children: [
          { label: 'Lihat Role', key: 'roles.role.view' },
          { label: 'Tambah Role', key: 'roles.role.create' },
          { label: 'Edit Role', key: 'roles.role.edit' },
          { label: 'Hapus Role', key: 'roles.role.delete' },
        ],
      },
      {
        label: 'Approval',
        children: [
          { label: 'Kelola Approval', key: 'roles.role.view' },
        ],
      },
      {
        label: 'General',
        children: [
          { label: 'Kelola Pengaturan', key: 'users.user.view' },
        ],
      },
      {
        label: 'Sync',
        children: [
          { label: 'WhatsApp', key: 'users.user.view' },
          { label: 'Marketplace', key: 'users.user.view' },
          { label: 'Website', key: 'users.user.view' },
          { label: 'Platform', key: 'users.user.view' },
        ],
      },
      {
        label: 'Password Requests',
        children: [
          { label: 'Setujui Request', key: 'users.password.approve' },
        ],
      },
    ],
  },
];
