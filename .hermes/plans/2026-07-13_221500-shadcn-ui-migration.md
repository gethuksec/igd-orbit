# shadcn/ui Migration — IGD-Orbit Frontend

> **Goal:** Replace all hand-rolled HTML/Tailwind UI patterns with standard shadcn/ui components across every menu page.

**Why:** ~43,600 lines of page code contain repetitive inline Tailwind classes (the same `border-2 border-gray-200 rounded-xl focus:ring-2` ~600 times). shadcn provides a single source of truth for styling, reduces maintenance burden, and makes the app look consistent.

**Architecture:** Phase-based — foundation (install + shared components) → core layout (sidebar, header) → page patterns (cards, tables, forms, dialogs) → per-menu rollout → cleanup.

**Total Scope:** ~125 TSX files, 43,600 lines, 10 menu groups, 30+ sub-pages (each with List/Form/Detail).

**Tech Stack:** shadcn/ui (built on Radix primitives), Tailwind CSS v3, React 19, React Router v6, React Hook Form, Zod.

---

## Phase 0: Foundation — Install Missing shadcn Components

### Task 0.1: Install shadcn CLI & Required Components

**Objective:** Get all Radix-backed primitives the frontend needs.

Run from `frontend/`:

```bash
npx shadcn@latest init    # Already done — just verify
npx shadcn@latest add card table tabs select label form dialog dropdown-menu avatar separator scroll-area sheet skeleton popover command badge
```

**Components to install:**
| Component | Replaces |
|-----------|----------|
| `Card` | Manual `bg-white rounded-2xl shadow-md border...` stat cards |
| `Table` | Raw `<table>` in every List page |
| `Tabs` | Manual tab buttons in ProductForm, CustomerForm, etc. |
| `Select` | Raw `<select class="...border-2...">` in all forms |
| `Label` | Raw `<label class="block text-sm font-bold...">` |
| `Form` (react-hook-form) | Manual form state management |
| `Dialog` | Custom `Modal.tsx` |
| `DropdownMenu` | User menu (currently manual) |
| `Avatar` | User avatar fallback (currently manual) |
| `Separator` | Manual `<div class="border-t...">` |
| `Sheet` | Mobile sidebar drawer |
| `Skeleton` | Loading states (currently manual spinners) |
| `Command` | Search/combobox (for POS customer search etc.) |
| `Popover` | Dropdown pickers |
| `Badge` | Upgrade existing badge.tsx to full shadcn variant set |

**Verification:**
```bash
ls src/components/ui/ | wc -l   # Should be >= 14
```

---

## Phase 1: Shared Components & Reusable Patterns

### Task 1.1: Create `PageHeader` Component

**Objective:** Replace the `bg-gradient-to-r from-primary-600...` page header pattern used in >30 files.

**Create:** `src/components/shared/PageHeader.tsx`

```tsx
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;  // Action buttons (right side)
  className?: string;
}

export function PageHeader({ title, subtitle, children, className }: PageHeaderProps) {
  return (
    <div className={cn(
      'bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white',
      className
    )}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">{title}</h1>
          {subtitle && <p className="text-primary-100">{subtitle}</p>}
        </div>
        {children && (
          <div className="flex items-center gap-3">{children}</div>
        )}
      </div>
    </div>
  );
}
```

### Task 1.2: Create `StatCard` Component

**Objective:** Replace the 4-card stats grid pattern used in ProductList, CustomerList, dashboard, etc.

**Create:** `src/components/shared/StatCard.tsx`

```tsx
import { type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: ReactNode;
  iconBg?: string; // gradient classes
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down';
  trendIcon?: ReactNode;
  badge?: { text: string; className: string };
}

export function StatCard({ icon, iconBg = 'from-primary-500 to-primary-600', label, value, subtitle, badge }: StatCardProps) {
  return (
    <Card className="hover:shadow-lg transition-all duration-300 group">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn('p-3 rounded-xl bg-gradient-to-br group-hover:scale-110 transition-transform', iconBg)}>
            {icon}
          </div>
          {badge && (
            <span className={cn('px-2 py-1 rounded-full text-xs font-semibold', badge.className)}>
              {badge.text}
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
        <h3 className="text-2xl font-bold text-foreground mb-1">{value}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
```

### Task 1.3: Create `DataTable` Component

**Objective:** Single reusable table component replacing raw `<table>` in every List page.

**Create:** `src/components/shared/DataTable.tsx`

Covers: loading skeleton, empty state, sortable headers, pagination slot, action column.

### Task 1.4: Create `SearchFilter` Component

**Objective:** Replace the verbose search input + select filter group pattern.

**Create:** `src/components/shared/SearchFilter.tsx`

Wraps: shadcn `Input` with search icon, `Select` dropdowns, in a responsive grid.

### Task 1.5: Upgrade `Modal.tsx` → `Dialog`

**Objective:** Replace custom Modal with shadcn Dialog for consistency.

**Modify:** `src/components/ui/modal.tsx` (or replace with `src/components/ui/dialog.tsx` and re-export)

---

## Phase 2: Core Layout — Sidebar Refactor

### Task 2.1: Refactor Sidebar Navigation

**Modify:** `src/layouts/DashboardLayout.tsx`

Replace the entire sidebar:
- Use proper CSS variables (no hardcoded `text-gray-700`, use `text-muted-foreground` / `text-foreground` / `bg-card`)
- Extract sidebar menu into `MenuGroup` and `MenuItem` sub-components
- Use shadcn `Button` (ghost variant) for parent toggles and child links
- Use shadcn `Separator` between sections
- Use shadcn `ScrollArea` for scrollable sidebar
- Use shadcn `Sheet` for mobile sidebar drawer

The menu data (`allMenuItems`) stays as-is — just the rendering changes.

### Task 2.2: Refactor User Dropdown

Replace the manual user info section at sidebar bottom with shadcn `Avatar` + `DropdownMenu`.

---

## Phase 3: Pattern Rollout by Menu Group

Each menu group below follows a **consistent pattern**:
1. **List page** → use `PageHeader` + `StatCard` (optional) + `SearchFilter` + `DataTable`
2. **Form page** → use `PageHeader` + shadcn `Card` + shadcn `Label`/`Input`/`Select` + shadcn `Tabs` (if multi-tab)
3. **Detail page** → use `PageHeader` + shadcn `Card` + description list layout

### Task 3.1: Master Data (11 files)
- Products: `ProductList`, `ProductForm`, `ProductDetail`
- Customers: `CustomerList`, `CustomerForm`, `CustomerDetail`
- Categories: `CategoryList`, `CategoryForm`, `CategoryDetail`
- Brands: `BrandList`, `BrandForm`, `BrandDetail`
- Suppliers, Service Types, Customer Tiers

### Task 3.2: Penjualan / Sales (8 files)
- POS: `POSPage` + components (`POSCart`, `POSCustomer`, `POSActions`, `PaymentModal`)
- `SalesHistory`, `SalesTransactionDetail`, `ReturnsList`, `ReturnForm`

### Task 3.3: Servis / Service Orders (11 files)
- `ServiceOrderList`, `ServiceOrderForm`, `ServiceOrderDetail`, `ServiceOrderPrint`
- `MyServiceOrders`
- `ServiceReturnsList`, `ServiceReturnForm`, `ServiceReturnDetail`

### Task 3.4: Gudang / Inventory (11 files)
- `StockList`, `StockTransfer`, `StockTransferList`, `StockTransferDetail`
- `StockOpnameList`, `StockOpnameDetail`, `StockOpnameCount`, `StockOpnameForm`
- `StockAdjustment`, `StockMovementHistory`, `LowStockAlerts`

### Task 3.5: Keuangan / Finance (15 files)
- COA, Journal, Expenses, Petty Cash, AR, Reports

### Task 3.6: Pembelian / Purchasing (7 files)
- PO, Goods Receipt, Supplier

### Task 3.7: Karyawan / HR (15 files)
- Employees, Departments, Attendance, Leave, Payroll, KPI

### Task 3.8: User & Role / Branches / Other (10 files)
- Users, Roles (including `PermissionTree`, `MenuAccessSelector`, `RoleHierarchyTree`)
- Branches, Settings, Profile

---

## Phase 4: Removal of Repetitive Classes & Cleanup

### Task 4.1: Remove Duplicate Tailwind Classes

After migration, remove CSS overrides that are now redundant:
- `border-2 border-gray-200 rounded-xl` — superseded by shadcn `Input`/`Select`
- `text-gray-700`, `text-gray-600`, `text-gray-500` — replace with semantic `text-muted-foreground` etc.
- `bg-white` — replace with `bg-card` / `bg-background`
- `font-bold text-gray-700 mb-2.5` (label pattern) — replaced by shadcn `Label`

### Task 4.2: Audit CSS Variables

**Verify** `src/index.css` has all CSS variables that shadcn components expect (--background, --foreground, --card, --card-foreground, --popover, --popover-foreground, --primary, --primary-foreground, --secondary, --secondary-foreground, --muted, --muted-foreground, --accent, --accent-foreground, --destructive, --destructive-foreground, --border, --input, --ring, --radius).

Current config has these in `tailwind.config.js` mapped via `hsl(var(--...))` but **needs actual CSS variable values** in `index.css`:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 0 100% 50%; /* Red */
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 0 100% 50%; /* Red */
    --radius: 0.75rem;
  }
}
```

### Task 4.3: Remove Custom Modal Component

After all pages use shadcn `Dialog`, delete `src/components/ui/modal.tsx`.

---

## Phase 5: Verification

### Task 5.1: Build Verification (after each phase)

```bash
cd frontend && npm run build
# Expected: Build succeeds with 0 errors
```

### Task 5.2: Visual QA Checklist

- [ ] Sidebar renders with proper spacing and hover states
- [ ] Mobile sidebar opens/closes via Sheet
- [ ] All cards have consistent padding and shadow
- [ ] All tables have consistent header styling and row hover
- [ ] All form inputs use shadcn Input (same height, border, focus ring)
- [ ] All form selects use shadcn Select (not raw `<select>`)
- [ ] All labels use shadcn Label
- [ ] All modals use shadcn Dialog with overlay
- [ ] Page headers consistent across all pages
- [ ] Loading states use Skeleton, not manual spinners
- [ ] Empty states consistent

### Task 5.3: Existing Functionality Regression Check

- [ ] Login works
- [ ] Sidebar navigation to every menu item works
- [ ] CRUD forms submit correctly
- [ ] POS flow (add to cart, checkout, payment) works
- [ ] Service order flow works
- [ ] Stock transfer/opname flows work
- [ ] Finance journal/expense flows work
- [ ] HR attendance/leave/payroll flows work
- [ ] Responsive layout works on mobile viewport

---

## Risks & Tradeoffs

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Build breakage** — shadcn components may have TypeScript/React 19 incompatibilities | High | Test build after each component install, pin compatible versions |
| **Style regression** — the current red theme (dc2626) may not map cleanly to shadcn CSS variables | Medium | Set `--primary` HSL values to match dc2626 exactly (0 100% 50%) |
| **Feature bloat** — refactoring every page could touch 125+ files, raising risk of bugs | High | **Phase 3 approach**: one menu group at a time, build + verify after each |
| **POS page complexity** — POS has the most intricate UI (cart, customer search, payment flow, keyboard shortcuts) | High | Refactor POS last, after patterns are proven on simpler pages |
| **React 19** — shadcn uses Radix which may not have full React 19 support | Medium | Check Radix compatibility; pin to known working shadcn/Rx versions |
| **Time** — ~43,600 lines across 125 files is substantial | High | Estimate: 20-30 hours for full migration. Focus on high-visibility pages first (dashboard, products, sales). |

---

## Open Questions for Discussion

1. **Approach:** Full migration in one pass (big bang) vs incremental (one menu per session)? **Recommend:** Incremental per menu group, deployed & tested each time.

2. **POS Page:** The POS interface is the most interactive page with custom components (cart, payment modal, barcode scanning). Should it use shadcn at all, or stay custom-styled with just the shared wrapper components (PageHeader)?

3. **Color System:** Current theme is Indonesia-red (`dc2626`/`#dc2626`) with gradient headers. shadcn's default is slate/blue. Do you want to:
   - (a) Keep the red gradient headers as-is (via PageHeader component)?
   - (b) Migrate fully to shadcn's standard styling?
   - (c) Custom shadcn theme with red as primary?

4. **Timeline:** Priority menu group to start with? (Master Data is smallest/cleanest — good pilot)

5. **Deployment:** Each phase should be deployed to homelab for review. Are you ok with incremental deploys as each menu group is migrated?

---

## Quick Stats

| Metric | Value |
|--------|-------|
| Page TSX files | ~125 |
| Total page LOC | ~43,600 |
| Menu groups | 10 |
| shadcn components to install | ~14 new |
| Shared components to create | 4-5 (PageHeader, StatCard, DataTable, SearchFilter) |
| Files to modify | ~100+ |
| Estimated effort | **20-30 hours** full, **2-3 hours** per menu group |
