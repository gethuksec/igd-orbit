import { create } from 'zustand';
import type { Branch } from '@/services/public.service';

/**
 * Branch reference list (user-accessible branches).
 *
 * D7 (#62): global selection context (currentBranchId) is REMOVED — every page
 * owns its branch/warehouse selection via useBranchFilter (page-local state).
 * availableBranches is kept purely as the shared reference list of branches
 * the user may pick from (populated by DashboardLayout on mount).
 */
export interface BranchState {
  availableBranches: Branch[];
  setBranches: (branches: Branch[]) => void;
}

export const useBranchStore = create<BranchState>((set) => ({
  availableBranches: [],
  setBranches: (branches) => set({ availableBranches: branches }),
}));
