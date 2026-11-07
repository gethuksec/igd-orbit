import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { inventoryService } from '../../services/inventory.service';
import { useBranchFilter } from '@/components/branch/BranchFilter';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type OpnameType = 'FREEZE' | 'OPEN';

/**
 * Start-SO modal (replaces the 4-step wizard page for the common case).
 * Smart defaults: today's date, approver pre-filled from Administrator →
 * General, all stocked categories included unless the user picks a subset.
 * After start, lands directly on the count page; the session code is toasted
 * so it can be shared with the counting team.
 */
export default function StockOpnameStartModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { branchId: filterBranchId } = useBranchFilter();

  const [outletId, setOutletId] = useState('');
  const [opnameType, setOpnameType] = useState<OpnameType>('FREEZE');
  const [opnameDate, setOpnameDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [approverId, setApproverId] = useState('');
  const [showPartial, setShowPartial] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoriesTouched, setCategoriesTouched] = useState(false);

  // Default outlet = current branch filter (reset each time the modal opens)
  useEffect(() => {
    if (open) {
      setOutletId(filterBranchId || '');
      setOpnameType('FREEZE');
      setOpnameDate(new Date().toISOString().slice(0, 10));
      setApproverId('');
      setShowPartial(false);
      setSelectedCategories([]);
      setCategoriesTouched(false);
    }
  }, [open, filterBranchId]);

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches');
      return res.data.data || res.data;
    },
    enabled: open,
  });
  const branches: any[] = Array.isArray(branchesData) ? branchesData : [];

  const { data: categoriesData } = useQuery({
    queryKey: ['categories-all'],
    queryFn: async () => {
      const res = await api.get('/categories', { params: { page: 1, limit: 100 } });
      return res.data.data || res.data || [];
    },
    enabled: open,
  });
  const categories: any[] = Array.isArray(categoriesData) ? categoriesData : [];

  const { data: approverCandidates } = useQuery({
    queryKey: ['opname-approver-candidates', outletId],
    queryFn: () => inventoryService.getApproverCandidates(outletId),
    enabled: open && !!outletId,
    retry: false,
  });

  useEffect(() => {
    if (!open || !outletId) return;
    if (approverCandidates?.defaultUserId) setApproverId(approverCandidates.defaultUserId);
    else if (approverCandidates) setApproverId('');
  }, [open, outletId, approverCandidates]);

  const approverOptions: any[] = useMemo(() => {
    const byId = new Map<string, any>();
    for (const c of approverCandidates?.candidates ?? []) byId.set(c.id, c);
    return [...byId.values()];
  }, [approverCandidates]);
  const defaultApproverName =
    approverCandidates?.candidates.find((c) => c.id === approverCandidates.defaultUserId)
      ?.displayName || null;

  const toggleCategory = (id: string) => {
    setCategoriesTouched(true);
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };
  const effectiveCategoryIds = categoriesTouched ? selectedCategories : categories.map((c: any) => c.id);

  const startMutation = useMutation({
    mutationFn: (data: any) => inventoryService.startOpname(data),
    onSuccess: (created: any) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-opnames'] });
      onClose();
      if (created?.code) toast.success(`Opname dimulai — kode sesi: ${created.code}`);
      else toast.success('Opname dimulai');
      navigate(`/inventory/opname/${created.id}/count`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal memulai stock opname');
    },
  });

  const handleStart = () => {
    if (!outletId) {
      toast.error('Pilih outlet');
      return;
    }
    startMutation.mutate({
      branchId: outletId,
      opnameDate,
      opnameType,
      approverId: approverId || undefined,
      categoryIds: effectiveCategoryIds.length > 0 ? effectiveCategoryIds : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mulai Stock Opname</DialogTitle>
          <DialogDescription>
            Sesi baru untuk satu outlet. Kode sesi dibuat otomatis saat dimulai.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Outlet</label>
            <select
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="">Pilih outlet</option>
              {branches.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipe</label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { v: 'FREEZE', icon: '❄️', hint: 'Stok dikunci selama dihitung' },
                  { v: 'OPEN', icon: '🔓', hint: 'Kasir tetap jalan, mutasi tercatat' },
                ] as Array<{ v: OpnameType; icon: string; hint: string }>
              ).map((t) => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => setOpnameType(t.v)}
                  className={`rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${
                    opnameType === t.v
                      ? 'border-primary-600 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="block text-sm font-bold text-gray-900">
                    {t.icon} {t.v}
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal</label>
            <input
              type="date"
              value={opnameDate}
              onChange={(e) => setOpnameDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Approver{' '}
              <span className="font-normal text-gray-400">(otomatis dari Pengaturan → General)</span>
            </label>
            <select
              value={approverId}
              onChange={(e) => setApproverId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="">
                {defaultApproverName
                  ? `Default — ${defaultApproverName}`
                  : approverCandidates
                    ? `Default — tidak ada (${approverCandidates.defaultRole})`
                    : 'Memuat…'}
              </option>
              {approverOptions.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.displayName || u.fullName || u.username}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Kategori</label>
            <div className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span>
                  <b>Semua kategori</b>{' '}
                  <span className="text-gray-400">({categories.length} dicakup)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowPartial((s) => !s)}
                  className="text-primary-600 font-medium hover:underline"
                >
                  {showPartial ? 'tutup' : 'pilih sebagian'}
                </button>
              </div>
              {showPartial && (
                <div className="mt-2 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {categories.map((c: any) => {
                    const on = categoriesTouched
                      ? selectedCategories.includes(c.id)
                      : true;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCategory(c.id)}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                          on
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-400 border-gray-200 line-through opacity-60'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
            Setelah dimulai, kode sesi tampil di halaman hitung — bagikan ke tim penghitung
            untuk gabung via kode.
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleStart} disabled={!outletId || startMutation.isPending}>
            {startMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Mulai Opname →
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
