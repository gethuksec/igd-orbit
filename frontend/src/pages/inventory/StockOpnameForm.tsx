import { useEffect, useMemo, useState } from 'react';
import { BreadcrumbHeader } from '@/components/shared';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  Loader2,
  ClipboardCheck,
  Calendar,
  Snowflake,
  LockOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
} from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { useBranchFilter } from '@/components/branch/BranchFilter';
import { toast } from 'sonner';
import { api } from '@/services/api';

type OpnameType = 'FREEZE' | 'OPEN';

const STEPS = ['Tipe', 'Outlet & Jadwal', 'Kategori', 'Review'];

const APPROVER_ROLES = ['OWNER', 'MGR', 'SPV'];

function userRoles(user: any): string[] {
  const roles = user?.roles || user?.userRoles || [];
  return roles.map((r: any) => (typeof r === 'string' ? r : r?.code || r?.role?.code || '')).filter(Boolean);
}

export default function StockOpnameForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { branchId } = useBranchFilter({ defaultAll: false });

  const [step, setStep] = useState(0);
  const [opnameType, setOpnameType] = useState<OpnameType>('FREEZE');
  const [outletId, setOutletId] = useState(branchId || '');
  const [opnameDate, setOpnameDate] = useState(new Date().toISOString().split('T')[0]);
  const [approverId, setApproverId] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoriesTouched, setCategoriesTouched] = useState(false);
  const [created, setCreated] = useState<any>(null);

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches');
      return res.data.data || res.data;
    },
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories-all'],
    queryFn: async () => {
      const res = await api.get('/categories', { params: { page: 1, limit: 100 } });
      return res.data.data || res.data || [];
    },
  });
  const categories: any[] = Array.isArray(categoriesData) ? categoriesData : [];

  const { data: usersData } = useQuery({
    queryKey: ['users-approvers'],
    queryFn: async () => {
      const res = await api.get('/users', { params: { page: 1, limit: 100 } });
      return res.data.data || res.data || [];
    },
  });
  const approvers: any[] = useMemo(() => {
    const users: any[] = Array.isArray(usersData) ? usersData : [];
    return users.filter((u) => userRoles(u).some((r) => APPROVER_ROLES.includes(r)));
  }, [usersData]);

  // IGDERP-236 (OP4): pre-fill the approver from the General setting
  // (per-outlet person override, else first holder of the default role).
  const { data: approverCandidates } = useQuery({
    queryKey: ['opname-approver-candidates', outletId],
    queryFn: () => inventoryService.getApproverCandidates(outletId),
    enabled: !!outletId,
    retry: false,
  });
  useEffect(() => {
    if (!outletId) return;
    if (approverCandidates?.defaultUserId) setApproverId(approverCandidates.defaultUserId);
    else if (approverCandidates) setApproverId('');
  }, [outletId, approverCandidates]);

  // Allowed list = setting candidates ∪ role-filtered users (reassignable within it)
  const approverOptions: any[] = useMemo(() => {
    const byId = new Map<string, any>();
    for (const u of approvers) byId.set(u.id, u);
    for (const c of approverCandidates?.candidates ?? []) {
      if (!byId.has(c.id)) {
        byId.set(c.id, { id: c.id, fullName: c.displayName, username: c.displayName });
      }
    }
    return [...byId.values()];
  }, [approvers, approverCandidates]);
  const defaultApproverLabel = approverCandidates
    ? `Default — ${approverCandidates.candidates.find((c) => c.id === approverCandidates.defaultUserId)?.displayName || 'tidak ada (' + approverCandidates.defaultRole + ')'}`
    : 'Outlet manager (default)';

  const toggleCategory = (id: string) => {
    setCategoriesTouched(true);
    setSelectedCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const effectiveCategoryIds = categoriesTouched ? selectedCategories : categories.map((c: any) => c.id);

  const mutation = useMutation({
    mutationFn: (data: any) => inventoryService.startOpname(data),
    onSuccess: (opname) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-opnames'] });
      setCreated(opname);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal memulai stock opname');
    },
  });

  const canNext = () => {
    if (step === 1) return !!outletId && !!opnameDate;
    return true;
  };

  const handleCreate = () => {
    if (!outletId) {
      toast.error('Pilih cabang');
      return;
    }
    mutation.mutate({
      branchId: outletId,
      opnameDate,
      notes: notes || undefined,
      opnameType,
      approverId: approverId || undefined,
      categoryIds: effectiveCategoryIds.length > 0 ? effectiveCategoryIds : undefined,
    });
  };

  const outletName = branches?.find((b: any) => b.id === outletId)?.name || '-';
  const approverName = approverOptions.find((u: any) => u.id === approverId)?.fullName
    || approverOptions.find((u: any) => u.id === approverId)?.username
    || defaultApproverLabel;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(created?.code || '');
      toast.success('Kode sesi disalin');
    } catch {
      toast.error('Gagal menyalin kode');
    }
  };

  if (created) {
    return (
      <div className="w-full space-y-3">
        <BreadcrumbHeader title="Sesi Opname Dibuat" subtitle="Bagikan kode sesi ke petugas counting" />
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Kode sesi (Menu › Opname › Count › Code)</p>
            <p className="text-4xl font-extrabold tracking-[0.2em] mt-1">{created.code}</p>
            <p className="text-sm text-gray-500 mt-2">
              {created.opnameNumber} · {outletName} · {opnameType === 'FREEZE' ? '❄ FREEZE' : '🔓 OPEN'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={copyCode}
              className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Copy className="w-4 h-4" /> Salin kode
            </button>
            <button
              type="button"
              onClick={() => navigate(`/inventory/opname/${created.id}/count`)}
              className="px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg font-semibold hover:from-primary-700 hover:to-primary-600"
            >
              Buka halaman count →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Mulai Stock Opname" subtitle={`Langkah ${step + 1} dari 4 — ${STEPS[step]}`} />

      {/* Stepper */}
      <div className="flex items-center gap-0 bg-white rounded-xl shadow-md border border-gray-100 p-4">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1 flex items-center">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                  i < step
                    ? 'bg-green-500 text-white'
                    : i === step
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs mt-1 ${i === step ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 mx-1 ${i < step ? 'bg-green-500' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Tipe */}
      {step === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setOpnameType('FREEZE')}
            className={`text-left bg-white rounded-xl shadow-md border-2 p-6 transition-all ${
              opnameType === 'FREEZE' ? 'border-red-500 bg-red-50' : 'border-gray-100 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Snowflake className="w-5 h-5 text-red-500" />
              <span className="text-lg font-bold">FREEZE STOCK</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">Transaksi dilarang</span>
            </div>
            <ul className="text-sm text-gray-600 mt-3 space-y-1 list-disc list-inside">
              <li>Sales, transfer, stock-in/out diblokir di outlet ini</li>
              <li>Variance = Fisik − Snapshot</li>
            </ul>
          </button>
          <button
            type="button"
            onClick={() => setOpnameType('OPEN')}
            className={`text-left bg-white rounded-xl shadow-md border-2 p-6 transition-all ${
              opnameType === 'OPEN' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <LockOpen className="w-5 h-5 text-blue-500" />
              <span className="text-lg font-bold">OPEN STOCK</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500 text-white">Transaksi tetap berjalan</span>
            </div>
            <ul className="text-sm text-gray-600 mt-3 space-y-1 list-disc list-inside">
              <li>Transaksi dicatat: SOLD · RETURN · INBOUND · TRANSFER · ADJUSTMENT</li>
              <li>Expected = Snapshot + Movement · Variance = Fisik − Expected</li>
            </ul>
          </button>
        </div>
      )}

      {/* Step 2: Outlet & jadwal */}
      {step === 1 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cabang <span className="text-red-500">*</span>
              </label>
              <select
                value={outletId}
                onChange={(e) => setOutletId(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Pilih Cabang</option>
                {branches?.map((branch: any) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tanggal Opname <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  value={opnameDate}
                  onChange={(e) => setOpnameDate(e.target.value)}
                  className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Disetujui oleh (approver)</label>
            <select
              value={approverId}
              onChange={(e) => setApproverId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">{defaultApproverLabel}</option>
              {approverOptions.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.fullName || u.username} ({userRoles(u).join(', ')})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Catatan</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Tambahkan catatan untuk opname ini..."
            />
          </div>
          {opnameType === 'FREEZE' && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-sm text-yellow-800">
              Selama sesi FREEZE berjalan, stock in/out outlet ini diblokir kecuali posting hasil opname setelah
              approval.
            </div>
          )}
        </div>
      )}

      {/* Step 3: Kategori */}
      {step === 2 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
          <div>
            <h3 className="font-bold text-gray-900">Kategori yang diopname</h3>
            <p className="text-sm text-gray-500">
              Snapshot hanya mencakup produk berkategori terpilih · {effectiveCategoryIds.length} dari{' '}
              {categories.length} kategori
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c: any) => {
              const active = effectiveCategoryIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  {active ? '✓ ' : ''}{c.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 3 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-3">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary-600" /> Review sesi
          </h3>
          <dl className="text-sm divide-y divide-gray-100">
            <div className="flex justify-between py-2"><dt className="text-gray-500">Tipe</dt><dd className="font-bold">{opnameType === 'FREEZE' ? '❄ FREEZE' : '🔓 OPEN'}</dd></div>
            <div className="flex justify-between py-2"><dt className="text-gray-500">Outlet</dt><dd className="font-bold">{outletName}</dd></div>
            <div className="flex justify-between py-2"><dt className="text-gray-500">Tanggal</dt><dd className="font-bold">{opnameDate}</dd></div>
            <div className="flex justify-between py-2"><dt className="text-gray-500">Approver</dt><dd className="font-bold">{approverName}</dd></div>
            <div className="flex justify-between py-2"><dt className="text-gray-500">Kategori</dt><dd className="font-bold">{effectiveCategoryIds.length} dari {categories.length}</dd></div>
            {notes && <div className="flex justify-between py-2"><dt className="text-gray-500">Catatan</dt><dd className="font-medium text-right max-w-md">{notes}</dd></div>}
          </dl>
          <button
            type="button"
            onClick={handleCreate}
            disabled={mutation.isPending}
            className="w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg font-semibold hover:from-primary-700 hover:to-primary-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Membuat sesi + snapshot...</span></> : <><Save className="w-4 h-4" /><span>Buat sesi + snapshot stok</span></>}
          </button>
        </div>
      )}

      {/* Nav */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => (step === 0 ? navigate('/inventory/opname') : setStep(step - 1))}
          className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" /> {step === 0 ? 'Batal' : 'Kembali'}
        </button>
        {step < 3 && (
          <button
            type="button"
            onClick={() => canNext() && setStep(step + 1)}
            disabled={!canNext()}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
          >
            Lanjut <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
