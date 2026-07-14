# IGD-Orbit Frontend — Master Plan

> **Vision:** Modernize the entire IGD-Orbit frontend — consistent UI via shadcn, redesigned POS workflow inspired by Erzap, and targeted module adjustments per business needs.

**Status:** 🚧 Draft — open for discussion
**Last Updated:** 2026-07-13

---

## Table of Contents

1. [Overview & Guiding Principles](#1-overview--guiding-principles)
2. [Workstream A: shadcn/ui Migration](#2-workstream-a-shadcnui-migration)
3. [Workstream B: POS Redesign (Erzap-style)](#3-workstream-b-pos-redesign-erzap-style)
4. [Workstream C: Module Adjustments](#4-workstream-c-module-adjustments--tbd)
5. [Dependencies & Ordering](#5-dependencies--ordering)
6. [Rollout Strategy](#6-rollout-strategy)
7. [Risk Register](#7-risk-register)
8. [Open Questions](#8-open-questions)

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
| shadcn status | Partially set up (4 components installed) |

### Workstream Map

```
MASTER PLAN
├── A. shadcn/ui Migration ─────── Foundation → Layout → Patterns → Rollout → Cleanup
├── B. POS Redesign ─────────────── Invoice form → Table → Payment → API → Polish
└── C. Module Adjustments ───────── [TBD — add as needed]
```

---

## 2. Workstream A: shadcn/ui Migration

**Goal:** Replace all hand-rolled HTML/Tailwind patterns with standard shadcn components.
**Files:** ~125 TSX | **Effort:** 20-30 hours
**Full detail:** [shadcn-ui-migration.md](./2026-07-13_221500-shadcn-ui-migration.md)

### Phase Map

| Phase | What | Output | ~Time |
|-------|------|--------|-------|
| **A0** Foundation | Install 14 shadcn components + CSS vars | `components/ui/` populated | 15 min |
| **A1** Shared Patterns | Create `PageHeader`, `StatCard`, `DataTable`, `SearchFilter` | `components/shared/` | 30 min |
| **A2** Core Layout | Refactor sidebar (Sheet, DropdownMenu, Avatar) + user menu | `DashboardLayout.tsx` | 1 hr |
| **A3** Per-Menu Rollout | One menu group at a time (Master Data → Sales → Servis → Gudang → Keuangan → Pembelian → HR → User & Role) | All pages use shadcn | 2-3 hr each |
| **A4** Cleanup | Delete Modal.tsx, audit CSS vars, remove dead classes | Codebase clean | 30 min |

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

## 5. Dependencies & Ordering

**Decided sequence: Option C**

```
A0 (shadcn components install)
 │
 └──→ A1 (shared components: PageHeader, StatCard, etc.)
       │
       ├──→ (GROUP 1 — pilot) A3.1 Master Data rollout
       │         │
       │         └──→ (patterns validated, confidence built)
       │
       ├──→ (GROUP 2 — parallel) B0 POS API layer (backend + termin CRUD)
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
       ├──→ (GROUP 2 — parallel) A2 sidebar refactor
       │
       └──→ (GROUP 3) A3.2–A3.8 remaining menu rollout
             │
             └──→ A4 cleanup (after everything)
```

---

## 6. Rollout Strategy

**Recommendation:** Deploy to homelab after each workstream phase, NOT after every task.

```yaml
Deploy cadence:
  A0-A1:  one deploy (foundation, no visible change)
  A2:     one deploy (sidebar changes)
  A3.1:   one deploy (Master Data pages — first visible rollout)
  B1-B2:  one deploy (POS store + header — behind feature flag or unlinked)
  B3-B4:  one deploy (table + bottom section — testable but not replacing old POS)
  A3.2+:  one deploy per menu group
  B5-B6:  one deploy (POS goes live — swap routes)
  A4:     final cleanup deploy
```

### Feature Flag for POS
```typescript
// In POSPage — detect via localStorage or search param
// ?v2=true → show new POS
// Show toggle button in development only
const useNewPOS = import.meta.env.DEV && localStorage.getItem('pos-v2') === 'true';
```

---

## 7. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **POS Redesign breaks existing sales flow** | Medium | 🔴 High | Feature flag + parallel old/new POS until verified |
| **shadcn/Radix React 19 incompatibility** | Low | 🔴 High | Pin versions, test build immediately after install |
| **shadcn Select replaces native `<select>` — form behavior changes** | Medium | 🟡 Medium | Test all forms after A3 rollout of each menu |
| **POS table is complex to implement (editable cells, keyboard nav)** | High | 🟡 Medium | Start with basic table, add cell editing iteratively |
| **Backend API missing fields (salesperson, tax breakdown, draft)** | High | 🟡 Medium | Add backend endpoints in parallel, or hardcode defaults temporarily |
| **Scope creep — "module adjustments" grows unbounded** | Medium | 🟡 Medium | Each adjustment is gated by separate PRD/approval |
| **Build time increases with full migration** | Low | 🟢 Low | Keep vite config optimized |

---

## Decisions (Resolved)

| # | Question | Decision |
|---|----------|----------|
| 1 | **Ordering** | ✅ **Option C** — A0→A1→A3.1 (Master Data pilot) → B1 (POS store) + A2 (sidebar) in parallel → continue |
| 2 | **POS color scheme** | ✅ **(a) Follow our red theme** — consistent with rest of IGD-Orbit |
| 4 | **Cashback column** | ✅ **Not needed** — skip the @Cashback column entirely |
| 5 | **Tukar Tambah (Trade-in)** | ✅ **Not needed** — skip trade-in feature |
| 6 | **Excel import for product table** | ✅ **Not needed for v1** — could add later |
| 7 | **Module Adjustments** | ✅ **Placeholder** — discuss later as needs arise |

---

## Open Questions

1. ~~**Ordering:** Should POS redesign happen before or after shadcn migration on other menus? (see dependency graph above)~~ → **Decided: Option C**

2. ~~**POS color scheme:** The reference uses blue as primary. Our theme is red. Should the POS:
   - (a) Follow our red theme? 
   - (b) Match the reference blue (different module = different color)?
   - (c) Neutral/grey with accent colors per function?~~ → **Decided: (a) Red theme**

3. ~~**Backend readiness:** Do we need new API endpoints before POS redesign?
   - `GET /employees?role=sales` → salesperson list
   - `POST /sales/transactions/draft` → draft save
   - `POST /sales/transactions/:id/duplicate` → duplicate
   - `PATCH /sales/transactions/:id` → update draft
   - Tax breakdown fields in create/update payload
   - `salesType`, `paymentTerms`, `warehouseId` fields~~ → **Addressed: POS API layer B0 covers all of these**

4. ~~**Cashback:** Is per-item cashback a real requirement or nice-to-have? (affects table column layout)~~ → **Decided: Not needed**

5. ~~**Tukar Tambah (Trade-in):** Full workflow design needed — does the customer bring an old item to exchange? Is it a discount mechanism or a separate transaction type?~~ → **Decided: Not needed**

6. ~~**Excel import for product table:** Is this a must-have for launch, or stretch goal?~~ → **Decided: Not needed for v1, maybe later**

7. **Module Adjustments (C):** Do you have specific modules in mind already, or shall we add them as they come up?

---

## Appendix: Current File Inventory

### POS Files (to be replaced/refactored)
```
src/pages/sales/pos/POSPage.tsx               # 264 lines — main entry
src/pages/sales/pos/components/POSCart.tsx     # 417 lines — cart + discount
src/pages/sales/pos/components/POSCustomer.tsx # 332 lines — customer search
src/pages/sales/pos/components/POSActions.tsx  # 329 lines — notes, discount, hold
src/pages/sales/pos/components/PaymentModal.tsx# 279 lines — payment processing
src/stores/posStore.ts                         # 299 lines — state management
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
