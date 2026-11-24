import { formatStreetLabel, resolveStreetLabel } from './street-geocode';

/**
 * dev-presensi-clock-street: street label stored at clock time.
 * Pure formatter + resolver with injected fetch (no network in tests).
 */
describe('street-geocode', () => {
  describe('formatStreetLabel', () => {
    it('joins road + number + area + city', () => {
      expect(
        formatStreetLabel({ road: 'Jalan PB Sudirman', house_number: '88', suburb: 'Kaliwates', city: 'Jember' }),
      ).toBe('Jalan PB Sudirman No. 88, Kaliwates, Jember');
    });

    it('omits missing parts without dangling commas', () => {
      expect(formatStreetLabel({ road: 'Jalan Trunojoyo' })).toBe('Jalan Trunojoyo');
      expect(formatStreetLabel({ city: 'Jember' })).toBe('Jember');
      expect(formatStreetLabel({ suburb: 'Kepatihan', town: 'Jember' })).toBe('Kepatihan, Jember');
    });

    it('returns null for null/empty addresses', () => {
      expect(formatStreetLabel(null)).toBeNull();
      expect(formatStreetLabel(undefined)).toBeNull();
      expect(formatStreetLabel({})).toBeNull();
    });
  });

  describe('resolveStreetLabel', () => {
    const addr = { road: 'Jalan PB Sudirman', house_number: '88', suburb: 'Kaliwates', city: 'Jember' };
    const okFetch = () => jest.fn(async () => ({ ok: true, json: async () => ({ address: addr }) }));

    it('returns the formatted street on success', async () => {
      await expect(resolveStreetLabel(-8.1753, 113.7021, { fetchImpl: okFetch() })).resolves.toBe(
        'Jalan PB Sudirman No. 88, Kaliwates, Jember',
      );
    });

    it('returns null on non-200, throw, and unusable payload', async () => {
      await expect(
        resolveStreetLabel(0, 0, { fetchImpl: jest.fn(async () => ({ ok: false, json: async () => ({}) })) }),
      ).resolves.toBeNull();
      await expect(
        resolveStreetLabel(0, 0, {
          fetchImpl: jest.fn(async () => {
            throw new Error('down');
          }),
        }),
      ).resolves.toBeNull();
      await expect(
        resolveStreetLabel(0, 0, { fetchImpl: jest.fn(async () => ({ ok: true, json: async () => ({}) })) }),
      ).resolves.toBeNull();
    });

    it('returns null on timeout instead of hanging', async () => {
      const hanging = jest.fn(
        (_url: string, init?: { signal?: AbortSignal }) =>
          new Promise<{ ok: boolean; json(): Promise<unknown> }>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );
      await expect(resolveStreetLabel(0, 0, { fetchImpl: hanging, timeoutMs: 50 })).resolves.toBeNull();
      expect(hanging).toHaveBeenCalledTimes(1);
    });
  });
});
