# IGD-Orbit Frontend — Master Plan

> **Vision:** Modernize the entire IGD-Orbit frontend — consistent UI via shadcn, redesigned POS workflow inspired by Erzap, and targeted module adjustments per business needs.

**Status:** 🟢 Active — in execution
**Last Updated:** 2026-07-24

---

## Table of Contents

1. [Overview & Guiding Principles](#1-overview--guiding-principles)
2. [Workstream A: shadcn/ui Migration](#2-workstream-a-shadcnui-migration)
3. [Workstream B: POS Redesign (Erzap-style)](#3-workstream-b-pos-redesign-erzap-style)
4. [Workstream C: Module Adjustments](#4-workstream-c-module-adjustments--tbd)
5. [Workstream D: Organization Architecture (User/Branch/Warehouse/Role)](#5-workstream-d-organization-architecture-userbranchwarehouserole)
6. [Workstream E: Service Module Redesign](#6-workstream-e-service-module-redesign--pending-discussion)
7. [Dependencies & Ordering](#7-dependencies--ordering)
8. [Rollout Strategy](#8-rollout-strategy)
9. [Risk Register](#9-risk-register)
10. [Open Questions](#10-open-questions)

---

## 1. Overview & Guiding Principles

### Principles
- **Backward compatibility** — existing data & APIs don't change
- **Incremental delivery** — deploy & verify each workstream independently
- **Consistency first** — establish shared components before major redesigns
- **User testing** — every redesign gets validated against the live deployment

### Project at a Glance

| Metric | Value |
|--------|-------|
| Page TSX files | ~125 |
| Total page LOC | ~43,600 |
| Menu groups | 10 |
| Current UI pattern | Hand-rolled Tailwind (repetitive inline classes) |
| State management | Zustand + React Query |
| Routing | React Router v6 |
| Forms | react-hook-form (some pages) / manual (most pages) |
| Icons | lucide-react |
| CSS Framework | Tailwind CSS v3 + css variables |
| shadcn status | ✅ Fully set up (14 components installed) |
| Shared components | ✅ PageHeader, StatCard, DataTable, SearchFilter, FormCard (5 shared) |
| Master Data migration | ✅ Complete (all 13 menus use shadcn/shared) |
| Build status | ✅ `tsc -b && vite build` — 0 errors |

### Workstream Map

```
MASTER PLAN
├── A. shadcn/ui Migration ─────── Foundation → Layout → Patterns → Rollout → Cleanup
├── B. POS Redesign ─────────────── Invoice form → Table → Payment → API → Polish
├── C. Module Adjustments ───────── [TBD — add as needed]
├── D. Organization Architecture ── Branch → Warehouse → Role → User assignments
└── E. Service Redesign ─────────── [Pending discussion — Erzap-style service page]
```

---

## 2. Workstream A: shadcn/ui Migration

**Goal:** Replace all hand-rolled HTML/Tailwind patterns with standard shadcn components.
**Files:** ~125 TSX | **Effort:** 20-30 hours
**Full detail:** [shadcn-ui-migration.md](./2026-07-13_221500-shadcn-ui-migration.md)

### Phase Map

| Phase | What | Output | ~Time |
|-------|------|--------|-------|
| **A0** Foundation | Install 14 shadcn components + CSS vars | ✅ `components/ui/` populated | ✅ Done |
| **A1** Shared Patterns | Create `PageHeader`, `StatCard`, `DataTable`, `SearchFilter`, `FormCard` | ✅ `components/shared/` | ✅ Done |
| **A2** Core Layout | Refactor sidebar (Sheet, DropdownMenu, Avatar) + user menu | ✅ Extracted MenuGroup/MenuItem components, shadcn Button everywhere, DropdownMenu in sidebar bottom | ✅ Done |
| **A3.1** Master Data Pilot | All 13 menus refactored to shadcn/shared components | ✅ Products, Categories, Brands, Units, Prices, Taxes, Discounts, Customers, Suppliers, Expenses, Giro, Sources, Expenditures | ✅ Done |
| **A3.2–A3.8** Remaining Menus | Sales → Servis → Gudang → Keuangan → Pembelian → HR → User & Role | ✅ All headers refactored to `<PageHeader>`, simple list pages use `<DataTable>` | ✅ Done |
| **A4** Cleanup | Mark Modal.tsx as `@deprecated` with migration guide, note dead CSS for future cleanup | Modal.tsx marked deprecated | ✅ Done |
| **A5** Navbar Restructure | Remove search bar, simplify top header | `DashboardLayout.tsx` header | ✅ Done |
| **Infra (bonus)** | VM memory fixes: swap + Node memory cap + BuildKit cache + SW cache-busting | 🖥️ igd-vm + nginx | ✅ Done |

### Phase A5 Details: Navbar Restructure

**Objective:** Simplify the top header bar by removing the site-wide search bar and cleaning up the remaining controls.

**Current state:** The top bar has: [desktop sidebar toggle] [search bar] [branch selector] [notifications] [user dropdown]. The search bar is underutilized — it doesn't provide useful results across modules and adds visual clutter.

**Scope:**
- Remove the search input + icon from the header
- Tighten spacing between remaining elements (sidebar toggle, branch selector, notifications, user menu)
- Keep the sticky header behavior and shadow styling
- No changes to the user dropdown or notification bell (already refactored in A2)

**Modify:** `src/layouts/DashboardLayout.tsx` (header section only)

### Key Dependencies
- A0 → A1 → A2 → A3 → A4 (strict order)
- A0 must finish before B starts (POS redesign uses shared components)
- A3 and B can overlap (POS is excluded from A3)

---

## 3. Workstream B: POS Redesign (Erzap-style)

**Goal:** Rebuild the POS from a split-panel layout into a single-page invoice form matching the Erzap reference.
**Files:** ~10 files (create + modify) | **Effort:** 8-12 hours
**Depends on:** Shared components from A1 (PageHeader, shadcn Input, Select, Card, Table, Dialog, etc.)
**Full detail:** [pos-redesign-erzap.md](./2026-07-13_223000-pos-redesign-erzap.md)

**NEW:** Now includes **B0 — POS API Layer** with dedicated `/api/v1/pos/*` endpoints and a new `PaymentTerm` master data module.

### Reference Design

The reference is an ERP-style "Pencatatan Transaksi Penjualan" form with:

```
┌──────────────────────────────────────────────────────────────┐
│ [Duplikasi] [Draf] [Tukar Tambah]                           │
├──────────────────────────────────────────────────────────────┤
│ *Outlet    *Termin   Tgl.JatuhTempo  *Sales   *TipeJual     │
│  [select]   [Tunai]  [____]          [select]  [select]      │
│ *Gudang     *Tgl.Faktur  *Pelanggan  Pajak: PPN ☑ Include.. │
│  [select→]   [25-06-26]  [🔍______]  PPH22 ☐ PPH23 ☐      │
│                              Transfer Outlet ☐ Kirim ☐       │
├──────────────────────────────────────────────────────────────┤
│ Qty<space>Scan Barcode atau Ketik Nama Barang    🔍          │
│ Daftar Barang              [☐ Tampilkan Bahan] [Excel↓]     │
│ ┌────┬──────────────┬────┬──────┬──────┬────┬────────┐      │
│ │ ✕  │ No│ Barcode/..│ Jml│ Harga│Diskon│ Tot│ Cashbk│      │
│ ├────┼──────────────┼────┼──────┼──────┼────┼────────┤      │
│ │ 🔴-│ 1 │ [🔍✏️]  │    │      │      │ 0  │        │      │
│ │ 🔴-│ 2 │ [🔍✏️]  │    │      │      │ 0  │        │      │
│ │ 🔴-│ 3 │ [🔍✏️]  │    │      │      │ 0  │        │      │
│ │ 🔴-│ 4 │ [🔍✏️]  │    │      │      │ 0  │        │      │
│ │ 🔴-│ 5 │ [🔍✏️]  │    │      │      │ 0  │        │      │
│ └────┴──────────────┴────┴──────┴──────┴────┴────────┘      │
│ [+ Tambah Data]                                              │
├──────────────────────────────────────────────────────────────┤
│ Keterangan                                     Total Qty: 0  │
│ [___________________________]                  Subtotal: 0   │
│                                                                 │
├──────────────────────────────────────────────────────────────┤
│ F2=Simpan  F3=Simpan Sementara  F5=Refresh                SC│
└──────────────────────────────────────────────────────────────┘
```

### B.1 — Gap Analysis (Current vs Reference)

| # | Feature | Current | Target | Priority |
|---|---------|---------|--------|----------|
| 1 | **Outlet Penjual** field | Implicit (branch store) | Visible dropdown | 🔴 High |
| 2 | **Termin** (payment terms) | In PaymentModal | Header dropdown (Tunai/Tempo) | 🔴 High |
| 3 | **Tipe Penjualan** (sales type) | ❌ Missing | Dropdown (Retail/Wholesale/etc) | 🔴 High |
| 4 | **Salesperson** field | ❌ Missing | Dropdown with + add | 🔴 High |
| 5 | **Tanggal Faktur** | ❌ Not displayed | Editable date field | 🟡 Medium |
| 6 | **Tanggal Jatuh Tempo** | ❌ Missing | Auto-fills based on Termin | 🟡 Medium |
| 7 | **Gudang** dropdown | Implicit (branch) | Visible, dependent on Outlet | 🔴 High |
| 8 | **Inline product table** | Card layout (POSCart) | Full editable table with columns | 🔴 High |
| 9 | **Tax breakdown** (PPN/PPH) | Flat 11% | PPN, PPH22, PPH23 checkboxes + include-PPN toggle | 🔴 High |
| 10 | **Harga include PPN** toggle | ❌ Missing | Checkbox to toggle tax-inclusive pricing | 🔴 High |
| 11 | **Transfer Outlet** checkbox | ❌ Missing | Flag for cross-outlet | 🟡 Medium |
| 12 | **Barang Dikirim** checkbox | ❌ Missing | Flag for goods shipped | 🟡 Medium |
| 13 | **Cashback column** | ❌ Missing | Per-item cashback tracking | 🟡 Medium |
| 14 | **Qty<space>Barcode** syntax | Raw barcode search | "2 barcode123" adds 2 qty | 🔴 High |
| 15 | **Row-level search/edit** | ❌ Missing | In-row 🔍/✏️ icons to change product | 🟡 Medium |
| 16 | **Excel import** | ❌ Missing | "Isi Table via Excel" link | 🟢 Low |
| 17 | **Tambah Data** button | Search then auto-add | Add empty row button | 🟡 Medium |
| 18 | **Duplicate Sales** button | ❌ Missing | Clone current transaction | 🟡 Medium |
| 19 | **Draft Save** | Hold (via Actions) | "Simpan Sementara" button | 🟡 Medium |
| 20 | **Tukar Tambah** (trade-in) | ❌ Missing | Trade-in/exchange workflow | 🟢 Low |
| 21 | **Footer shortcut bar** | ❌ Missing | Persistent F2/F3/F5 shortcut bar | 🟡 Medium |
| 22 | **Keterangan** (notes) | In Actions modal | Inline textarea on main form | 🔴 High |

### B.2 — New Component Tree

```
POSPage (redesigned)
├── PageHeader                    [from A1 shared]
│   ├── Title: "Pencatatan Transaksi Penjualan"
│   ├── Action buttons: Duplikasi | Draf | Tukar Tambah
│   └── Manual Invoice# checkbox
├── TransactionForm               [NEW — header fields]
│   ├── OutletPenjual (Select)
│   ├── Termin (Select: Tunai/Tempo) + quick-add
│   ├── TanggalJatuhTempo (DatePicker) — visible when Tempo
│   ├── Salesperson (Select) + quick-add
│   ├── TipePenjualan (Select)
│   ├── Gudang (Select — dependent on Outlet)
│   ├── TanggalFaktur (DatePicker)
│   ├── Pelanggan (Combobox — search + select)
│   ├── TaxSection (checkboxes: PPN, IncludePPN, PPH22, PPH23)
│   ├── TransferOutlet (Checkbox)
│   └── BarangDikirim (Checkbox)
├── ProductSearchBar              [NEW]
│   ├── Input with Qty<space>barcode parse logic
│   └── Search results dropdown (product search)
├── ProductTable                  [NEW — replaces POSCart]
│   ├── Table with columns: ✕ | No | Barcode/Produk | Jumlah | @Harga | @Diskon | Total | @Cashback
│   ├── Row: delete button, inline editing, search/edit icons
│   ├── TampilkanDataBahan (Checkbox)
│   └── IsiTableViaExcel (Upload trigger)
├── TambahDataButton              [+ Tambah Data green button]
├── Keterangan (Textarea)          [moved from Actions modal → inline]
├── TransactionSummary            [NEW — bottom right]
│   ├── Total Qty
│   └── Sub Total
└── FooterShortcutBar             [NEW — persistent bottom bar]
    ├── F2 = Simpan
    ├── F3 = Simpan Sementara
    └── F5 = Refresh
```

### B.3 — Data Flow Changes

| Concept | Current POS | Target POS |
|---------|-------------|------------|
| **Payment** | Modal after "Bayar" click | Termin dropdown + due date (payment is a field, not a screen) |
| **Tax** | Flat 11% hardcoded | PPN checkbox (11%) + PPH22 (2%) + PPH23 (2%) + include-PPN toggle |
| **Cart** | Zustand store (POSCart) | Zustand store (same) but rendered as table |
| **Save** | Only completed via PaymentModal | F2=Save (completed), F3=Save Draft |
| **Customer** | Separate right panel | Inline in form header |
| **Notes** | Separate modal | Inline textarea on main form |
| **Warehouse** | Implicit from branch | Visible dropdown, dependent on outlet |
| **Salesperson** | Not tracked | Visible dropdown, links to employee/HR module |

### B.4 — Phased Implementation

#### Phase B1: Foundation (shared + store)

**Files to create/modify:**
- `src/stores/posStore.ts` — **extend** (add: salesType, salespersonId, outletId, warehouseId, invoiceDate, dueDate, paymentTerms, taxFlags, cashback per item)
- `src/types/pos.ts` — **create** (shared types: SalesType, PaymentTerm, TaxFlags, etc.)
- `src/services/sales.service.ts` — **extend** (add draft save, duplicate, trade-in endpoints)

**Tests:**
- Store calculations with new tax flags (PPN + PPH combinations)
- Payment terms → due date calculation

#### Phase B2: Header Form Fields

**Create:** `src/pages/sales/pos/components/TransactionForm.tsx`
- Outlet, Termin, Salesperson, Tipe Penjualan, Gudang, Tanggal Faktur, Tanggal Jatuh Tempo (conditional)
- Customer combobox with search
- Tax section (PPN, include PPN, PPH22, PPH23)
- Transfer Outlet + Barang Dikirim checkboxes
- Manual Invoice# checkbox

**Data sources:**
- Outlets/branches → `useBranchStore` + `publicService.getBranches()`
- Salespeople → new API endpoint or from HR employees module
- Payment terms → seed in store or API
- Sales types → seed in store or API

#### Phase B3: Product Table

**Create:** `src/pages/sales/pos/components/ProductTable.tsx`
- shadcn `<Table>` with editable inline cells
- Columns: ✕ (delete), No, Barcode/Produk (with 🔍✏️), Jumlah, @Harga, @Diskon, Total, @Cashback
- Qty<space>Barcode parsing logic in search bar
- Row add/remove
- Excel upload handler (stretch)

**Key interactions:**
- Clicking 🔍 opens product search popover
- Clicking product name cell toggles edit mode
- Arrow key navigation between cells (like a spreadsheet)
- "Tambah Data" button adds empty row

#### Phase B4: Bottom Section + Actions

**Create:** `src/pages/sales/pos/components/TransactionNotes.tsx`
**Create:** `src/pages/sales/pos/components/TransactionSummary.tsx`
**Create:** `src/pages/sales/pos/components/FooterShortcutBar.tsx`

- Keterangan textarea (inline, not modal)
- Summary box (Total Qty, Sub Total)
- Keyboard shortcut bar (F2=Simpan, F3=Draf, F5=Refresh)
- Save/Draft action handlers

#### Phase B5: Payment & Save Logic

**Modify:** `src/stores/posStore.ts` — wire up save logic
**Modify:** `src/services/sales.service.ts` — proper draft + duplicate + trade-in

- **F2 → Save**: Validate required fields, call `createTransaction()`, open receipt print
- **F3 → Save Draft**: Call `saveDraft()`, store in held transactions
- **Duplicate**: Load existing transaction data into new form
- **Tukar Tambah**: Flag transaction as trade-in (special discount/workflow)

#### Phase B6: Integration + Polish

- Wire up keyboard shortcuts (F2, F3, F5)
- Wire up quick-add `+` buttons (new Termin, new Salesperson)
- Add mobile responsive adaptation (collapse header fields)
- Remove old POS components (POSCart, POSCustomer, POSActions, PaymentModal)
- Update routing if needed

### B.5 — Verification

After each phase:
```bash
cd frontend && npm run build
```

End-to-end test (after B5):
1. ✅ Fill all header fields
2. ✅ Search product by barcode → adds to table
3. ✅ Type "2<space>barcode" → adds 2 qty
4. ✅ Edit quantity/price/discount in table
5. ✅ Set payment terms to Tempo → due date visible
6. ✅ Enable PPN → tax calculated
7. ✅ Save as completed (F2) → receipt prints
8. ✅ Save as draft (F3) → appears in held transactions
9. ✅ Duplicate existing transaction
10. ✅ Tukar Tambah flow

---

## 4. Workstream C: Module Adjustments

*This section is reserved for future module refinements. Add as needed:*

| Module | Adjustment | Priority | Status |
|--------|-----------|----------|--------|
| — | — | — | 🟢 TBD |

**Note:** Each module adjustment should be its own mini-plan with scope, files, effort estimation, and verification.

---

## 5. Workstream D: Organization Architecture (User/Branch/Warehouse/Role)

**Goal:** Redesign the organization data model — clean separation between Branch (outlet), Warehouse, User, and Role. Simplify roles (title-only, no granular permission system).

**Decided:** 2026-07-24 | **Status:** 🟡 Planned (not started) | **Effort:** ~8-12 hours

### D.1 — Reference Design (Erzap-style)

Outlet list page with search/filter sidebar:

```
┌───────────────────────────────────────────────────────────┐
│ [Blue top bar] ERP INDONESIA                     [🌐][🔍] │
├────┬──────────────────────────────────────────────────────┤
│ 🏠 │ Daftar Outlet                         Pencarian     │
│ 🔍 │ ┌────┬─────┬──────────┬──────┬────── ───┐ ┌──────┐ │
│ 🔄 │ │ No │Grup │ Kode     │ Nama │ Kota ...  │ │Nama  │ │
│ 🚪 │ ├────┼─────┼──────────┼──────┼───────────┤ │Outlet│ │
│    │ │ 1  │IGD  │1GCKG15183│Spare │ Jember    │ │______│ │
│    │ │ 2  │IGD  │1FXH217005│Kalis │ Jember    │ │CP    │ │
│    │ │ .. │     │          │      │           │ │______│ │
│    │ └────┴─────┴──────────┴──────┴───────────┘ │Status│ │
│    │ Total data = 4                       [F5=...]│ [v]  │ │
│    │                                          │Kota  │ │
│    │                                          │______│ │
│    │                                          │Alamat│ │
│    │                                          │______│ │
│    │                                          │ ...  │ │
│    │                                          │[Cari]│ │
│    └──────────────────────────────────────────┴──────┘ │
└───────────────────────────────────────────────────────────┘
```

### D.2 — Data Model

#### Branch (outlet only — pure selling location)

```prisma
model Branch {
  id             String    @id @default(uuid())
  code           String    @unique
  name           String
  group          String?   // e.g. "IGD Group"
  city           String?
  address        String?
  phone          String?
  email          String?
  director       String?
  contactPerson  String?
  mobilePhone    String?
  isActive       Boolean   @default(true)
  operatingHours Json?     // JSONB: {"monday": {"open": "08:00", "close": "22:00"}, ...}
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  // Relations
  warehouses    Warehouse[]      // 1 outlet → N warehouses
  userBranches  UserBranch[]
  // Keep existing relations: salesTransactions, serviceOrders, etc.
}
```

#### Warehouse (separate table — exclusive to one outlet)

```prisma
model Warehouse {
  id             String    @id @default(uuid())
  code           String    @unique
  name           String
  city           String?
  address        String?
  phone          String?
  email          String?
  contactPerson  String?
  mobilePhone    String?
  isActive       Boolean   @default(true)
  outletId       String    @map("outlet_id")  // FK → Branch.id (exclusive)
  outlet         Branch    @relation(fields: [outletId], references: [id])

  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  // Relations
  productStocks      ProductStock[]    // stock lives here
  stockMovements     StockMovement[]
  stockTransfersFrom StockTransfer[]   @relation("StockTransferFrom")
  stockTransfersTo   StockTransfer[]   @relation("StockTransferTo")
  stockOpnames       StockOpname[]
  purchaseOrders     PurchaseOrder[]
  goodsReceipts      GoodsReceipt[]
}
```

#### Role (standalone CRUD — title only, no permission system)

```prisma
model Role {
  id          String    @id @default(uuid())
  code        String    @unique
  name        String
  description String?
  level       Int       // Hierarchical level (0=SUPERADMIN, 1=OWNER, 2=MANAGER, etc.)
  isActive    Boolean   @default(true)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  userBranches UserBranch[]
}
```

**Removed:** `Permission`, `RolePermission`, `RoleMenuAccess` tables. Menu visibility is driven by `Role.level` (simple numeric hierarchy) + hardcoded checks per module.

#### UserBranch (user → outlet + role assignment)

```prisma
model UserBranch {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  branchId  String   @map("branch_id")   // outlet only (NOT warehouse)
  roleId    String   @map("role_id")
  isPrimary Boolean  @default(false)

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  branch Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)
  role   Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([userId, branchId, roleId])
  @@index([userId])
  @@index([branchId])
  @@index([roleId])
  @@map("user_branches")
}
```

#### User (simplified — no role/outlet directly on user)

```prisma
model User {
  id                  String    @id @default(uuid())
  email               String    @unique
  username            String?   @unique
  passwordHash        String    @map("password_hash")
  fullName            String?
  phone               String?
  isActive            Boolean   @default(true)
  isVerified          Boolean   @default(false)
  failedLoginAttempts Int       @default(0)
  lockedUntil         DateTime?
  banReason           String?
  lastLoginAt         DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // Relations
  userBranches UserBranch[]
  employee     Employee?
  // Keep existing relations: transactions, service orders, etc.
}
```

### D.3 — Key Rules

| Rule | Detail |
|------|--------|
| **Branch = outlet** | `Branch` type removed. No `isWarehouse` flag. Pure selling locations. |
| **Warehouse exclusive** | `Warehouse.outletId` FK. 1 outlet → N warehouses. No sharing. |
| **Users → outlets only** | `UserBranch.branchId` references outlets only. Users cannot be assigned to warehouses directly. |
| **Warehouse access** | Users access warehouses through their outlet assignment + warehouse selection in forms. |
| **Role = title** | No `Permission`/`RolePermission`/`RoleMenuAccess`. Menu access driven by `Role.level` + hardcoded checks. |
| **User multi-outlet** | User can have multiple `UserBranch` records (different outlet + same or different role). |

### D.4 — CRUD Pages

| Page | Path | Description |
|------|------|-------------|
| **Outlet List** | `/outlets` | Erzap-style table + search sidebar. Columns: No, Grup, Kode, Nama, Kota, Telepon, Email, Direktur, CP, Handphone |
| **Outlet Form** | `/outlets/new`, `/outlets/:id/edit` | Create/edit outlet |
| **Outlet Detail** | `/outlets/:id` | View outlet detail + list of its warehouses |
| **Warehouse List** | `/warehouses` | Filterable by parent outlet. Columns: No, Kode, Nama, Outlet Induk, Kota, CP, Telepon |
| **Warehouse Form** | `/warehouses/new`, `/warehouses/:id/edit` | Create/edit — outletId selects parent outlet |
| **Warehouse Detail** | `/warehouses/:id` | View warehouse detail |
| **Role List** | `/roles` | Simple table: No, Kode, Nama, Level, Status |
| **Role Form** | `/roles/new`, `/roles/:id/edit` | Create/edit — code, name, description, level |
| **User List** | `/users` | Update to show UserBranch assignments |
| **User Form** | `/users/:id/edit` | Assign user to outlets + select role per assignment |

### D.5 — Migration Steps

| Phase | What | Files | ~Time |
|-------|------|-------|-------|
| **D1** Prisma schema | Create Warehouse model, simplify Role, create UserBranch, update Branch (drop type/isWarehouse), update User | `schema.prisma` + migration | 1.5h |
| **D2** Backend CRUD | Warehouse module (list/create/edit/detail). Role module (simplified CRUD). Branch module (clean outlet-only). Update User module (UserBranch assignments). | `backend/src/modules/warehouse/`, `backend/src/modules/role/`, `backend/src/modules/branch/`, `backend/src/modules/user/` | 3h |
| **D3** Frontend: Outlet pages | Outlet List (Erzap-style), Outlet Form, Outlet Detail, Warehouse List/Form/Detail | `frontend/src/pages/outlets/`, `frontend/src/pages/warehouses/` | 3h |
| **D4** Frontend: Role + User pages | Role List/Form (simplified), update User form with UserBranch assignments | `frontend/src/pages/roles/`, `frontend/src/pages/users/` | 2h |
| **D5** POS integration | Update POS header: outlet dropdown → Branch, warehouse dropdown → Warehouse (filtered by outlet), salesperson → filtered by UserBranch | `POSTransaksi.tsx`, `posStore.ts` | 1.5h |
| **D6** Data migration | Seed script: migrate existing Branch records → split outlets vs warehouses. Migrate UserRole → UserBranch. | `seed.ts`, migration script | 1h |

### D.6 — Open Questions

1. **`Role.level` thresholding**: What level number for each role? (SUPERADMIN=0, OWNER=1, MANAGER=2, SPV=3, STAFF=4?)
2. **Menu visibility**: Should it be purely `Role.level` based (e.g. level ≤ 1 sees everything) or need per-role menu config?
3. **User default branch**: When a user logs in and has multiple outlet assignments, which one is default? (a) Last used, (b) Primary flag, (c) First in list
4. **Existing data migration**: What to do with current Branch records that have `isWarehouse=true` or `type="warehouse"`?

---

## 6. Workstream E: Service Module Redesign (Erzap-style Smart Repair)

**Goal:** Redesign the service intake page into an Erzap-style "Smart Repair" form with two flows — Quick Service and Rawat Inap (Inpatient). Keep the same structure current users are familiar with, but use shadcn components.

**Status:** 🟡 Planned | **Effort:** ~10-15 hours | **Depends on:** Workstream B (POS patterns), Workstream D (warehouse/outlet model)

### E.1 — Reference Design

Two service flows from Erzap:

#### Rawat Inap (Full Service Intake)

```
┌──────────────────────────────────────────────────────────────────┐
│ Inputkan data lalu tekan tombol Simpan untuk menyimpan           │
├──────────────────────────────────────────────────────────────────┤
│ Smart Repair                                                     │
│ Jenis Servis:  ○ Quick Servis  ● Rawat Inap  ○ Klaim Garansi     │
├──────────────────────────────────────────────────────────────────┤
│ *Outlet     *Pelanggan [🔍][📋][+]  *Termin     Pajak             │
│  [select]    [______________]        [select]    ☐PPN ☐IncPPN   │
│                                                 ☐PPH22 ☐PPH23   │
│ *Tgl Terima  Estimasi Selesai   *Penerima    Tipe Penjualan      │
│  [16-07-26]  [______________]    [________]   [select]           │
├──────────────────────────────────────────────────────────────────┤
│ Data Servis                                                      │
│ *Serial Number [🔍]  *Nama Barang [🔍]                          │
│ ☐ Dalam Garansi  Tgl Akhir Garansi: [________]                  │
│ Lampiran: [Pilih File] Tidak ada file yang dipilih              │
│                                                                  │
│ *Deskripsi Kerusakan     Kelengkapan        Kondisi Barang       │
│ [____________________]   [_______________]   [_______________]   │
├──────────────────────────────────────────────────────────────────┤
│ *Teknisi [🔍]  *Bobot Pekerjaan [v]  Harga Jual Servis [____]  │
│ *Tindakan [______________]                                      │
│ Catatan (tidak tampil pada nota)                                 │
│ [____________________________________________________________] │
├──────────────────────────────────────────────────────────────────┤
│ [Tambah Data Unit]                    Uang Muka: [__________]   │
└──────────────────────────────────────────────────────────────────┘
```

#### Quick Service (Lightweight — Spare Parts Focus)

```
┌──────────────────────────────────────────────────────────────────┐
│ Inputkan data lalu tekan tombol Simpan untuk menyimpan           │
├──────────────────────────────────────────────────────────────────┤
│ Smart Repair                                                     │
│ Jenis Servis:  ● Quick Servis  ○ Rawat Inap  ○ Klaim Garansi     │
├──────────────────────────────────────────────────────────────────┤
│ *Outlet   *Pelanggan [🔍][📋][+]  *Termin    Pajak               │
│  [select]  [______________]        [select]   ☐PPN ☐IncPPN     │
│                                               ☐PPH22 ☐PPH23     │
├──────────────────────────────────────────────────────────────────┤
│ *Gudang: [Tentukan Outlet Penjual]   Catatan (tidak tampil)      │
├──────────────────────────────────────────────────────────────────┤
│ Qty <spasi> Scan Barcode atau Ketik Nama Barang    🔍            │
│ Daftar Barang        [Tambah Produk +]   [Isi Table via Excel↓]│
│ ┌────┬──────────────┬────┬──────┬──────┬────────┐               │
│ │ ✕  │ No│ Barcode/..│ Jml│ Harga│Diskon│  Total │               │
│ ├────┼──────────────┼────┼──────┼──────┼────────┤               │
│ │ 🔴-│ 1 │ [🔍✏️]  │    │      │      │  0     │               │
│ │ 🔴-│ 2 │ [🔍✏️]  │    │      │      │  0     │               │
│ │ 🔴-│ 3 │ [🔍✏️]  │    │      │      │  0     │               │
│ │ 🔴-│ 4 │ [🔍✏️]  │    │      │      │  0     │               │
│ │ 🔴-│ 5 │ [🔍✏️]  │    │      │      │  0     │               │
│ └────┴──────────────┴────┴──────┴──────┴────────┘               │
│ [Tambah Data Part +]                                             │
├──────────────────────────────────────────────────────────────────┤
│ Harga Pokok Servis : Rp 0.00                                     │
│ Total Jasa         : Rp 0.00                                     │
│ Total Spare Part   : Rp 0.00                                     │
│ Ongkos Kirim        : 0.0                                        │
├──────────────────────────────────────────────────────────────────┤
│ F2=Simpan  F3=Simpan Sementara  F5=Refresh                    SC│
└──────────────────────────────────────────────────────────────────┘
```

### E.2 — Gap Analysis (Current Service Orders vs Erzap Reference)

| # | Feature | Current | Target | Priority |
|---|---------|---------|--------|----------|
| 1 | **Service type tabs** (Quick/Rawat Inap/Klaim) | Single form (serviceSubType) | Tabbed interface with conditional sections | 🔴 High |
| 2 | **Outlet selection** | branchId (implicit) | Visible dropdown (same as POS) | 🔴 High |
| 3 | **Customer search** | Separate customer modal | Inline 🔍 combobox + 📋 grid + ➕ quick-add | 🔴 High |
| 4 | **Termin + Tax** | Missing (no tax on services) | Termin dropdown + PPN/PPH checkboxes (same as POS) | 🔴 High |
| 5 | **Device serial/IMEI** | Text field | Input with search icon | 🟡 Medium |
| 6 | **Device name/brand** | deviceType + deviceUnit split | Single "*Nama Barang" field with search | 🔴 High |
| 7 | **Warranty tracking** | ❌ Missing | Dalam Garansi checkbox + Tgl Akhir Garansi | 🟡 Medium |
| 8 | **Attachment upload** | ❌ Missing | File upload with "Pilih File" button | 🟢 Low |
| 9 | **Damage description** | complaint field | Large textarea (same) | 🟡 Medium |
| 10 | **Accessories checklist** | accessoriesIncluded (JSON) | Large textarea (simpler UX) | 🟡 Medium |
| 11 | **Device condition** | deviceCondition | Large textarea (same) | 🟡 Medium |
| 12 | **Technician assignment** | assignedTechnicianId | Teknisi field with 🔍 search | 🔴 High |
| 13 | **Work weight (Bobot)** | ❌ Missing | Dropdown (Ringan/Sedang/Berat) | 🟡 Medium |
| 14 | **Service sell price** | laborCost | Harga Jual Servis input | 🔴 High |
| 15 | **Tindakan (action)** | workNotes? | Dedicated input field | 🟡 Medium |
| 16 | **Quick Service product table** | ❌ Missing | Same as POS — barcode search, inline table | 🔴 High |
| 17 | **Bottom cost summary** | Estimated separately | Harga Pokok Servis, Total Jasa, Total Spare Part, Ongkir | 🔴 High |
| 18 | **Down payment (Uang Muka)** | ❌ Missing | Uang Muka input field | 🟡 Medium |
| 19 | **Duplicate POS-style footer** | ❌ Missing | F2/F3/F5 shortcut bar | 🟡 Medium |
| 20 | **Notes (not on receipt)** | workNotes? | Catatan textarea (same as POS) | 🟡 Medium |
| 21 | **Service Number auto-generation** | Existing (SRV-*) | Keep as-is | 🟢 Low |

### E.3 — Component Tree

```
SmartRepairPage                              [NEW — main entry]
├── InstructionBanner                        [shared pattern]
│   └── "Inputkan data lalu tekan tombol Simpan untuk menyimpan"
├── PageHeader                               [from A1 shared]
│   └── Title: "Smart Repair"
├── ServiceTypeTabs                          [NEW — tabs/radio group]
│   ├── Quick Servis (tab)
│   ├── Rawat Inap (tab) — default/active
│   └── Klaim Garansi Servis (tab)
├── TransactionHeader                        [REUSE from B — same as POS]
│   ├── Outlet (Select — same as POS)
│   ├── Pelanggan (Combobox — 🔍 + 📋 + ➕)
│   ├── Termin (Select)
│   ├── TaxSection (PPN, IncludePPN, PPH22, PPH23 — same as POS)
│   ├── TanggalTerima (DatePicker)
│   ├── EstimasiSelesai (DatePicker)
│   ├── Penerima (Input)
│   └── TipePenjualan (Select)
├── DeviceInfoSection                       [NEW — Rawat Inap only]
│   ├── SerialNumber (Input + 🔍)
│   ├── NamaBarang (Input + 🔍)
│   ├── WarrantySection (checkbox + expiry date)
│   └── Lampiran (file upload)
├── DamageSection                           [NEW — Rawat Inap only]
│   ├── DeskripsiKerusakan (textarea)
│   ├── Kelengkapan (textarea)
│   └── KondisiBarang (textarea)
├── QuickServiceSection                     [REUSE from B — Quick Service only]
│   ├── Gudang (Select — same as POS, filtered by outlet)
│   ├── ProductSearchBar (same as POS — Qty<space>barcode)
│   ├── ProductTable (same as POS — inline editable table)
│   │   └── Columns: ✕ | No | Barcode/Produk | Jml | Harga | Diskon | Total
│   ├── TambahDataButton
│   └── Notes (Catatan textarea)
├── TechnicianSection                       [NEW — Rawat Inap only]
│   ├── Teknisi (Input + 🔍)
│   ├── BobotPekerjaan (Select)
│   ├── HargaJualServis (Input — numeric)
│   ├── Tindakan (Input)
│   └── Catatan (textarea — not on receipt)
├── CostSummary                             [NEW — Quick Service]
│   ├── HargaPokokServis
│   ├── TotalJasa
│   ├── TotalSparePart
│   └── OngkosKirim
├── DownPayment                             [NEW — Rawat Inap]
│   └── UangMuka (Input)
└── FooterShortcutBar                       [REUSE from B — F2/F3/F5]
```

### E.4 — Data Flow Changes

| Concept | Current | Target |
|---------|---------|--------|
| **Service type** | serviceSubType string | Tabbed UI → sets serviceSubType ('quick'/'inap'/'garansi') |
| **Customer** | customerName + phone (manual) | Combobox search → autofills from existing customers |
| **Device** | deviceType + deviceUnit (split) | "*Nama Barang" single field with product search |
| **Warranty** | Not tracked | Checkbox → enables expiry date field |
| **Attachments** | Not supported | File upload → stored as URL/path |
| **Tax** | Not applied | PPN/PPH checkboxes → affects pricing calculation |
| **Spare parts** | Not tracked (manual) | Product table (same as POS) → stored as ServiceOrderItems |
| **Technician** | assignedTechnicianId | Searchable field filtered by outlet assignment |
| **Cost breakdown** | partsCost + laborCost (flat) | Harga Pokok, Total Jasa, Total Spare Part, Ongkir |
| **Down payment** | Not tracked | Uang Muka → stored as payment deposit |

### E.5 — Phased Implementation

| Phase | What | Key Files | ~Time |
|-------|------|-----------|-------|
| **E1** Foundation | Create ServiceStore (Zustand), shared types, new DTO for service transactions | `stores/serviceStore.ts`, `types/service.ts`, `services/service.service.ts` | 1.5h |
| **E2** Header + Tabs | ServiceTypeTabs, TransactionHeader (reuse from POS with service fields), Outlet/Customer/Termin/Tax | `SmartRepairPage.tsx`, `components/ServiceTypeTabs.tsx`, `components/ServiceHeader.tsx` | 2h |
| **E3** Rawat Inap sections | DeviceInfoSection, DamageSection, TechnicianSection | `components/DeviceInfo.tsx`, `components/DamageSection.tsx`, `components/TechnicianSection.tsx` | 2h |
| **E4** Quick Service section | Reuse POS product table + search bar, Gudang selector, CostSummary | `components/QuickServiceParts.tsx`, `components/CostSummary.tsx` | 2h |
| **E5** Save + Payment | Save handler (F2/F3), Uang Muka, receipt print | Service store wiring, `components/DownPayment.tsx` | 1.5h |
| **E6** Integration + Polish | Wire to existing routes, remove old ServiceOrder pages, add sidebar | Route updates, sidebar "Servis" menu, cleanup | 1h |
| **E7** Existing data migration | Migrate existing service orders to new schema fields if needed | Seed/migration script | 0.5h |

### E.6 — Key Design Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | **Single page vs multi-step** | Single page with tabs (Rawat Inap / Quick Servis). Tab switch hides/shows conditional sections. Matches Erzap. |
| 2 | **Product table reuse** | Same `ProductTable` component as POS — shared, not duplicated. Columns configurable (Quick Service has no @Cashback). |
| 3 | **Route path** | `/services/smart-repair` or keep at `/service-orders/new`? |
| 4 | **Quick Service vs Rawat Inap** | Quick Service = lightweight (just product table + cost). Rawat Inap = full form (device info, technician, pricing). Both possible from same page via tab. |
| 5 | **Old vs new** | Keep old `ServiceOrderForm.tsx` alongside during transition, or replace entirely? |
| 6 | **Service number** | Keep existing `SRV-YYYYMMDD-XXXXXX` auto-generation |

### E.7 — Verification

End-to-end test (after E5):

1. Open Smart Repair page → Rawat Inap tab selected by default
2. Fill outlet, customer, termin
3. Enter serial number, device name, damage description
4. Assign technician, set work weight and service price
5. Switch to Quick Service tab → form collapses to product table
6. Search product by barcode → adds to table
7. Edit qty/price/discount inline
8. Verify cost summary updates (Harga Pokok, Total Jasa, Total Spare Part)
9. Save as completed (F2) → service order created
10. Save as draft (F3) → appears in held/draft list

---

## 7. Dependencies & Ordering

**Decided sequence: Option C**

```
✅ A0 (shadcn components install)
 │
 └──→ ✅ A1 (shared components: PageHeader, StatCard, DataTable, SearchFilter, FormCard)
       │
       ├──→ ✅ (GROUP 1 — pilot) ✅ A3.1 Master Data rollout
       │         │
       │         └──→ ✅ (patterns validated, confidence built)
       │
       ├──→ ⌛ (GROUP 2 — parallel) B0 POS API layer (backend + termin CRUD)
       │                              │
       │                              └──→ B1 POS store + types ──→ B2 POS form fields
       │                                                              │
       │                                                        B3 POS product table
       │                                                              │
       │                                                        B4 POS notes + summary
       │                                                              │
       │                                                        B5 POS save logic
       │                                                              │
       │                                                        B6 POS polish + cleanup
       │
       ├──→ ⌛ (GROUP 2 — parallel) A2 sidebar refactor
       │
       └──→ ⌛ (GROUP 3) A3.2–A3.8 remaining menu rollout
             │
             └──→ ⌛ A4 cleanup (after everything)
```

**New workstreams can run in parallel after current ones complete.** D (Organization Architecture) depends on nothing except completing the current POS polish. E (Service Redesign) depends on D (needs warehouse/outlet model).

```
⌛ B6 (ongoing) ──→ 🟡 D (Organization Architecture)
                                        │
                                  └──→ E (Service Redesign)
```

---

## 8. Rollout Strategy

**Recommendation:** Deploy to homelab after each workstream phase, NOT after every task.

```yaml
Deploy cadence:
  A0-A1:  one deploy (foundation, no visible change) ✅ Done
  A2:     one deploy (sidebar changes) ✅ Done
  A3.1:   one deploy (Master Data pages — first visible rollout) ✅ Done + verified
  B1-B2:  one deploy (POS store + header — behind feature flag or unlinked)
  B3-B4:  one deploy (table + bottom section — testable but not replacing old POS)
  A3.2+:  one deploy per menu group
  B5-B6:  one deploy (POS goes live — swap routes)
  A4:     final cleanup deploy
  D1-D2:  one deploy (schema + backend — no visible change)
  D3-D5:  one deploy (frontend pages + POS integration)
  D6:     one deploy (data migration + seed)
  E:      TBD
```

### Feature Flag for POS
```typescript
// In POSPage — detect via localStorage or search param
// ?v2=true → show new POS
// Show toggle button in development only
const useNewPOS = import.meta.env.DEV && localStorage.getItem('pos-v2') === 'true';
```

---

## 9. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **POS Redesign breaks existing sales flow** | Medium | 🔴 High | Feature flag + parallel old/new POS until verified |
| **shadcn/Radix React 19 incompatibility** | Low | 🔴 High | Pin versions, test build immediately after install |
| **shadcn Select replaces native `<select>` — form behavior changes** | Medium | 🟡 Medium | Test all forms after A3 rollout of each menu |
| **POS table is complex to implement (editable cells, keyboard nav)** | High | 🟡 Medium | Start with basic table, add cell editing iteratively |
| **Backend API missing fields (salesperson, tax breakdown, draft)** | High | 🟡 Medium | Add backend endpoints in parallel, or hardcode defaults temporarily |
| **Scope creep — "module adjustments" grows unbounded** | Medium | 🟡 Medium | Each adjustment is gated by separate PRD/approval |
| **Build time increases with full migration** | Low | 🟢 Low | Keep vite config optimized |
| **D data migration — existing Branch records with isWarehouse=true** | Medium | 🟡 Medium | Write careful migration script, test on backup first |
| **Service Redesign scope unclear** | Medium | 🟡 Medium | Discuss + document requirements before starting |

---

## 10. Open Questions

1. ~~**Ordering:** Should POS redesign happen before or after shadcn migration on other menus?~~ → **Decided: Option C**

2. ~~**POS color scheme:** The reference uses blue as primary. Our theme is red. Should the POS:
   - (a) Follow our red theme? 
   - (b) Match the reference blue (different module = different color)?
   - (c) Neutral/grey with accent colors per function?~~ → **Decided: (a) Red theme**

3. ~~**Backend readiness:** Do we need new API endpoints before POS redesign?~~ → **Addressed: POS API layer B0 covers all of these**

4. ~~**Cashback:** Is per-item cashback a real requirement or nice-to-have?~~ → **Decided: Not needed**

5. ~~**Tukar Tambah (Trade-in):** Full workflow design needed~~ → **Decided: Not needed**

6. ~~**Excel import for product table:** Is this a must-have for launch, or stretch goal?~~ → **Decided: Not needed for v1, maybe later**

7. **Module Adjustments (C):** Do you have specific modules in mind already, or shall we add them as they come up?

8. **Branch Selector Mechanism:** How should branch data be handled during actions (creating transactions, inventory operations, etc.)? Current approach uses a global Zustand store (`useBranchStore`) with `currentBranchId` injected into API calls via interceptor. Need to decide:
   - (a) **Keep current store-based approach** — branchId in Zustand, API picks it up automatically
   - (b) **Explicit per-action** — pass branchId in every mutation payload, no implicit store reads
   - (c) **Hybrid** — store for display/default, explicit for submission (user confirms branch before each action)

9. **Role.level thresholding (from D.6):** What level number for each role?

10. **Menu visibility:** Per-role menu config or purely level-based?

11. **User default branch:** When user has multiple outlet assignments, which is default?

12. **Data migration:** How to handle existing Branch records with `isWarehouse=true` or `type="warehouse"`?

---

## Resolved: ServiceWorker Cache Strategy

| # | Question | Decision |
|---|----------|----------|
| 9 | **SW cache-busting on every build:** Ensure users always get fresh JS/CSS after deploy without manual cache clear | **nginx: no-cache for `/sw.js`** + **SW activate deletes all `igd-erp-*` caches** — every deploy = fresh cache. See `nginx.conf` + `public/sw.js`. |

---

## Appendix: Current File Inventory

### POS Files (current)
```
src/pages/pos/POSTransaksi.tsx            # 771 lines — new POS redesign entry
src/layouts/POSLayout.tsx                 # POS full-page layout (no sidebar)
src/stores/posStore.ts                    # 299 lines — state management (old, may be removed)
```

### Files to Create (POS Redesign)
```
src/pages/sales/pos/components/TransactionForm.tsx
src/pages/sales/pos/components/ProductTable.tsx
src/pages/sales/pos/components/TransactionNotes.tsx
src/pages/sales/pos/components/TransactionSummary.tsx
src/pages/sales/pos/components/FooterShortcutBar.tsx
src/types/pos.ts
```
