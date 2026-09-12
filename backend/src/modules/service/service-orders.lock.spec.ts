import { ServiceOrdersService } from './service-orders.service';
import { encryptPassword } from './utils/password-encryption.util';
import { SalesTransactionsService } from '../sales/sales-transactions.service';

const TEST_SECRET = 'test-secret-0123456789abcdef-test';

describe('ServiceOrdersService lock credential lifecycle (IGDERP-185)', () => {
  let service: ServiceOrdersService;
  let prisma: any;

  const tx = {
    serviceOrder: { update: jest.fn() },
    serviceStatusHistory: { create: jest.fn() },
  };

  const salesMock = {
    findByServiceOrderId: jest.fn(() => Promise.resolve(null)),
    createNoServiceFromParts: jest.fn((a: any) => Promise.resolve({ id: 'tx-1', ...a })),
    markPaidForServiceOrder: jest.fn(() => Promise.resolve(null)),
  } as unknown as SalesTransactionsService;

  beforeEach(() => {
    process.env.DEVICE_PASSWORD_SECRET = TEST_SECRET;
    prisma = {
      serviceOrder: { findUnique: jest.fn(), update: jest.fn() },
      serviceStatusHistory: { create: jest.fn() },
      serviceType: { findUnique: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    service = new ServiceOrdersService(prisma, undefined, salesMock);
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.DEVICE_PASSWORD_SECRET;
  });

  it('wipes devicePassword + deviceLockType on done', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue({
      id: 'so-1', status: 'ready', branchId: 'br-1', partsUsed: [],
    });
    tx.serviceOrder.update.mockImplementation((args: any) =>
      Promise.resolve({ id: 'so-1', ...args.data }),
    );
    tx.serviceStatusHistory.create.mockResolvedValue({ id: 'h-1' });

    await service.updateStatus('so-1', { status: 'done' } as any, 'u-1');

    expect(tx.serviceOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ devicePassword: null, deviceLockType: 'none' }),
      }),
    );
  });

  it('revealLock decrypts + writes an audit line', async () => {
    const enc = encryptPassword('pattern:0-3-4-5-8');
    prisma.serviceOrder.findUnique.mockResolvedValue({
      id: 'so-1', status: 'in-progress', deviceLockType: 'pattern', devicePassword: enc,
    });
    prisma.serviceStatusHistory.create.mockResolvedValue({ id: 'h-1' });

    const out = await service.revealLock('so-1', 'tc-1');

    expect(out).toEqual({ lockType: 'pattern', value: 'pattern:0-3-4-5-8' });
    expect(prisma.serviceStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ serviceOrderId: 'so-1', notes: 'Kunci layar dilihat', changedBy: 'tc-1' }),
      }),
    );
  });

  it('revealLock returns none without touching history when no credential', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue({
      id: 'so-1', status: 'ready', deviceLockType: 'none', devicePassword: null,
    });

    const out = await service.revealLock('so-1', 'tc-1');

    expect(out).toEqual({ lockType: 'none', value: null });
    expect(prisma.serviceStatusHistory.create).not.toHaveBeenCalled();
  });
});
