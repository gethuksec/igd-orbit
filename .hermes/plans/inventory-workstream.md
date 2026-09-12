# Inventory Workstream — Plan & Decision Log

Branch: `ws-inventory-improve` (off `origin/main` `ef2d6a0`, 2026-09-12). Plan-only so far — no product code, no Plane writes.
Owner: dev-2. Status of every finished slice: **Needs Review** (never straight to Done).

## 0. Basis (verified, not vibes)

- Linked rec thread (11 Sep): order PO/GR → Smart Repair → Inventory, inventory last per client's own sequencing.
- Meeting notes: 6 Aug (gudang flows §4–§8), 22 Aug §11 (threshold/buffer discussion), 8 Sep §2 (mutasi receive mirrors GR) + §6 (cost layers/FIFO/margin).
- Plane ledger (IGDERP, project `67075690-…`): 92 In Progress; 88/89/90/91, 97, 104/105/106, 172/173/174, 175/176/177 backlog; 182 backlog/low (finance round, refs 147); 140/139/159 + 76/77/78/79/80/81 done-ish.
- Code state read from `origin/main` (`ef2d6a0`, shared clone lags at `b6ae6f6` — never trust its tree):
  - Routes live: `/inventory/stock|requests|stock-in|stock-out|transfer(+new/:id)|mutasi(+new/:id)|opname(+new/:id/:id/count)|adjustment|movements|alerts`. BE: `inventory` (stock + stock-opname), `stock-in`, `stock-out`, `transfer-stock`, `mutasi`, `stock-requests`.
  - Opname lifecycle real: `draft → counting → completed → approved` + cancel, with status guards.
  - StockList today: Produk · Cabang · Stok Tersedia · Min Stock · Nilai + low-stock stat + total value + filter toolbar. No tier price, no warehouse tooltip, no umur.
  - Transfer & Mutasi post `status:'completed'` immediately — no transit→receive (contradicts 8 Sep §2).
  - Stock-in/out: zero approval/status code. Excel import exists only for products + customers. `ProductStock.minStock` + `reorderPoint` columns exist, no engine/UI. Only `Product.costPrice`, no per-PO cost layer. Alokasi: zero code, no item.

## 1. Locked decisions (user, 2026-09-12)

- **D1 = B**: build I3 first (fast visible wins), then I1 → I2 → I4 → I5. Accepted cost: I3 areas re-tested after I2 corrects movements.
- **D2 = A**: thin cost-layer capture now (one layer per PO line at GR: qty, unit cost, PO#, date). No FIFO math / margin UI / sell-price rule — finance round (182+147) may reshape it. Rationale: history cannot be back-filled; every GR until the finance round would be a permanent FIFO hole.
- **D3**: Alokasi == Mutasi. Post-PO distribution central-good → outlets, same mechanism (searchable destination, receive mirroring GR). No new menu, no new item — annotate 173 (refs 140) to record alokasi coverage.
- **D4**: keep 6 Aug §7 (no direct koreksi; corrections via stok masuk/keluar). Notion F4 approval path dead — annotate its carrying item (Inventory set 146 scope) as superseded, move to Cancelled (user to confirm Cancelled vs Done).
- **D5 = A**: 92 via I0 E2E → Needs Review for user QA. 175/176/177 stay as I1 follow-ups.

## 2. Slice plan

### I3 — List & visibility ✅ DONE 2026-09-12, branch `ws-inventory-improve` (96c6462), preview BE+FE rebuilt
88/89/90/91/104/106 → Needs Review with evidence. 119 stays backlog (client decision pending).

### I0 — E2E hygiene (no product code; can run any time, needs no decisions) ✅ DONE (92 → Needs Review)
- Pass over all 10 inventory routes on current build; post evidence to 92; move 92 → Needs Review.
- Align 93/84/79/82 statuses to reality.

### I3 — List & visibility (FIRST build slice; 6 Aug §8 spec)
- 88: per-outlet filter, threshold toggle (hide zero), total SKU per outlet, tier price reg/member (same values as master product), read-only, permission-scoped visibility.
- 89: warehouse location tooltip on qty breakdown. 90: activity log global/detail + period filters. 91: product age (days with stock > 0, not creation date).
- Plus 106 (export column popup, filters applied), 104 (drill-down: summary click → filtered popup, no page jump), 119 (search placement).
- Files: `frontend/src/pages/inventory/*` (StockList, movements, alerts), shared FilterToolbar/DataTable consumers. BE: read-only query extensions in `inventory/stock.service.ts` (low-stock, age aggregation).
- Tests: backend unit + integration on new service queries. AC per item description (88/89/90/91).

### I1 — SO hardening (175/176/177 on top of 92)
- 176 first (confirmed ~500-scan draft-loss risk): autosave durability + save-lock. Then 175 (3-condition scan modal + mismatch/double-scan guards). Then 177 (result document export + variance analytics).
- Files: `backend/src/modules/inventory/stock-opname.service.ts` + spec, `frontend/src/pages/inventory/*opname*`.
- Tests: unit + integration for opname service (per 92 AC).

### I2 — Movement correctness (173 → 174 → 172)
- 173: transit→receive (pending → approve/reject + qty adjust, GR-mirror; damage via separate SODO mutasi to bad stock w/ WA photo). Records alokasi semantics (D3). 174: printable packer checklist. 172: cross-outlet UX. Verifies 108 (bad-global vs good-outlet) along the way.
- Files: `backend/src/modules/mutasi/*`, `transfer-stock/*`, FE Mutasi/Transfer pages.
- Tests: unit + integration per service.

### I4 — Import (97)
- Contract: templates + required columns + preview/confirm; SO barcode migration template (RZAP migration — the client-flagged hard need). PO item import stays in PO batch per client ("belakangan").
- Reuse products/customers import pattern (`FileInterceptor` + preview endpoint).

### I5 — Thin cost-layer capture (slice of 182)
- New additive table (e.g. `StockCostLayer`: product, qty, unitCost, PO#, date) written at GR; read API for later drill-down. No outflow logic, no UI beyond what I3 needs.
- Files: `backend/prisma/schema.prisma` (migration) + GR hook in purchasing/receiving service + spec.

### I6 — Client-blocked (meeting batch, not built until answered)
105 ROP/buffer formula (+fast-moving & seasonal data), alokasi split already resolved by D3, first-real-SO schedule + outlets (sets barcode-migration deadline), barcode label template (93).

### I7 — Finance round (deferred)
182 full (FIFO/margin) + 147/95.

## 3. Plane moves — APPLIED 2026-09-12 (I0 + D4/D3 annotation)
1. ✅ 92 → Needs Review + I0 evidence comment (comment `fdf3b221-…`).
2. ✅ 146 annotated with D4 (F4 superseded by 6 Aug §7) + D3 (alokasi == mutasi, see 173). Epic deliberately LEFT in backlog — it groups live items 92/105/139/140, so Cancelled would have buried them. Deviation from the draft "Cancelled" proposal, rationale recorded in the item.
3. Pending (needs build first): each finished slice (I3 items etc.) → Needs Review.

## 4. Parallel work vs fullstack-dev (ws-sr-batch, Smart Repair)
- Their diff vs `origin/main` (verified 2026-09-12): only `backend/src/modules/service/*` + `frontend/src/pages/services/*`. No schema/migration touch.
- Inventory scope: `backend/src/modules/{inventory,stock-in,stock-out,transfer-stock,mutasi,stock-requests}` (+ purchasing GR hook for I5) and `frontend/src/pages/inventory/*`. **Zero file overlap** with their stream.
- Shared-surface risks: none for I0/I3 (routes + sidebar entries exist; no App.tsx/DashboardLayout edits planned). I5 adds a migration — theirs has none, but merge order still via `--no-ff` after user approval; whoever merges second re-verifies `prisma migrate` + backend suite.
- Deploy contention: igd-vm preview builds must be coordinated (never deploy over each other; announce in #igd-deploy). Plan doc itself is local-only, no push.
- Verdict: **safe to run in parallel**. Only coordination point is merge/deploy sequencing.

## 5. Resume notes
- Worktree: `~/worktrees/ws-inventory-improve`, branch `ws-inventory-improve` off `ef2d6a0`. Shared clone untouched.
- Next after approval: I0 E2E pass (needs nothing else), then I3 slice per D1.
