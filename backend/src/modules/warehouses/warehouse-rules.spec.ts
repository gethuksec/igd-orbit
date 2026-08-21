import { BadRequestException } from '@nestjs/common';
import { normalizeWarehouseIdentity } from './warehouse-rules';

describe('normalizeWarehouseIdentity', () => {
  it('defaults an outlet warehouse to GOOD and OUTLET', () => {
    expect(normalizeWarehouseIdentity({ outletId: 'outlet-1' })).toEqual({
      type: 'GOOD',
      scope: 'OUTLET',
      outletId: 'outlet-1',
    });
  });

  it('allows the centralized BAD warehouse without an outlet', () => {
    expect(
      normalizeWarehouseIdentity({
        type: 'BAD',
        scope: 'SYSTEM',
        outletId: null,
      }),
    ).toEqual({ type: 'BAD', scope: 'SYSTEM', outletId: null });
  });

  it.each([
    [{ type: 'BAD', scope: 'OUTLET', outletId: 'outlet-1' }],
    [{ type: 'GOOD', scope: 'SYSTEM', outletId: null }],
    [{ type: 'BAD', scope: 'SYSTEM', outletId: 'outlet-1' }],
    [{ type: 'GOOD', scope: 'OUTLET', outletId: null }],
  ])('rejects invalid warehouse identity %#', (input) => {
    expect(() => normalizeWarehouseIdentity(input)).toThrow(BadRequestException);
  });

  it('rejects unknown type and scope values', () => {
    expect(() =>
      normalizeWarehouseIdentity({
        type: 'DAMAGED',
        scope: 'SYSTEM',
        outletId: null,
      }),
    ).toThrow('Warehouse type must be GOOD or BAD');

    expect(() =>
      normalizeWarehouseIdentity({
        type: 'GOOD',
        scope: 'GLOBAL',
        outletId: null,
      }),
    ).toThrow('Warehouse scope must be OUTLET or SYSTEM');
  });
});
