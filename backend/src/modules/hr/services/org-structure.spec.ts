import { ORG_DEPARTMENTS, RETIRED_DEPARTMENT_CODES } from '../../../../prisma/org-tree';
import {
  ORG_DIVISIONS,
  ORG_GRADES,
  ORG_POSITION_TITLES,
} from '../../../../prisma/org-structure';

/**
 * Org-structure contract (IGDERP-277).
 * Guards the chart-locked shape: 3 departments, 6 divisions, G1-G6 grades,
 * 26 titles (11 non-staff + 15 staff × 6 grade rows = 101 position rows).
 */
describe('org-structure contract (IGDERP-277)', () => {
  it('has exactly 3 root departments', () => {
    expect(ORG_DEPARTMENTS.map((d) => d.code).sort()).toEqual(
      ['DEPT-MKT', 'DEPT-OPS', 'DEPT-SUP'].sort(),
    );
  });

  it('retires SC/FIN/HRD as departments', () => {
    expect(RETIRED_DEPARTMENT_CODES.sort()).toEqual(['DEPT-FIN', 'DEPT-HRD', 'DEPT-SC'].sort());
    const live = new Set(ORG_DEPARTMENTS.map((d) => d.code));
    for (const code of RETIRED_DEPARTMENT_CODES) {
      expect(live.has(code)).toBe(false);
    }
  });

  it('has exactly 6 divisions, all under live departments', () => {
    expect(ORG_DIVISIONS).toHaveLength(6);
    const liveDepts = new Set(ORG_DEPARTMENTS.map((d) => d.code));
    const codes = new Set<string>();
    for (const div of ORG_DIVISIONS) {
      expect(codes.has(div.code)).toBe(false);
      codes.add(div.code);
      expect(liveDepts.has(div.department)).toBe(true);
    }
    // 1 marketing + 2 operation + 3 support
    const perDept = ORG_DIVISIONS.reduce<Record<string, number>>((acc, d) => {
      acc[d.department] = (acc[d.department] ?? 0) + 1;
      return acc;
    }, {});
    expect(perDept).toEqual({ 'DEPT-MKT': 1, 'DEPT-OPS': 2, 'DEPT-SUP': 3 });
  });

  it('has grades G1-G6 with unique ranks', () => {
    expect(ORG_GRADES).toHaveLength(6);
    expect(ORG_GRADES.map((g) => g.rank).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(ORG_GRADES.map((g) => g.code)).size).toBe(6);
  });

  it('has 26 chart titles: 11 non-staff + 15 staff', () => {
    expect(ORG_POSITION_TITLES).toHaveLength(26);
    const staff = ORG_POSITION_TITLES.filter((t) => t.rank === 6);
    const rest = ORG_POSITION_TITLES.filter((t) => t.rank !== 6);
    expect(staff).toHaveLength(15);
    expect(rest).toHaveLength(11);
    // 11 non-staff + 15 staff × 6 grades = 101 position rows
    expect(rest.length + staff.length * ORG_GRADES.length).toBe(101);
  });

  it('links every non-MU title to a live department/division', () => {
    const liveDepts = new Set(ORG_DEPARTMENTS.map((d) => d.code));
    const liveDivs = new Map(ORG_DIVISIONS.map((d) => [d.code, d.department]));
    for (const t of ORG_POSITION_TITLES) {
      if (t.titleCode === 'MU') continue; // above departments
      expect(liveDepts.has(t.department!)).toBe(true);
      if (t.division) {
        expect(liveDivs.get(t.division)).toBe(t.department);
      }
    }
  });

  it('keeps FL in the sales scope per chart grouping', () => {
    const fl = ORG_POSITION_TITLES.find((t) => t.titleCode === 'FL')!;
    expect(fl.division).toBe('DIV-OPS-SE');
  });

  it('wires a valid N+1 chain: every title except MU has a higher-rank parent, no cycles', () => {
    const byCode = new Map(ORG_POSITION_TITLES.map((t) => [t.titleCode, t]));
    const mu = byCode.get('MU')!;
    expect(mu.parentTitleCode ?? null).toBeNull();
    for (const t of ORG_POSITION_TITLES) {
      if (t.titleCode === 'MU') continue;
      const parent = byCode.get(t.parentTitleCode!);
      expect(parent).toBeDefined();
      expect(parent!.rank).toBeLessThan(t.rank);
    }
    // Walk every chain to the top; all must terminate at MU without looping.
    for (const t of ORG_POSITION_TITLES) {
      const seen = new Set<string>();
      let cursor: string | null | undefined = t.parentTitleCode;
      while (cursor) {
        expect(seen.has(cursor)).toBe(false);
        seen.add(cursor);
        cursor = byCode.get(cursor)!.parentTitleCode;
      }
      expect(seen.has('MU') || t.titleCode === 'MU').toBe(true);
    }
  });
});
