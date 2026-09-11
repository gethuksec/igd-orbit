# PO/GR Workstream — Plan & Change Log

**Date:** 2026-09-11 · **Owner:** dev agent · **Tracker:** Plane IGDERP · **Base:** `origin/main` @ `d008a2b` · **Branch:** `ws-po-create-v2`

---

## 0. State audit (verified 2026-09-11)

- **`origin/main` = `d008a2b` "Merge ws-f-po-receiving-upload" (2026-09-07 18:42 WIB)** — contains all recent purchasing/inventory work:
  - IGDERP-80 — receiving workflow (per-item check, approve/reject/revisit, GR events trail, approval settings)
  - IGDERP-81 — PO/GR document attachments (+ mandatory-invoice gate on approve, per approval-setting)
  - IGDERP-167 — PO approval flow v2 (pending-first, split actions, reject endpoint, approval queue page, GR prefill from PO + remaining cap, settings modal)
  - IGDERP-159 — central-good warehouse (SYSTEM/GOOD), IGDERP-139/140 — Transfer Stock v2 + Mutasi v2, QA batch (65/66/68/69/58)
- **Prod (igd-vm):** container build 2026-09-07 19:36 WIB; deploy checkout = `ws-request-stock` @ `70f2078` (main + 5 request-stock commits). Verified on prod: BE `stock-requests` module present; BE strings "Invoice wajib diunggah…" + central-good; FE markers "Terima Semua"/"Sisa". So prod = request-stock **preview build**, not a main build.
- **Not merged:** `ws-request-stock` (5 commits — IGDERP-164/165/166, status Needs Review). Separate workstream; out of PO/GR scope. Merge + main rebuild = coordination item.
- **Pitfall for future audits:** the shared clone's local `main` ref was stale (`b6ae6f6`, pre-merge). Always compare against `origin/main` after `git fetch`.
- **Branch housekeeping:** `origin/ws-f-po-receiving-upload` deleted after merge (local worktree copy still exists).

## 1. What's changed — decision changelog (latest decision wins)

| # | Topic | Before | Now (locked) | Impl status |
|---|-------|--------|--------------|-------------|
| 1 | PO input timing | Flexible; stock could be entered before the document (IGDERP-81 caveat) | PO created **only after supplier DO/invoice exists** (record-after-DO). Discipline: don't create PO after goods arrive — analytics = PO date vs delivery date | Partial (draft removed → created `pending` ✓; invoice still not required ✗) |
| 2 | Invoice document upload | Optional; after approval; mandate-via-permission (IGDERP-81) | **Mandatory at creation** (reverses the 81 caveat) | ✗ Pending |
| 3 | Destination warehouse | "Target outlet" field — outlet/warehouse first, then distribution | Always **central-good**; outlet selection removed from PO | Partial — receiving lands central-good ✓ (159/80); PO/GR forms still carry branch ✗ |
| 4 | PO actions | approve / reject / send order / **cancel** (Sep 7 build) | approve / reject / **revisi** — **no cancel**; **no manual "send order"** (record-after-DO — see §4 D3); reject note mandatory | Partial — reject+note ✓; cancel + send-order still present ✗; "revisi" (edit rejected) missing ✗ |
| 5 | PO initial status | `draft` → `pending` | Created directly `pending`, no draft | ✓ Done (167) |
| 6 | Termin | Free-form CASH/COD/CREDIT + free days on the PO form | **Shared termin master** (tunai vs termin, Net 14/30/60/90 — same master as POS/customers); cash disables termin; **due = invoice date + term**; overdue notice (payables) | Partial — master exists (B0), used by POS/customers; PO not wired ✗; due date ✗ |
| 7 | GR flow | approve → stock in | Per-item receiving check (pesan vs diterima vs rusak) + "check all", **partial qty**, recheck/**revisi loop to SODO with reason**, rejected → **central-bad** (never enters central-good), full history | ✓ Built (80/167) — QA pending |
| 8 | GR source | — | From PO (**approved/ordered**) **or standalone (hibah)**; qty capped to PO remaining | ✓ Built (prefill + cap + hibah) |
| 9 | Item entry | Search existing products only | Master + **quick-add new product** (mandatory fields + tier price) + Excel import ("most common" — client: export/import *belakangan*) | Partial — search ✓; quick-add ✗; Excel import deferred (§4 D4) |
| 10 | Margin / pricing | — | Unit price + margin **reference display** on PO lines (beli vs harga jual) — **no writes to product master**; per-product PO-value history lives in the activity-log / finance items (see §2) | ✗ Pending |
| 11 | Invoice total check | — | PO total must match supplier invoice — enforced via **creation confirm modal** (checkbox, no value input — §4 D1) | ✗ Pending |
| 12 | Purchase returns | — | Retur Pembelian per invoice → reduces central-good, parks in **central-bad**; receiving-discrepancy **auto-create checkbox** (not forced) | Partial — reject-at-receiving → central-bad ✓; return module ✗; checkbox ✗ |
| 13 | Barcode | Manual print, one by one | **Auto-print after approval** + label/printer settings (position, size, barcode/QR, paper, columns). Client to send existing label format (blocker) | ✗ Pending |
| 14 | Approval tiers | hardcoded: <5M CSO; 5–50M +CFO; >50M +OWNER. GR configurable via Approval Settings | Keep as-is for now — confirmation open (IGDERP-163, awaiting owner) | No change |
| 15 | OCR / DO scan | — | Future; not now | Out |
| 16 | Buffer | — | "Buffer = PO recommendation + allocation" — client's next topic after this batch (IGDERP-105) | Out of scope |

Supersedes notes: 8 Sep §5–§6 (locked) > 27 Aug §9 (warehouse model) > 6 Aug §5–§6 > earlier. IGDERP-81 stays completed/untouched — changes tracked as follow-ups.

## 2. Remaining scope (Plane items)

| Item | Plane ID | Priority | Slice |
|------|----------|----------|-------|
| Purchase: invoice creation + temporary (draft/transit) storage, permanent save after receiving | IGDERP-79 (`471a5424`) | high | S1 |
| PO — invoice upload mandatory at creation [08 Sep, ref 81] | `a4353fe9` | medium | S1 |
| PO/POS — shared termin master (tunai vs termin, Net 14/30/60/90) | `cda254f1` | low | S2 |
| Purchase: edit-after-approval policy (locked by default; permission + reason + audit log) | IGDERP-82 (`f15af39b`) | medium | S3 |
| Purchase return (Retur Pembelian): per invoice, auto-reduces stock | `bf95dbbf` | medium | S4 |
| Purchase: auto-create purchase return checkbox on receiving discrepancy | IGDERP-83 (`289ce3cd`) | medium | S4 |
| Barcode auto-print after purchase approval + label/printer settings | `fc7b9d65` | medium | S5 |
| PO — DO scan/OCR pre-fill (future) | `a5ce262b` | low | out |
| Konfirmasi: PO approval tiers — configurable vs hardcoded | IGDERP-163 (`81372be5`) | medium | decision — close when owner confirms |

Adjacent / cross-referenced (not this workstream): import contract `a364be5b` (PO item import decision), buffer IGDERP-105, RequestStock merge (164/165/166).
**Product-history cross-refs (per D2):** "each PO value per product with stocks" → **`424b15d1` Product activity log: global vs detail modes** + deeper invoice drill-down ("stock per cost") → **`c34ad1a0` Inventory — cost layers + FIFO outflow + margin (finance round)**. No extra S1 work needed — PO unit prices/references are already stored per item and stock movement, so those items can build on existing data.

## 3. Slice plan

### S0 — Hygiene (no product code)
- Post merge-evidence comments on 80/81/167/159/139/140 (merge hash `d008a2b` + prod markers).
- Run the **full backend suite on merged main** (`d008a2b`); record result.
- Coordinate: request-stock merge (owner) + when to rebuild main on prod (deploy gate — explicit go only).

### S1 — PO Creation v2: invoice + transit semantics *(IGDERP-79 + a4353fe9)* — the core slice
**Scope — BE**
- Schema `PurchaseOrder` += `invoiceNumber` (required at create), `invoiceDate`, `dueDate` (derived; server-side). Migration + backfill strategy for existing rows (nullable historical fields).
- `branchId`: stop requiring; remove from create DTO/UI (keep column for legacy; destination is central-good).
- `create()`: validate invoice no; compute `dueDate` (S2: from termin master; interim: from `payment_term_days`); totals unchanged; status `pending` (no draft — stays).
- **Remove PO `cancel`** (controller guard + FE) and **remove manual `send order`**; GR becomes available right after approve (accept GR from `approved`, or auto-transition to `ordered` on approve — implementation detail; receiving transitions updated accordingly).
- **Mandatory invoice doc gate**: reuse `ApprovalSetting.mandatoryInvoice` for category `PURCHASE_INVOICE` (currently only gates GR). Default ON per 8 Sep; approve blocked until an `INVOICE` attachment exists on the PO.
- **Creation confirm modal** (D1): FE gate — checkbox required before save; BE stores nothing (no value input); flag on PO not needed.
- Allow `update()` while `pending` (exists) — reject/revisi path in S3.
**Scope — FE (`PurchaseOrderForm.tsx`, `PurchaseOrderDetail.tsx`)**
- Informasi Umum v2: Supplier, **No. Invoice \***, **Tgl. Invoice \***, Termin (master dropdown — S2), **Jatuh Tempo** (read-only calc), Tanggal Order (default today), Expected Delivery (optional, informational), Notes. **Cabang selector removed.**
- Documents: upload supplier invoice (required to submit; reuse `AttachmentPanel`; add required-variant UX — file picked in form, uploaded immediately after create, block approve if missing).
- **Confirm modal on save** ("Konfirmasi Total Invoice"): shows PO **Total**; checkbox "Total PO sudah sesuai dengan invoice supplier" — required; genuine selisih → noted in Catatan (no extra logic).
- Items: product search (keep) + **"+ Produk Baru" quick-add modal** (nama*, harga jual*, satuan optional, barcode auto) + per-row **margin display** (reference only: unit price vs harga jual → gross margin %; no writes to product master).
- Summary: keep P2 ledger (no supplier-total input field).
- Actions (detail): split button = **approve / reject** (note mandatory) / **revisi**; cancel + send-order removed; GR button available after approve.
**Acceptance**
- PO cannot be created without invoice no + confirm checkbox; invoice doc required (blocked at approve at minimum); no outlet field; stock untouched until GR approve (transit = pending→approved, no stock); reject without note fails; no cancel / no send-order; GR creatable right after approve; totals + due date correct; `npm test` green incl. new specs.
**Files:** `backend/prisma/schema.prisma`(+migration) · `backend/src/modules/purchasing/{dto/create-purchase-order.dto.ts, dto/update-purchase-order.dto.ts, services/purchase-orders.service.ts, purchase-orders.controller.ts}` · `backend/src/modules/approval-settings/*` · `frontend/src/pages/purchasing/{PurchaseOrderForm.tsx, PurchaseOrderDetail.tsx}` · `frontend/src/components/purchasing/AttachmentPanel.tsx` · `frontend/src/services/purchasing.service.ts`
**Tests:** unit — create validations (invoice no required, supplier/items), due-date calc, approve gate (no doc → block), no-cancel/no-send-order guards, GR-from-approved; flow spec — create → approve → GR partial → central-good/qty. Pattern: `purchase-orders.service.spec.ts`, `goods-receipts-flow.service.spec.ts`.

### S2 — Termin master wiring + due date *(cda254f1)*
- PO form termin dropdown ← `PaymentTerm` master (active only); `days = 0` → tunai (due date hidden); termin → `dueDate = invoiceDate + days`.
- PO list/detail: due date column + "Jatuh Tempo"/overdue badge; overdue = due < today && not received/paid-out (v1 = visual flag; notification later).
- Verify POS/customer side unaffected (shared master — read-only reuse).
**Tests:** due calc (tunai vs Net 14/30/60/90), date math, badge logic unit.

### S3 — Edit-after-approval + revisi path *(IGDERP-82)*
- Default locked after approval (current guard exists: `draft|pending` only).
- Permission flag (e.g. `purchase.edit_after_approval`) + mandatory reason + audit log (old/new snapshot; mirror existing audit patterns).
- **Fix reject dead-end:** rejected PO currently cannot be edited (update guard) → allow `rejected` → edit → resubmit (`pending`). This *is* the 8-Sep "revisi" semantics.
**Tests:** guard matrix by status; reason required; audit entry written; resubmit flips to pending.

### S4 — Purchase returns *(bf95dbbf + IGDERP-83)*
- New module + models `PurchaseReturn`/`PurchaseReturnItem` (pattern: `SalesReturn`): per PO/invoice; reason + notes + qty; stock movements: central-good −qty, central-bad +qty (ref `reference_id` per existing polymorphic convention); supplier traceability (doc no. series to confirm with format convention).
- GR receiving: per-line **"buat retur" checkbox** on short/damaged → auto-creates return draft (1 invoice = 1 return; NOT forced); damage already parked in central-bad at receiving → return doc = paperwork + counters where applicable.
- FE: list/detail under Expense/Purchasing menu (direct list pattern per conventions).
**Tests:** stock math both cases (post-receipt return vs receiving-time damage), auto-create checkbox logic, reason capture.

### S5 — Barcode auto-print *(fc7b9d65)*
- Print queue triggered on GR approve (labels = approved qty); settings page: printer/label template (size, columns, barcode vs QR, paper) — client format pending (explicit blocker; implement scaffold + default template).
**Tests:** label payload generation unit; settings persist.

## 4. Decisions (resolved 2026-09-11)

- **D1 — Invoice total check: RESOLVED — creation confirm modal.** Popup on save (create + edits while pending): shows PO **Total**, checkbox "Total PO sudah sesuai dengan invoice supplier" required before save. No invoice-total value input (redundant; uploaded doc not parsed). Known selisih → recorded in Catatan; no mismatch computation logic.
- **D2 — Margin: RESOLVED — display-only reference.** PO lines show margin (gross margin = (harga jual − beli) ÷ harga jual) as a reference; **no writes to product master**. Per-product PO-value history → activity-log item `424b15d1` + finance-round cost/FIFO item `c34ad1a0` (cross-refs in §2); data already captured, no extra S1 work.
- **D3 — Action set: cancel DROPPED (locked).** Manual **"send order" drop proposed** — record-after-DO has no outbound order moment; GR available right after approve. *Final OK pending user; implementation includes it either way as a toggle-free removal.*
- **D4 — PO item Excel import: DEFERRED** (quick-add in S1; import ships with the import-contract batch `a364be5b`).

## 5. Verification & deploy protocol

- Backend unit + integration per slice (dev lane); full suite re-run on the merged tree before any merge.
- E2E checklist on preview before merge: create w/o invoice/confirm blocked → create with invoice no+date+doc+confirm → approve → reject w/o note blocked → no cancel/send-order → GR creatable right after approve → GR partial + rejected qty → central-good/central-bad deltas → purchase return deltas → edit-after-approval locked/audited → due-date badges.
- **Deploy gate:** igd-vm only on explicit go-ahead. `--no-ff` merges only after user approval.

## 6. Resume notes

1. `git fetch origin && git log --oneline -1 origin/main` (compare against origin, not the stale local ref).
2. Read this doc; check Plane for updated states of the items in §2.
3. Work happens on `ws-po-create-v2` (worktree `~/worktrees/ws-po-create-v2`), branches `<ws>-<name>`, `--no-ff` on approval.
