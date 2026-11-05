import { PosService } from './pos.service';

describe('PosService.getCatalog (IGDERP-244)', () => {
  let service: PosService;
  let prisma: any;

  const productRows = [
    {
      id: 'p1',
      name: 'Laptop Fan ASUS',
      sku: 'SPR-007',
      barcode: '8999999014001',
      sellingPrice: { toNumber: () => 450000 },
      unitId: 'u1',
      productStocks: [{ quantityAvailable: { toNumber: () => 14, valueOf: () => 14 } }],
    },
    {
      id: 'p2',
      name: 'Baterai Tanam',
      sku: 'BAT-001',
      barcode: null,
      sellingPrice: { toNumber: () => 120000 },
      unitId: 'u1',
      productStocks: [],
    },
  ];
  const customerRows = [
    {
      id: 'c1',
      customerCode: 'C-001',
      name: 'Budi Santoso',
      phone: '0811',
      email: null,
      subdistrict: 'Kalisat',
      tierId: null,
    },
  ];

  beforeEach(() => {
    prisma = {
      product: { findMany: jest.fn().mockResolvedValue(productRows) },
      customer: { findMany: jest.fn().mockResolvedValue(customerRows) },
    };
    service = new PosService(prisma);
  });

  it('returns drop-in search shapes with warehouse-scoped available', async () => {
    const res: any = await service.getCatalog('wh-1');
    expect(res.products).toHaveLength(2);
    expect(res.products[0]).toMatchObject({
      id: 'p1',
      name: 'Laptop Fan ASUS',
      sku: 'SPR-007',
      barcode: '8999999014001',
      available: 14,
    });
    expect(res.products[0].productStocks).toBeUndefined();
    // no stock row for this warehouse → null (same as searchProducts)
    expect(res.products[1].available).toBeNull();
    expect(res.customers).toEqual(customerRows);
    expect(res.warehouseId).toBe('wh-1');
    expect(typeof res.cachedAt).toBe('string');
    // drop-in for addProductToRow: price resolves from sellingPrice
    expect(Number(res.products[0].sellingPrice.toNumber())).toBe(450000);
  });

  it('without warehouseId omits the stock join and maps available to null', async () => {
    const res: any = await service.getCatalog(undefined);
    expect(
      prisma.product.findMany.mock.calls[0][0].select.productStocks,
    ).toBe(false);
    expect(res.products[0].available).toBeNull();
    expect(res.warehouseId).toBeNull();
  });

  it('only pulls active rows with a safety cap', async () => {
    await service.getCatalog('wh-1');
    const pArgs = prisma.product.findMany.mock.calls[0][0];
    const cArgs = prisma.customer.findMany.mock.calls[0][0];
    expect(pArgs.where).toEqual({ isActive: true });
    expect(cArgs.where).toEqual({ isActive: true });
    expect(pArgs.take).toBe(5000);
    expect(cArgs.take).toBe(5000);
  });
});
