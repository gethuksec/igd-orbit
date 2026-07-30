# D — Organization Architecture (Branch/Warehouse/Role/User)

**Status:** 🟡 Planned
**Effort:** ~8-12h (BE ~5h, FE ~5h, Data migration ~2h)
**Depends on:** Nothing — but other workstreams depend on this schema

---

## Goal

Clean separation between Branch (outlet), Warehouse, Role, and User. Simplify roles to title+level only. Remove old Permission/RolePermission/RoleMenuAccess tables.

## Data Model

### Branch (outlet only)

```prisma
model Branch {
  id             String    @id @default(uuid())
  code           String    @unique
  name           String
  group          String?
  city           String?
  address        String?
  phone          String?
  email          String?
  director       String?
  contactPerson  String?
  mobilePhone    String?
  isActive       Boolean   @default(true)
  operatingHours Json?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  warehouses    Warehouse[]
  userBranches  UserBranch[]
  // Keep existing relations: salesTransactions, serviceOrders, productStocks, etc.
}
```

**Changes from current:** Remove `type`, `isWarehouse`, `headOfServiceId` fields. Add `group`, `director`, `contactPerson`, `mobilePhone` (matches Erzap outlet form).

### Warehouse (new — separate table)

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
  outletId       String    @map("outlet_id")
  outlet         Branch    @relation(fields: [outletId], references: [id])

  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  productStocks      ProductStock[]
  stockMovements     StockMovement[]
  stockTransfersFrom StockTransfer[]   @relation("StockTransferFrom")
  stockTransfersTo   StockTransfer[]   @relation("StockTransferTo")
  stockOpnames       StockOpname[]
  purchaseOrders     PurchaseOrder[]
  goodsReceipts      GoodsReceipt[]
}
```

**Exclusive:** 1 outlet → N warehouses. No sharing between outlets.

### Role (simplified)

```prisma
model Role {
  id          String    @id @default(uuid())
  code        String    @unique
  name        String
  description String?
  level       Int
  isActive    Boolean   @default(true)
  // REMOVED: isSystemRole, parentRoleId
  // REMOVED: RolePermission, RoleMenuAccess tables entirely
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  userBranches UserBranch[]
  defaultPermissions String[]  // JSON text array (for C.1)
}
```

### UserBranch (replaces UserRole)

```prisma
model UserBranch {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  branchId  String    @map("branch_id")
  roleId    String    @map("role_id")
  isPrimary Boolean   @default(false)
  deniedPermissions String[]  // JSON text array (for C.1)

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  branch Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)
  role   Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([userId, branchId, roleId])
  @@map("user_branches")
}
```

**Changes from `UserRole`:** Renamed. `branchId` required (outlet only — no null = all branches). Removed `validFrom`/`validUntil`. Added `deniedPermissions` (for C.1).

### User (minimal changes)

Remove role-related fields. Keep existing relations.

---

## Key Rules

| Rule | Detail |
|------|--------|
| Branch = outlet only | No `isWarehouse`, `type` fields |
| Warehouse exclusive | `Warehouse.outletId` FK. No sharing |
| Users → outlets only | `UserBranch.branchId` always an outlet |
| Role = title | No Permission/RolePermission/RoleMenuAccess |
| User multi-outlet | Multiple UserBranch records = different outlets |

---

## Pages & Routes

| Page | Path | Description |
|------|------|-------------|
| Outlet List | `/outlets` | Erzap-style table + search sidebar |
| Outlet Form | `/outlets/new`, `/outlets/:id/edit` | Create/edit |
| Outlet Detail | `/outlets/:id` | View + list its warehouses |
| Warehouse List | `/warehouses` | Filter by parent outlet |
| Warehouse Form | `/warehouses/new`, `/warehouses/:id/edit` | Create/edit |
| Warehouse Detail | `/warehouses/:id` | View detail |
| Role List | `/roles` | Simple table |
| Role Form | `/roles/new`, `/roles/:id/edit` | Code, name, level |
| User List | `/users` | Show UserBranch assignments |
| User Form | `/users/:id/edit` | Assign outlets + role |

---

## Implementation Phases

### D1: Prisma schema
- Create Warehouse model
- Simplify Role (remove old fields, add defaultPermissions)
- Create UserBranch model
- Update Branch (remove type/isWarehouse, add new fields)
- Update User (minimal)
- Generate Prisma migration
- **Files:** `prisma/schema.prisma`
- **~Time:** 1.5h

### D2: Backend CRUD
- Warehouse module: list, create, edit, detail, delete
- Role module: simplified CRUD
- Branch module: clean outlet-only CRUD with new fields
- User module: update for UserBranch assignments
- **Files:** `backend/src/modules/warehouse/`, `backend/src/modules/role/`, `backend/src/modules/branch/`, `backend/src/modules/user/`
- **~Time:** 3h

### D3: Frontend — Outlet pages
- Outlet List: Erzap-style table + search sidebar
- Outlet Form: create/edit with all fields
- Outlet Detail: view + warehouse list
- **Files:** `frontend/src/pages/outlets/`
- **~Time:** 2h

### D4: Frontend — Warehouse + Role + User
- Warehouse List/Form/Detail
- Role List/Form (simplified)
- Update User form with UserBranch assignment UI
- **Files:** `frontend/src/pages/warehouses/`, `frontend/src/pages/roles/`, `frontend/src/pages/users/`
- **~Time:** 3h

### D5: POS integration
- Update POS header: Outlet dropdown → Branch, Warehouse dropdown → Warehouse (filtered by selected outlet)
- Update salesperson selector → filtered by UserBranch
- **Files:** `POSTransaksi.tsx`, `posStore.ts`
- **~Time:** 1.5h

### D6: Data migration
- Migrate existing Branch records: split outlets from warehouses
- Migrate UserRole → UserBranch
- Remove old UserRole/RolePermission/RoleMenuAccess data
- **Files:** migration script, `seed.ts`
- **~Time:** 1h

---

## Data Migration Strategy

### Branch split

Current Branch records have `type` and `isWarehouse`:

```sql
-- Current branches with isWarehouse=true → new Warehouse records
INSERT INTO warehouses (id, code, name, city, phone, outlet_id, ...)
SELECT id, code, name, city, phone, <outlet_id resolved from logic>, ...
FROM branches WHERE is_warehouse = true;

-- Current branches with type='store' or type='office' → remain as outlets
-- Update Branch: drop is_warehouse, update fields
```

**Note:** The current data has 4 outlets including 1 warehouse ("Warehouse" with code 4KH1N03273). Need to decide which outlet it belongs to.

### UserRole → UserBranch

```sql
INSERT INTO user_branches (id, user_id, role_id, branch_id, is_primary)
SELECT id, user_id, role_id, 
  COALESCE(branch_id, (SELECT id FROM branches LIMIT 1)), -- null → first branch
  is_primary
FROM user_roles;
```

---

## Open Questions

1. **Warehouse migration:** The existing "Warehouse" branch (code 4KH1N03273) — which outlet does it belong to?
2. **UserRole.branchId = null:** Currently means "all branches". In new model, UserBranch.branchId is required. Should we create one UserBranch per branch for these users?
3. **Level numbering:** SUPERADMIN=0, OWNER=1, MANAGER=2, SPV=3, STAFF=4 — confirmed?
