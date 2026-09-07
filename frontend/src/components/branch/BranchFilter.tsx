import { useCallback, useEffect, useRef, useState } from 'react';
import { useBranchStore } from '@/stores/branchStore';

interface UseBranchFilterOptions {
  /**
   * When true (lists, default): multi-branch users default to "Semua Cabang" ('').
   * When false (forms): default to the first-in-list branch so creates always
   * carry an explicit branchId. Client decision (meeting 22 Agu 2026 §1):
   * - 1 branch → auto-select it (both modes).
   * - >1 branch → "Semua Cabang" is the default on lists; forms stay explicit.
   */
  defaultAll?: boolean;
}

/**
 * D7 (#62): page-local branch selection — no global context.
 * IGDERP-107 (22-Agu-2026): "Semua Cabang" is the default for multi-branch
 * users on list pages; a single-branch user auto-selects that branch.
 *
 * Switching branch on one page never affects another page. The auto-default
 * only applies until the user makes their own choice — picking a specific
 * branch (or "Semua Cabang") is respected, never overwritten.
 */
export function useBranchFilter(options?: UseBranchFilterOptions) {
  const defaultAll = options?.defaultAll ?? true;
  const { availableBranches } = useBranchStore();
  const [branchId, setBranchId] = useState<string>('');
  const userTouched = useRef(false);

  const handleSetBranchId = useCallback((id: string) => {
    userTouched.current = true;
    setBranchId(id);
  }, []);

  useEffect(() => {
    if (userTouched.current) return;
    if (branchId !== '') return;

    if (availableBranches.length === 1) {
      // Single branch → auto-select it (client decision §1)
      setBranchId(availableBranches[0].id);
    } else if (!defaultAll && availableBranches.length > 0) {
      // Forms: fall back to the first-in-list branch (decision #32)
      setBranchId(availableBranches[0].id);
    }
    // Multi-branch lists: stay on '' = "Semua Cabang"
  }, [availableBranches, branchId, defaultAll]);

  return { branchId, setBranchId: handleSetBranchId, branches: availableBranches };
}

interface BranchFilterSelectProps {
  value: string;
  onChange: (branchId: string) => void;
  allowAll?: boolean;
  label?: string;
  className?: string;
}

/**
 * Compact per-page branch filter dropdown. `allowAll` adds a "Semua Cabang"
 * option (used on list pages per IGDERP-107; forms pass allowAll=false so an
 * explicit branch is always chosen).
 */
export function BranchFilterSelect({
  value,
  onChange,
  allowAll = false,
  label = 'Cabang',
  className = '',
}: BranchFilterSelectProps) {
  const { availableBranches } = useBranchStore();

  return (
    <div className="flex items-center gap-2 text-sm">
      {label && <span className="text-muted-foreground whitespace-nowrap">{label}:</span>}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={
          'h-9 border border-input rounded-lg px-3 text-sm bg-background focus:ring-2 focus:ring-primary-500 ' +
          className
        }
      >
        {allowAll && <option value="">Semua Cabang</option>}
        {availableBranches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </div>
  );
}
