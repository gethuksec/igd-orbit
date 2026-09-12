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
  ShieldCheck,
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
  RefreshCcw,
  ArrowDownToLine,
  ArrowUpFromLine,
  Palette,
  Ruler,
  Maximize,
  ClipboardCheck,
  ClipboardList,
  Truck,
  ReceiptText,
  Wallet,
  BarChart3,
  Clock,
  CalendarDays,
  Banknote,
  Target,
  RotateCcw,
  ScanBarcode,
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

/**
 * Wildcard-aware permission matching (mirrors backend patternMatchesKey in
 * backend/src/shared/utils/permissions.util.ts).
 * '*' consumes zero or more segments: 'master_data.*.view' matches
 * 'master_data.customer.view' and 'master_data.customer_type.view'.
 */
function patternMatchesKey(pattern: string, key: string): boolean {
  const p = pattern.split('.');
  const k = key.split('.');
  const m = p.length;
  const n = k.length;
  const dp: boolean[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(false));
  dp[0][0] = true;
  for (let i = 1; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      if (p[i - 1] === '*') {
        dp[i][j] = dp[i - 1][j] || (j > 0 && dp[i][j - 1]);
      } else if (j > 0) {
        dp[i][j] = dp[i - 1][j - 1] && p[i - 1] === k[j - 1];
      }
    }
  }
  return dp[m][n];
}

function collectLeafKeys(nodes: PermissionNode[]): string[] {
  const keys: string[] = [];
  const walk = (node: PermissionNode) => {
    if (node.key) keys.push(node.key);
    for (const c of node.children || []) walk(c);
  };
  for (const n of nodes) walk(n);
  return keys;
}

const CATALOG_KEYS = collectLeafKeys(PERMISSION_CATALOG);

/**
 * Expand a user's raw permission patterns (e.g. 'purchasing.*.view') into the
 * concrete catalog keys they cover, so sidebar visibility (exact-match
 * isBranchVisible) honors wildcard role defaults — the D-PERM model.
 */
function expandPermissions(patterns: string[]): Set<string> {
  const out = new Set<string>();
  for (const p of patterns || []) {
    out.add(p);
    if (!p.includes('*')) continue;
    for (const k of CATALOG_KEYS) {
      if (patternMatchesKey(p, k)) out.add(k);
    }
  }
  return out;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const user = getUser();
  const { setBranches } = useBranchStore();
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

  // Load branches (reference list only — D7: no global selection, pages filter themselves)
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
      } catch (error) {
        console.error('Failed to load branches:', error);
      }
    };

    loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Menu structure with submenus — restructured 2026-08-22 per client reference:
  // Master Data (Customer/Product/Logistik/Outlet/Gudang), Expense, Quotation,
  // Service, Inventory, Finance, Staff, Report, Administrator.
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
          label: 'Customer',
          children: [
            { icon: Users, label: 'Pelanggan', path: '/customers', permission: 'master_data.customer.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CS'] },
            { icon: Tag, label: 'Tipe Customer', path: '/customer-types', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
            { icon: Award, label: 'Level', path: '/customer-tiers', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER'] },
            { icon: CreditCard, label: 'Termin', path: '/payment-terms', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
          ],
        },
        {
          icon: Package,
          label: 'Product',
          children: [
            { icon: Package, label: 'Produk', path: '/products', permission: 'master_data.product.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
            { icon: Tag, label: 'Kategori', path: '/categories', permission: 'master_data.category.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
            { icon: Award, label: 'Merek', path: '/brands', permission: 'master_data.brand.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
            { icon: Palette, label: 'Warna', path: '/colors', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
            { icon: Ruler, label: 'Satuan', path: '/units', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
            { icon: Maximize, label: 'Ukuran', path: '/sizes', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
          ],
        },
        {
          icon: Truck,
          label: 'Logistik',
          children: [
            { icon: Building2, label: 'Supplier', path: '/suppliers', permission: 'master_data.supplier.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
            { icon: Truck, label: 'Ekspedisi', path: '/expeditions', permission: 'master_data.*.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
          ],
        },
        { icon: Store, label: 'Outlet', path: '/branches', permission: 'master_data.branch.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
        { icon: Warehouse, label: 'Gudang', path: '/warehouses', permission: 'master_data.warehouse.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA'] },
        {
          icon: Wrench,
          label: 'Servis',
          children: [
            { icon: Wrench, label: 'Layanan', path: '/service-types', permission: 'master_data.service_type.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS'] },
            { icon: ClipboardList, label: 'Kelengkapan', path: '/service-checkpoints', permission: 'service.checkpoint.view', roles: ['SUPERADMIN', 'OWNER', 'MGR', 'CS', 'HS', 'SPV'] },
          ],
        },
      ],
    },
    {
      icon: FileText,
      label: 'Expense',
      permission: 'purchasing.*.view',
      roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'],
      children: [
        { icon: FileText, label: 'Faktur', path: '/purchasing/invoices', permission: 'purchasing.invoice.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
        { icon: FileText, label: 'Purchase Order', path: '/purchasing/po', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
        { icon: Truck, label: 'Goods Receipt', path: '/purchasing/goods-receipt', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
        { icon: RotateCcw, label: 'Retur', path: '/purchasing/returns', permission: 'purchasing.return.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
        { icon: ShieldCheck, label: 'Approval', path: '/purchasing/approval', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
        { icon: Building2, label: 'Supplier', path: '/purchasing/suppliers', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
      ],
    },
    {
      icon: ShoppingCart,
      label: 'Quotation',
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
      label: 'Service',
      permission: 'service.*.view',
      roles: ['SUPERADMIN', 'OWNER', 'MGR', 'CS', 'TC', 'HS', 'SPV'],
      children: [
        { icon: Zap, label: 'Smart Repair', path: '/services/smart-repair', roles: ['SUPERADMIN', 'OWNER', 'MGR', 'CS'] },
        { icon: Wrench, label: 'Semua Service Order', path: '/service-orders', roles: ['SUPERADMIN', 'OWNER', 'MGR', 'CS', 'HS', 'SPV'] },
        { icon: UserCog, label: 'Service Saya', path: '/service-orders/my', roles: ['SUPERADMIN', 'TC', 'HS', 'SPV'] },
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
        { icon: ClipboardList, label: 'Request', path: '/inventory/requests', permission: 'inventory.request.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'ASA', 'SODO'] },
        { icon: ArrowDownToLine, label: 'Stok Masuk', path: '/inventory/stock-in', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'ASA', 'SODO'] },
        { icon: ArrowUpFromLine, label: 'Stok Keluar', path: '/inventory/stock-out', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'ASA', 'SODO'] },
        { icon: ArrowRightLeft, label: 'Transfer Stok', path: '/inventory/transfer', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'ASA', 'SODO'] },
        { icon: RefreshCcw, label: 'Mutasi Stok', path: '/inventory/mutasi', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'SODO'] },
        { icon: ClipboardCheck, label: 'Stock Opname', path: '/inventory/opname', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'ASA', 'SODO'] },
      ],
    },
    {
      icon: DollarSign,
      label: 'Finance',
      permission: 'finance.*.view',
      roles: ['SUPERADMIN', 'OWNER', 'CFO'],
      children: [
        { icon: FileText, label: 'Chart of Accounts', path: '/finance/coa', roles: ['SUPERADMIN', 'OWNER', 'CFO'] },
        { icon: ReceiptText, label: 'Mutasi', path: '/finance/journal', roles: ['SUPERADMIN', 'OWNER', 'CFO'] },
        { icon: CreditCard, label: 'Hutang', path: '/finance/ap', permission: 'finance.ap.view', roles: ['SUPERADMIN', 'OWNER', 'CFO'] },
        { icon: Receipt, label: 'Piutang', path: '/finance/ar', roles: ['SUPERADMIN', 'OWNER', 'CFO'] },
        { icon: Banknote, label: 'Aset', path: '/finance/assets', permission: 'finance.asset.view', roles: ['SUPERADMIN', 'OWNER', 'CFO'] },
        { icon: User, label: 'Prive', path: '/finance/prive', permission: 'finance.prive.view', roles: ['SUPERADMIN', 'OWNER', 'CFO'] },
        { icon: Wallet, label: 'Pengeluaran', path: '/finance/expenses', roles: ['SUPERADMIN', 'OWNER', 'CFO'] },
        { icon: CreditCard, label: 'Petty Cash', path: '/finance/petty-cash', roles: ['SUPERADMIN', 'OWNER', 'CFO'] },
        { icon: BarChart3, label: 'Laporan Keuangan', path: '/finance/reports', roles: ['SUPERADMIN', 'OWNER', 'CFO'] },
      ],
    },
    {
      icon: UserCog,
      label: 'Staff',
      permission: 'hr.*.view',
      roles: ['SUPERADMIN', 'OWNER', 'CFO', 'CHR'],
      children: [
        { icon: Users, label: 'Data Karyawan', path: '/hr/employees', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'CHR'] },
        { icon: Clock, label: 'Presensi', path: '/hr/attendance', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'CHR'] },
        { icon: Wallet, label: 'Kasbon', path: '/hr/kasbon', permission: 'hr.kasbon.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'CHR'] },
        { icon: Building2, label: 'Departemen', path: '/hr/departments', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'CHR'] },
        { icon: ClipboardList, label: 'Divisi', path: '/hr/divisions', permission: 'hr.division.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'CHR'] },
        { icon: CalendarDays, label: 'Cuti', path: '/hr/leave', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'CHR'] },
        { icon: Target, label: 'KPI', path: '/hr/kpi', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'CHR'] },
        { icon: Banknote, label: 'Payroll', path: '/hr/payroll', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'CHR'] },
      ],
    },
    {
      icon: BarChart3,
      label: 'Report',
      permission: 'finance.report.view',
      roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'],
      children: [
        { icon: Wallet, label: 'Expense', path: '/reports/expense', permission: 'finance.report.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
        { icon: Receipt, label: 'Quotation', path: '/reports/quotation', permission: 'sales.history.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CS'] },
        { icon: Wrench, label: 'Service', path: '/reports/service', permission: 'service.order.view', roles: ['SUPERADMIN', 'OWNER', 'MGR', 'CS'] },
        { icon: Boxes, label: 'Inventory', path: '/reports/inventory', permission: 'inventory.stock.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS'] },
        { icon: Users, label: 'Staff', path: '/reports/staff', permission: 'hr.employee.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'CHR'] },
        { icon: Store, label: 'Outlet', path: '/reports/outlet', permission: 'master_data.branch.view', roles: ['SUPERADMIN', 'OWNER', 'CFO', 'MGR'] },
      ],
    },
    {
      icon: Shield,
      label: 'Administrator',
      permission: 'users.*.view',
      roles: ['SUPERADMIN', 'OWNER', 'CHR'],
      children: [
        { icon: Users, label: 'Users', path: '/users', permission: 'users.user.view', roles: ['SUPERADMIN', 'OWNER', 'CHR'] },
        { icon: Shield, label: 'Roles', path: '/roles', permission: 'roles.role.view', roles: ['SUPERADMIN', 'OWNER', 'CHR'] },
        { icon: Shield, label: 'Approval', path: '/admin/approval', permission: 'roles.role.view', roles: ['SUPERADMIN', 'OWNER', 'CHR'] },
        {
          icon: Settings,
          label: 'General',
          children: [
            { icon: ScanBarcode, label: 'Barcode Setting', path: '/admin/general/barcode', permission: 'users.user.view', roles: ['SUPERADMIN', 'OWNER', 'CHR'] },
          ],
        },
        {
          icon: ArrowRightLeft,
          label: 'Sync',
          children: [
            { icon: ReceiptText, label: 'WhatsApp', path: '/admin/sync/whatsapp', permission: 'users.user.view', roles: ['SUPERADMIN', 'OWNER', 'CHR'] },
            { icon: Store, label: 'Marketplace', path: '/admin/sync/marketplace', permission: 'users.user.view', roles: ['SUPERADMIN', 'OWNER', 'CHR'] },
            { icon: Package, label: 'Website', path: '/admin/sync/website', permission: 'users.user.view', roles: ['SUPERADMIN', 'OWNER', 'CHR'] },
            { icon: Boxes, label: 'Platform', path: '/admin/sync/platform', permission: 'users.user.view', roles: ['SUPERADMIN', 'OWNER', 'CHR'] },
          ],
        },
        { icon: Shield, label: 'Password Requests', path: '/password-requests', permission: 'users.*.view', roles: ['SUPERADMIN', 'OWNER', 'CHR'] },
      ],
    },
  ];

  // Build a set of user's permissions for catalog visibility checks.
  // Wildcards in role defaults (e.g. 'purchasing.*.view') are expanded to the
  // concrete catalog keys they cover (D-PERM model).
  const currentUserData = getUser();
  const userPermSet = expandPermissions(currentUserData?.permissions || []);

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
