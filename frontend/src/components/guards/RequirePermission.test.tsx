import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RequirePermission from './RequirePermission';
import * as usePermissionsHook from '@/hooks/usePermissions';

// Mock usePermissions hook
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: vi.fn(),
}));

describe('RequirePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children when no permission specified', () => {
    (usePermissionsHook.usePermissions as any).mockReturnValue({
      hasAnyPermission: () => false,
      hasAnyRole: () => false,
    });

    render(
      <RequirePermission>
        <div>Test Content</div>
      </RequirePermission>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should render children when user has permission', () => {
    (usePermissionsHook.usePermissions as any).mockReturnValue({
      hasAnyPermission: () => true,
      hasAnyRole: () => false,
    });

    render(
      <RequirePermission permission="sales.pos.create">
        <div>Test Content</div>
      </RequirePermission>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should not render children when user lacks permission', () => {
    (usePermissionsHook.usePermissions as any).mockReturnValue({
      hasAnyPermission: () => false,
      hasAnyRole: () => false,
    });

    render(
      <RequirePermission permission="sales.pos.create">
        <div>Test Content</div>
      </RequirePermission>
    );

    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
  });

  it('should render fallback when user lacks permission', () => {
    (usePermissionsHook.usePermissions as any).mockReturnValue({
      hasAnyPermission: () => false,
      hasAnyRole: () => false,
    });

    render(
      <RequirePermission
        permission="sales.pos.create"
        fallback={<div>No Permission</div>}
      >
        <div>Test Content</div>
      </RequirePermission>
    );

    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
    expect(screen.getByText('No Permission')).toBeInTheDocument();
  });

  it('should hide component when hideOnDeny is true', () => {
    (usePermissionsHook.usePermissions as any).mockReturnValue({
      hasAnyPermission: () => false,
      hasAnyRole: () => false,
    });

    const { container } = render(
      <RequirePermission permission="sales.pos.create" hideOnDeny>
        <div>Test Content</div>
      </RequirePermission>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should support multiple permissions (OR logic)', () => {
    (usePermissionsHook.usePermissions as any).mockReturnValue({
      hasAnyPermission: (perms: string[]) => perms.includes('sales.pos.view'),
      hasAnyRole: () => false,
    });

    render(
      <RequirePermission permission={['sales.pos.create', 'sales.pos.view']}>
        <div>Test Content</div>
      </RequirePermission>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should fallback to role check when permission check fails', () => {
    (usePermissionsHook.usePermissions as any).mockReturnValue({
      hasAnyPermission: () => false,
      hasAnyRole: () => true,
    });

    render(
      <RequirePermission
        permission="sales.pos.create"
        fallbackRoles={['CR', 'HS']}
      >
        <div>Test Content</div>
      </RequirePermission>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should not render when both permission and role check fail', () => {
    (usePermissionsHook.usePermissions as any).mockReturnValue({
      hasAnyPermission: () => false,
      hasAnyRole: () => false,
    });

    render(
      <RequirePermission
        permission="sales.pos.create"
        fallbackRoles={['CR', 'HS']}
      >
        <div>Test Content</div>
      </RequirePermission>
    );

    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
  });
});

