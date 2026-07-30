# C.1 — Granular Permissions

**Status:** 🟡 Planned
**Effort:** ~4-6h (FE ~4h, BE ~2.5h)
**Depends on:** Workstream D schema (Role + UserBranch models)

---

## Overview

Unified `hasPermission(key)` system driving 3 levels of granularity — sidebar, actions, and per-field. Uses subtractive model: Role defines defaults, UserBranch removes permissions.

## Architecture

```ts
Role {
  defaultPermissions: string[]   // e.g. ['menu.pos', 'action.service.create']
}

UserBranch {
  deniedPermissions: string[]    // subtractive — removes from role defaults
}

// Runtime
function hasPermission(key: string): boolean {
  if (userRole.level === 0) return true  // SUPERADMIN bypass
  const perms = new Set(role.defaultPermissions)
  for (const denied of userBranch.deniedPermissions) perms.delete(denied)
  return perms.has(key)
}
```

## Permission Key Convention

| Pattern | Example | Level | Phase |
|---------|---------|-------|-------|
| `menu.X` | `menu.pos` | 1 — Sidebar | 1 |
| `action.X.Y` | `action.service.create` | 2 — Button/Page | 1 |
| `field.X.Y.Z` | `field.service.serial.required` | 3 — Field | 2 |

## Phase 1: Levels 1-2 (Sidebar + Actions)

### Required permission keys (~20)

| Key | Where checked | Effect |
|-----|--------------|--------|
| `menu.dashboard` | Sidebar | Show/hide Dashboard |
| `menu.pos` | Sidebar | Show/hide POS |
| `menu.service` | Sidebar | Show/hide Service menu |
| `menu.sales` | Sidebar | Show/hide Penjualan |
| `menu.master-data` | Sidebar | Show/hide Master Data |
| `menu.inventory` | Sidebar | Show/hide Gudang |
| `menu.finance` | Sidebar | Show/hide Keuangan |
| `menu.purchasing` | Sidebar | Show/hide Pembelian |
| `menu.hr` | Sidebar | Show/hide Karyawan |
| `menu.users` | Sidebar | Show/hide User & Role |
| `menu.branches` | Sidebar | Show/hide Cabang |
| `menu.settings` | Sidebar | Show/hide Settings |
| `action.pos.create` | POS page | Enable/disable Save |
| `action.pos.edit` | POS page | Enable/disable edit |
| `action.service.create` | Service form | Enable/disable Save |
| `action.service.delete` | Service detail | Show/hide Delete |
| `action.service.edit` | Service form | Enable/disable edit |
| `action.service.assign` | Service form | Enable/disable technician assign |
| `action.view` | ProtectedRoute | Generic page access fallback |

### Implementation

**BE:**
- Add `defaultPermissions: String[]` to Role model (Prisma JSON array)
- Add `deniedPermissions: String[]` to UserBranch model
- Update Role CRUD to edit `defaultPermissions` (checkboxes or tag input)
- Update UserBranch CRUD to edit `deniedPermissions`
- Seed default permissions per role

**FE:**
- Extend `usePermissions` hook with `hasPermission(key)` using subtractive logic
- In `DashboardLayout.tsx`: filter sidebar items with `hasPermission(menu.X)`
- In `ProtectedRoute.tsx`: accept `permission` prop, redirect if denied
- On POS/Service pages: wrap action buttons with `hasPermission('action.X.Y')`

### Default permissions per role (seed)

| Role | Level | Default permissions |
|------|-------|-------------------|
| SUPERADMIN | 0 | Bypass all checks |
| OWNER | 1 | All `menu.*`, all `action.*.*` |
| MANAGER | 2 | All `menu.*`, `action.*.view`, `action.*.create`, `action.*.edit` |
| CFO | 2 | `menu.finance`, `menu.dashboard`, `action.finance.*` |
| SPV | 3 | `menu.pos`, `menu.service`, `menu.sales`, `action.pos.*`, `action.service.view` |
| CS | 4 | `menu.pos`, `action.pos.view`, `action.pos.create` |
| CASHIER | 4 | `menu.pos`, `action.pos.view`, `action.pos.create` |

## Phase 2: Level 3 (Per-field Required/Readonly) — v2

No new infrastructure — same `hasPermission()`, just add keys.

### Example keys (~25 additional)

| Key | Component | Effect |
|-----|-----------|--------|
| `field.service.serial.required` | Serial input | Required toggle |
| `field.service.device-name.required` | Nama Barang | Required toggle |
| `field.service.technician.required` | Teknisi select | Required toggle |
| `field.service.technician.readonly` | Teknisi select | Readonly toggle |
| `field.service.deskkondisi.required` | Deskripsi textarea | Required toggle |
| `field.pos.customer.required` | Customer combobox | Required toggle |
| `field.pos.discount.readonly` | Diskon input | Readonly toggle |
| `field.pos.gudang.readonly` | Gudang select | Readonly toggle |

### Pattern

```tsx
function useFieldPermission(key: string) {
  const required = hasPermission(`${key}.required`)
  const readonly = hasPermission(`${key}.readonly`)
  return { required, readonly, disabled: readonly }
}

// Usage
const serialField = useFieldPermission('field.service.serial')
<Input required={serialField.required} readOnly={serialField.readonly} />
```

## Files to modify

### Backend
- `prisma/schema.prisma` — add fields
- `backend/src/modules/roles/` — update CRUD for defaultPermissions
- `backend/src/modules/users/` — update UserBranch CRUD for deniedPermissions
- `backend/src/seeds/seed.ts` — add default permissions per role

### Frontend
- `frontend/src/hooks/usePermissions.ts` — add `hasPermission()`
- `frontend/src/layouts/DashboardLayout.tsx` — filter sidebar
- `frontend/src/components/ProtectedRoute.tsx` — accept permission prop
- `frontend/src/pages/pos/POSTransaksi.tsx` — wrap action buttons
- `frontend/src/pages/service/SmartRepairPage.tsx` — wrap action buttons

## Verification

1. SUPERADMIN sees all menus → OK
2. CS sees only POS menu → OK
3. CS cannot see Master Data → filtered from sidebar
4. CS cannot delete service order → Delete button hidden
5. CASHIER cannot edit POS → Save button disabled
6. SPV can create but not delete service → Create visible, Delete hidden
7. User with deniedPermission removes from sidebar → menu gone
8. (Phase 2) Field required toggles based on permission key
