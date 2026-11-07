import { ServiceOrdersService } from './service-orders.service';

// List-filter coverage: code/customer/penerima/unit/part/serial/date land in where.
describe('ServiceOrdersService — list filters', () => {
  let service: ServiceOrdersService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      serviceOrder: { findMany: jest.fn(() => Promise.resolve([])) },
      user: { findMany: jest.fn(() => Promise.resolve([])) },
    };
    service = new ServiceOrdersService(prisma, undefined, undefined, undefined);
    jest.clearAllMocks();
    prisma.serviceOrder.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
  });

  const lastWhere = () => {
    const calls = prisma.serviceOrder.findMany.mock.calls;
    return calls[calls.length - 1][0].where;
  };

  it('maps code to serviceNumber/internalNumber contains (AND clause)', async () => {
    await service.findAll(undefined, undefined, undefined, undefined, { code: 'SRV-2026' });
    expect(lastWhere().AND).toEqual(
      expect.arrayContaining([
        {
          OR: [
            { serviceNumber: { contains: 'SRV-2026', mode: 'insensitive' } },
            { internalNumber: { contains: 'SRV-2026', mode: 'insensitive' } },
          ],
        },
      ]),
    );
  });

  it('maps customerId to exact match', async () => {
    await service.findAll(undefined, undefined, undefined, undefined, { customerId: 'cust-1' });
    expect(lastWhere().customerId).toBe('cust-1');
  });

  it('maps penerima to pickedUpBy contains', async () => {
    await service.findAll(undefined, undefined, undefined, undefined, { penerima: 'Siti' });
    expect(lastWhere().pickedUpBy).toEqual({ contains: 'Siti', mode: 'insensitive' });
  });

  it('maps deviceUnit to contains', async () => {
    await service.findAll(undefined, undefined, undefined, undefined, { deviceUnit: 'A52' });
    expect(lastWhere().deviceUnit).toEqual({ contains: 'A52', mode: 'insensitive' });
  });

  it('maps partSearch to partsUsed product barcode/sku/name', async () => {
    await service.findAll(undefined, undefined, undefined, undefined, { partSearch: '89912' });
    expect(lastWhere().partsUsed).toEqual({
      some: {
        product: {
          OR: [
            { barcode: { contains: '89912', mode: 'insensitive' } },
            { sku: { contains: '89912', mode: 'insensitive' } },
            { name: { contains: '89912', mode: 'insensitive' } },
          ],
        },
      },
    });
  });

  it('maps serial to deviceSerial/deviceImei contains (AND clause)', async () => {
    await service.findAll(undefined, undefined, undefined, undefined, { serial: '35811' });
    expect(lastWhere().AND).toEqual(
      expect.arrayContaining([
        {
          OR: [
            { deviceSerial: { contains: '35811', mode: 'insensitive' } },
            { deviceImei: { contains: '35811', mode: 'insensitive' } },
          ],
        },
      ]),
    );
  });

  it('free search actually filters (per-word OR across fields)', async () => {
    await service.findAll(undefined, undefined, undefined, 'Ahmad');
    const and = lastWhere().AND;
    expect(and).toBeDefined();
    expect(JSON.stringify(and)).toContain('Ahmad');
    expect(JSON.stringify(and)).toContain('customerName');
  });

  it('maps createdBy to exact user-id match (penerima awal)', async () => {
    await service.findAll(undefined, undefined, undefined, undefined, { createdBy: 'user-cs-1' });
    expect(lastWhere().createdBy).toBe('user-cs-1');
  });

  it('attaches creator names to rows (null when user missing)', async () => {
    prisma.serviceOrder.findMany.mockResolvedValue([
      { id: 'so-1', createdBy: 'user-cs-1' },
      { id: 'so-2', createdBy: 'ghost-id' },
      { id: 'so-3', createdBy: null },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-cs-1', fullName: 'CS Andi', email: 'andi@x.id' },
    ]);
    const rows: any[] = await service.findAll(undefined, undefined, undefined, undefined, {});
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['user-cs-1', 'ghost-id'] } },
      select: { id: true, fullName: true, email: true },
    });
    expect(rows[0].creator).toEqual({ id: 'user-cs-1', fullName: 'CS Andi', email: 'andi@x.id' });
    expect(rows[1].creator).toBeNull();
    expect(rows[2].creator).toBeNull();
  });

  it('maps receivedFrom/receivedTo to receivedDate range (to is end-of-day)', async () => {
    await service.findAll(undefined, undefined, undefined, undefined, {
      receivedFrom: '2026-11-01',
      receivedTo: '2026-11-05',
    });
    const range = lastWhere().receivedDate;
    expect(range.gte).toEqual(new Date('2026-11-01'));
    expect(range.lte.getTime()).toBeGreaterThan(new Date('2026-11-05T00:00:00').getTime());
    expect(range.lte.getHours()).toBe(23);
  });

  it('keeps legacy params working alongside new filters', async () => {
    await service.findAll({ branchId: 'br-1' } as any, 'ready', 'tech-1', 'Ahmad', {
      penerima: 'Siti',
    });
    const where = lastWhere();
    expect(where.branchId).toBe('br-1');
    expect(where.status).toBe('ready');
    expect(where.assignedTechnicianId).toBe('tech-1');
    expect(where.pickedUpBy).toEqual({ contains: 'Siti', mode: 'insensitive' });
    expect(where.AND).toBeDefined();
  });
});
