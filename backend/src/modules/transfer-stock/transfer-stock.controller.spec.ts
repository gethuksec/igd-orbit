import { Test, TestingModule } from '@nestjs/testing';
import { TransferStockController } from './transfer-stock.controller';
import { TransferStockService } from './transfer-stock.service';

describe('TransferStockController', () => {
  let controller: TransferStockController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    findWarehouses: jest.Mock;
    findCentralBad: jest.Mock;
    searchProducts: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'transfer-1' }),
      findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      findById: jest.fn().mockResolvedValue({ id: 'transfer-1' }),
      findWarehouses: jest.fn().mockResolvedValue([]),
      findCentralBad: jest.fn().mockResolvedValue({ id: 'central-bad' }),
      searchProducts: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransferStockController],
      providers: [{ provide: TransferStockService, useValue: service }],
    }).compile();

    controller = module.get<TransferStockController>(TransferStockController);
  });

  it('passes req.user.id to the service on create', async () => {
    const dto = {
      outletId: 'outlet-a',
      warehouseId: 'wh-a',
      destinationMode: 'outlet',
      toOutletId: 'outlet-b',
      toWarehouseId: 'wh-b',
      items: [{ productId: 'prod-1', quantity: 2 }],
    };
    await controller.create(dto as any, { user: { id: 'user-42' } });
    expect(service.create).toHaveBeenCalledWith(dto, 'user-42');
  });

  it('forwards pagination/filter queries to findAll', async () => {
    await controller.findAll({ page: '2', limit: '10', outletId: 'outlet-a' });
    expect(service.findAll).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      outletId: 'outlet-a',
      warehouseId: undefined,
    });
  });

  it('forwards outletId to findWarehouses', async () => {
    await controller.warehouses('outlet-a');
    expect(service.findWarehouses).toHaveBeenCalledWith('outlet-a');
  });

  it('forwards no args to findCentralBad', async () => {
    await controller.centralBad();
    expect(service.findCentralBad).toHaveBeenCalledWith();
  });

  it('forwards q/limit/warehouseId to searchProducts', async () => {
    await controller.products('iphone', '20', 'wh-a');
    expect(service.searchProducts).toHaveBeenCalledWith('iphone', 20, 'wh-a');
  });

  it('forwards id to findById', async () => {
    await controller.findById('transfer-1');
    expect(service.findById).toHaveBeenCalledWith('transfer-1');
  });
});
