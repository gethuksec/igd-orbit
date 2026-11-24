import { AttendanceController } from './attendance.controller';

/**
 * WS-290b: SUPERADMIN has no employee row — scoping it to "self"
 * returned an empty roster. It must see all staff like other managers.
 */
describe('AttendanceController role scoping (WS-290b)', () => {
  let service: any;
  let ctrl: AttendanceController;
  const reqFor = (roles: string[], id = 'u-1') => ({ user: { id, roles } }) as any;

  beforeEach(() => {
    service = { getRoster: jest.fn().mockResolvedValue({}), findAll: jest.fn().mockResolvedValue({}) };
    ctrl = new AttendanceController(service);
  });

  it('SUPERADMIN roster is not self-scoped', async () => {
    await ctrl.getRoster(reqFor(['SUPERADMIN']), undefined, undefined, undefined, undefined);
    expect(service.getRoster).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: undefined }),
    );
  });

  it('STAFF roster is self-scoped', async () => {
    await ctrl.getRoster(reqFor(['STAFF'], 'u-9'), undefined, undefined, undefined, undefined);
    expect(service.getRoster).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'u-9' }),
    );
  });

  it('SUPERADMIN record list is not self-scoped', async () => {
    await ctrl.findAll(reqFor(['SUPERADMIN']), undefined, undefined, undefined, undefined, undefined, undefined);
    expect(service.findAll).toHaveBeenCalledTimes(1);
    expect(service.findAll.mock.calls[0][0]).toBeUndefined();
  });
});
