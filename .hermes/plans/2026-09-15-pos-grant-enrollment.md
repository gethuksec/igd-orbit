# Plan — POS grant enrollment for CS (IGDERP-141, "Plan C")

Branch: `ws-141-pos-grant` (cut from `ws-sr-batch` e5222f6 — current deployed preview content)
Started: 2026-09-15 · Owner: dev agent · Status: **S1 in progress**

## Goal

Feature-level enrollment: allow management to GRANT specific allowlisted feature
permissions to a user/outlet assignment, beyond role defaults. First feature:
**"Akses POS"** for CS (27 Aug §10 decision #6-C). Also delivers the mechanism
behind IGDERP-75 ("feature-level enrollment per user").

Decisions (saintOx, 14–15 Sep):
- Execute Plan C = grant mechanism + CS default flip + rollout together.
- CS default flip confirmed: CS loses built-in POS (`menu.pos`, `action.pos.create`,
  `action.pos.edit` removed from CS defaults); enable per user/outlet via the new grant.
- Amends D-PERM #31 (deny-only) → deny-only **+ allowlisted grants**. Deny always wins.
- Rollout/day-one tick list: pending (ask at flip time).

## Design

- Storage: `user_branches.granted_permissions TEXT[] DEFAULT ARRAY[]::TEXT[]` (nullable,
  mirrors `denied_permissions` DDL).
- Merge (`computeEffectivePermissions`): `(∪ defaults ∪ allowlisted grants) − ∪ denies`
  → deny wins. Grants outside the allowlist are ignored at merge AND rejected at assign.
- Allowlist (`GRANTABLE_PERMISSIONS` in permissions.util.ts): `action.pos.create`,
  `action.pos.edit` (the gates actually used by POS UI; `menu.pos` is vestigial — only a label).
- UI: "Akses POS" checkbox per Penugasan row in UserFormModal, shown for role code `CS`
  (extensible list). Save flow reuses removeRole+assignRole (no PUT for denies/grants).
- Sidebar/quick-access: already permission-catalog driven (`isBranchVisible`) — POS entry
  hides/shows automatically based on `action.pos.*` presence; NO menu code change needed.
- permVer: assign/removeRole already bump; grants ride the same calls.

## Slices

- **S1 (BE, zero behavior change)** — column + migration, merge + allowlist, assignRole
  validation + create, DTO, transformer, tests. Grants empty ⇒ effective perms provably identical.
- **S2 (FE)** — modal checkbox + save diff + detail chips; FE service types.
- **S3 (flip + rollout)** — seed.ts CS defaults; migration #2 flips prod CS role
  (array_remove ×3); deploy preview; tick list with saintOx; E2E.

## Migrations (deploy-controlled)

1. `20260914175000_pos_grant_enrollment` — ADD COLUMN IF NOT EXISTS granted_permissions.
2. `20260914175500_cs_pos_default_flip` — UPDATE roles SET default_permissions = (…) − 3 keys
   WHERE code='CS'. **Apply only when saintOx confirms the flip moment.**

## Verification

- Dry-run both migrations on a prod clone (`sr_mig_dryrun` pattern) as `developer`.
- Full BE suite + new specs (merge grants/deny-wins/allowlist; assignRole validation).
- Fresh nest build + vite build; preview deploy; E2E: flip hides POS for a CS fixture
  (or until-ticked real CS), tick grants it back on refresh; UI screenshots.
