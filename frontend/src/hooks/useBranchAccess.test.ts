import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBranchAccess } from './useBranchAccess';
import { useBranchStore } from '@/stores/branchStore';

// Mock the branch store
vi.mock('@/stores/branchStore', () => ({
  useBranchStore: vi.fn(),
}));

describe('useBranchAccess', () => {
  const mockBranches = [
    { id: 'branch-1', name: 'Branch 1', code: 'BR1' },
    { id: 'branch-2', name: 'Branch 2', code: 'BR2' },
    { id: 'branch-3', name: 'Branch 3', code: 'BR3' },
  ];

  beforeEach(() => {
    localStorage.clear();
    (useBranchStore as any).mockReturnValue({
      availableBranches: mockBranches,
      currentBranchId: null,
    });
    // Reset env
    delete import.meta.env.VITE_USE_BRANCH_ACCESS_HOOKS;
  });

  describe('Feature Flag Disabled (Default)', () => {
    it('should return true for all branch checks when feature flag is disabled', () => {
      // Feature flag not set (default false)
      const { result } = renderHook(() => useBranchAccess());

      expect(result.current.canAccessBranch('branch-1')).toBe(true);
      expect(result.current.canAccessBranch('branch-999')).toBe(true);
      expect(result.current.getAccessibleBranchIds()).toBeNull();
      expect(result.current.hasGlobalAccess).toBe(true);
    });
  });

  describe('Feature Flag Enabled', () => {
    beforeEach(() => {
      // Set feature flag to true
      import.meta.env.VITE_USE_BRANCH_ACCESS_HOOKS = 'true';
    });

    afterEach(() => {
      delete import.meta.env.VITE_USE_BRANCH_ACCESS_HOOKS;
    });

    it('should return true for all branches when user has global access (null branchIds)', () => {
      const user = {
        id: '1',
        name: 'Test User',
        branchIds: null, // Global access
      };
      localStorage.setItem('user', JSON.stringify(user));

      const { result } = renderHook(() => useBranchAccess());

      expect(result.current.canAccessBranch('branch-1')).toBe(true);
      expect(result.current.canAccessBranch('branch-999')).toBe(true);
      expect(result.current.getAccessibleBranchIds()).toBeNull();
      expect(result.current.hasGlobalAccess).toBe(true);
    });

    it('should return true for all branches when user has null in branchIds array', () => {
      const user = {
        id: '1',
        name: 'Test User',
        branchIds: [null, 'branch-1'], // null means global access
      };
      localStorage.setItem('user', JSON.stringify(user));

      const { result } = renderHook(() => useBranchAccess());

      expect(result.current.canAccessBranch('branch-1')).toBe(true);
      expect(result.current.canAccessBranch('branch-999')).toBe(true);
      expect(result.current.getAccessibleBranchIds()).toBeNull();
      expect(result.current.hasGlobalAccess).toBe(true);
    });

    it('should return true only for accessible branches', () => {
      const user = {
        id: '1',
        name: 'Test User',
        branchIds: ['branch-1', 'branch-2'],
      };
      localStorage.setItem('user', JSON.stringify(user));

      const { result } = renderHook(() => useBranchAccess());

      expect(result.current.canAccessBranch('branch-1')).toBe(true);
      expect(result.current.canAccessBranch('branch-2')).toBe(true);
      expect(result.current.canAccessBranch('branch-3')).toBe(false);
      expect(result.current.canAccessBranch('branch-999')).toBe(false);
      expect(result.current.getAccessibleBranchIds()).toEqual(['branch-1', 'branch-2']);
      expect(result.current.hasGlobalAccess).toBe(false);
    });

    it('should return all branches when user has global access', () => {
      const user = {
        id: '1',
        name: 'Test User',
        branchIds: null,
      };
      localStorage.setItem('user', JSON.stringify(user));

      const { result } = renderHook(() => useBranchAccess());

      const accessibleBranches = result.current.getAccessibleBranches();
      expect(accessibleBranches).toEqual(mockBranches);
    });

    it('should filter branches by access', () => {
      const user = {
        id: '1',
        name: 'Test User',
        branchIds: ['branch-1', 'branch-2'],
      };
      localStorage.setItem('user', JSON.stringify(user));

      const { result } = renderHook(() => useBranchAccess());

      const data = [
        { id: '1', name: 'Item 1', branchId: 'branch-1' },
        { id: '2', name: 'Item 2', branchId: 'branch-2' },
        { id: '3', name: 'Item 3', branchId: 'branch-3' },
        { id: '4', name: 'Item 4', branchId: null },
      ];

      const filtered = result.current.filterByBranchAccess(data);
      expect(filtered).toEqual([
        { id: '1', name: 'Item 1', branchId: 'branch-1' },
        { id: '2', name: 'Item 2', branchId: 'branch-2' },
        { id: '4', name: 'Item 4', branchId: null }, // null branchId = allowed
      ]);
    });

    it('should return true for null branchId (no branch specified)', () => {
      const user = {
        id: '1',
        name: 'Test User',
        branchIds: ['branch-1'],
      };
      localStorage.setItem('user', JSON.stringify(user));

      const { result } = renderHook(() => useBranchAccess());

      expect(result.current.canAccessBranch(null)).toBe(true);
    });

    it('should check current branch accessibility', () => {
      const user = {
        id: '1',
        name: 'Test User',
        branchIds: ['branch-1'],
      };
      localStorage.setItem('user', JSON.stringify(user));

      // Test accessible branch
      (useBranchStore as any).mockReturnValue({
        availableBranches: mockBranches,
        currentBranchId: 'branch-1',
      });

      const { result } = renderHook(() => useBranchAccess());
      expect(result.current.isCurrentBranchAccessible).toBe(true);

      // Test inaccessible branch - need to re-render with new store value
      (useBranchStore as any).mockReturnValue({
        availableBranches: mockBranches,
        currentBranchId: 'branch-3',
      });

      // Re-render hook to get new store value
      const { result: result2 } = renderHook(() => useBranchAccess());
      expect(result2.current.isCurrentBranchAccessible).toBe(false);
    });

    it('should return empty array when user has no branchIds and no global access', () => {
      const user = {
        id: '1',
        name: 'Test User',
        branchIds: [], // Empty array = no access
      };
      localStorage.setItem('user', JSON.stringify(user));

      const { result } = renderHook(() => useBranchAccess());

      expect(result.current.canAccessBranch('branch-1')).toBe(false);
      expect(result.current.getAccessibleBranchIds()).toEqual([]);
      expect(result.current.hasGlobalAccess).toBe(false);
    });

    it('should fallback to global access when branchIds not available', () => {
      const user = {
        id: '1',
        name: 'Test User',
        // No branchIds property
      };
      localStorage.setItem('user', JSON.stringify(user));

      const { result } = renderHook(() => useBranchAccess());

      // Should default to global access (backward compatible)
      expect(result.current.canAccessBranch('branch-1')).toBe(true);
      expect(result.current.getAccessibleBranchIds()).toBeNull();
      expect(result.current.hasGlobalAccess).toBe(true);
    });
  });
});
