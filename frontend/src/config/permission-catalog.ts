// ─── Permission Catalog ───────────────────────────────────
// Sidebar tree structure matching DashboardLayout menus
// Each leaf has a `key` that maps to a real permission string.
// Items that share a key with other items are controlled by that shared key.
// Future: add field-level layer (Level 4) under relevant actions.

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
        label: 'Pelanggan',
        children: [
          { label: 'Lihat', key: 'master_data.customer.view' },
          { label: 'Tambah', key: 'master_data.customer.create' },
          { label: 'Edit', key: 'master_data.customer.edit' },
          { label: 'Hapus', key: 'master_data.customer.delete' },
        ],
      },
      {
        label: 'Produk',
        children: [
          { label: 'Lihat', key: 'master_data.product.view' },
          { label: 'Tambah', key: 'master_data.product.create' },
          { label: 'Edit', key: 'master_data.product.edit' },
          { label: 'Hapus', key: 'master_data.product.delete' },
        ],
      },
      {
        label: 'Supplier',
        children: [
          { label: 'Lihat', key: 'master_data.supplier.view' },
          { label: 'Tambah', key: 'master_data.supplier.create' },
          { label: 'Edit', key: 'master_data.supplier.edit' },
          { label: 'Hapus', key: 'master_data.supplier.delete' },
        ],
      },
      {
        label: 'Kategori',
        children: [
          { label: 'Lihat', key: 'master_data.category.view' },
          { label: 'Tambah', key: 'master_data.category.create' },
          { label: 'Edit', key: 'master_data.category.edit' },
          { label: 'Hapus', key: 'master_data.category.delete' },
        ],
      },
      {
        label: 'Brand',
        children: [
          { label: 'Lihat', key: 'master_data.brand.view' },
          { label: 'Tambah', key: 'master_data.brand.create' },
          { label: 'Edit', key: 'master_data.brand.edit' },
          { label: 'Hapus', key: 'master_data.brand.delete' },
        ],
      },
      // Each of these shares master_data.attribute.* permissions
      {
        label: 'Warna',
        children: [
          { label: 'Lihat', key: 'master_data.attribute.view' },
          { label: 'Tambah', key: 'master_data.attribute.create' },
          { label: 'Edit', key: 'master_data.attribute.edit' },
          { label: 'Hapus', key: 'master_data.attribute.delete' },
        ],
      },
      {
        label: 'Satuan',
        children: [
          { label: 'Lihat', key: 'master_data.attribute.view' },
          { label: 'Tambah', key: 'master_data.attribute.create' },
          { label: 'Edit', key: 'master_data.attribute.edit' },
          { label: 'Hapus', key: 'master_data.attribute.delete' },
        ],
      },
      {
        label: 'Ukuran',
        children: [
          { label: 'Lihat', key: 'master_data.attribute.view' },
          { label: 'Tambah', key: 'master_data.attribute.create' },
          { label: 'Edit', key: 'master_data.attribute.edit' },
          { label: 'Hapus', key: 'master_data.attribute.delete' },
        ],
      },
      {
        label: 'Ekspedisi',
        children: [
          { label: 'Lihat', key: 'master_data.attribute.view' },
          { label: 'Tambah', key: 'master_data.attribute.create' },
          { label: 'Edit', key: 'master_data.attribute.edit' },
          { label: 'Hapus', key: 'master_data.attribute.delete' },
        ],
      },
      {
        label: 'Tipe Penjualan',
        children: [
          { label: 'Lihat', key: 'master_data.attribute.view' },
          { label: 'Tambah', key: 'master_data.attribute.create' },
          { label: 'Edit', key: 'master_data.attribute.edit' },
          { label: 'Hapus', key: 'master_data.attribute.delete' },
        ],
      },
      {
        label: 'Termin Pembayaran',
        children: [
          { label: 'Lihat', key: 'master_data.attribute.view' },
          { label: 'Tambah', key: 'master_data.attribute.create' },
          { label: 'Edit', key: 'master_data.attribute.edit' },
          { label: 'Hapus', key: 'master_data.attribute.delete' },
        ],
      },
      {
        label: 'Customer Tiers',
        children: [
          { label: 'Lihat', key: 'master_data.attribute.view' },
          { label: 'Tambah', key: 'master_data.attribute.create' },
          { label: 'Edit', key: 'master_data.attribute.edit' },
          { label: 'Hapus', key: 'master_data.attribute.delete' },
        ],
      },
      {
        label: 'Layanan',
        children: [
          { label: 'Lihat', key: 'master_data.service_type.view' },
          { label: 'Tambah', key: 'master_data.service_type.create' },
          { label: 'Edit', key: 'master_data.service_type.edit' },
          { label: 'Hapus', key: 'master_data.service_type.delete' },
        ],
      },
      {
        label: 'Kelengkapan',
        children: [
          { label: 'Lihat', key: 'service.checkpoint.view' },
          { label: 'Tambah', key: 'service.checkpoint.create' },
          { label: 'Edit', key: 'service.checkpoint.edit' },
          { label: 'Hapus', key: 'service.checkpoint.delete' },
        ],
      },
    ],
  },

  // ── Penjualan ──
  {
    label: 'Penjualan',
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
          { label: 'Buat Retur', key: 'sales.return.create' },
          { label: 'Edit Retur', key: 'sales.return.edit' },
        ],
      },
    ],
  },

  // ── Servis ──
  {
    label: 'Servis',
    children: [
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
        label: 'Smart Repair',
        children: [
          { label: 'Buat Smart Repair', key: 'action.service.smart_repair.create' },
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

  // ── Gudang ──
  {
    label: 'Gudang',
    children: [
      {
        label: 'Stok',
        children: [
          { label: 'Lihat Stok', key: 'inventory.stock.view' },
          { label: 'Sesuaikan Stok', key: 'inventory.stock.adjust' },
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
        label: 'Stock Opname',
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
        label: 'Riwayat Perpindahan',
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

  // ── Keuangan ──
  {
    label: 'Keuangan',
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
        label: 'Jurnal Umum',
        children: [
          { label: 'Buat Jurnal', key: 'finance.journal.create' },
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
        label: 'Accounts Receivable',
        children: [
          { label: 'Kelola Piutang', key: 'finance.ar.create' },
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

  // ── Pembelian ──
  {
    label: 'Pembelian',
    children: [
      {
        label: 'Supplier',
        children: [
          { label: 'Lihat', key: 'purchasing.supplier.view' },
          { label: 'Tambah', key: 'purchasing.supplier.create' },
          { label: 'Edit', key: 'purchasing.supplier.edit' },
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
    ],
  },

  // ── Karyawan ──
  {
    label: 'Karyawan',
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
        label: 'Departemen',
        children: [
          { label: 'Lihat', key: 'hr.employee.view' },
          { label: 'Tambah', key: 'hr.employee.create' },
          { label: 'Edit', key: 'hr.employee.edit' },
        ],
      },
      {
        label: 'Absensi',
        children: [
          { label: 'Lihat Absensi', key: 'hr.attendance.view' },
        ],
      },
      {
        label: 'Cuti',
        children: [
          { label: 'Setujui Cuti', key: 'hr.leave.approve' },
        ],
      },
      {
        label: 'Payroll',
        children: [
          { label: 'Lihat Payroll', key: 'hr.payroll.view' },
        ],
      },
      {
        label: 'KPI',
        children: [
          { label: 'Kelola KPI', key: 'hr.kpi.create' },
        ],
      },
    ],
  },

  // ── Cabang (outlet) ──
  {
    label: 'Cabang',
    children: [
      { label: 'Lihat Cabang', key: 'branch.view' },
    ],
  },

  // ── User & Role ──
  {
    label: 'User & Role',
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
        label: 'Password Requests',
        children: [
          { label: 'Setujui Request', key: 'users.password.approve' },
        ],
      },
    ],
  },
];
