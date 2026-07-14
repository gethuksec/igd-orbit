# POS Redesign — Erzap-style Sales Transaction Form

> **Goal:** Rebuild the POS from a split-panel layout into a single-page invoice form inspired by the Erzap "Pencatatan Transaksi Penjualan" reference.

**Parent:** [MASTER.md](./MASTER.md) — Workstream B
**Depends on:** Shared components from Workstream A Phase 0-1 (shadcn foundation)
**Effort:** 8-12 hours | **Files:** ~10 frontend + ~8 backend (create + modify)

---

## Reference Design

```
┌──────────────────────────────────────────────────────────────┐
│ [Duplikasi] [Draf]                                               │
├──────────────────────────────────────────────────────────────┤
│ *Outlet    *Termin   Tgl.JatuhTempo  *Sales   *TipeJual     │
│  [select]   [Tunai]  [____]          [select]  [select]      │
│ *Gudang     *Tgl.Faktur  *Pelanggan  Pajak: PPN ☑ Include.. │
│  [select→]   [25-06-26]  [🔍______]  PPH22 ☐ PPH23 ☐      │
│                              Transfer Outlet ☐ Kirim ☐       │
├──────────────────────────────────────────────────────────────┤
│ Qty<space>Scan Barcode atau Ketik Nama Barang    🔍          │
│ Daftar Barang              [☐ Tampilkan Bahan]                  │
│ ┌────┬──────────────┬────┬──────┬──────┬──────┐      │
│ │ ✕  │ No│ Barcode/..│ Jml│ Harga│Diskon│ Total│      │
│ ├────┼──────────────┼────┼──────┼──────┼──────┤      │
│ │ 🔴-│ 1 │ [🔍✏️]  │    │      │      │ 0    │      │
│ │ 🔴-│ 2 │ [🔍✏️]  │    │      │      │ 0    │      │
│ │ 🔴-│ 3 │ [🔍✏️]  │    │      │      │ 0    │      │
│ │ 🔴-│ 4 │ [🔍✏️]  │    │      │      │ 0    │      │
│ │ 🔴-│ 5 │ [🔍✏️]  │    │      │      │ 0    │      │
│ └────┴──────────────┴────┴──────┴──────┴──────┘      │
│ [+ Tambah Data]                                              │
├──────────────────────────────────────────────────────────────┤
│ Keterangan                                     Total Qty: 0  │
│ [___________________________]                  Subtotal: 0   │
│                                                                 │
├──────────────────────────────────────────────────────────────┤
│ F2=Simpan  F3=Simpan Sementara  F5=Refresh                SC│
└──────────────────────────────────────────────────────────────┘
```

---

## Gap Analysis

### 🟢 Already Have (keep/reuse)
- Product search with barcode scanning
- Customer search / quick-create
- Notes (receiptNotes + internalNotes)
- Item-level & transaction-level discount
- Hold/draft transaction
- Keyboard shortcuts (different keys)
- Payment methods (cash, card, transfer, e-wallet, credit)
- Receipt printing

### 🟡 Partial (modify)
- **Cart items** — currently card layout → needs to become editable table
- **Tax handling** — flat 11% → needs PPN/PPH breakdown
- **Draft hold** — exists but separate → needs F3 dedicated save

### ❌ Missing (new)
| # | Feature | Why It Matters |
|---|---------|----------------|
| 1 | **Outlet Penjual** field | Must select which branch — currently implicit, needs visible dropdown |
| 2 | **Termin** as header field | Payment terms chosen upfront, not in a separate modal |
| 3 | **Salesperson** field | Track who made the sale — links to HR/employee module |
| 4 | **Tipe Penjualan** | Retail vs Wholesale vs Other — different pricing/payment rules |
| 5 | **Tanggal Faktur** | Visible/editable invoice date |
| 6 | **Tanggal Jatuh Tempo** | Auto-calculated due date based on Termin |
| 7 | **Gudang** dropdown | Warehouse selection, dependent on outlet |
| 8 | **Tax breakdown** | PPN + Include PPN toggle + PPH22 + PPH23 checkboxes |
| 9 | **Transfer Outlet** checkbox | Cross-outlet transfer flag |
| 10 | **Barang Dikirim** checkbox | Goods-shipped flag |
| 11 | **Inline editable table** | Table with columns: No, Barcode/Produk, Jumlah, @Harga, @Diskon, Total |
| 12 | **Row-level search/edit** icons | In-row 🔍/✏️ to change product |
| 13 | **Qty<space>Barcode** syntax | Type "2 barcode123" to add 2 qty in one go |
| 14 | **Tambah Data** button | Add empty row to table |
| 15 | **Tampilkan Data Bahan** checkbox | Show raw material/BOM data |
| 16 | **Duplicate Sales** button | Clone existing transaction |
| 17 | **Draft Save** (F3) | Dedicated "Simpan Sementara" action |
| 18 | **Footer shortcut bar** | Persistent F2/F3/F5 bar |
| 19 | **Keterangan inline** | Notes field directly on form, not in modal |

---

## B0: POS API Layer (Backend)

POS needs its own set of **lightweight, POS-optimized endpoints** — same master tables but flat responses, no pagination metadata, no deep joins. These are served under `/api/v1/pos/`.

### B0.1 — POS Reference Data (page-load dropdowns)

| Endpoint | Purpose | Returns | 
|----------|---------|---------|
| `GET /pos/outlets` | Active outlet/branch list | `[{ id, code, name }]` — only active branches |
| `GET /pos/termin` | Payment terms list | `[{ id, name, days, isDefault }]` — from new PaymentTerms table |
| `GET /pos/sales-types` | Sales type enum | `[{ code, name }]` — e.g. Retail, Wholesale, Lainnya |
| `GET /pos/salespersons?outletId=x` | Salespeople at outlet | `[{ id, name }]` — from employees linked to users |
| `GET /pos/warehouses?outletId=x` | Warehouses at outlet | `[{ id, name }]` — branches where `isWarehouse=true` |

### B0.2 — POS Search (type-ahead, barcode scan)

| Endpoint | Purpose | Returns |
|----------|---------|---------|
| `GET /pos/products?q={query}&outletId=x` | Product search + barcode | `[{ id, name, sku, barcode, sellingPrice, stockAvailable, image }]` — flat, max 10 |
| `GET /pos/products/barcode/{code}?outletId=x` | Direct barcode lookup | Same shape as above, single result or 404 |
| `GET /pos/customers?q={query}` | Customer search | `[{ id, name, phone, tierName, creditRemaining }]` — merged tier info |

### B0.3 — POS Transactions (save, draft, duplicate)

| Endpoint | Purpose | Notes |
|----------|---------|-------|
| `POST /pos/transactions` | Create completed transaction | Same as existing `POST /sales/transactions` but accepts new fields |
| `POST /pos/transactions/draft` | Save as draft | Creates with status=held, returns draft ID |
| `GET /pos/transactions/drafts?outletId=x` | List drafts for outlet | Lightweight list for "resume draft" feature |
| `POST /pos/transactions/{id}/duplicate` | Clone transaction | Loads existing → creates new with same items |
| `POST /pos/transactions/{id}/receipt` | Generate receipt | Already exists |

### B0.4 — Payload Shape for `POST /pos/transactions`

```typescript
{
  // Header
  outletId: string;              // required
  terminId: string;              // required — maps to payment_term_id
  dueDate?: string;              // ISO date — required if Tempo
  salespersonId: string;         // required
  salesType: string;             // required — 'retail' | 'wholesale' | 'other'
  warehouseId: string;           // required
  invoiceDate: string;           // ISO date — defaults today
  invoiceNumber?: string;        // if manual invoice checked
  customerId?: string;           // optional, required for credit

  // Tax
  taxFlags: {
    ppn: boolean;
    includePpn: boolean;
    pph22: boolean;
    pph23: boolean;
  };

  // Flags
  transferOutlet: boolean;
  goodsShipped: boolean;

  // Items
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    discountPercentage?: number;
    discountAmount?: number;
    notes?: string;
  }>;

  // Notes
  receiptNotes?: string;
  internalNotes?: string;
}
```

### B0.5 — Backend Files to Create/Modify

| File | Action |
|------|--------|
| `backend/src/modules/pos/pos.module.ts` | **Create** — new module |
| `backend/src/modules/pos/pos.controller.ts` | **Create** — all /pos/* endpoints |
| `backend/src/modules/pos/pos.service.ts` | **Create** — query logic (lightweight) |
| `backend/src/modules/pos/dto/` | **Create** — POS-specific DTOs |
| `backend/prisma/schema.prisma` | **Modify** — add `PaymentTerm` model |
| `backend/src/modules/sales/dto/create-sales-transaction.dto.ts` | **Modify** — add new fields (terminId, taxFlags, salesType, warehouseId, etc.) |
| `backend/src/modules/sales/sales-transactions.service.ts` | **Modify** — add draft/duplicate methods + new field handling |

### B0.6 — New Prisma Model: PaymentTerm

```prisma
model PaymentTerm {
  id        String   @id @default(uuid())
  name      String              // "Tunai", "Tempo 30 Hari", "Kartu Kredit", "Transfer"
  days      Int                 // 0 = cash, 30 = net 30, etc. Used to calculate due date
  isActive  Boolean  @default(true)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("payment_terms")
}
```

**New master data page:** PaymentTerm CRUD under Master Data menu (simple List + Form).

## ❌ Not Needed (v1)
- **Cashback column** — removed from scope
- **Tukar Tambah (Trade-in)** — removed from scope
- **Excel import** — could add later, not needed for v1

---

## New Component Tree (Frontend)

```
POSPage (redesigned — replaces current POSPage)
│
├── PageHeader                          [from shared components]
│   ├── Title: "Pencatatan Transaksi Penjualan"
│   └── Actions: Duplikasi | Draf
│
├── TransactionForm                     [NEW — header fields section]
│   ├── Row 1: Outlet, Termin (+ add), Tgl Jatuh Tempo, Sales (+ add), Tipe Penjualan
│   ├── Row 2: Gudang, Tgl Faktur, Pelanggan (search combobox)
│   ├── TaxSection: PPN, Include PPN, PPH22, PPH23
│   └── Row 3: Transfer Outlet, Barang Dikirim checkboxes
│
├── ProductSearchBar                    [NEW — enhanced search]
│   ├── Input: "Qty<space>Scan Barcode atau Ketik Nama Barang"
│   ├── Parses "2 sku-name" → qty=2, product=sku-name
│   └── Search results dropdown
│
├── ProductTable                        [NEW — replaces POSCart]
│   ├── Table header: No, Barcode/Produk, Jumlah, @Harga, @Diskon, Total
│   ├── Each row: inline editable cells + 🔍✏️ icons + delete button
│   ├── Tampilkan Data Bahan checkbox
│   └── (Excel import — future)
│
├── TambahDataButton                    [+ Tambah Data] — adds empty row
│
├── NotesSection                        [NEW — replaces modal notes]
│   └── Keterangan textarea
│
├── TransactionSummary                  [NEW]
│   └── Total Qty | Sub Total (bottom right box)
│
└── FooterShortcutBar                   [NEW — persistent bar]
    ├── F2 = Simpan
    ├── F3 = Simpan Sementara
    └── F5 = Refresh
```

---

## Frontend Service: `posService.ts`

Create a dedicated POS API service that calls the `/pos/*` endpoints:

```typescript
// src/services/pos.service.ts
export const posService = {
  // Reference data
  getOutlets: () => api.get('/pos/outlets'),
  getTermin: () => api.get('/pos/termin'),
  getSalesTypes: () => api.get('/pos/sales-types'),
  getSalespersons: (outletId: string) => api.get(`/pos/salespersons?outletId=${outletId}`),
  getWarehouses: (outletId: string) => api.get(`/pos/warehouses?outletId=${outletId}`),

  // Search
  searchProducts: (query: string, outletId: string) =>
    api.get(`/pos/products?q=${encodeURIComponent(query)}&outletId=${outletId}`),
  getProductByBarcode: (barcode: string, outletId: string) =>
    api.get(`/pos/products/barcode/${encodeURIComponent(barcode)}?outletId=${outletId}`),
  searchCustomers: (query: string) =>
    api.get(`/pos/customers?q=${encodeURIComponent(query)}`),

  // Transactions
  create: (data: CreatePosTransactionDto) => api.post('/pos/transactions', data),
  saveDraft: (data: CreatePosTransactionDto) => api.post('/pos/transactions/draft', data),
  getDrafts: (outletId: string) => api.get(`/pos/transactions/drafts?outletId=${outletId}`),
  duplicate: (id: string) => api.post(`/pos/transactions/${id}/duplicate`),
  generateReceipt: (id: string) => api.post(`/pos/transactions/${id}/receipt`),

  // Excel import
  importExcel: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/pos/import/excel', formData);
  },
};
```

---

## Data Flow & Store Changes

### Zustand Store Extensions (`posStore.ts`)

**New fields to add:**
```typescript
interface POSStoreState {
  // ... existing cart, customer, discount, notes ...

  // NEW HEADER FIELDS
  outletId: string | null;
  terminId: string | null;            // FK to payment_terms
  terminName: string;                 // display name, e.g. "Tunai"
  terminDays: number;                 // 0 = cash, 30 = net 30
  dueDate: string | null;            // auto-calculated
  salespersonId: string | null;
  salesType: string;                  // 'retail' | 'wholesale' | 'other'
  warehouseId: string | null;
  invoiceDate: string;                // defaults to today
  manualInvoiceNumber: boolean;
  invoiceNumber: string;

  // NEW TAX
  taxFlags: {
    ppn: boolean;          // 11% VAT
    includePpn: boolean;   // price inclusive of VAT
    pph22: boolean;        // 2% income tax art 22
    pph23: boolean;        // 2% income tax art 23
  };

  // NEW CHECKBOXES
  transferOutlet: boolean;
  goodsShipped: boolean;

  // NEW TABLE FIELDS
  // (none — store item data already covers qty, price, discount)

  // NEW UI STATE
  isDraft: boolean;
}
```

### Tax Calculation Logic

```
subtotal = Σ (qty × unitPrice)

if (includePpn) {
  // Price already includes 11% VAT
  baseAmount = subtotal × 100/111   // DPP (Dasar Pengenaan Pajak)
  ppnAmount  = subtotal × 11/111
} else {
  baseAmount = subtotal
  ppnAmount  = subtotal × 0.11      // if PPN checked
}

pph22Amount = baseAmount × 0.02     // if PPH22 checked
pph23Amount = baseAmount × 0.02     // if PPH23 checked

total = baseAmount + ppnAmount + pph22Amount + pph23Amount
```

---

## Phase Plan

### B0: POS API Layer (Backend)

**Create:**
- `backend/src/modules/pos/` — module, controller, service, DTOs
- `backend/prisma/migrations/` — add PaymentTerm table

**Modify:**
- `backend/prisma/schema.prisma` — add `PaymentTerm` model
- `backend/src/modules/sales/dto/create-sales-transaction.dto.ts` — accept new fields
- `backend/src/modules/sales/sales-transactions.service.ts` — draft/duplicate

**Also:** New master data page for PaymentTerm CRUD (list + form)

**Verification:**
```bash
curl /api/v1/pos/termin         → [{ id, name, days, isDefault }]
curl /api/v1/pos/outlets        → [{ id, code, name }]
curl /api/v1/pos/products?q=iphone&outletId=x → [{ id, name, sku, stockAvailable }]
curl /api/v1/pos/customers?q=adi → [{ id, name, phone, tierName }]
```

---

### B1: Frontend Foundation — Store + Types + Service

**Files:**
- Create: `src/types/pos.ts` — shared interfaces (PosProduct, PosCustomer, PaymentTerm, TaxFlags)
- Create: `src/services/pos.service.ts` — dedicated POS API service
- Modify: `src/stores/posStore.ts` — add all new fields, tax calculation, draft flag

**Verification:**
```
Store logic: tax calculations with various flag combinations
```

---

### B2: Header Form Fields

**Create:** `src/pages/sales/pos/components/TransactionForm.tsx`

- Outlet select (populated from `GET /pos/outlets`)
- Termin select (populated from `GET /pos/termin`) with `+` quick-add → opens PaymentTerm modal
- Tanggal Jatuh Tempo (conditional on Termin.days > 0)
- Salesperson select (populated from `GET /pos/salespersons?outletId=`) with `+` quick-add
- Tipe Penjualan select (populated from `GET /pos/sales-types`)
- Gudang select (populated from `GET /pos/warehouses?outletId=`)
- Tanggal Faktur date picker (defaults to today)
- Pelanggan: search combobox (`GET /pos/customers?q=`)
- Tax checkboxes (PPN, Include PPN, PPH22, PPH23)
- Transfer Outlet + Barang Dikirim checkboxes
- Manual Invoice# checkbox + text input

---

### B3: Product Table

**Create:** `src/pages/sales/pos/components/ProductTable.tsx`

// Columns: Delete | No | Barcode/Produk | Jumlah | @Harga | @Diskon | Total

**Interactions:**
- Search bar parses "2 barcode123" → qty=2
- 🔍 icon → product search popover (`GET /pos/products?q=`)
- ✏️ icon → edit product reference
- Jumlah, @Harga, @Diskon, @Cashback → inline number inputs
- Total → computed (read-only)
- Arrow key navigation between cells
- "+ Tambah Data" adds empty row

**Excel import:** File upload → `POST /pos/import/excel`

---

### B4: Notes + Summary + Footer

**Create:** `NotesSection.tsx`, `TransactionSummary.tsx`, `FooterShortcutBar.tsx`

---

### B5: Save Logic + Keyboard Shortcuts

**Key bindings (remapped to reference):**
| Key | Action |
|-----|--------|
| `F2` | Save completed → `POST /pos/transactions` |
| `F3` | Save Draft → `POST /pos/transactions/draft` |
| `F5` | Refresh page data |
| `Escape` | Close popovers / cancel editing |

**Duplicate:** `POST /pos/transactions/{id}/duplicate` → fills form → user can edit + save

---

### B6: Integration + Polish

- Remove old POS components (`POSCart`, `POSCustomer`, `POSActions`, `PaymentModal`)
- Mobile responsive layout
- Feature flag: `pos-v2` localStorage toggle
- Full build verification

---

## Complete File Inventory

### Backend (new)
```
backend/src/modules/pos/
├── pos.module.ts
├── pos.controller.ts
├── pos.service.ts
└── dto/
    ├── index.ts
    ├── create-pos-transaction.dto.ts
    └── search-product.dto.ts

backend/prisma/schema.prisma          # + PaymentTerm model
backend/prisma/migrations/            # + payment_terms table

backend/src/modules/payment-terms/    # [new master data module]
├── payment-terms.module.ts
├── payment-terms.controller.ts
├── payment-terms.service.ts
└── dto/
```

### Frontend (new + modify)
```
src/services/pos.service.ts           # CREATE — dedicated POS API
src/types/pos.ts                      # CREATE — POS-specific types
src/stores/posStore.ts                # MODIFY — extend with new fields

src/pages/sales/pos/POSPage.tsx       # MODIFY — complete rewrite
src/pages/sales/pos/components/
├── TransactionForm.tsx               # CREATE — header fields
├── ProductTable.tsx                  # CREATE — editable table
├── NotesSection.tsx                  # CREATE — notes textarea
├── TransactionSummary.tsx            # CREATE — bottom summary
└── FooterShortcutBar.tsx             # CREATE — keyboard hint bar

src/pages/master-data/payment-terms/  # CREATE — Termin CRUD pages
├── PaymentTermList.tsx
├── PaymentTermForm.tsx
└── PaymentTermDetail.tsx
```

---

## Verification Checklist

### B0 (API layer)
- [ ] `GET /pos/termin` returns payment terms list
- [ ] `GET /pos/outlets` returns active branches
- [ ] `GET /pos/products?q=` returns flat product list
- [ ] `GET /pos/products/barcode/{code}` returns single product
- [ ] `GET /pos/customers?q=` returns flat customer list
- [ ] `POST /pos/transactions` creates with all new fields
- [ ] `POST /pos/transactions/draft` creates draft

### B1 (store + service)
- [ ] Store initializes with defaults for all new fields
- [ ] Tax calculation: all 8 flag combinations correct
- [ ] Due date auto-calculates when Termin has days > 0

### B2 (header form)
- [ ] All dropdowns populate from API
- [ ] Gudang filters by selected outlet
- [ ] Customer combobox searches
- [ ] Tax flags toggle correctly
- [ ] Jatuh Tempo shows/hides based on Termin

### B3 (product table)
- [ ] Barcode scan adds product
- [ ] "3 barcode" syntax adds 3 qty
- [ ] All columns editable
- [ ] Total auto-computes
- [ ] "+ Tambah Data" adds row
- [ ] Arrow key navigation

### B4 (notes + summary + footer)
- [ ] Keterangan textarea renders
- [ ] Summary shows correct Qty/Subtotal
- [ ] Footer bar displays with F2/F3/F5

### B5 (save + shortcuts)
- [ ] F2 validates → saves → receipt
- [ ] F3 saves as draft
- [ ] Duplicate loads existing data

### B6 (integration)
- [ ] Old POS components removed
- [ ] Build passes 0 errors
- [ ] Mobile responsive
