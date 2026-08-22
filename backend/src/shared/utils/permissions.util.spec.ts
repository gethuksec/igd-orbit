import {
  patternMatchesKey,
  isPermissionWithinDefaults,
  computeEffectivePermissions,
  PERMISSION_CATALOG,
} from './permissions.util';

describe('patternMatchesKey (wildcard-aware matching)', () => {
  it('matches exact keys', () => {
    expect(patternMatchesKey('purchasing.po.create', 'purchasing.po.create')).toBe(true);
    expect(patternMatchesKey('purchasing.po.create', 'purchasing.po.approve')).toBe(false);
  });

  it('matches single-segment wildcard', () => {
    expect(patternMatchesKey('master_data.*.view', 'master_data.customer.view')).toBe(true);
    expect(patternMatchesKey('master_data.*.view', 'master_data.customer_type.view')).toBe(true);
    expect(patternMatchesKey('master_data.*.view', 'master_data.customer.create')).toBe(false);
  });

  it('matches zero-segment wildcard (wildcard consumes nothing)', () => {
    expect(patternMatchesKey('dashboard.*.view', 'dashboard.view')).toBe(true);
    expect(patternMatchesKey('inventory.*.view', 'inventory.stock.view')).toBe(true);
  });

  it('matches multi-segment consumption', () => {
    expect(patternMatchesKey('admin.sync.*', 'admin.sync.whatsapp.view')).toBe(true);
    expect(patternMatchesKey('admin.*', 'admin.approval.view')).toBe(true);
  });

  it('rejects non-matching module/action', () => {
    expect(patternMatchesKey('hr.*.view', 'finance.report.view')).toBe(false);
    expect(patternMatchesKey('sales.*.view', 'purchasing.po.create')).toBe(false);
  });

  it('exact keys do not act as prefixes', () => {
    expect(patternMatchesKey('master_data', 'master_data.customer.view')).toBe(false);
  });
});

describe('isPermissionWithinDefaults', () => {
  it('true when exact key present', () => {
    expect(
      isPermissionWithinDefaults('purchasing.po.create', [
        'menu.purchasing',
        'purchasing.*.view',
        'purchasing.po.create',
      ]),
    ).toBe(true);
  });

  it('true when covered by a wildcard default', () => {
    expect(
      isPermissionWithinDefaults('purchasing.invoice.view', ['purchasing.*.view']),
    ).toBe(true);
  });

  it('false when not covered', () => {
    expect(isPermissionWithinDefaults('hr.kasbon.view', ['purchasing.*.view'])).toBe(false);
  });
});

describe('computeEffectivePermissions', () => {
  it('unions role defaults and subtracts denied permissions (deny-only model)', () => {
    const roles = [
      { role: { code: 'MGR', defaultPermissions: ['purchasing.*.view', 'sales.history.view'] }, deniedPermissions: ['sales.history.view'] },
      { role: { code: 'CS', defaultPermissions: ['sales.history.view'] }, deniedPermissions: [] },
    ];
    const effective = computeEffectivePermissions(roles as any);
    expect(effective).toContain('purchasing.*.view');
    // Denied on the MGR assignment — deny wins for the key across roles
    expect(effective).not.toContain('sales.history.view');
    expect(effective.length).toBe(1);
  });

  it('returns union when nothing is denied', () => {
    const roles = [
      { role: { code: 'MGR', defaultPermissions: ['purchasing.*.view'] }, deniedPermissions: [] },
      { role: { code: 'CS', defaultPermissions: ['sales.history.view', 'service.order.view'] }, deniedPermissions: [] },
    ];
    const effective = computeEffectivePermissions(roles as any);
    expect(effective).toEqual(
      expect.arrayContaining(['purchasing.*.view', 'sales.history.view', 'service.order.view']),
    );
  });
});

describe('PERMISSION_CATALOG vocabulary', () => {
  it('contains the new sidebar-restructure placeholder keys', () => {
    for (const key of [
      'master_data.branch.view',
      'master_data.warehouse.view',
      'purchasing.invoice.view',
      'purchasing.return.view',
      'inventory.request.view',
      'finance.ap.view',
      'finance.asset.view',
      'finance.prive.view',
      'hr.kasbon.view',
      'hr.division.view',
    ]) {
      expect(PERMISSION_CATALOG).toContain(key);
    }
  });
});
