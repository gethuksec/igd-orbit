import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  Warehouse,
  ShoppingCart,
  Wrench,
  Bell,
  Menu,
  X,
  ChevronDown,
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
  Palette,
  Ruler,
  Maximize,
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
import { usePermissions } from '@/hooks/usePermissions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { isBranchVisible } from '@/components/shared/PermissionAccordion';
import { PERMISSION_CATALOG } from '@/config/permission-catalog';
import type { PermissionNode } from '@/types/permission';
import { MenuItem, MenuGroup } from '@/components/shared';

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
  roles?: string[];
  permission?: string;
  children?: MenuItem[];
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const user = getUser();
  const { availableBranches, currentBranchId, setBranches, setCurrentBranchId } = useBranchStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Menu key definitions for auto-expand on route change
  const menuDefinitions = [
    { key: 'masterdata', paths: ['/customers', '/products', '/branches', '/service-types', '/suppliers', '/categories', '/brands', '/colors', '/units', '/sizes', '/expeditions', '/sales-types', '/customer-tiers'] },
    { key: 'penjualan', paths: ['/sales'] },
    { key: 'servis', paths: ['/service-orders', '/service-returns'] },
    { key: 'gudang', paths: ['/inventory'] },
    { key: 'keuangan', paths: ['/finance'] },
    { key: 'pembelian', paths: ['/purchasing'] },
    { key: 'karyawan', paths: ['/hr'] },
  ];

  useEffect(() => {
    const currentPath = location.pathname;
    const match = menuDefinitions.find((def) =>
      def.paths.some((p) => currentPath.startsWith(p)),
    );
    if (match) {
      setExpandedMenus((prev) => ({
        ...Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: false }), {}),
        [match.key]: true,
      }));
    }
  }, [location.pathname]);

  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
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
        const data = await publicService.getBranches();
        let branches: Branch[] = data || [];

        if (user?.branchIds && Array.isArray(user.branchIds) && user.branchIds.length > 0) {
          const filtered = branches.filter((b: Branch) => user.branchIds.includes(b.id));
          branches = filtered.length > 0 ? filtered : branches;
        }

        setBranches(branches);

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

  // Menu structure with submenus
  const allMenuItems: MenuItem[] = [
    {
      icon: LayoutDashboard,
      label: 'Dashboard',
      path: '/dashboard',
      permission: 'dashboard.*.view',
      roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'],
    },
    {
      icon: Package,
      label: 'Master Data',
      permission: 'master_data.*.view',
      roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CS'],
      children: [
        { icon: Users, label: 'Pelanggan', path: '/customers', permission: 'master_data.customer.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CS'] },
        { icon: Package, label: 'Produk', path: '/products', permission: 'master_data.product.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
        { icon: Building2, label: 'Supplier', path: '/suppliers', permission: 'master_data.supplier.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
        { icon: Tag, label: 'Kategori', path: '/categories', permission: 'master_data.category.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
        { icon: Award, label: 'Brand', path: '/brands', permission: 'master_data.brand.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
        { icon: Palette, label: 'Warna', path: '/colors', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
        { icon: Ruler, label: 'Satuan', path: '/units', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
        { icon: Maximize, label: 'Ukuran', path: '/sizes', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
        { icon: Truck, label: 'Ekspedisi', path: '/expeditions', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
        { icon: Tag, label: 'Tipe Penjualan', path: '/sales-types', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
        { icon: CreditCard, label: 'Termin Pembayaran', path: '/payment-terms', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
        { icon: Target, label: 'Customer Tiers', path: '/customer-tiers', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER'] },
        { icon: Wrench, label: 'Layanan', path: '/service-types', permission: 'master_data.service_type.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS'] },
      ],
    },
    {
      icon: ShoppingCart,
      label: 'Penjualan',
      permission: 'sales.*.view',
      roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CS', 'CR', 'HS', 'SPV'],
      children: [
        { icon: ShoppingCart, label: 'POS', path: '/pos', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CS', 'CR', 'HS', 'SPV'] },
        { icon: Receipt, label: 'Riwayat Penjualan', path: '/sales/history', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CS', 'CR', 'HS', 'SPV'] },
        { icon: ArrowRightLeft, label: 'Retur Penjualan', path: '/sales/returns', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'HS', 'SPV'] },
      ],
    },
    {
      icon: Wrench,
      label: 'Servis',
      permission: 'service.*.view',
      roles: ['SUPERADMIN', 'OWNER', 'MGR', 'CS', 'TC', 'HS', 'SPV'],
      children: [
        { icon: Wrench, label: 'Semua Service Order', path: '/service-orders', roles: ['SUPERADMIN', 'OWNER', 'MGR', 'CS', 'HS', 'SPV'] },
        { icon: UserCog, label: 'Service Saya', path: '/service-orders/my', roles: ['SUPERADMIN', 'TC', 'HS', 'SPV'] },
        { icon: Plus, label: 'Tambah Service', path: '/service-orders/new', roles: ['SUPERADMIN', 'OWNER', 'MGR', 'CS'] },
        { icon: RotateCcw, label: 'Retur & Komplain', path: '/service-returns', roles: ['SUPERADMIN', 'OWNER', 'MGR', 'CS', 'CR', 'HS', 'SPV', 'CMO', 'CSO'] },
      ],
    },
    {
      icon: Warehouse,
      label: 'Gudang',
      permission: 'inventory.*.view',
      roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'ASA', 'SODO'],
      children: [
        { icon: Boxes, label: 'Stok', path: '/inventory/stock', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'ASA', 'SODO'] },
        { icon: ArrowRightLeft, label: 'Transfer Stok', path: '/inventory/transfer', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'ASA', 'SODO'] },
        { icon: ClipboardCheck, label: 'Stock Opname', path: '/inventory/opname', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'ASA', 'SODO'] },
        { icon: PackageSearch, label: 'Stock Adjustment', path: '/inventory/adjustment', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS'] },
        { icon: TrendingUp, label: 'Riwayat Perpindahan', path: '/inventory/movements', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'ASA', 'SODO'] },
        { icon: AlertTriangle, label: 'Peringatan Stok Rendah', path: '/inventory/alerts', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'ASA', 'SODO'] },
      ],
    },
    {
      icon: DollarSign,
      label: 'Keuangan',
      permission: 'finance.*.view',
      roles: ['SUPERADMIN', 'OWNER', 'CFO'],
      children: [
        { icon: FileText, label: 'Chart of Accounts', path: '/finance/coa', roles: ['SUPERADMIN', 'OWNER', 'CFO'] },
        { icon: ReceiptText, label: 'Jurnal Umum', path: '/finance/journal', roles: ['SUPERADMIN', 'OWNER', 'CFO'] },
        { icon: Wallet, label: 'Pengeluaran', path: '/finance/expenses', roles: ['SUPERADMIN', 'OWNER', 'CFO'] },
        { icon: CreditCard, label: 'Petty Cash', path: '/finance/petty-cash', roles: ['SUPERADMIN', 'OWNER', 'CFO'] },
        { icon: Receipt, label: 'Accounts Receivable', path: '/finance/ar', roles: ['SUPERADMIN', 'OWNER', 'CFO'] },
        { icon: BarChart3, label: 'Laporan Keuangan', path: '/finance/reports', roles: ['SUPERADMIN', 'OWNER', 'CFO'] },
      ],
    },
    {
      icon: FileText,
      label: 'Pembelian',
      permission: 'purchasing.*.view',
      roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'],
      children: [
        { icon: Building2, label: 'Supplier', path: '/purchasing/suppliers', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
        { icon: FileText, label: 'Purchase Order', path: '/purchasing/po', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
        { icon: Truck, label: 'Goods Receipt', path: '/purchasing/goods-receipt', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
      ],
    },
    {
      icon: UserCog,
      label: 'Karyawan',
      permission: 'hr.*.view',
      roles: ['SUPERADMIN', 'OWNER', 'CFO', 'CHR'],
      children: [
        { icon: Users, label: 'Data Karyawan', path: '/hr/employees', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'CHR'] },
        { icon: Building2, label: 'Departemen', path: '/hr/departments', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'CHR'] },
        { icon: Clock, label: 'Absensi', path: '/hr/attendance', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'CHR'] },
        { icon: CalendarDays, label: 'Cuti', path: '/hr/leave', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'CHR'] },
        { icon: Banknote, label: 'Payroll', path: '/hr/payroll', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'CHR'] },
        { icon: Target, label: 'KPI', path: '/hr/kpi', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'CHR'] },
      ],
    },
    {
      icon: Store,
      label: 'Cabang',
      path: '/branches',
      permission: 'master_data.*.view',
      roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'],
    },
    {
      icon: Shield,
      label: 'User & Role',
      permission: 'users.*.view',
      roles: ['SUPERADMIN', 'OWNER', 'CHR'],
      children: [
        { icon: Users, label: 'Users', path: '/users', permission: 'users.user.view', roles: ['SUPERADMIN', 'OWNER', 'CHR'] },
        { icon: Shield, label: 'Roles', path: '/roles', permission: 'roles.role.view', roles: ['SUPERADMIN', 'OWNER', 'CHR'] },
        { icon: Shield, label: 'Password Requests', path: '/password-requests', permission: 'users.*.view', roles: ['SUPERADMIN', 'OWNER', 'CHR'] },
      ],
    },
  ];

  const { hasPermission, hasAnyRole } = usePermissions();

  // Build a set of user's permissions for catalog visibility checks
  const currentUserData = getUser();
  const userPermissions: string[] = currentUserData?.permissions || [];
  const userPermSet = new Set<string>(userPermissions);

  // Map catalog labels to their top-level nodes for quick lookup
  const catalogByLabel = new Map<string, PermissionNode>();
  for (const node of PERMISSION_CATALOG) {
    catalogByLabel.set(node.label, node);
  }

  const hasAccess = (item: MenuItem): boolean => {
    const currentUser = getUser();
    const userRoles = currentUser?.roles || (currentUser?.role?.code ? [currentUser.role.code] : []);

    if (userRoles.includes('SUPERADMIN')) return true;

    // Check via permission catalog (bottom-up visibility)
    if (item.label && catalogByLabel.has(item.label)) {
      const catalogNode = catalogByLabel.get(item.label)!;
      return isBranchVisible(catalogNode, userPermSet);
    }

    // Fallback: role-based access
    if (item.roles) return item.roles.includes('*') || hasAnyRole(item.roles);

    return true;
  };

  const getChildVisibility = (children: MenuItem[]): MenuItem[] => {
    return children.filter((child) => {
      // Find the child node in the catalog by searching all top-level sections
      for (const topNode of PERMISSION_CATALOG) {
        const found = findChildInTree(topNode, child.label);
        if (found) {
          // Catalog explicitly controls visibility for this child
          return isBranchVisible(found, userPermSet);
        }
      }
      // Not in catalog: fallback to traditional checks
      // Check child's own permission
      if (child.permission && userPermissions.length > 0) {
        if (hasPermission(child.permission)) return true;
      }
      // Check roles
      if (child.roles) return child.roles.includes('*') || hasAnyRole(child.roles);
      return false;
    });
  };

  // Find a node by label in the catalog tree, return the matched node itself
  function findChildInTree(node: PermissionNode, label: string): PermissionNode | null {
    if (node.label === label) return node;
    if (node.children) {
      for (const c of node.children) {
        const result = findChildInTree(c, label);
        if (result) return result;
      }
    }
    return null;
  }

  const menuItems = allMenuItems
    .filter((item) => hasAccess(item))
    .map((item) => ({
      ...item,
      children: item.children ? getChildVisibility(item.children) : undefined,
    }))
    .filter((item) => !item.children || item.children.length > 0);

  const isActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const isParentActive = (item: MenuItem): boolean => {
    if (item.path && isActive(item.path)) return true;
    if (item.children) return item.children.some((child) => isParentActive(child));
    return false;
  };

  const toggleMenu = (menuKey: string) => {
    setExpandedMenus((prev) => {
      const newState: Record<string, boolean> = {};
      Object.keys(prev).forEach((key) => {
        newState[key] = key === menuKey ? !prev[key] : false;
      });
      if (!(menuKey in prev)) newState[menuKey] = true;
      return newState;
    });
  };

  const getMenuKey = (label: string) => label.toLowerCase().replace(/\s+/g, '');

  const initial = user?.fullName?.charAt(0).toUpperCase() || 'A';

  // ======== SIDEBAR CONTENT ========
  const renderSidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b shrink-0">
        <div className="flex items-center gap-3">
          <img src="/logo/igd-1.jpg" alt="IGD Ponsel Logo" className="h-10 w-10 object-contain flex-shrink-0" />
          <p className="text-xs text-muted-foreground font-medium">v1.0</p>
        </div>
      </div>

      {/* Navigation Menu */}
      <ScrollArea className="flex-1 px-4 py-6">
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const menuKey = getMenuKey(item.label);
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedMenus[menuKey] ?? false;
            const parentActive = isParentActive(item);
            const itemActive = item.path ? isActive(item.path) : false;

            if (hasChildren) {
              return (
                <MenuGroup
                  key={menuKey}
                  icon={Icon}
                  label={item.label}
                  isExpanded={isExpanded}
                  isActive={parentActive}
                  onToggle={() => toggleMenu(menuKey)}
                >
                  {item.children!.map((child) => {
                    const ChildIcon = child.icon;
                    const childActive = child.path ? location.pathname === child.path : false;
                    return (
                      <MenuItem
                        key={child.path || child.label}
                        icon={ChildIcon}
                        label={child.label}
                        path={child.path || '#'}
                        isActive={childActive}
                        variant="child"
                      />
                    );
                  })}
                </MenuGroup>
              );
            }

            return (
              <MenuItem
                key={item.path || item.label}
                icon={Icon}
                label={item.label}
                path={item.path || '#'}
                isActive={itemActive}
              />
            );
          })}
        </nav>
      </ScrollArea>

      {/* User Info at Bottom */}      <Separator />
      <div className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-3 w-full px-3 py-2 h-auto rounded-lg justify-start">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-gradient-to-r from-primary-600 to-primary-500 text-white text-sm">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {user?.fullName || 'Admin'}
                  {user?.role?.name && (
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      ({user.role.name})
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email || user?.role?.code || 'Administrator'}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56 mb-2">
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <User className="w-4 h-4 mr-2" />
              Profil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="w-4 h-4 mr-2" />
              Pengaturan
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
              <LogOut className="w-4 h-4 mr-2" />
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 ease-in-out bg-white border-r border-border shadow-xl hidden lg:block ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: `${SIDEBAR_WIDTH}px` }}
      >
        <div className="flex flex-col h-full">
          {renderSidebarContent()}
        </div>
      </aside>

      {/* Mobile Sidebar (Sheet) */}
      <Sheet>
        <SheetContent side="left" className="p-0 w-[280px]">
          <div className="flex flex-col h-full">
            {renderSidebarContent()}
          </div>
        </SheetContent>

        {/* Mobile hamburger — must be inside <Sheet> */}
        <SheetTrigger className="lg:hidden p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors flex-shrink-0" aria-label="Open sidebar">
          <Menu className="w-5 h-5" />
        </SheetTrigger>
      </Sheet>

      {/* Main Content */}
      <div
        className="transition-all duration-300 ease-in-out w-full"
        style={{
          marginLeft: sidebarOpen ? `${SIDEBAR_WIDTH}px` : '0px',
          width: sidebarOpen ? `calc(100% - ${SIDEBAR_WIDTH}px)` : '100%',
        }}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-border shadow-sm">
          <div className="flex items-center justify-between h-16 px-4">
            {/* Left: Toggle */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {/* Desktop toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="flex-shrink-0 hidden lg:inline-flex"
                aria-label="Toggle sidebar"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>

            {/* Right: Notifications & User */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Branch selector */}
              {availableBranches.length > 0 && (
                <div className="hidden md:flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Cabang:</span>
                  <select
                    value={currentBranchId || ''}
                    onChange={(e) =>
                      setCurrentBranchId(e.target.value === '' ? null : e.target.value)
                    }
                    className="border border-input rounded-lg px-2 py-1 text-xs bg-background focus:ring-2 focus:ring-primary-500"
                  >
                    {availableBranches.length > 1 && <option value="">Semua Cabang</option>}
                    {availableBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notifications */}
              <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-600 rounded-full" />
              </Button>

              {/* User Menu — shadcn DropdownMenu + Avatar */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-3 py-2 h-auto">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-r from-primary-600 to-primary-500 text-white text-sm">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:flex flex-col items-start">
                      <span className="text-sm font-semibold text-foreground">
                        {user?.fullName || 'Admin'}
                        {user?.role?.name && (
                          <span className="text-xs font-normal text-muted-foreground ml-1">
                            ({user.role.name})
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {user?.role?.code || 'ADMIN'}
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-muted-foreground hidden md:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="w-4 h-4 mr-2" />
                    Profil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <Settings className="w-4 h-4 mr-2" />
                    Pengaturan
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                    <LogOut className="w-4 h-4 mr-2" />
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="min-h-[calc(100vh-4rem)] p-3 bg-gray-50 w-full overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Mobile Overlay (for desktop sidebar toggle on mobile — Sheet handles this) */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 z-30 bg-black/50 transition-opacity duration-300 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
