# E — Service Module Redesign (Smart Repair)

**Status:** 🟡 Planned
**Effort:** FE ~6-10h + BE ~4-6h
**Depends on:** Workstream D schema (Warehouse, Branch). FE can start with current API / mock data.

---

## Reference

Two flows from Erzap + physical IGD Ponsel SERVICE FORM:

**Rawat Inap:** Full service intake — device info, damage description, kelengkapan checklist, technician assignment, pricing.

**Quick Service:** Lightweight — header fields + product table (reuses POS components) + cost summary.

## Split Scope

| Layer | Effort | What |
|-------|--------|------|
| **E-FE** Frontend | ~6-10h | SmartRepairPage, all UI components, reuse POS patterns |
| **E-BE** Backend | ~4-6h | Kelengkapan CRUD, warehouse endpoints, tax/down payment fields |

---

## Reference Diagrams

### Rawat Inap

```
Smart Repair
Jenis Servis:  ○ Quick Servis  ● Rawat Inap  ○ Klaim Garansi (v2)

*Outlet     *Pelanggan [🔍][📋][+]  *Termin     ☐PPN ☐IncPPN ☐PPH22 ☐PPH23
*Tgl Terima  Estimasi Selesai       *Penerima   Tipe Penjualan

Data Servis
*Serial Number [🔍]  *Nama Barang [🔍]  ☐ Dalam Garansi  Tgl Akhir: [____]

*Deskripsi & Kondisi:
[_________________________________________________]

Kelengkapan:
☐ Slot SIM    [______]    ☐ Mic Speaker  [______]
☐ Speaker Atas[______]    ☐ Buzzer       [______]
☐ Tombol      [______]    ☐ [empty]
☐ Back casing [______]    ☐ [empty]
☐ SIM         [______]    [+ Tambah]
...

*Teknisi [🔍]  *Bobot [v]  Harga Jual Servis [____]  *Tindakan [____]
Catatan (tidak tampil pada nota): [____________________]

Uang Muka: [__________]
```

### Quick Service

```
*Gudang: [select]   Catatan: [____________________]

Qty <spasi> Scan Barcode atau Ketik Nama Barang    🔍
Daftar Barang        [Tambah Produk +]
┌────┬──────────────┬────┬──────┬──────┬────────┐
│ ✕  │ No│ Barcode  │ Jml│ Harga│Diskon│ Total  │
├────┼──────────────┼────┼──────┼──────┼────────┤
│ 🔴-│ 1 │ [🔍✏️]  │    │      │      │ 0      │
│ 🔴-│ 2 │ [🔍✏️]  │    │      │      │ 0      │
└────┴──────────────┴────┴──────┴──────┴────────┘

Harga Pokok Servis : Rp 0.00   (auto: spare parts + jasa + ongkir)
Total Jasa         : Rp 0.00
Total Spare Part   : Rp 0.00   (auto: sum of product table)
Ongkos Kirim       : Rp 0.00

F2=Simpan  F3=Simpan Sementara  F5=Refresh
```

---

## Component Tree

```
SmartRepairPage                              [NEW]
├── InstructionBanner                        [shared pattern — "Inputkan data lalu..."]
├── PageHeader                               [from A1]
│   └── Title: "Smart Repair"
├── ServiceTypeTabs                          [NEW — radio group or tabs]
│   ├── Quick Servis
│   ├── Rawat Inap (default)
│   └── Klaim Garansi (v2 — deferred)
├── TransactionHeader                        [REUSE from POS]
│   ├── Outlet, Pelanggan, Termin, Tax
│   └── Extra: TanggalTerima, EstimasiSelesai, Penerima, TipePenjualan
├── [if Rawat Inap:]
│   ├── DeviceInfoSection
│   │   ├── SerialNumber (input + 🔍)
│   │   ├── NamaBarang (input + 🔍)
│   │   └── WarrantySection (checkbox + expiry date)
│   ├── DamageSection
│   │   ├── Deskripsi & Kondisi (textarea — merged)
│   │   └── KelengkapanChecklist (dynamic — see E.8)
│   └── TechnicianSection
│       ├── Teknisi (input + 🔍)
│       ├── BobotPekerjaan (select)
│       ├── HargaJualServis (input — numeric)
│       ├── Tindakan (input)
│       └── Catatan (textarea — not on receipt)
├── [if Quick Service:]
│   ├── QuickServiceSection
│   │   ├── Gudang (select — filtered by outlet)
│   │   ├── ProductSearchBar (REUSE from POS)
│   │   ├── ProductTable (REUSE from POS — without cashback column)
│   │   ├── TambahDataButton
│   │   └── Notes (textarea)
│   └── CostSummary
│       ├── HargaPokokServis (auto: totalSparePart + totalJasa + ongkir)
│       ├── TotalJasa (manual input)
│       ├── TotalSparePart (auto: sum of product table)
│       └── OngkosKirim (manual input)
├── DownPayment                             [Rawat Inap only]
│   └── UangMuka (input)
└── FooterShortcutBar                       [REUSE from POS — F2/F3/F5]
```

---

## Implementation Phases

### E-BE1: ServiceCheckpoint model + CRUD
- Add `ServiceCheckpoint` model (name, isActive, sortOrder)
- CRUD endpoints: `GET/POST/PUT/DELETE /api/v1/service-checkpoints`
- `GET /api/v1/service-checkpoints/active` — returns isActive=true sorted
- Seed default checkpoints (Slot SIM, Speaker, Tombol, Back casing, etc.)

### E-BE2: Extend ServiceOrder API
- Add fields: `warehouseId`, `taxPpn`, `taxIncPpn`, `taxPph22`, `taxPph23`, `downPayment`, `completenessItems` (JSON)
- Update DTOs and service logic
- Calculate totals including tax

### E-BE3: Support endpoints
- `GET /api/v1/employees/technicians?outletId=X` — filter by outlet
- Ensure auto service number generation works for new flow

### E-FE1: Foundation
- Create `stores/serviceStore.ts` (Zustand)
- Create `types/service.ts`
- Create `services/service.service.ts` (API calls)
- Define all TS interfaces matching the form

### E-FE2: Page shell + Header
- Create `SmartRepairPage.tsx` (main page)
- `ServiceTypeTabs.tsx` — radio group or tab component
- Reuse `TransactionHeader` from POS — add service-specific fields via props

### E-FE3: Rawat Inap sections
- `DeviceInfo.tsx` — Serial, Nama Barang, Warranty
- `DamageSection.tsx` — Deskripsi & Kondisi textarea
- `KelengkapanChecklist.tsx` — dynamic checklist (2-column layout)

### E-FE4: Technician + Summary
- `TechnicianSection.tsx` — Teknisi, Bobot, Harga Jual, Tindakan, Catatan
- `CostSummary.tsx` — auto-calculated fields
- `DownPayment.tsx` — Uang Muka input

### E-FE5: Quick Service + Footer
- Reuse `ProductSearchBar`, `ProductTable`, `FooterShortcutBar` from POS
- Wire up save logic (F2 = save, F3 = draft)

### E-FE6: Integration
- Add route: `/services/smart-repair`
- Add to sidebar under "Servis" menu
- Replace old `ServiceOrderForm.tsx` or keep alongside

### E-FE7: Kelengkapan CRUD page
- `/service-checkpoints` route
- Table with No, Nama, Status, Urutan, Aksi
- Add/edit/delete/reorder checkpoints

---

## Kelengkapan CRUD System (E.8 in master plan)

### Data Model

```prisma
model ServiceCheckpoint {
  id        String   @id @default(uuid())
  name      String
  isActive  Boolean  @default(true)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive, sortOrder])
  @@map("service_checkpoints")
}
```

### Storage on ServiceOrder

```prisma
model ServiceOrder {
  // ... existing fields
  completenessItems Json? @map("completeness_items")
  // JSONB: [{checkpointId, name, checked: bool, conditionNote: string}]
}
```

### CRUD page (`/service-checkpoints`)
| Column | Control |
|--------|---------|
| No | Auto |
| Nama Item | Text input |
| Status | Toggle active/inactive |
| Urutan | Number input |
| Aksi | Edit / Delete |

### Form behavior
- Loads all active checkpoints sorted by sortOrder
- Arranged in 2 columns (matching physical form)
- Each row: `☐ [Nama]` + `[condition note]`
- "+ Tambah" button for one-off items (stored in JSON only)

### Seed data
Slot SIM, Speaker Atas, Tombol, Back casing, SIM, Memory Card, LCD, Kamera, Mic Speaker, Buzzer

---

## Design Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Single page vs multi-step | Single page with tabs |
| 2 | Product table | REUSE from POS (shared component) |
| 3 | Route | `/services/smart-repair` |
| 4 | Klaim Garansi | Deferred to v2 |
| 5 | Attachment upload | Deferred to v2 |
| 6 | Deskripsi + Kondisi | Merged into 1 textarea |
| 7 | Kelengkapan | CRUD-managed with defaults + inline add |
| 8 | Service number | Keep existing `SRV-YYYYMMDD-XXXXXX` |
| 9 | Old vs new | Keep old alongside during transition |

## Verification

1. Rawat Inap: fill all fields → save → service order created
2. Quick Service: search barcode → adds to table → cost auto-calculates → save
3. Kelengkapan: active items appear as checkboxes → one-off add works
4. Technician: search by outlet → select → assigned
5. Tax: PPN/PPH checkboxes → affects total
6. Down payment: enter amount → stored
7. F2 = save, F3 = draft
