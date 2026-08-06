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
  ClipboardList,
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
  Zap,
} from 'lucide-react';
import type { Branch } from '@/services/public.service';
import { publicService } from '@/services/public.service';
import { useBranchStore } from '@/stores/branchStore';
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

  // Menu keys are namespaced: top-level = lowercase label, nested = `<parent>-<label>`
  const getMenuKey = (label: string) => label.toLowerCase().replace(/\s+/g, '');
  const menuKeyFor = (item: MenuItem, parentKey?: string): string =>
    parentKey ? `${parentKey}-${getMenuKey(item.label)}` : getMenuKey(item.label);

  // Find the chain of menu keys (group → subgroup → …) matching the current path
  function findMenuChain(items: MenuItem[], path: string, parentKey?: string): string[] {
    for (const item of items) {
      const key = menuKeyFor(item, parentKey);
      if (item.path && (path === item.path || path.startsWith(item.path + '/'))) {
        return [key];
      }
      if (item.children) {
        const sub = findMenuChain(item.children, path, key);
        if (sub.length > 0) return [key, ...sub];
      }
    }
    return [];
  }

  useEffect(() => {
    const chain = findMenuChain(allMenuItems, location.pathname);
    if (chain.length > 0) {
      setExpandedMenus(() => {
        const next: Record<string, boolean> = {};
        for (const key of chain) next[key] = true;
        return next;
      });
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
        {
          icon: Users,
          label: 'Pelanggan',
          children: [
            { icon: Users, label: 'Pelanggan', path: '/customers', permission: 'master_data.customer.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CS'] },
            { icon: Target, label: 'Customer Tiers', path: '/customer-tiers', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER'] },
          ],
        },
        {
          icon: Package,
          label: 'Produk',
          children: [
            { icon: Package, label: 'Produk', path: '/products', permission: 'master_data.product.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
            { icon: Tag, label: 'Kategori', path: '/categories', permission: 'master_data.category.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
            { icon: Award, label: 'Brand', path: '/brands', permission: 'master_data.brand.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
            { icon: Palette, label: 'Warna', path: '/colors', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
            { icon: Ruler, label: 'Satuan', path: '/units', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
            { icon: Maximize, label: 'Ukuran', path: '/sizes', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
          ],
        },
        {
          icon: Truck,
          label: 'Supplier & Logistik',
          children: [
            { icon: Building2, label: 'Supplier', path: '/suppliers', permission: 'master_data.supplier.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
            { icon: Truck, label: 'Ekspedisi', path: '/expeditions', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
          ],
        },
        {
          icon: CreditCard,
          label: 'Penjualan',
          children: [
            { icon: Tag, label: 'Tipe Penjualan', path: '/sales-types', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
            { icon: CreditCard, label: 'Termin Pembayaran', path: '/payment-terms', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
          ],
        },
        {
          icon: Wrench,
          label: 'Servis',
          children: [
            { icon: Wrench, label: 'Layanan', path: '/service-types', permission: 'master_data.service_type.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS'] },
            { icon: ClipboardList, label: 'Kelengkapan', path: '/service-checkpoints', permission: 'service.checkpoint.view', roles: ['SUPERADMIN', 'OWNER', 'MGR', 'CS', 'HS', 'SPV'] },
          ],
        },
        {
          icon: Store,
          label: 'Outlet & Gudang',
          children: [
            { icon: Store, label: 'Cabang', path: '/branches', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
            { icon: Warehouse, label: 'Gudang', path: '/warehouses', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA'] },
          ],
        },
      ],
    },
    {
      icon: ShoppingCart,
      label: 'Penjualan',
      permission: 'sales.*.view',
      roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CS', 'CR', 'HS', 'SPV'],
      children: [
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
      icon: Boxes,
      label: 'Inventory',
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

  // Build a set of user's permissions for catalog visibility checks
  const currentUserData = getUser();
  const userPermSet = new Set<string>(currentUserData?.permissions || []);

  // Map catalog labels to their top-level nodes for quick lookup
  const catalogByLabel = new Map<string, PermissionNode>();
  for (const node of PERMISSION_CATALOG) {
    catalogByLabel.set(node.label, node);
  }

  const hasAccess = (item: MenuItem): boolean => {
    const currentUser = getUser();
    const userRoles = currentUser?.roles || (currentUser?.role?.code ? [currentUser.role.code] : []);

    if (userRoles.includes('SUPERADMIN')) return true;

    // Permission catalog is the SINGLE source of truth for sidebar visibility.
    // Every sidebar item must have a matching entry in PERMISSION_CATALOG.
    if (item.label && catalogByLabel.has(item.label)) {
      const catalogNode = catalogByLabel.get(item.label)!;
      return isBranchVisible(catalogNode, userPermSet);
    }

    // Item has no catalog entry — hidden (no legacy fallback)
    return false;
  };

  // Leaf visibility: exact catalog match by label within section, fallback global search
  const isLeafVisible = (item: MenuItem, sectionNode: PermissionNode | null): boolean => {
    const currentUser = getUser();
    const userRoles = currentUser?.roles || (currentUser?.role?.code ? [currentUser.role.code] : []);
    if (userRoles.includes('SUPERADMIN')) return true;

    if (sectionNode) {
      const found = findChildInTree(sectionNode, item.label);
      if (found) return isBranchVisible(found, userPermSet);
    }

    // Fallback: search all sections (for cross-section lookup as last resort)
    for (const topNode of PERMISSION_CATALOG) {
      const found = findChildInTree(topNode, item.label);
      if (found) return isBranchVisible(found, userPermSet);
    }

    // Leaf has no catalog entry — hidden (no legacy fallback)
    return false;
  };

  // Recursive menu filtering: subgroups visible when any descendant leaf is visible
  const filterMenuTree = (items: MenuItem[], sectionNode: PermissionNode | null): MenuItem[] => {
    const result: MenuItem[] = [];
    for (const item of items) {
      if (item.children && item.children.length > 0) {
        const children = filterMenuTree(item.children, sectionNode);
        if (children.length > 0) result.push({ ...item, children });
      } else if (isLeafVisible(item, sectionNode)) {
        result.push(item);
      }
    }
    return result;
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
      children: item.children
        ? filterMenuTree(item.children, item.label ? catalogByLabel.get(item.label) ?? null : null)
        : undefined,
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
      const next: Record<string, boolean> = {};
      const depth = menuKey.split('-').length - 1;
      const targetState = !(prev[menuKey] ?? false);

      // Ancestors of the toggled key stay open; the key itself toggles
      const parts = menuKey.split('-');
      for (let i = 0; i < parts.length; i++) {
        const prefixKey = parts.slice(0, i + 1).join('-');
        next[prefixKey] = prefixKey === menuKey ? targetState : true;
      }

      // Per-level accordion: collapse other branches at same-or-deeper depth
      for (const [key, val] of Object.entries(prev)) {
        const keyDepth = key.split('-').length - 1;
        if (keyDepth >= depth && key !== menuKey && !key.startsWith(menuKey + '-')) {
          next[key] = false;
        } else if (!(key in next)) {
          next[key] = val;
        }
      }
      return next;
    });
  };

  // Quick-access header buttons gated by catalog nodes (e.g. POS, Smart Repair)
  const hasQuickAccess = (label: string): boolean => {
    const currentUser = getUser();
    const userRoles = currentUser?.roles || (currentUser?.role?.code ? [currentUser.role.code] : []);
    if (userRoles.includes('SUPERADMIN')) return true;
    for (const topNode of PERMISSION_CATALOG) {
      const found = findChildInTree(topNode, label);
      if (found) return isBranchVisible(found, userPermSet);
    }
    return false;
  };

  // Recursive sidebar renderer (supports group → subgroup → item, arbitrary depth)
  const renderMenuItems = (items: MenuItem[], parentKey?: string): ReactNode[] =>
    items.map((item) => {
      const menuKey = menuKeyFor(item, parentKey);
      const hasChildren = item.children && item.children.length > 0;

      if (hasChildren) {
        const isExpanded = expandedMenus[menuKey] ?? false;
        const parentActive = isParentActive(item);
        return (
          <MenuGroup
            key={menuKey}
            icon={item.icon}
            label={item.label}
            isExpanded={isExpanded}
            isActive={parentActive}
            onToggle={() => toggleMenu(menuKey)}
          >
            {renderMenuItems(item.children!, menuKey)}
          </MenuGroup>
        );
      }

      return (
        <MenuItem
          key={item.path || item.label}
          icon={item.icon}
          label={item.label}
          path={item.path || '#'}
          isActive={item.path ? isActive(item.path) : false}
          variant={parentKey ? 'child' : 'default'}
        />
      );
    });

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
            const menuKey = menuKeyFor(item);
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
                  {renderMenuItems(item.children!, menuKey)}
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

              {/* Quick actions — full-page tools, open in new tab */}
            {hasQuickAccess('POS') && (
              <Button asChild variant="default" size="sm" className="hidden md:inline-flex items-center gap-1.5 font-semibold">
                <a href="/pos" target="_blank" rel="noopener noreferrer">
                  <ShoppingCart className="w-4 h-4" />
                  POS
                </a>
              </Button>
            )}
            {hasQuickAccess('Smart Repair') && (
              <Button asChild variant="outline" size="sm" className="hidden md:inline-flex items-center gap-1.5 font-semibold">
                <a href="/services/smart-repair" target="_blank" rel="noopener noreferrer">
                  <Zap className="w-4 h-4" />
                  Smart Repair
                </a>
              </Button>
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
