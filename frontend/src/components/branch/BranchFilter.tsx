import { useEffect, useState } from 'react';
import { useBranchStore } from '@/stores/branchStore';

/**
 * D7 (#62): page-local branch selection — no global context.
 *
 * Defaults to the first-in-list branch once `availableBranches` loads
 * (decision #32: default = first-in-list; auto-select when only 1 branch).
 * Switching branch on one page never affects another page.
 */
export function useBranchFilter() {
  const { availableBranches } = useBranchStore();
  const [branchId, setBranchId] = useState<string>('');

  useEffect(() => {
    if (!branchId && availableBranches.length > 0) {
      setBranchId(availableBranches[0].id);
    }
  }, [availableBranches, branchId]);

  return { branchId, setBranchId, branches: availableBranches };
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
 * option (only used on aggregate views, e.g. ExecutiveDashboard).
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
    <div className="flex items-center gap-2 text-xs">
      {label && <span className="text-muted-foreground whitespace-nowrap">{label}:</span>}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={
          'border border-input rounded-lg px-2 py-1.5 text-xs bg-background focus:ring-2 focus:ring-primary-500 ' +
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
