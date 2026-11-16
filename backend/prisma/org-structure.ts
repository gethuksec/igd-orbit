// ORG-DEPT-DIV-GRADE (IGDERP-277): single source of truth for Division,
// Grade and Position seeds + specs. Chart locked 2026-11-04, dept/div/grade
// model locked 2026-11-16 (thread 20261111-org-structure).

export interface OrgDivisionDef {
  code: string;
  name: string;
  department: string; // ORG_DEPARTMENTS code
}

export const ORG_DIVISIONS: OrgDivisionDef[] = [
  { code: 'DIV-MKT', name: 'SPV Marketing', department: 'DEPT-MKT' },
  { code: 'DIV-OPS-SE', name: 'Assistant Store Sales', department: 'DEPT-OPS' },
  { code: 'DIV-OPS-SRV', name: 'Assistant Store Service', department: 'DEPT-OPS' },
  { code: 'DIV-SUP-SC', name: 'SPV Supply Chain', department: 'DEPT-SUP' },
  { code: 'DIV-SUP-FIN', name: 'SPV Finance & Accounting', department: 'DEPT-SUP' },
  { code: 'DIV-SUP-HRD', name: 'SPV HRD', department: 'DEPT-SUP' },
];

export interface OrgGradeDef {
  code: string;
  name: string;
  rank: number; // 1-6, staff-only ladder
}

export const ORG_GRADES: OrgGradeDef[] = [
  { code: 'G1', name: 'Grade 1', rank: 1 },
  { code: 'G2', name: 'Grade 2', rank: 2 },
  { code: 'G3', name: 'Grade 3', rank: 3 },
  { code: 'G4', name: 'Grade 4', rank: 4 },
  { code: 'G5', name: 'Grade 5', rank: 5 },
  { code: 'G6', name: 'Grade 6', rank: 6 },
];

export interface OrgPositionTitleDef {
  titleCode: string; // base code, shared with Role code where one exists
  name: string; // chart wording verbatim (locked 2026-11-04)
  rank: number; // chart level L0-L6
  department?: string; // ORG_DEPARTMENTS code
  division?: string; // ORG_DIVISIONS code
}

// Staff titles (rank 6) expand to one Position row per grade (TITLE-G1..G6).
// L0-L5 titles are single rows. FL sits in the sales scope per chart grouping.
export const ORG_POSITION_TITLES: OrgPositionTitleDef[] = [
  { titleCode: 'MU', name: 'MANAGER UNIT', rank: 2 },
  { titleCode: 'MM', name: 'MANAGER MARKETING', rank: 3, department: 'DEPT-MKT' },
  { titleCode: 'MO', name: 'MANAGER OPERASIONAL', rank: 3, department: 'DEPT-OPS' },
  { titleCode: 'MS', name: 'MANAGER SUPPORT', rank: 3, department: 'DEPT-SUP' },
  { titleCode: 'SPV-MKT', name: 'SPV MARKETING', rank: 4, department: 'DEPT-MKT', division: 'DIV-MKT' },
  { titleCode: 'HS', name: 'HEADSTORE', rank: 4, department: 'DEPT-OPS' },
  { titleCode: 'SPV-SC', name: 'SPV SUPPLY CHAIN', rank: 4, department: 'DEPT-SUP', division: 'DIV-SUP-SC' },
  { titleCode: 'SPV-FO', name: 'SPV FINANCE & ACCOUNTING', rank: 4, department: 'DEPT-SUP', division: 'DIV-SUP-FIN' },
  { titleCode: 'SPV-HRD', name: 'SPV HUMAN RESOURCE DEVELOPMENT', rank: 4, department: 'DEPT-SUP', division: 'DIV-SUP-HRD' },
  { titleCode: 'AS-SE', name: 'ASSISTANT STORE SALES', rank: 5, department: 'DEPT-OPS', division: 'DIV-OPS-SE' },
  { titleCode: 'AS-SRV', name: 'ASSISTANT STORE SERVICE', rank: 5, department: 'DEPT-OPS', division: 'DIV-OPS-SRV' },
  { titleCode: 'SMO', name: 'STAFF SMO', rank: 6, department: 'DEPT-MKT', division: 'DIV-MKT' },
  { titleCode: 'ADV', name: 'STAFF ADVERTISER', rank: 6, department: 'DEPT-MKT', division: 'DIV-MKT' },
  { titleCode: 'SM', name: 'STAFF MARKETING', rank: 6, department: 'DEPT-MKT', division: 'DIV-MKT' },
  { titleCode: 'CRM', name: 'STAFF CRM', rank: 6, department: 'DEPT-MKT', division: 'DIV-MKT' },
  { titleCode: 'SE', name: 'STAFF SALES EXECUTIVE', rank: 6, department: 'DEPT-OPS', division: 'DIV-OPS-SE' },
  { titleCode: 'CR', name: 'STAFF CASHIER', rank: 6, department: 'DEPT-OPS', division: 'DIV-OPS-SE' },
  { titleCode: 'FL', name: 'STAFF FRONTLINER', rank: 6, department: 'DEPT-OPS', division: 'DIV-OPS-SE' },
  { titleCode: 'CS', name: 'STAFF CUSTOMER SERVICE', rank: 6, department: 'DEPT-OPS', division: 'DIV-OPS-SRV' },
  { titleCode: 'TC', name: 'STAFF TEKNISI', rank: 6, department: 'DEPT-OPS', division: 'DIV-OPS-SRV' },
  { titleCode: 'SODO', name: 'STAFF SO/DO', rank: 6, department: 'DEPT-SUP', division: 'DIV-SUP-SC' },
  { titleCode: 'MP', name: 'STAFF MARKETPLACE', rank: 6, department: 'DEPT-SUP', division: 'DIV-SUP-SC' },
  { titleCode: 'AO', name: 'STAFF FINANCE & ACCOUNTING', rank: 6, department: 'DEPT-SUP', division: 'DIV-SUP-FIN' },
  { titleCode: 'HR', name: 'STAFF HUMAN RESOURCE', rank: 6, department: 'DEPT-SUP', division: 'DIV-SUP-HRD' },
  { titleCode: 'MT', name: 'STAFF MT SALES & SERVICE', rank: 6, department: 'DEPT-SUP', division: 'DIV-SUP-HRD' },
  { titleCode: 'IT', name: 'STAFF IT', rank: 6, department: 'DEPT-SUP', division: 'DIV-SUP-HRD' },
];
