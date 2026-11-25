import { MASTER_CODE_PATTERN, generateMasterCode } from './master-code.util';

/**
 * IGDERP-316 — master-data codes are flat 10-char uppercase alphanumeric.
 */
describe('master-code.util (IGDERP-316)', () => {
  it('generates exactly 10 uppercase alphanumeric chars', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateMasterCode();
      expect(code).toMatch(MASTER_CODE_PATTERN);
      expect(code).toHaveLength(10);
    }
  });

  it('generates unique codes across a batch', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      codes.add(generateMasterCode());
    }
    expect(codes.size).toBe(1000);
  });
});
