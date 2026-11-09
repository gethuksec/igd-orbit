import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { inventoryService } from '../../services/inventory.service';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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

  const [warehouseId, setWarehouseId] = useState('');
  const [opnameType, setOpnameType] = useState<OpnameType>('FREEZE');
  const [opnameDate, setOpnameDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [approverId, setApproverId] = useState('');
  const [catOpen, setCatOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [catInit, setCatInit] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Reset each time the modal opens
  useEffect(() => {
    if (open) {
      setWarehouseId('');
      setOpnameType('FREEZE');
      setOpnameDate(new Date().toISOString().slice(0, 10));
      setApproverId('');
      setCatOpen(false);
      setSelectedCategories([]);
      setCatInit(false);
      setSelectedMembers([]);
    }
  }, [open]);

  // IGDERP-259: gudang dropdown — outlet GOOD + central GOOD/BAD
  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-active-all'],
    queryFn: async () => {
      const res = await api.get('/warehouses/active', { params: { includeSystem: true } });
      return res.data.data || res.data || [];
    },
    enabled: open,
  });
  const warehouses: any[] = Array.isArray(warehousesData) ? warehousesData : [];
  const outletWarehouses = warehouses.filter((w: any) => w.scope !== 'SYSTEM');
  const centralWarehouses = warehouses.filter((w: any) => w.scope === 'SYSTEM');
  const selectedWarehouse = warehouses.find((w: any) => w.id === warehouseId);
  const outletId = selectedWarehouse?.outletId || '';

  const { data: usersData } = useQuery({
    queryKey: ['users-all'],
    queryFn: async () => {
      const res = await api.get('/users', { params: { page: 1, limit: 100 } });
      return res.data.data || res.data || [];
    },
    enabled: open,
  });
  const allUsers: any[] = Array.isArray(usersData) ? usersData : [];
  const toggleMember = (id: string) => {
    setSelectedMembers((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  };

  const { data: categoriesData } = useQuery({
    queryKey: ['categories-all'],
    queryFn: async () => {
      const res = await api.get('/categories', { params: { page: 1, limit: 100 } });
      return res.data.data || res.data || [];
    },
    enabled: open,
  });
  const categories: any[] = Array.isArray(categoriesData) ? categoriesData : [];

  // Multi-select defaults to ALL categories once loaded.
  useEffect(() => {
    if (open && !catInit && categories.length > 0) {
      setSelectedCategories(categories.map((c: any) => c.id));
      setCatInit(true);
    }
  }, [open, catInit, categories]);

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
  // No head/approver assigned to this outlet (and no global default) → the
  // admin must set one in Administrator → General before an SO can start.
  const approverMissing =
    !!outletId && !!approverCandidates && !approverCandidates.defaultUserId;

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };
  const effectiveCategoryIds = selectedCategories;
  const allSelected = categories.length > 0 && selectedCategories.length === categories.length;
  const startBlocked =
    !warehouseId || effectiveCategoryIds.length === 0 || approverMissing;

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
    if (!warehouseId) {
      toast.error('Pilih gudang');
      return;
    }
    if (effectiveCategoryIds.length === 0) {
      toast.error('Pilih minimal satu kategori');
      return;
    }
    if (approverMissing) {
      toast.error('Atur approver outlet ini di Administrator → Approval dulu');
      return;
    }
    startMutation.mutate({
      warehouseId,
      opnameDate,
      opnameType,
      approverId: approverId || undefined,
      categoryIds: effectiveCategoryIds.length > 0 ? effectiveCategoryIds : undefined,
      assignments: selectedMembers.length > 0 ? selectedMembers.map((userId) => ({ userId })) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mulai Stock Opname</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Gudang <span className="text-red-500">*</span></label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="">Pilih gudang</option>
              {outletWarehouses.length > 0 && (
                <optgroup label="Gudang Outlet">
                  {outletWarehouses.map((w: any) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </optgroup>
              )}
              {centralWarehouses.length > 0 && (
                <optgroup label="Gudang Central">
                  {centralWarehouses.map((w: any) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code}) · {w.type}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipe <span className="text-red-500">*</span></label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={opnameDate}
              onChange={(e) => setOpnameDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Approver <span className="text-red-500">*</span>
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
            {approverMissing && (
              <div className="mt-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                Belum ada approver untuk outlet ini. Atur dulu di{' '}
                <Link
                  to="/admin/approval"
                  onClick={onClose}
                  className="font-semibold underline hover:text-red-800"
                >
                  Administrator → Approval
                </Link>{' '}
                sebelum memulai opname.
              </div>
            )}
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Kategori <span className="text-red-500">*</span></label>
            <button
              type="button"
              onClick={() => setCatOpen((o) => !o)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-left outline-none focus:border-primary-500 flex items-center justify-between gap-2"
            >
              <span className={selectedCategories.length === 0 ? 'text-gray-400' : ''}>
                {allSelected
                  ? `Semua kategori (${categories.length})`
                  : selectedCategories.length === 0
                    ? 'Pilih kategori'
                    : `${selectedCategories.length} dari ${categories.length} kategori`}
              </span>
              <span className="text-gray-400">▾</span>
            </button>
            {catOpen && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedCategories(categories.map((c: any) => c.id))}
                    className="text-primary-600 font-medium hover:underline"
                  >
                    Pilih semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCategories([])}
                    className="text-gray-500 font-medium hover:underline"
                  >
                    Kosongkan
                  </button>
                </div>
                <div className="max-h-44 overflow-y-auto p-1.5">
                  {categories.map((c: any) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(c.id)}
                        onChange={() => toggleCategory(c.id)}
                        className="w-4 h-4 accent-red-600"
                      />
                      <span>{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Anggota <span className="text-gray-400 font-normal">(opsional)</span></label>
            <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-300 p-1.5">
              {allUsers.map((u: any) => (
                <label
                  key={u.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(u.id)}
                    onChange={() => toggleMember(u.id)}
                    className="w-4 h-4 accent-red-600"
                  />
                  <span>{u.fullName || u.username}</span>
                </label>
              ))}
              {allUsers.length === 0 && (
                <span className="block px-2 py-1.5 text-sm text-gray-400">Memuat…</span>
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
          <Button onClick={handleStart} disabled={startBlocked || startMutation.isPending}>
            {startMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Mulai Opname →
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
