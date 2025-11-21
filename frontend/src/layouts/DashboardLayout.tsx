import { useState, useEffect, type ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  Warehouse,
  ShoppingCart,
  Wrench,
  Bell,
  Search,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  LogOut,
  Settings,
  User,
  UserCog,
  Shield,
  DollarSign,
  FileText,
  CreditCard,
  Receipt,
  Building2,
  Tag,
  Award,
  Store,
  Boxes,
  ArrowRightLeft,
  ClipboardCheck,
  PackageSearch,
  Truck,
  ReceiptText,
  Wallet,
  BarChart3,
  Clock,
  CalendarDays,
  Banknote,
  Target,
  Plus,
  RotateCcw,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import type { Branch } from '@/services/public.service';
import { publicService } from '@/services/public.service';
import { useBranchStore } from '@/stores/branchStore';

interface DashboardLayoutProps {
  children: ReactNode;
}

// Get user from localStorage or auth store
const getUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) return JSON.parse(userStr);
  } catch {
    // Ignore
  }
  return { fullName: 'Admin', role: { name: 'Administrator', code: 'ADMIN' } };
};

const SIDEBAR_WIDTH = 280;

interface MenuItem {
  icon: any;
  label: string;
  path?: string;
  roles: string[]; // allowed role codes, '*' = all
  children?: MenuItem[];
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    masterData: true,
    sales: true,
    service: true,
    inventory: true,
    finance: true,
    purchasing: true,
    hr: true,
  });
  const user = getUser();
  const { availableBranches, currentBranchId, setBranches, setCurrentBranchId } = useBranchStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      // Auto-close sidebar on mobile
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Load branches based on user access
  useEffect(() => {
    const loadBranches = async () => {
      try {
        // Use public branches endpoint so dropdown tetap muncul walau endpoint private belum siap
        const data = await publicService.getBranches();
        let branches: Branch[] = data || [];

        // If user has specific branchIds, filter to allowed branches only.
        // Fallback: jika hasil filter kosong (mungkin mismatch id/code), pakai semua cabang.
        if (user?.branchIds && Array.isArray(user.branchIds) && user.branchIds.length > 0) {
          const filtered = branches.filter((b: Branch) => user.branchIds.includes(b.id));
          branches = filtered.length > 0 ? filtered : branches;
        }

        setBranches(branches);

        // Default selection: jika hanya satu cabang → pilih cabang itu, jika lebih dari satu → semua cabang (null)
        if (branches.length === 1) {
          setCurrentBranchId(branches[0].id);
        } else if (branches.length > 1) {
          setCurrentBranchId(null);
        }
      } catch (error) {
        console.error('Failed to load branches:', error);
      }
    };

    loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Menu structure with submenus based on PRD
  const allMenuItems: MenuItem[] = [
    {
      icon: LayoutDashboard,
      label: 'Dashboard',
      path: '/dashboard',
      roles: ['OWNER', 'CFO', 'MGR'],
    },
    {
      icon: Package,
      label: 'Master Data',
      roles: ['OWNER', 'CFO', 'MGR', 'CS'],
      children: [
        { icon: Users, label: 'Pelanggan', path: '/customers', roles: ['OWNER', 'CFO', 'MGR', 'CS'] },
        { icon: Package, label: 'Produk', path: '/products', roles: ['OWNER', 'CFO', 'MGR'] },
        { icon: Building2, label: 'Supplier', path: '/suppliers', roles: ['OWNER', 'CFO', 'MGR'] },
        { icon: Tag, label: 'Kategori', path: '/categories', roles: ['OWNER', 'CFO', 'MGR'] },
        { icon: Award, label: 'Brand', path: '/brands', roles: ['OWNER', 'CFO', 'MGR'] },
        { icon: Wrench, label: 'Layanan', path: '/service-types', roles: ['OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS'] },
      ],
    },
    {
      icon: ShoppingCart,
      label: 'Penjualan',
      // POS & sales pages: kasir dan tim frontliner (CS, CR, HS, SPV) + manajemen
      roles: ['OWNER', 'CFO', 'MGR', 'CS', 'CR', 'HS', 'SPV'],
      children: [
        {
          icon: ShoppingCart,
          label: 'POS',
          path: '/sales/pos',
          roles: ['OWNER', 'CFO', 'MGR', 'CS', 'CR', 'HS', 'SPV'],
        },
        {
          icon: Receipt,
          label: 'Riwayat Penjualan',
          path: '/sales/history',
          roles: ['OWNER', 'CFO', 'MGR', 'CS', 'CR', 'HS', 'SPV'],
        },
        {
          icon: ArrowRightLeft,
          label: 'Retur Penjualan',
          path: '/sales/returns',
          roles: ['OWNER', 'CFO', 'MGR', 'HS', 'SPV'],
        },
      ],
    },
    {
      icon: Wrench,
      label: 'Servis',
      // CS: create/update service order; TC/HS/SPV: manage assigned services; OWNER/MGR: overview
      roles: ['OWNER', 'MGR', 'CS', 'TC', 'HS', 'SPV'],
      children: [
        {
          icon: Wrench,
          label: 'Semua Service Order',
          path: '/service-orders',
          roles: ['OWNER', 'MGR', 'CS', 'HS', 'SPV'],
        },
        {
          icon: UserCog,
          label: 'Service Saya',
          path: '/service-orders/my',
          roles: ['TC', 'HS', 'SPV'],
        },
        {
          icon: Plus,
          label: 'Tambah Service',
          path: '/service-orders/new',
          roles: ['OWNER', 'MGR', 'CS'],
        },
        {
          icon: RotateCcw,
          label: 'Retur & Komplain',
          path: '/service-returns',
          roles: ['OWNER', 'MGR', 'CS', 'CR', 'HS', 'SPV', 'CMO', 'CSO'],
        },
      ],
    },
    {
      icon: Warehouse,
      label: 'Gudang',
      roles: ['OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'ASA', 'SODO'],
      children: [
        { icon: Boxes, label: 'Stok', path: '/inventory/stock', roles: ['OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'ASA', 'SODO'] },
        { icon: ArrowRightLeft, label: 'Transfer Stok', path: '/inventory/transfer', roles: ['OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'ASA', 'SODO'] },
        { icon: ClipboardCheck, label: 'Stock Opname', path: '/inventory/opname', roles: ['OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'ASA', 'SODO'] },
        { icon: PackageSearch, label: 'Stock Adjustment', path: '/inventory/adjustment', roles: ['OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS'] },
        { icon: TrendingUp, label: 'Riwayat Perpindahan', path: '/inventory/movements', roles: ['OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'ASA', 'SODO'] },
        { icon: AlertTriangle, label: 'Peringatan Stok Rendah', path: '/inventory/alerts', roles: ['OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'ASA', 'SODO'] },
      ],
    },
    {
      icon: DollarSign,
      label: 'Keuangan',
      roles: ['OWNER', 'CFO'],
      children: [
        { icon: FileText, label: 'Chart of Accounts', path: '/finance/coa', roles: ['OWNER', 'CFO'] },
        { icon: ReceiptText, label: 'Jurnal Umum', path: '/finance/journal', roles: ['OWNER', 'CFO'] },
        { icon: Wallet, label: 'Pengeluaran', path: '/finance/expenses', roles: ['OWNER', 'CFO'] },
        { icon: CreditCard, label: 'Petty Cash', path: '/finance/petty-cash', roles: ['OWNER', 'CFO'] },
        { icon: Receipt, label: 'Accounts Receivable', path: '/finance/ar', roles: ['OWNER', 'CFO'] },
        { icon: BarChart3, label: 'Laporan Keuangan', path: '/finance/reports', roles: ['OWNER', 'CFO'] },
      ],
    },
    {
      icon: FileText,
      label: 'Pembelian',
      roles: ['OWNER', 'CFO', 'MGR'],
      children: [
        { icon: Building2, label: 'Supplier', path: '/purchasing/suppliers', roles: ['OWNER', 'CFO', 'MGR'] },
        { icon: FileText, label: 'Purchase Order', path: '/purchasing/po', roles: ['OWNER', 'CFO', 'MGR'] },
        { icon: Truck, label: 'Goods Receipt', path: '/purchasing/goods-receipt', roles: ['OWNER', 'CFO', 'MGR'] },
      ],
    },
    {
      icon: UserCog,
      label: 'Karyawan',
      roles: ['OWNER', 'CFO'],
      children: [
        { icon: Users, label: 'Data Karyawan', path: '/hr/employees', roles: ['OWNER', 'CFO'] },
        { icon: Clock, label: 'Absensi', path: '/hr/attendance', roles: ['OWNER', 'CFO'] },
        { icon: CalendarDays, label: 'Cuti', path: '/hr/leave', roles: ['OWNER', 'CFO'] },
        { icon: Banknote, label: 'Payroll', path: '/hr/payroll', roles: ['OWNER', 'CFO'] },
        { icon: Target, label: 'KPI', path: '/hr/kpi', roles: ['OWNER', 'CFO'] },
      ],
    },
    {
      icon: Store,
      label: 'Cabang',
      path: '/branches',
      roles: ['OWNER', 'CFO', 'MGR'],
    },
    {
      icon: Shield,
      label: 'User & Role',
      path: '/users',
      roles: ['OWNER'],
    },
  ];

  // Flatten user roles: array of codes + primary role code (from backend JWT payload)
  const userRoleCodes: string[] = (() => {
    const codes: string[] = [];
    if (Array.isArray(user?.roles)) {
      codes.push(...user.roles);
    }
    if (user?.role?.code && !codes.includes(user.role.code)) {
      codes.push(user.role.code);
    }
    // Fallback default
    if (codes.length === 0) {
      codes.push('ADMIN');
    }
    return codes;
  })();

  const hasAccess = (itemRoles: string[]) =>
    itemRoles.includes('*') || itemRoles.some((r) => userRoleCodes.includes(r));

  // Filter menu based on Access Control Matrix (simplified per-role)
  const menuItems = allMenuItems
    .filter((item) => hasAccess(item.roles))
    .map((item) => ({
      ...item,
      children: item.children?.filter((child) => hasAccess(child.roles || ['*'])),
    }))
    .filter((item) => !item.children || item.children.length > 0);

  const isActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const isParentActive = (item: MenuItem): boolean => {
    if (item.path && isActive(item.path)) return true;
    if (item.children) {
      return item.children.some((child) => isParentActive(child));
    }
    return false;
  };

  const toggleMenu = (menuKey: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuKey]: !prev[menuKey],
    }));
  };

  const getMenuKey = (label: string) => {
    return label.toLowerCase().replace(/\s+/g, '');
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } bg-white border-r border-gray-200 shadow-xl`}
        style={{ width: `${SIDEBAR_WIDTH}px` }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img
              src="/logo/igd-1.jpg"
              alt="IGD Ponsel Logo"
              className="h-10 w-10 object-contain flex-shrink-0"
            />
            <div>
              <p className="text-xs text-gray-500 font-medium">v1.0</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto overflow-x-hidden" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const menuKey = getMenuKey(item.label);
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedMenus[menuKey] ?? false;
            const parentActive = isParentActive(item);
            const itemActive = item.path ? isActive(item.path) : false;

            if (hasChildren) {
              return (
                <div key={menuKey}>
                  <button
                    onClick={() => toggleMenu(menuKey)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-all ${
                      parentActive
                        ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-4">
                      {item.children!.map((child) => {
                        const ChildIcon = child.icon;
                        const childActive = child.path ? isActive(child.path) : false;
                        return (
                          <Link
                            key={child.path || child.label}
                            to={child.path || '#'}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm ${
                              childActive
                                ? 'bg-primary-50 text-primary-700 font-semibold border-l-2 border-primary-600'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            <ChildIcon className="w-4 h-4" />
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.path || item.label}
                to={item.path || '#'}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  itemActive
                    ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info at Bottom */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50">
            <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-primary-600 to-primary-500 rounded-full text-white text-sm font-semibold">
              {user?.fullName?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {user?.fullName || 'Admin'}
                {user?.role?.name && (
                  <span className="text-xs font-normal text-gray-500 ml-1">
                    ({user.role.name})
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.email || user?.role?.code || 'Administrator'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content - Dynamic Width */}
      <div
        className="transition-all duration-300 ease-in-out w-full"
        style={{
          marginLeft: sidebarOpen ? `${SIDEBAR_WIDTH}px` : '0px',
          width: sidebarOpen ? `calc(100% - ${SIDEBAR_WIDTH}px)` : '100%',
        }}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between h-16 px-4">
            {/* Left: Toggle & Search */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                aria-label="Toggle sidebar"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Cari pelanggan, produk, atau transaksi..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Right: Notifications & User */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Branch selector */}
              {availableBranches.length > 0 && (
                <div className="hidden md:flex items-center gap-2 text-xs">
                  <span className="text-gray-500">Cabang:</span>
                  <select
                    value={currentBranchId || ''}
                    onChange={(e) =>
                      setCurrentBranchId(e.target.value === '' ? null : e.target.value)
                    }
                    className="border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {availableBranches.length > 1 && (
                      <option value="">Semua Cabang</option>
                    )}
                    {availableBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notifications */}
              <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary-600 rounded-full"></span>
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-primary-600 to-primary-500 rounded-full text-white text-sm font-semibold">
                    {user?.fullName?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-semibold text-gray-900">
                      {user?.fullName || 'Admin'}
                      {user?.role?.name && (
                        <span className="text-xs font-normal text-gray-500 ml-1">
                          ({user.role.name})
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-gray-500">
                      {user?.role?.code || 'ADMIN'}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setUserMenuOpen(false)}
                    ></div>
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-20">
                      <Link
                        to="/profile"
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <User className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-700">Profil</span>
                      </Link>
                      <Link
                        to="/settings"
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-700">Pengaturan</span>
                      </Link>
                      <hr className="border-gray-200" />
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4 text-red-600" />
                        <span className="text-sm text-red-600 font-medium">Keluar</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content - Full Width */}
        <main className="min-h-[calc(100vh-4rem)] p-3 bg-gray-50 w-full overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50 transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
