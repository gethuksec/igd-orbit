  // ORG-REAL role tree contract (IGDERP-237). Single source of truth for
  // seed.ts and backend specs — level is a grade tier (parent sits above,
  // not necessarily exactly one level up: L6 staff under SPVs report to L4).
  export interface OrgRoleDef {
    code: string;
    name: string;
    description: string;
    level: number;
    permissions: string[];
    parent?: string;
  }

export const ROLE_TREE: OrgRoleDef[] = [
    { code: 'SUPERADMIN', name: 'Super Administrator', description: 'System administrator with full access', level: 0, permissions: ['dashboard.view', 'master_data.customer.view', 'master_data.customer.create', 'master_data.customer.edit', 'master_data.customer.delete', 'master_data.product.view', 'master_data.product.create', 'master_data.product.edit', 'master_data.product.delete', 'master_data.supplier.view', 'master_data.supplier.create', 'master_data.supplier.edit', 'master_data.supplier.delete', 'master_data.category.view', 'master_data.category.create', 'master_data.category.edit', 'master_data.category.delete', 'master_data.brand.view', 'master_data.brand.create', 'master_data.brand.edit', 'master_data.brand.delete', 'master_data.attribute.view', 'master_data.attribute.create', 'master_data.attribute.edit', 'master_data.attribute.delete', 'master_data.service_type.view', 'master_data.service_type.create', 'master_data.service_type.edit', 'master_data.service_type.delete', 'action.pos.create', 'action.pos.edit', 'sales.history.view', 'sales.return.create', 'sales.return.edit', 'service.order.view', 'action.service.create', 'action.service.edit', 'action.service.delete', 'action.service.assign', 'service.return.create', 'service.return.edit', 'inventory.stock.view', 'inventory.stock.adjust', 'inventory.stock_in.create', 'inventory.stock_out.create', 'inventory.transfer.create', 'inventory.transfer.approve', 'inventory.opname.create', 'inventory.opname.approve', 'inventory.history.view', 'inventory.alert.view', 'finance.coa.view', 'finance.coa.create', 'finance.coa.edit', 'finance.journal.create', 'finance.expense.create', 'finance.petty_cash.create', 'finance.ar.create', 'finance.report.view', 'purchasing.supplier.view', 'purchasing.supplier.create', 'purchasing.supplier.edit', 'purchasing.po.create', 'purchasing.po.approve', 'purchasing.po.receive', 'hr.employee.view', 'hr.employee.create', 'hr.employee.edit', 'hr.employee.deactivate', 'hr.attendance.view', 'hr.leave.approve', 'hr.payroll.view', 'hr.kpi.create', 'branch.view', 'users.user.view', 'users.user.create', 'users.user.edit', 'users.user.deactivate', 'roles.role.view', 'roles.role.create', 'roles.role.edit', 'roles.role.delete', 'users.password.approve', 'action.service.smart_repair.create', 'service.checkpoint.view', 'service.checkpoint.create', 'service.checkpoint.edit', 'service.checkpoint.delete', 'service.price.edit'] },
    { code: 'OWNER', name: 'Pemilik', description: 'Full access to all modules', level: 1, permissions: ['menu.dashboard', 'menu.pos', 'menu.service', 'menu.sales', 'menu.master-data', 'menu.inventory', 'menu.finance', 'menu.purchasing', 'menu.hr', 'menu.users', 'menu.branches', 'action.view', 'action.pos.create', 'action.pos.edit', 'action.service.create', 'action.service.edit', 'action.service.delete', 'action.service.assign', 'action.service.smart_repair.create', 'service.price.edit', 'service.checkpoint.view', 'service.checkpoint.create', 'service.checkpoint.edit', 'service.checkpoint.delete'] },
    { code: 'MU', name: 'Manager Unit', description: 'Pimpinan unit, reports to OWNER', level: 2, parent: 'OWNER',
      permissions: ['menu.dashboard', 'menu.pos', 'menu.service', 'menu.sales', 'menu.master-data', 'menu.inventory', 'menu.finance', 'menu.purchasing', 'menu.hr', 'menu.branches', 'action.view', 'action.pos.create', 'action.pos.edit', 'action.service.create', 'action.service.edit', 'action.service.delete', 'action.service.assign', 'action.service.smart_repair.create', 'service.price.edit', 'service.checkpoint.view', 'service.checkpoint.create', 'service.checkpoint.edit', 'service.checkpoint.delete'] },
    { code: 'MM', name: 'Manager Marketing', description: 'Manajer marketing, reports to MU', level: 3, parent: 'MU',
      permissions: ['menu.dashboard', 'menu.sales', 'menu.master-data', 'menu.service', 'action.view', 'service.checkpoint.view'] },
    { code: 'MO', name: 'Manager Operasional', description: 'Manajer operasional, reports to MU', level: 3, parent: 'MU',
      permissions: ['menu.dashboard', 'menu.pos', 'menu.service', 'menu.sales', 'menu.master-data', 'menu.inventory', 'menu.purchasing', 'menu.branches', 'action.view', 'action.pos.create', 'action.pos.edit', 'action.service.create', 'action.service.edit', 'action.service.assign', 'action.service.smart_repair.create', 'service.checkpoint.view', 'service.checkpoint.create', 'service.checkpoint.edit', 'service.checkpoint.delete'] },
    { code: 'MS', name: 'Manager Support', description: 'Manajer support, reports to MU', level: 3, parent: 'MU',
      permissions: ['menu.dashboard', 'menu.finance', 'menu.purchasing', 'menu.hr', 'menu.master-data', 'action.view'] },
    { code: 'SPV-MKT', name: 'SPV Marketing', description: 'Supervisor marketing, reports to MM', level: 4, parent: 'MM',
      permissions: ['menu.dashboard', 'menu.sales', 'menu.service', 'menu.master-data', 'action.view', 'service.checkpoint.view'] },
    { code: 'HS', name: 'Headstore', description: 'Kepala toko per cabang, reports to MO', level: 4, parent: 'MO',
      permissions: ['menu.pos', 'menu.service', 'menu.sales', 'menu.master-data', 'menu.inventory', 'menu.hr', 'action.view', 'action.service.create', 'action.service.edit', 'action.service.assign'] },
    { code: 'SPV-SC', name: 'SPV Supply Chain', description: 'Supervisor supply chain, reports to MS', level: 4, parent: 'MS',
      permissions: ['menu.dashboard', 'menu.inventory', 'menu.purchasing', 'menu.sales', 'menu.master-data', 'action.view'] },
    { code: 'SPV-FO', name: 'SPV Finance & Accounting', description: 'Supervisor finance & accounting, reports to MS', level: 4, parent: 'MS',
      permissions: ['menu.dashboard', 'menu.finance', 'menu.sales', 'action.view'] },
    { code: 'SPV-HRD', name: 'SPV Human Resource Development', description: 'Supervisor HRD, reports to MS', level: 4, parent: 'MS',
      permissions: ['menu.dashboard', 'menu.hr', 'menu.master-data', 'action.view'] },
    { code: 'AS-SE', name: 'Assistant Store Sales', description: 'Asisten toko sales, reports to HS', level: 5, parent: 'HS',
      permissions: ['menu.sales', 'menu.pos', 'action.view', 'action.pos.create'] },
    { code: 'AS-SRV', name: 'Assistant Store Service', description: 'Asisten toko service, reports to HS', level: 5, parent: 'HS',
      permissions: ['menu.service', 'menu.pos', 'action.view', 'action.service.create', 'action.service.edit'] },
    { code: 'SMO', name: 'Sales & Marketing Officer', description: 'Staff SMO, reports to SPV-MKT', level: 6, parent: 'SPV-MKT',
      permissions: ['menu.sales', 'action.view'] },
    { code: 'ADV', name: 'Advertiser', description: 'Staff advertiser, reports to SPV-MKT', level: 6, parent: 'SPV-MKT',
      permissions: ['menu.sales', 'action.view'] },
    { code: 'SM', name: 'Staff Marketing', description: 'Staff marketing, reports to SPV-MKT', level: 6, parent: 'SPV-MKT',
      permissions: ['menu.sales', 'menu.master-data', 'action.view'] },
    { code: 'CRM', name: 'Staff CRM', description: 'Staff CRM, reports to SPV-MKT', level: 6, parent: 'SPV-MKT',
      permissions: ['menu.sales', 'action.view'] },
    { code: 'SE', name: 'Sales Executive', description: 'Staff sales executive, reports to AS-SE', level: 6, parent: 'AS-SE',
      permissions: ['menu.sales', 'menu.pos', 'action.view', 'action.pos.create'] },
    { code: 'CR', name: 'Cashier', description: 'Kasir POS, reports to AS-SE', level: 6, parent: 'AS-SE',
      permissions: ['menu.pos', 'menu.sales', 'action.view', 'action.pos.create'] },
    { code: 'FL', name: 'Frontliner', description: 'Staff frontliner, reports to AS-SRV', level: 6, parent: 'AS-SRV',
      permissions: ['menu.service', 'action.view'] },
    { code: 'CS', name: 'Customer Service', description: 'Customer service, reports to AS-SRV', level: 6, parent: 'AS-SRV',
      permissions: ['menu.pos', 'menu.sales', 'action.view', 'action.pos.create', 'action.pos.edit', 'action.service.smart_repair.create', 'service.checkpoint.view'] },
    { code: 'TC', name: 'Technician', description: 'Teknisi servis, reports to AS-SRV', level: 6, parent: 'AS-SRV',
      permissions: ['menu.service', 'action.view', 'action.service.view'] },
    { code: 'SODO', name: 'SO/DO', description: 'Sales Order & Delivery Order, reports to SPV-SC', level: 6, parent: 'SPV-SC',
      permissions: ['menu.inventory', 'menu.service', 'action.view'] },
    { code: 'MP', name: 'Marketplace', description: 'Staff marketplace, reports to SPV-SC', level: 6, parent: 'SPV-SC',
      permissions: ['menu.sales', 'menu.inventory', 'action.view'] },
    { code: 'AO', name: 'Finance & Accounting', description: 'Staff finance & accounting (merges AR+AS), reports to SPV-FO', level: 6, parent: 'SPV-FO',
      permissions: ['menu.finance', 'menu.sales', 'action.view'] },
    { code: 'HR', name: 'Human Resource', description: 'Staff HR, reports to SPV-HRD', level: 6, parent: 'SPV-HRD',
      permissions: ['menu.hr', 'action.view'] },
    { code: 'MT', name: 'MT Sales & Service', description: 'Management trainee sales & service, reports to SPV-HRD', level: 6, parent: 'SPV-HRD',
      permissions: ['menu.sales', 'menu.service', 'action.view'] },
    { code: 'IT', name: 'IT', description: 'Staff IT, reports to SPV-HRD', level: 6, parent: 'SPV-HRD',
      permissions: ['menu.dashboard', 'menu.users', 'action.view'] },
  ];

export const RETIRED_ROLE_CODES = ['CFO', 'CSO', 'CMO', 'CHR', 'MGR', 'SPV', 'AR', 'AS', 'ASA'];

export const ORG_DEPARTMENTS = [
  { code: 'DEPT-MKT', name: 'Marketing' },
  { code: 'DEPT-OPS', name: 'Operasional & Toko' },
  { code: 'DEPT-SC', name: 'Supply Chain' },
  { code: 'DEPT-FIN', name: 'Finance & Accounting' },
  { code: 'DEPT-HRD', name: 'Human Resource Development' },
];
