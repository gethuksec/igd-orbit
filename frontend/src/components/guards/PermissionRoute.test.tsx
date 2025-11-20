import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PermissionRoute from './PermissionRoute';
import * as usePermissionsHook from '@/hooks/usePermissions';

// Mock usePermissions hook
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('PermissionRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('should render children when no permission specified', () => {
    (usePermissionsHook.usePermissions as any).mockReturnValue({
      hasAnyPermission: () => false,
      hasAnyRole: () => false,
    });

    render(
      <MemoryRouter>
        <PermissionRoute>
          <div>Test Content</div>
        </PermissionRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should render children when user has permission', () => {
    (usePermissionsHook.usePermissions as any).mockReturnValue({
      hasAnyPermission: () => true,
      hasAnyRole: () => false,
    });

    render(
      <MemoryRouter>
        <PermissionRoute permission="sales.pos.view">
          <div>Test Content</div>
        </PermissionRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should show loading state when checking access', async () => {
    (usePermissionsHook.usePermissions as any).mockReturnValue({
      hasAnyPermission: () => false,
      hasAnyRole: () => false,
    });

    render(
      <MemoryRouter>
        <PermissionRoute permission="sales.pos.view">
          <div>Test Content</div>
        </PermissionRoute>
      </MemoryRouter>
    );

    // Should show loading state
    expect(screen.getByText('Checking access...')).toBeInTheDocument();
    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
  });

  it('should redirect to /unauthorized when access denied', async () => {
    (usePermissionsHook.usePermissions as any).mockReturnValue({
      hasAnyPermission: () => false,
      hasAnyRole: () => false,
    });

    render(
      <MemoryRouter>
        <PermissionRoute permission="sales.pos.view">
          <div>Test Content</div>
        </PermissionRoute>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/unauthorized', { replace: true });
    });
  });

  it('should redirect to custom path when access denied', async () => {
    (usePermissionsHook.usePermissions as any).mockReturnValue({
      hasAnyPermission: () => false,
      hasAnyRole: () => false,
    });

    render(
      <MemoryRouter>
        <PermissionRoute permission="sales.pos.view" redirectTo="/custom-unauthorized">
          <div>Test Content</div>
        </PermissionRoute>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/custom-unauthorized', { replace: true });
    });
  });

  it('should support multiple permissions (OR logic)', () => {
    (usePermissionsHook.usePermissions as any).mockReturnValue({
      hasAnyPermission: (perms: string[]) => perms.includes('sales.pos.view'),
      hasAnyRole: () => false,
    });

    render(
      <MemoryRouter>
        <PermissionRoute permission={['sales.pos.create', 'sales.pos.view']}>
          <div>Test Content</div>
        </PermissionRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should fallback to role check when permission check fails', () => {
    (usePermissionsHook.usePermissions as any).mockReturnValue({
      hasAnyPermission: () => false,
      hasAnyRole: () => true,
    });

    render(
      <MemoryRouter>
        <PermissionRoute
          permission="sales.pos.view"
          fallbackRoles={['CR', 'HS']}
        >
          <div>Test Content</div>
        </PermissionRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should redirect when both permission and role check fail', async () => {
    (usePermissionsHook.usePermissions as any).mockReturnValue({
      hasAnyPermission: () => false,
      hasAnyRole: () => false,
    });

    render(
      <MemoryRouter>
        <PermissionRoute
          permission="sales.pos.view"
          fallbackRoles={['CR', 'HS']}
        >
          <div>Test Content</div>
        </PermissionRoute>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/unauthorized', { replace: true });
    });
  });
});

