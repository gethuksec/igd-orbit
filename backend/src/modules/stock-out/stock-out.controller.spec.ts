import { Test, TestingModule } from '@nestjs/testing';
import { StockOutController } from './stock-out.controller';
import { StockOutService } from './stock-out.service';

describe('StockOutController', () => {
  let controller: StockOutController;
  let service: { create: jest.Mock; findAll: jest.Mock; findById: jest.Mock; findSourceWarehouses: jest.Mock; searchProducts: jest.Mock };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'stockout-1' }),
      findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      findById: jest.fn().mockResolvedValue({ id: 'stockout-1' }),
      findSourceWarehouses: jest.fn().mockResolvedValue([]),
      searchProducts: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockOutController],
      providers: [{ provide: StockOutService, useValue: service }],
    }).compile();

    controller = module.get<StockOutController>(StockOutController);
  });

  it('passes req.user.id to the service on create', async () => {
    const dto = {
      warehouseId: 'wh-1',
      reason: 'Barang rusak',
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
      startDate: '2026-08-01',
      endDate: undefined,
    });
  });

  it('forwards outletId to findSourceWarehouses and q/limit/warehouseId to searchProducts', async () => {
    await controller.warehouses('outlet-1');
    expect(service.findSourceWarehouses).toHaveBeenCalledWith('outlet-1');

    await controller.products('iphone', '20', 'wh-1');
    expect(service.searchProducts).toHaveBeenCalledWith('iphone', 20, 'wh-1');
  });

  it('forwards id to findById', async () => {
    await controller.findById('stockout-1');
    expect(service.findById).toHaveBeenCalledWith('stockout-1');
  });
});
