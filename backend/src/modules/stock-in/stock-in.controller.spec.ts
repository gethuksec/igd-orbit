import { Test, TestingModule } from '@nestjs/testing';
import { StockInController } from './stock-in.controller';
import { StockInService } from './stock-in.service';

describe('StockInController', () => {
  let controller: StockInController;
  let service: { create: jest.Mock; findAll: jest.Mock; findById: jest.Mock; findGoodWarehouses: jest.Mock; searchProducts: jest.Mock; getTiers: jest.Mock };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'stockin-1' }),
      findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      findById: jest.fn().mockResolvedValue({ id: 'stockin-1' }),
      findGoodWarehouses: jest.fn().mockResolvedValue([]),
      searchProducts: jest.fn().mockResolvedValue([]),
      getTiers: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockInController],
      providers: [{ provide: StockInService, useValue: service }],
    }).compile();

    controller = module.get<StockInController>(StockInController);
  });

  it('passes req.user.id to the service on create', async () => {
    const dto = {
      outletId: 'outlet-1',
      warehouseId: 'wh-1',
      reason: 'Stok awal',
      items: [{ productId: 'prod-1', quantity: 2 }],
    };
    await controller.create(dto as any, { user: { id: 'user-42' } });
    expect(service.create).toHaveBeenCalledWith(dto, 'user-42');
  });

  it('forwards pagination/filter queries to findAll', async () => {
    await controller.findAll({
      page: '2',
      limit: '10',
      outletId: 'outlet-1',
      startDate: '2026-08-01',
    });
    expect(service.findAll).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      outletId: 'outlet-1',
      warehouseId: undefined,
      supplierId: undefined,
      startDate: '2026-08-01',
      endDate: undefined,
    });
  });

  it('forwards outletId to findGoodWarehouses and q/limit to searchProducts', async () => {
    await controller.warehouses('outlet-1');
    expect(service.findGoodWarehouses).toHaveBeenCalledWith('outlet-1');

    await controller.products('iphone', '20');
    expect(service.searchProducts).toHaveBeenCalledWith('iphone', 20);
  });

  it('forwards id to findById and calls getTiers', async () => {
    await controller.findById('stockin-1');
    expect(service.findById).toHaveBeenCalledWith('stockin-1');

    await controller.tiers();
    expect(service.getTiers).toHaveBeenCalled();
  });
});
