import { StockRequestsController } from './stock-requests.controller';

describe('StockRequestsController', () => {
  let controller: StockRequestsController;
  let service: any;

  beforeEach(() => {
    service = {
      getIntakeContext: jest.fn(),
      searchIntakeProducts: jest.fn(),
      verifyIntakeMember: jest.fn(),
      createIntake: jest.fn(),
      rotateIntakeToken: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      approve: jest.fn(),
      updateStatus: jest.fn(),
    };
    controller = new StockRequestsController(service);
  });

  it('delegates public intake create with token + body', async () => {
    const dto: any = { staffName: 'Aldi', customerType: 'USER', items: [] };
    service.createIntake.mockResolvedValue({ id: 'r' });
    await controller.createIntake('tok-1', dto);
    expect(service.createIntake).toHaveBeenCalledWith('tok-1', dto);
  });

  it('delegates context/products/member-verify with token', async () => {
    await controller.getIntakeContext('tok-1');
    expect(service.getIntakeContext).toHaveBeenCalledWith('tok-1');
    await controller.searchIntakeProducts('tok-1', 'lcd', '10');
    expect(service.searchIntakeProducts).toHaveBeenCalledWith('tok-1', 'lcd', 10);
    await controller.verifyIntakeMember('tok-1', 'MBR-001');
    expect(service.verifyIntakeMember).toHaveBeenCalledWith('tok-1', 'MBR-001');
  });

  it('passes JWT user id as decidedBy on approve/status', async () => {
    await controller.approve('req-1', { user: { id: 'sodo-1' } });
    expect(service.approve).toHaveBeenCalledWith('req-1', 'sodo-1');
    const dto: any = { status: 'CHECKOUT', poNumber: 'PO-1' };
    await controller.updateStatus('req-1', dto, { user: { id: 'sodo-1' } });
    expect(service.updateStatus).toHaveBeenCalledWith('req-1', dto, 'sodo-1');
  });

  it('parses list pagination params', async () => {
    await controller.findAll({ page: '2', limit: '10', status: 'submitted' });
    expect(service.findAll).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      search: undefined,
      status: 'submitted',
      branchId: undefined,
    });
  });
});
