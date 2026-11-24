import { PasswordService } from './password.service';

describe('PasswordService.generateStrongPassword (IGDERP-298)', () => {
  const svc = new PasswordService();

  it('generates passwords that pass the strength policy', () => {
    for (let i = 0; i < 50; i++) {
      const pw = svc.generateStrongPassword();
      expect(pw.length).toBeGreaterThanOrEqual(12);
      expect(svc.validatePasswordStrength(pw)).toEqual({ isValid: true });
    }
  });

  it('respects a minimum length floor of 8', () => {
    const pw = svc.generateStrongPassword(4);
    expect(pw.length).toBeGreaterThanOrEqual(8);
    expect(svc.validatePasswordStrength(pw).isValid).toBe(true);
  });

  it('generates unique values', () => {
    const set = new Set(Array.from({ length: 20 }, () => svc.generateStrongPassword()));
    expect(set.size).toBeGreaterThan(1);
  });
});
