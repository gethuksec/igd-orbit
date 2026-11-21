import { BadRequestException } from '@nestjs/common';
import { haversineMeters, assertMobileClockProof } from './attendance.service';

/**
 * IGDERP-275: GPS radius math + mobile proof gate (pure unit, no Nest).
 */
describe('attendance mobile proof (IGDERP-275 unit)', () => {
  it('haversine: same point is 0m', () => {
    expect(haversineMeters(-7.25, 112.75, -7.25, 112.75)).toBe(0);
  });

  it('haversine: ~111m per 0.001° latitude', () => {
    const d = haversineMeters(-7.25, 112.75, -7.249, 112.75);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(125);
  });

  const branch = { latitude: -7.25, longitude: 112.75, attendanceRadiusM: 100, name: 'Pusat' };
  const proof = { latitude: -7.25, longitude: 112.75, photoUrl: 'http://x/selfie.jpg' };

  it('rejects missing GPS', () => {
    expect(() => assertMobileClockProof({ photoUrl: 'http://x/s.jpg' }, branch)).toThrow(
      BadRequestException,
    );
  });

  it('rejects missing selfie', () => {
    expect(() =>
      assertMobileClockProof({ latitude: -7.25, longitude: 112.75 }, branch),
    ).toThrow(BadRequestException);
  });

  it('rejects outside radius with distance in message (popup payload)', () => {
    try {
      assertMobileClockProof(
        { latitude: -7.24, longitude: 112.75, photoUrl: 'http://x/s.jpg' },
        branch,
      );
      fail('should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect(e.message).toMatch(/Di luar lokasi/);
      expect(e.message).toMatch(/radius 100m/);
    }
  });

  it('accepts inside radius', () => {
    expect(assertMobileClockProof(proof, branch)).toEqual({ distanceMeters: 0 });
  });

  it('skips radius check when branch has no geotag', () => {
    expect(
      assertMobileClockProof(proof, { latitude: null, longitude: null, attendanceRadiusM: 100 }),
    ).toEqual({ distanceMeters: null });
  });
});
