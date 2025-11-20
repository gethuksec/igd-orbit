import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from '../decorators';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let configService: ConfigService;

  const mockExecutionContext = (user: any) => {
    const request = {
      user: user,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('false'), // Default: disabled
          },
        },
      ],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
    reflector = module.get<Reflector>(Reflector);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('Feature Flag Disabled (Default - Safe Mode)', () => {
    it('should allow access when feature flag is disabled', () => {
      jest.spyOn(configService, 'get').mockReturnValue('false');
      const context = mockExecutionContext({ id: 'user-1' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('Feature Flag Enabled', () => {
    beforeEach(() => {
      // Create new guard instance with feature flag enabled for these tests
      jest.spyOn(configService, 'get').mockReturnValue('true');
      // Re-instantiate guard to pick up new config
      guard = new PermissionsGuard(reflector, configService);
    });

    it('should allow access when no @Permissions() decorator is present', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const context = mockExecutionContext({ id: 'user-1' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user has required permission', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['sales.pos.create']);
      const context = mockExecutionContext({
        id: 'user-1',
        permissions: ['sales.pos.create'],
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user does not have required permission', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['sales.pos.create']);
      const context = mockExecutionContext({
        id: 'user-1',
        permissions: ['inventory.stock.view'], // Completely different, no match
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should allow access when user has any of multiple required permissions (OR logic)', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['sales.pos.create', 'sales.pos.view']);
      const context = mockExecutionContext({
        id: 'user-1',
        permissions: ['sales.pos.view'], // Has one of the required
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should support wildcard module permission', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['sales.*.create']);
      const context = mockExecutionContext({
        id: 'user-1',
        permissions: ['sales.pos.create'], // Matches wildcard
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should support wildcard submodule permission', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['sales.pos.*']);
      const context = mockExecutionContext({
        id: 'user-1',
        permissions: ['sales.pos.create'], // Matches wildcard
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user is not authenticated', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['sales.pos.create']);
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ user: null }), // No user
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('User not authenticated');
    });
  });
});

