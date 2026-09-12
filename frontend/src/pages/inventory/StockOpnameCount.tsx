import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Save,
  Loader2,
  ClipboardCheck,
  Search,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  X,
  ScanBarcode,
} from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { inventoryService } from '../../services/inventory.service';
import { productsService } from '../../services/products.service';
import { toast } from 'sonner';
type Condition = 'good' | 'damaged' | 'expired';

const toNumber = (v: any): number => {
  if (v === null || v === undefined) return 0;
  return typeof v === 'string' ? parseFloat(v) : Number(v);
};

export default function StockOpnameCount() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const me = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const [scanQuery, setScanQuery] = useState('');
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [conditions, setConditions] = useState<Record<string, Condition>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const activeQtyRef = useRef<HTMLInputElement>(null);

  // IGDERP-176: crash-proof draft — unsubmitted inputs survive refresh.
  // Server is source of truth; the draft only fills items the server
  // has no count for, and is pruned as items get saved.
  const draftKey = `opname-draft:${id}`;
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(`opname-draft:${id}`) || 'null')?.updatedAt || null;
    } catch {
      return null;
    }
  });
  const [draftRestored, setDraftRestored] = useState(false);

  // IGDERP-175: same-condition double-scan reject + >5% confirm modal
  const [rejectInfo, setRejectInfo] = useState<{
    productName: string;
    cond: Condition;
    countedLabel: string;
    physical: number;
    rowId: string;
  } | null>(null);
  const [bigSave, setBigSave] = useState<{
    item: any;
    qty: number;
    cond: Condition;
    pct: number;
  } | null>(null);
  const [bigNote, setBigNote] = useState('');

  const { data: opname, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['inventory-opname', id],
    queryFn: () => inventoryService.getOpnameById(id!),
    enabled: !!id,
  });

  // Initialize local inputs from server data — uncounted items stay EMPTY
  // (no silent "physical = system" prefill). IGDERP-176: merge the crash
  // draft for items the server has no count for.
  useEffect(() => {
    if (opname) {
      const nextCounts: Record<string, string> = {};
      const nextConditions: Record<string, Condition> = {};
      const nextNotes: Record<string, string> = {};
      let draft: any = null;
      try {
        draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
      } catch {
        draft = null;
      }
      let restored = false;
      opname.items.forEach((item) => {
        if (item.physicalQuantity !== null && item.physicalQuantity !== undefined) {
          nextCounts[item.id] = String(item.physicalQuantity);
        } else if (draft?.counts?.[item.id] !== undefined && draft.counts[item.id] !== '') {
          nextCounts[item.id] = draft.counts[item.id];
          restored = true;
        }
        if (item.condition) {
          nextConditions[item.id] = item.condition as Condition;
        } else if (draft?.conditions?.[item.id]) {
          nextConditions[item.id] = draft.conditions[item.id];
          restored = true;
        }
        if (item.notes) nextNotes[item.id] = item.notes;
        else if (draft?.notes?.[item.id]) {
          nextNotes[item.id] = draft.notes[item.id];
          restored = true;
        }
      });
      setCounts(nextCounts);
      setConditions(nextConditions);
      setNotes(nextNotes);
      if (restored && !draftRestored) {
        setDraftRestored(true);
        toast.info('Draft lokal dipulihkan — perubahan yang belum disimpan kembali tampil');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opname]);

  // IGDERP-176: persist unsubmitted inputs (debounced) for crash recovery
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({ counts, conditions, notes, updatedAt: new Date().toISOString() }),
        );
      } catch {
        /* storage full/blocked — server remains source of truth */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [counts, conditions, notes, draftKey]);

  // IGDERP-176: live diff vs server = "belum disimpan" count
  const unsavedCount = useMemo(() => {
    if (!opname) return 0;
    return opname.items.filter((item) => {
      const localQty = counts[item.id];
      const serverQty =
        item.physicalQuantity !== null && item.physicalQuantity !== undefined
          ? String(item.physicalQuantity)
          : undefined;
      if (localQty !== undefined && localQty !== '' && localQty !== serverQty) return true;
      if ((conditions[item.id] || undefined) !== (item.condition || undefined) && localQty) return true;
      if ((notes[item.id] || '') !== (item.notes || '') && localQty) return true;
      return false;
    }).length;
  }, [opname, counts, conditions, notes]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  };
  // Auto-focus the scanned item's quantity input
  useEffect(() => {
    if (activeItemId) {
      const t = setTimeout(() => activeQtyRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [activeItemId]);

  const recordMutation = useMutation({
    mutationFn: (data: { items: Array<{ productId: string; physicalQuantity: number; condition?: Condition; notes?: string; force?: boolean }> }) =>
      inventoryService.recordCount(id!, data),
    onSuccess: () => {
      toast.success('Hasil perhitungan disimpan');
      setLastSavedAt(new Date().toISOString());
      queryClient.invalidateQueries({ queryKey: ['inventory-opname', id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyimpan hasil perhitungan');
    },
  });

  const addItemMutation = useMutation({
    mutationFn: (productId: string) => inventoryService.addOpnameItem(id!, productId),
    onSuccess: () => {
      toast.success('Produk ditambahkan ke opname');
      queryClient.invalidateQueries({ queryKey: ['inventory-opname', id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menambahkan produk');
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => inventoryService.removeOpnameItem(id!, itemId),
    onSuccess: () => {
      toast.success('Produk dihapus dari opname');
      queryClient.invalidateQueries({ queryKey: ['inventory-opname', id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus produk');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => inventoryService.cancelOpname(id!),
    onSuccess: () => {
      toast.success('Stock opname dibatalkan');
      clearDraft();
      navigate('/inventory/opname');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membatalkan opname');
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => inventoryService.completeOpname(id!),
    onSuccess: () => {
      toast.success('Opname diajukan untuk persetujuan');
      clearDraft();
      navigate(`/inventory/opname/${id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal mengajukan opname');
    },
  });

  const isCounted = (itemId: string) =>
    counts[itemId] !== undefined && counts[itemId] !== '';

  const countedItems = useMemo(
    () => (opname?.items ?? []).filter((i) => isCounted(i.id)).length,
    [opname, counts],
  );
  const totalItems = opname?.items.length ?? 0;
  const remaining = totalItems - countedItems;
  const progressPct = totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0;

  // Per-counter breakdown
  const myCounted = useMemo(
    () => (opname?.items ?? []).filter((i) => isCounted(i.id) && i.countedBy === me.id).length,
    [opname, counts, me.id],
  );
  const othersCounted = countedItems - myCounted;

  const totalDiscrepancyValue = useMemo(
    () =>
      (opname?.items ?? []).reduce((sum, i) => sum + toNumber(i.discrepancyValue), 0),
    [opname],
  );

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = scanQuery.trim().toLowerCase();
    if (!q || !opname) return;
    const rows = opname.items.filter((i) => {
      const barcode = (i.product?.barcode || '').toLowerCase();
      const sku = (i.product?.sku || '').toLowerCase();
      const name = (i.product?.name || '').toLowerCase();
      return barcode === q || sku === q || name.includes(q);
    });
    if (rows.length > 0) {
      // IGDERP-175: prefer an uncounted row; the condition picker + reject
      // modal sort out same-condition re-scans after the condition is chosen
      const target = rows.find((i) => i.physicalQuantity === null || i.physicalQuantity === undefined) || rows[0];
      setActiveItemId(target.id);
      setScanQuery('');
    } else {
      toast.error('Produk tidak ditemukan dalam opname ini');
    }
  };

  // Live suggestions while typing in the scan box (like master product search)
  const scanMatches = useMemo(() => {
    const q = scanQuery.trim().toLowerCase();
    if (!q || !opname) return [];
    return opname.items
      .filter((i) => {
        const barcode = (i.product?.barcode || '').toLowerCase();
        const sku = (i.product?.sku || '').toLowerCase();
        const name = (i.product?.name || '').toLowerCase();
        return barcode.includes(q) || sku.includes(q) || name.includes(q);
      })
      .slice(0, 8);
  }, [scanQuery, opname]);

  const pickScanMatch = (item: any) => {
    if (!opname) {
      setActiveItemId(item.id);
      setScanQuery('');
      return;
    }
    // IGDERP-175: same product-preference as scan submit (uncounted row first)
    const rows = opname.items.filter((i) => i.productId === item.productId);
    const target =
      rows.find((i) => i.physicalQuantity === null || i.physicalQuantity === undefined) ||
      rows[0] ||
      item;
    setActiveItemId(target.id);
    setScanQuery('');
  };

  const saveItem = (item: any, qty?: string, cond?: Condition, note?: string, force = false) => {
    // IGDERP-176 save-lock: never double-submit while a save is in flight
    if (recordMutation.isPending) return;
    const q = qty ?? counts[item.id];
    const parsed = q !== undefined && q !== '' ? parseInt(q, 10) : NaN;
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error('Masukkan jumlah yang valid');
      return;
    }
    recordMutation.mutate({
      items: [
        {
          productId: item.productId,
          physicalQuantity: parsed,
          condition: (cond ?? conditions[item.id]) || 'good',
          notes: (note ?? notes[item.id]) || undefined,
          force,
        },
      ],
    });
    // Keep focus in the flow: move to next scan after saving from the scanned card
    setActiveItemId(null);
  };

  const handleSaveAll = () => {
    // IGDERP-176 save-lock
    if (!opname || recordMutation.isPending) return;
    const itemsToSave = opname.items
      .filter((i) => isCounted(i.id))
      .map((i) => ({
        productId: i.productId,
        physicalQuantity: parseInt(counts[i.id], 10),
        condition: conditions[i.id] || 'good',
        notes: notes[i.id] || undefined,
        // IGDERP-175: explicit bulk save = corrections allowed (force)
        force: true,
      }));
    if (itemsToSave.length === 0) {
      toast.error('Belum ada hasil perhitungan untuk disimpan');
      return;
    }
    recordMutation.mutate({ items: itemsToSave });
  };

  const handleCancel = () => {
    if (window.confirm('Batalkan stock opname ini? Semua hasil perhitungan akan dibuang.')) {
      cancelMutation.mutate();
    }
  };

  const handleComplete = () => {
    if (remaining > 0) return;
    if (
      window.confirm(
        `Ajukan opname ini (${countedItems} item) untuk persetujuan? Setelah diajukan, item tidak bisa diubah lagi.`,
      )
    ) {
      completeMutation.mutate();
    }
  };

  const handleRemove = (item: any) => {
    if (
      window.confirm(
        `Hapus "${item.product?.name}" dari opname? ${isCounted(item.id) ? 'Hasil hitungannya juga akan dibuang.' : ''}`,
      )
    ) {
      removeItemMutation.mutate(item.id);
    }
  };

  const activeItem = activeItemId
    ? (opname?.items ?? []).find((i) => i.id === activeItemId)
    : null;

  // IGDERP-175: condition-first scan — qty + Simpan stay locked until a
  // condition is chosen; same-condition re-scan opens the reject modal.
  const activeCond = (activeItem ? conditions[activeItem.id] || '' : '') as '' | Condition;
  const activeRows =
    activeItem && opname ? opname.items.filter((i) => i.productId === activeItem.productId) : [];
  const sameCounted = activeCond
    ? activeRows.find(
        (r) =>
          (r.condition || undefined) === activeCond &&
          r.physicalQuantity !== null &&
          r.physicalQuantity !== undefined,
      )
    : undefined;
  const diffCounted = activeCond
    ? activeRows.filter(
        (r) =>
          r.physicalQuantity !== null &&
          r.physicalQuantity !== undefined &&
          (r.condition || undefined) !== activeCond,
      )
    : [];
  const condLabel = (c: string) => (c === 'damaged' ? 'Rusak' : c === 'expired' ? 'Kadaluarsa' : 'Baik');

  const pickCondition = (c: Condition | '') => {
    if (!activeItem || !opname) return;
    if (c) {
      setConditions({ ...conditions, [activeItem.id]: c });
      const hit = opname.items.find(
        (r) =>
          r.productId === activeItem.productId &&
          (r.condition || undefined) === c &&
          r.physicalQuantity !== null &&
          r.physicalQuantity !== undefined,
      );
      if (hit) {
        setRejectInfo({
          productName: activeItem.product?.name || '-',
          cond: c,
          countedLabel: hit.countedBy === me.id ? 'Anda' : 'petugas lain',
          physical: Number(hit.physicalQuantity),
          rowId: hit.id,
        });
      }
    } else {
      const next = { ...conditions };
      delete next[activeItem.id];
      setConditions(next);
    }
  };

  const attemptSave = () => {
    if (!activeItem || !activeCond || sameCounted || recordMutation.isPending) return;
    const parsed = parseInt(counts[activeItem.id] ?? '', 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error('Masukkan jumlah yang valid');
      return;
    }
    const live = toNumber(activeItem.liveQuantity);
    const pct = live > 0 ? (Math.abs(parsed - live) / live) * 100 : 0;
    if (pct > 5) {
      setBigNote(notes[activeItem.id] || '');
      setBigSave({ item: activeItem, qty: parsed, cond: activeCond, pct });
    } else {
      saveItem(activeItem, String(parsed), activeCond);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);

  if (isLoading || !opname) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
          <p className="text-gray-600 font-semibold text-lg">Memuat data opname...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <BreadcrumbHeader
        title="Catat Hasil Perhitungan"
        subtitle={`${opname.opnameNumber} · ${opname.branch?.name || 'Cabang'} · ${new Date(opname.opnameDate).toLocaleDateString('id-ID')}`}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-bold text-red-700">
          ● COUNTING
        </span>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Muat Ulang
        </button>
        <button
          onClick={() => setShowAddDialog(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          Tambah Produk
        </button>
      </BreadcrumbHeader>

      {/* IGDERP-176: autosave status bar — draft durability + save-lock state */}
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
        <span
          className={`inline-block w-2 h-2 rounded-full ${unsavedCount > 0 ? 'bg-amber-500' : 'bg-green-500'}`}
        />
        {recordMutation.isPending ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-gray-700">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Menyimpan… tombol Simpan terkunci
          </span>
        ) : unsavedCount > 0 ? (
          <span>
            <b className="text-gray-800">Draft tersimpan otomatis</b>
            {lastSavedAt &&
              ` · terakhir ${new Date(lastSavedAt).toLocaleTimeString('id-ID')}`} ·{' '}
            {unsavedCount} perubahan belum disimpan
          </span>
        ) : (
          <span>
            <b className="text-gray-800">Draft tersimpan otomatis</b>
            {lastSavedAt &&
              ` · terakhir ${new Date(lastSavedAt).toLocaleTimeString('id-ID')}`} · semua
            perubahan sudah disimpan
          </span>
        )}
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-900">Progress Perhitungan</span>
          <span className="text-xs text-gray-500">
            <b className="text-primary-600">{countedItems}</b> dari {totalItems} item dihitung ·{' '}
            <b className="text-gray-900">{myCounted > 0 || othersCounted > 0 ? (myCounted > 0 ? 1 : 0) + (othersCounted > 0 ? 1 : 0) : 0}</b> petugas
          </span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-600 to-primary-500 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-4 mt-2.5 text-xs text-gray-500">
          {myCounted > 0 && (
            <span>
              <b className="text-gray-900">Anda ({me.name || 'Saya'}):</b> {myCounted} item
            </span>
          )}
          {othersCounted > 0 && (
            <span>
              <b className="text-gray-900">Petugas lain:</b> {othersCounted} item
            </span>
          )}
          {remaining > 0 && (
            <span className="rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 font-semibold text-red-700">
              {remaining} item belum dihitung
            </span>
          )}
          <span>
            Total selisih: <b className="text-gray-900">{formatCurrency(totalDiscrepancyValue)}</b>
          </span>
        </div>
      </div>

      {/* Scan box */}
      <form onSubmit={handleScanSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 relative">
        <div className="flex items-center gap-3 rounded-lg border-2 border-primary-600 bg-white px-4 shadow-[0_0_0_4px_rgba(220,38,38,0.08)]">
          <ScanBarcode className="w-5 h-5 text-primary-600" />
          <input
            value={scanQuery}
            onChange={(e) => setScanQuery(e.target.value)}
            placeholder="Scan barcode, atau ketik nama/SKU lalu tekan Enter…"
            className="flex-1 border-none outline-none py-3 text-base bg-transparent"
          />
          <kbd className="hidden sm:inline-block rounded border border-gray-300 border-b-2 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
            Enter
          </kbd>
        </div>
        {scanMatches.length > 0 && (
          <div className="absolute z-30 left-3 right-3 mt-2 border border-gray-200 rounded-lg bg-white shadow-lg max-h-64 overflow-y-auto">
            {scanMatches.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => pickScanMatch(m)}
                className="w-full px-4 py-3 text-left hover:bg-primary-50 border-b border-gray-100 last:border-b-0 transition-colors"
              >
                <div className="font-medium text-gray-900 flex items-center gap-2">
                  {m.product?.name || '-'}
                  <span className="text-[10px] rounded-full bg-gray-100 px-2 py-0.5 font-bold text-gray-500">
                    {toNumber(m.liveQuantity)} stok
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  SKU: {m.product?.sku || '-'}
                  {m.product?.barcode ? ` • Barcode: ${m.product.barcode}` : ''}
                </div>
              </button>
            ))}
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-2 px-1">
          Scanner USB (keyboard-wedge) langsung berfungsi — scan atau ketik → item muncul di kartu atas → isi jumlah →{' '}
          <b className="text-primary-600">Enter</b> → otomatis lanjut ke item berikutnya.
        </p>
      </form>

      {/* Scanned item card */}
      {activeItem && (
        <div className="rounded-xl border-2 border-primary-600 bg-red-50 p-4 shadow-[0_0_0_4px_rgba(220,38,38,0.08)]">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="font-bold text-gray-900 flex items-center gap-2">
                {activeItem.product?.name || '-'}
                <span className="rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">
                  BARU DI-SCAN
                </span>
              </div>
              <div className="text-xs text-gray-500">
                SKU: {activeItem.product?.sku || '-'}
                {activeItem.product?.barcode ? ` · Barcode: ${activeItem.product.barcode}` : ''}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">
                Stok Sistem <span className="text-green-600 font-semibold">● LIVE</span>
              </div>
              <div className="text-2xl font-extrabold text-gray-900">
                {toNumber(activeItem.liveQuantity)}
              </div>
            </div>
            {/* IGDERP-175 step 1: condition first — no default */}
            <div className="text-center">
              <div
                className={`text-[10px] uppercase tracking-wide font-bold ${activeCond ? 'text-gray-500' : 'text-primary-600'}`}
              >
                1 · Kondisi {activeCond ? '✓' : 'dulu'}
              </div>
              <select
                value={activeCond}
                onChange={(e) => pickCondition(e.target.value as Condition | '')}
                className={`h-11 rounded-lg border-2 bg-white px-3 text-sm ${activeCond ? 'border-gray-300' : 'border-primary-600'}`}
              >
                <option value="">— Pilih —</option>
                <option value="good">Baik</option>
                <option value="damaged">Rusak</option>
                <option value="expired">Kadaluarsa</option>
              </select>
            </div>
            {/* IGDERP-175 step 2: qty locked until condition chosen */}
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">
                2 · Jumlah {activeCond ? '' : '(terkunci)'}
              </div>
              <input
                ref={activeQtyRef}
                type="number"
                min="0"
                disabled={!activeCond}
                value={counts[activeItem.id] ?? ''}
                onChange={(e) => setCounts({ ...counts, [activeItem.id]: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    attemptSave();
                  }
                }}
                placeholder={activeCond ? 'Jumlah' : '—'}
                className={`w-28 h-11 rounded-lg border-2 px-3 text-xl font-bold text-center outline-none ${
                  activeCond ? 'border-primary-600 bg-white' : 'border-gray-300 bg-gray-100 text-gray-400'
                }`}
              />
              {activeCond &&
                counts[activeItem.id] !== undefined &&
                counts[activeItem.id] !== '' && (
                  <div className="text-[11px] mt-1 text-gray-500">
                    selisih{' '}
                    <b className={toNumber(counts[activeItem.id]) - toNumber(activeItem.liveQuantity) < 0 ? 'text-red-600' : 'text-green-600'}>
                      {toNumber(counts[activeItem.id]) - toNumber(activeItem.liveQuantity) > 0 ? '+' : ''}
                      {toNumber(counts[activeItem.id]) - toNumber(activeItem.liveQuantity)}
                    </b>
                  </div>
                )}
            </div>
            <button
              onClick={attemptSave}
              disabled={!activeCond || !!sameCounted || recordMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {recordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {recordMutation.isPending ? 'Menyimpan…' : 'Simpan'}
            </button>
            <button
              onClick={() => setActiveItemId(null)}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* IGDERP-175: different condition already counted → this save creates a second row */}
          {diffCounted.length > 0 && (
            <div className="mt-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
              Sudah ada:{' '}
              {diffCounted
                .map((r) => `${condLabel(r.condition || 'good')} ${toNumber(r.physicalQuantity)}`)
                .join(' · ')}{' '}
              — menyimpan {condLabel(activeCond)} membuat baris baru.
            </div>
          )}
        </div>
      )}

      {/* IGDERP-175: same-condition double-scan hard-reject modal */}
      <Dialog open={!!rejectInfo} onOpenChange={(o) => !o && setRejectInfo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>⛔ Sudah dihitung</DialogTitle>
            <DialogDescription>
              {rejectInfo?.productName} sudah dicatat oleh {rejectInfo?.countedLabel} (fisik{' '}
              {rejectInfo?.physical}, kondisi{' '}
              {rejectInfo ? condLabel(rejectInfo.cond) : ''}). Scan ganda ditolak.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setRejectInfo(null)}>
              Tutup
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const rowId = rejectInfo?.rowId;
                setRejectInfo(null);
                setActiveItemId(null);
                if (rowId) {
                  setTimeout(
                    () =>
                      document
                        .getElementById(`opname-row-${rowId}`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                    100,
                  );
                }
              }}
            >
              Lihat di tabel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* IGDERP-175: >5% variance confirm modal (note optional, row never shifts) */}
      <Dialog open={!!bigSave} onOpenChange={(o) => !o && setBigSave(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>⚠️ Selisih besar ({bigSave ? `−${bigSave.pct.toFixed(1)}%`.replace('−−', '') : ''})</DialogTitle>
            <DialogDescription>
              Sistem <b>{bigSave ? toNumber(bigSave.item.liveQuantity) : ''}</b> · Fisik{' '}
              <b>{bigSave?.qty}</b> · kondisi{' '}
              <b>{bigSave ? condLabel(bigSave.cond) : ''}</b>. Tekan <b>Tetap simpan</b>{' '}
              untuk menyimpan, atau <b>Periksa lagi</b> untuk hitung ulang.
            </DialogDescription>
          </DialogHeader>
          <input
            value={bigNote}
            onChange={(e) => setBigNote(e.target.value)}
            placeholder="Catatan (opsional)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setBigSave(null)}>
              Periksa lagi
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!bigSave) return;
                const s = bigSave;
                setBigSave(null);
                if (bigNote) setNotes((n) => ({ ...n, [s.item.id]: bigNote }));
                saveItem(s.item, String(s.qty), s.cond, bigNote || undefined);
              }}
            >
              Tetap simpan
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-sm font-bold text-gray-900">Daftar Item ({totalItems})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-700 uppercase">Produk</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold text-gray-700 uppercase">
                  Stok Sistem <span className="text-green-600">● live</span>
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold text-gray-700 uppercase">Stok Fisik</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold text-gray-700 uppercase">Selisih</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-700 uppercase">Kondisi</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold text-gray-700 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {opname.items.map((item) => {
                const liveQty = toNumber(item.liveQuantity);
                const physRaw = counts[item.id];
                const phys = physRaw !== undefined && physRaw !== '' ? parseInt(physRaw, 10) : null;
                const counted = phys !== null;
                const discrepancy = phys !== null ? phys - liveQty : null;
                const pct = liveQty > 0 && discrepancy !== null ? Math.abs((discrepancy / liveQty) * 100) : 0;
                const isLarge = pct > 5;
                const isActive = activeItemId === item.id;

                return (
                  <tr
                    key={item.id}
                    id={`opname-row-${item.id}`}
                    className={`${isActive ? 'bg-red-50' : 'hover:bg-gray-50'} ${isLarge && counted ? 'bg-yellow-50' : ''}`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                        {counted && <span className="text-green-600">✓</span>}
                        {item.product?.name || '-'}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        SKU: {item.product?.sku || '-'}
                        {isActive && (
                          <span className="ml-2 rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">
                            BELUM DISIMPAN
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-bold text-gray-900">{liveQty}</td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        min="0"
                        value={physRaw ?? ''}
                        onChange={(e) => setCounts({ ...counts, [item.id]: e.target.value })}
                        placeholder="—"
                        className={`w-20 rounded-lg border px-2 py-1 text-sm text-right outline-none ${
                          isActive ? 'border-primary-600 bg-white' : 'border-gray-300 bg-white focus:border-primary-500'
                        }`}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {discrepancy !== null ? (
                        <>
                          <div
                            className={`text-sm font-bold ${
                              discrepancy > 0 ? 'text-green-600' : discrepancy < 0 ? 'text-red-600' : 'text-gray-400'
                            }`}
                          >
                            {discrepancy > 0 ? '+' : ''}
                            {discrepancy} ({pct.toFixed(1)}%)
                          </div>
                          {isLarge && (
                            <div className="text-[10px] text-yellow-600 font-semibold flex items-center justify-end gap-0.5">
                              <AlertTriangle className="w-3 h-3" /> &gt; 5%
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-300 font-semibold">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={conditions[item.id] || 'good'}
                        onChange={(e) =>
                          setConditions({ ...conditions, [item.id]: e.target.value as Condition })
                        }
                        className="rounded-lg border border-gray-300 bg-white px-1.5 py-1 text-xs"
                      >
                        <option value="good">Baik</option>
                        <option value="damaged">Rusak</option>
                        <option value="expired">Kadaluarsa</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {counted ? (
                          <>
                            <span className="text-[11px] text-gray-400">
                              ✓ {item.countedBy === me.id ? 'Anda' : 'Petugas lain'}
                            </span>
                            {item.notes && (
                              <span title={item.notes} className="text-[11px] text-gray-400 cursor-help">
                                📝
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-bold text-gray-500">
                            BELUM DIHITUNG
                          </span>
                        )}
                        <button
                          onClick={() => handleRemove(item)}
                          className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-600"
                          title="Hapus dari opname"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-[11px] text-gray-400">
          Stok Sistem = stok saat ini (live); berubah jika ada transaksi POS selama SO berjalan. Baris kuning = selisih &gt; 5%.
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-2.5 pb-2">
        <Link
          to={`/inventory/opname/${id}`}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Detail
        </Link>
        <div className="flex-1" />
        <button
          onClick={handleCancel}
          disabled={cancelMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          <X className="w-4 h-4" />
          Batalkan SO
        </button>
        <button
          onClick={handleSaveAll}
          disabled={recordMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {recordMutation.isPending ? 'Menyimpan…' : 'Draft SO'}
        </button>
        <button
          onClick={handleComplete}
          disabled={remaining > 0 || completeMutation.isPending}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${
            remaining > 0 ? 'bg-primary-600/50 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          Ajukan SO{remaining > 0 ? ` (${remaining} belum dihitung)` : ''}
        </button>
      </div>

      {/* Add product dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Produk ke Opname</DialogTitle>
            <DialogDescription>
              Cari produk untuk ditambahkan ke daftar perhitungan. Produk yang sudah ada tidak bisa ditambahkan dua kali.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              autoFocus
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              placeholder="Cari nama produk / SKU / barcode..."
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <AddProductResults
            search={addSearch}
            existingIds={new Set(opname.items.map((i) => i.productId))}
            onPick={(productId) => {
              addItemMutation.mutate(productId);
              setShowAddDialog(false);
              setAddSearch('');
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddProductResults({
  search,
  existingIds,
  onPick,
}: {
  search: string;
  existingIds: Set<string>;
  onPick: (productId: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['opname-add-products', search],
    queryFn: async (): Promise<any[]> => {
      const res = await productsService.getAll({ search: search || undefined, limit: 10 });
      const payload: any = res as any;
      return Array.isArray(payload) ? payload : payload.data || [];
    },
    enabled: search.trim().length > 0,
  });

  const list: any[] = data || [];

  if (!search.trim()) {
    return <p className="text-sm text-gray-400 py-4 text-center">Ketik untuk mencari produk…</p>;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (list.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">Produk tidak ditemukan</p>;
  }

  return (
    <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
      {list.map((p: any) => {
        const already = existingIds.has(p.id);
        return (
          <button
            key={p.id}
            disabled={already}
            onClick={() => onPick(p.id)}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50 ${
              already ? 'opacity-45 cursor-not-allowed' : ''
            }`}
          >
            <span>
              <span className="font-semibold text-gray-900 block">{p.name}</span>
              <span className="text-[11px] text-gray-400">
                SKU: {p.sku}
                {p.barcode ? ` · ${p.barcode}` : ''}
              </span>
            </span>
            <span className="text-[11px] font-semibold text-primary-600 shrink-0">
              {already ? 'Sudah ada' : '+ Tambah'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
