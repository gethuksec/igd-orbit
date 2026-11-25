import { Test, TestingModule } from '@nestjs/testing';
import { LeaveTypesController } from './leave-types.controller';
import { LeaveTypesService } from './leave-types.service';
import { ROLES_KEY } from '../../shared/decorators/roles.decorator';

describe('LeaveTypesController (IGDERP-308 self-service lookup)', () => {
  let controller: LeaveTypesController;
  let service: { findAll: jest.Mock; findById: jest.Mock; findActiveOptions: jest.Mock };

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      findById: jest.fn().mockResolvedValue({ id: 'lt-1' }),
      findActiveOptions: jest.fn().mockResolvedValue([
        { id: 'lt-1', code: 'CUTI-TAHUNAN', name: 'Cuti Tahunan' },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaveTypesController],
      providers: [{ provide: LeaveTypesService, useValue: service }],
    }).compile();

    controller = module.get<LeaveTypesController>(LeaveTypesController);
  });

  it('delegates GET /leave-types/active to findActiveOptions', async () => {
    const res = await controller.findActiveOptions();
    expect(service.findActiveOptions).toHaveBeenCalledWith();
    expect(res).toHaveLength(1);
  });

  it('leaves GET /leave-types/active outside RolesGuard (no roles metadata)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, controller.findActiveOptions)).toBeUndefined();
  });

  it('keeps master list/detail/create/update/delete behind HR roles', () => {
    expect(Reflect.getMetadata(ROLES_KEY, controller.findAll)).toEqual(
      expect.arrayContaining(['HR', 'SPV-HRD', 'HS']),
    );
    expect(Reflect.getMetadata(ROLES_KEY, controller.findById)).toEqual(
      expect.arrayContaining(['HR', 'SPV-HRD', 'HS']),
    );
    expect(Reflect.getMetadata(ROLES_KEY, controller.create)).toEqual(
      expect.arrayContaining(['HR', 'SPV-HRD']),
    );
    expect(Reflect.getMetadata(ROLES_KEY, controller.update)).toEqual(
      expect.arrayContaining(['HR', 'SPV-HRD']),
    );
    expect(Reflect.getMetadata(ROLES_KEY, controller.delete)).toEqual(
      expect.arrayContaining(['HR', 'SPV-HRD']),
    );
  });
});
