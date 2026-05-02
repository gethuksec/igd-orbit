import { useState, useEffect } from 'react';
import { Check, ChevronDown, ChevronRight, LayoutDashboard, Package, ShoppingCart, Wrench, Warehouse, DollarSign, FileText, UserCog, Store, Shield } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rolesService } from '../../../services/roles.service';
import { toast } from 'sonner';

interface MenuItem {
  key: string;
  label: string;
  path?: string;
  icon?: any;
  children?: MenuItem[];
}

// Menu structure matching DashboardLayout
const MENU_STRUCTURE: MenuItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    key: 'master_data',
    label: 'Master Data',
    icon: Package,
    children: [
      { key: 'master_data.customers', label: 'Pelanggan', path: '/customers' },
      { key: 'master_data.products', label: 'Produk', path: '/products' },
      { key: 'master_data.suppliers', label: 'Supplier', path: '/suppliers' },
      { key: 'master_data.categories', label: 'Kategori', path: '/categories' },
      { key: 'master_data.brands', label: 'Brand', path: '/brands' },
      { key: 'master_data.service_types', label: 'Layanan', path: '/service-types' },
    ],
  },
  {
    key: 'sales',
    label: 'Penjualan',
    icon: ShoppingCart,
    children: [
      { key: 'sales.pos', label: 'POS', path: '/sales/pos' },
      { key: 'sales.history', label: 'Riwayat Penjualan', path: '/sales/history' },
      { key: 'sales.returns', label: 'Retur Penjualan', path: '/sales/returns' },
    ],
  },
  {
    key: 'service',
    label: 'Servis',
    icon: Wrench,
    children: [
      { key: 'service.orders', label: 'Semua Service Order', path: '/service-orders' },
      { key: 'service.my_orders', label: 'Service Saya', path: '/service-orders/my' },
      { key: 'service.new', label: 'Tambah Service', path: '/service-orders/new' },
      { key: 'service.returns', label: 'Retur & Komplain', path: '/service-returns' },
    ],
  },
  {
    key: 'inventory',
    label: 'Gudang',
    icon: Warehouse,
    children: [
      { key: 'inventory.stock', label: 'Stok', path: '/inventory/stock' },
      { key: 'inventory.transfer', label: 'Transfer Stok', path: '/inventory/transfer' },
      { key: 'inventory.opname', label: 'Stock Opname', path: '/inventory/opname' },
      { key: 'inventory.adjustment', label: 'Stock Adjustment', path: '/inventory/adjustment' },
      { key: 'inventory.movements', label: 'Riwayat Perpindahan', path: '/inventory/movements' },
      { key: 'inventory.alerts', label: 'Peringatan Stok Rendah', path: '/inventory/alerts' },
    ],
  },
  {
    key: 'finance',
    label: 'Keuangan',
    icon: DollarSign,
    children: [
      { key: 'finance.coa', label: 'Chart of Accounts', path: '/finance/coa' },
      { key: 'finance.journal', label: 'Jurnal Umum', path: '/finance/journal' },
      { key: 'finance.expenses', label: 'Pengeluaran', path: '/finance/expenses' },
      { key: 'finance.petty_cash', label: 'Petty Cash', path: '/finance/petty-cash' },
      { key: 'finance.ar', label: 'Accounts Receivable', path: '/finance/ar' },
      { key: 'finance.reports', label: 'Laporan Keuangan', path: '/finance/reports' },
    ],
  },
  {
    key: 'purchasing',
    label: 'Pembelian',
    icon: FileText,
    children: [
      { key: 'purchasing.suppliers', label: 'Supplier', path: '/purchasing/suppliers' },
      { key: 'purchasing.po', label: 'Purchase Order', path: '/purchasing/po' },
      { key: 'purchasing.goods_receipt', label: 'Goods Receipt', path: '/purchasing/goods-receipt' },
    ],
  },
  {
    key: 'hr',
    label: 'Karyawan',
    icon: UserCog,
    children: [
      { key: 'hr.employees', label: 'Data Karyawan', path: '/hr/employees' },
      { key: 'hr.attendance', label: 'Absensi', path: '/hr/attendance' },
      { key: 'hr.leave', label: 'Cuti', path: '/hr/leave' },
      { key: 'hr.payroll', label: 'Payroll', path: '/hr/payroll' },
      { key: 'hr.kpi', label: 'KPI', path: '/hr/kpi' },
    ],
  },
  {
    key: 'branches',
    label: 'Cabang',
    path: '/branches',
    icon: Store,
  },
  {
    key: 'users_roles',
    label: 'User & Role',
    icon: Shield,
    children: [
      { key: 'users_roles.users', label: 'Users', path: '/users' },
      { key: 'users_roles.roles', label: 'Roles', path: '/roles' },
    ],
  },
];

interface MenuAccessSelectorProps {
  roleId: string;
}

export function MenuAccessSelector({ roleId }: MenuAccessSelectorProps) {
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [selectedMenus, setSelectedMenus] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Fetch current menu access for this role
  const { data: menuAccessData, isLoading } = useQuery({
    queryKey: ['role-menu-access', roleId],
    queryFn: async () => {
      const menus = await rolesService.getMenuAccess(roleId);
      return { menus };
    },
    enabled: !!roleId,
  });

  useEffect(() => {
    if (menuAccessData?.menus) {
      setSelectedMenus(new Set(menuAccessData.menus.map((m: any) => m.menuKey)));
    }
  }, [menuAccessData]);

  const saveMutation = useMutation({
    mutationFn: async (menuKeys: string[]) => {
      await rolesService.updateMenuAccess(roleId, menuKeys);
      return { success: true };
    },
    onSuccess: () => {
      toast.success('Menu access berhasil disimpan');
      queryClient.invalidateQueries({ queryKey: ['role-menu-access', roleId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyimpan menu access');
    },
  });

  const toggleMenu = (menuKey: string) => {
    setSelectedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(menuKey)) {
        next.delete(menuKey);
        // Also uncheck all children
        const menu = findMenuByKey(menuKey);
        if (menu?.children) {
          menu.children.forEach((child) => next.delete(child.key));
        }
      } else {
        next.add(menuKey);
        // Also check all children
        const menu = findMenuByKey(menuKey);
        if (menu?.children) {
          menu.children.forEach((child) => next.add(child.key));
        }
      }
      return next;
    });
  };

  const toggleExpand = (menuKey: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(menuKey)) {
        next.delete(menuKey);
      } else {
        next.add(menuKey);
      }
      return next;
    });
  };

  const findMenuByKey = (key: string): MenuItem | undefined => {
    for (const menu of MENU_STRUCTURE) {
      if (menu.key === key) return menu;
      if (menu.children) {
        const found = menu.children.find((child) => child.key === key);
        if (found) return found;
      }
    }
    return undefined;
  };

  const isParentIndeterminate = (menu: MenuItem): boolean => {
    if (!menu.children) return false;
    const checkedCount = menu.children.filter((child) => selectedMenus.has(child.key)).length;
    return checkedCount > 0 && checkedCount < menu.children.length;
  };

  const handleSave = () => {
    saveMutation.mutate(Array.from(selectedMenus));
  };

  const renderMenu = (menu: MenuItem, depth: number = 0) => {
    const hasChildren = menu.children && menu.children.length > 0;
    const isExpanded = expandedMenus.has(menu.key);
    const isChecked = selectedMenus.has(menu.key);
    const isIndeterminate = isParentIndeterminate(menu);
    const Icon = menu.icon;

    return (
      <div key={menu.key} className="select-none">
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors ${
            !isChecked && !isIndeterminate ? 'opacity-60' : ''
          }`}
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(menu.key)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}
          <button
            onClick={() => toggleMenu(menu.key)}
            className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${
              isChecked || isIndeterminate
                ? 'bg-primary-600 border-primary-600 text-white'
                : 'border-gray-300 bg-white'
            }`}
          >
            {isChecked && <Check className="w-3 h-3" />}
            {isIndeterminate && <div className="w-2 h-2 bg-white rounded" />}
          </button>
          {Icon && <Icon className="w-4 h-4 text-gray-600" />}
          <span className="flex-1 text-sm font-medium text-gray-700">{menu.label}</span>
          {menu.path && (
            <span className="text-xs text-gray-400 font-mono">{menu.path}</span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="ml-6 border-l-2 border-gray-200">
            {menu.children!.map((child) => renderMenu(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading menu access...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4 max-h-96 overflow-y-auto">
        <div className="space-y-1">
          {MENU_STRUCTURE.map((menu) => renderMenu(menu))}
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveMutation.isPending ? 'Menyimpan...' : 'Simpan Menu Access'}
        </button>
      </div>
    </div>
  );
}

