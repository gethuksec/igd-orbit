import { create } from 'zustand';
import type { Branch } from '@/services/public.service';

export interface BranchState {
  availableBranches: Branch[];
  /** null = semua cabang, otherwise specific branch id */
  currentBranchId: string | null;
  setBranches: (branches: Branch[]) => void;
  setCurrentBranchId: (branchId: string | null) => void;
}

export const useBranchStore = create<BranchState>((set) => ({
  availableBranches: [],
  currentBranchId: null,
  setBranches: (branches) => set({ availableBranches: branches }),
  setCurrentBranchId: (branchId) => set({ currentBranchId: branchId }),
}));


