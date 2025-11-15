# Phase 4 Scripts

**Phase:** Finance & Accounting (PROMPT 4.1)  
**Date:** 2025-01-27

## Scripts

### PowerShell Scripts

1. **`phase4_20250127_test-finance.ps1`**
   - Comprehensive Finance module testing script
   - Tests all Finance endpoints (COA, Journal Entries, Reports)
   - Usage: 
     ```powershell
     cd backend/scripts/phase4
     powershell -ExecutionPolicy Bypass -File phase4_20250127_test-finance.ps1
     ```

2. **`phase4_20250127_test-role-verification.ps1`**
   - Quick script to verify role assignment and JWT token
   - Checks if CFO role is included in login response
   - Usage:
     ```powershell
     cd backend/scripts/phase4
     powershell -ExecutionPolicy Bypass -File phase4_20250127_test-role-verification.ps1
     ```

3. **`phase4_20250127_assign-cfo-role.ps1`**
   - PowerShell script to assign CFO role (alternative method)
   - Provides SQL instructions for manual role assignment
   - Usage:
     ```powershell
     cd backend/scripts/phase4
     powershell -ExecutionPolicy Bypass -File phase4_20250127_assign-cfo-role.ps1
     ```

### JavaScript/TypeScript Scripts

1. **`phase4_20250127_assign-cfo-role.js`**
   - Node.js script to assign CFO role to test user
   - Creates CFO role if it doesn't exist
   - Assigns role to `cfo@igdgroup.com` user
   - Usage:
     ```bash
     cd backend/scripts/phase4
     node phase4_20250127_assign-cfo-role.js
     ```

2. **`phase4_20250127_assign-cfo-role.ts`**
   - TypeScript version of the role assignment script
   - Usage:
     ```bash
     cd backend/scripts/phase4
     npx ts-node phase4_20250127_assign-cfo-role.ts
     ```

## SQL Scripts

Located in `sql/` subdirectory:

1. **`sql/phase4_20250127_assign-cfo-role.sql`**
   - SQL script to assign CFO role to test user
   - Creates CFO role if it doesn't exist
   - Assigns role via database directly
   - Usage:
     ```bash
     cd backend/scripts/phase4
     psql -d igd_orbit -f sql/phase4_20250127_assign-cfo-role.sql
     ```

2. **`sql/phase4_20250127_create-test-user.sql`**
   - SQL script to create test user (placeholder)
   - Note: User creation should be done via API or Prisma
   - This is a reference/template file
   - Usage:
     ```bash
     cd backend/scripts/phase4
     psql -d igd_orbit -f sql/phase4_20250127_create-test-user.sql
     ```

## Notes

- All scripts are for Phase 4 (Finance & Accounting) testing
- Scripts use timestamp format: `phase4_YYYYMMDD_filename.ext`
- Test user: `cfo@igdgroup.com` / `Admin123!`
- CFO role is required for Finance module access

