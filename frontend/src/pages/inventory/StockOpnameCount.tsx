import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Save,
  Loader2,
  ClipboardCheck,
  Search,
  RefreshCw,
  Plus,
  Trash2,
  X,
  ScanBarcode,
  Users,
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

type ResolvedProduct = {
  product: { id: string; name: string; sku: string; barcode: string | null; category: { id: string; name: string } | null };
  lines: Array<{ itemId: string; condition: string; physicalQuantity: string | null; countedBy: string | null }>;
};

/**
 * IGDERP-234 (OP2): blind count page.
 * Counters never see system/expected/variance — scan resolves to product
 * identity only, qty entry is GOOD/RUSAK/KADALUARSA, unknown barcodes go to
 * the exception log. Server is source of truth; refresh is manual (+15s
 * progress poll). No push channel per the IGDERP-92 draft model.
 */
export default function StockOpnameCount() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const me = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {} as any;
    }
  }, []);

  const [scanQuery, setScanQuery] = useState('');
  const [activeProduct, setActiveProduct] = useState<ResolvedProduct | null>(null);
  const [cardGood, setCardGood] = useState('');
  const [cardDamaged, setCardDamaged] = useState('');
  const [cardExpired, setCardExpired] = useState('');
  const [cardNote, setCardNote] = useState('');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [conditions, setConditions] = useState<Record<string, Condition>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const scanInputRef = useRef<HTMLInputElement>(null);
  const cardGoodRef = useRef<HTMLInputElement>(null);

  // IGDERP-176: crash-proof draft — unsubmitted inputs survive refresh.
  const draftKey = `opname-draft:${id}`;
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(`opname-draft:${id}`) || 'null')?.updatedAt || null;
    } catch {
      return null;
    }
  });
  const [draftRestored, setDraftRestored] = useState(false);

  // IGDERP-175: same-condition double-scan reject modal (server 409)
  const [rejectInfo, setRejectInfo] = useState<{
    productName: string;
    cond: Condition;
    countedLabel: string;
    physical: number;
    rowId: string;
  } | null>(null);
  // IGDERP-175 + OP2: unknown-barcode mismatch popup (explicit dialog + BE log)
  const [mismatchQuery, setMismatchQuery] = useState<string | null>(null);
  const [scopeNotice, setScopeNotice] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<{ kind: 'found' | 'mismatch' | 'double' | 'scope'; text: string } | null>(null);

  // OP2: scoped blind count view (never system stock for counters)
  const { data: opname, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['inventory-opname', id],
    queryFn: () => inventoryService.getCountView(id!),
    enabled: !!id,
  });

  // OP2: session progress — who counted what (polled, no push channel)
  const { data: progress, refetch: refetchProgress } = useQuery({
    queryKey: ['inventory-opname-progress', id],
    queryFn: () => inventoryService.getOpnameProgress(id!),
    enabled: !!id,
    refetchInterval: 15000,
  });

  // OP2: unknown-barcode exceptions (coordinator roles only; hidden otherwise)
  const { data: exceptions } = useQuery({
    queryKey: ['inventory-opname-exceptions', id],
    queryFn: () => inventoryService.listOpnameExceptions(id!),
    enabled: !!id,
    retry: false,
  });

  // Initialize local inputs from server data — uncounted items stay EMPTY
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

  // Focus the GOOD qty input when a scan card opens; scan box otherwise
  useEffect(() => {
    if (activeProduct) {
      const t = setTimeout(() => cardGoodRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [activeProduct]);
  useEffect(() => {
    if (!activeProduct) {
      const t = setTimeout(() => scanInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [activeProduct]);

  const refreshAll = () => {
    refetch();
    refetchProgress();
  };

  const recordMutation = useMutation({
    mutationFn: (data: { items: Array<{ productId: string; physicalQuantity?: number; condition?: Condition; goodQuantity?: number; damagedQuantity?: number; expiredQuantity?: number; notes?: string; force?: boolean }> }) =>
      inventoryService.recordCount(id!, data),
    onSuccess: () => {
      toast.success('Hasil perhitungan disimpan');
      setLastSavedAt(new Date().toISOString());
      queryClient.invalidateQueries({ queryKey: ['inventory-opname', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-opname-progress', id] });
    },
    onError: (error: any) => {
      const status = error.response?.status;
      const message: string = error.response?.data?.message || '';
      // OP2: same-condition re-scan = 409 reject (keep existing) → modal
      if (status === 409 && activeProduct) {
        const prodItems = (opname?.items ?? []).filter((i) => i.productId === activeProduct.product.id);
        const hit = prodItems.find((i) => i.physicalQuantity !== null && i.physicalQuantity !== undefined);
        setRejectInfo({
          productName: activeProduct.product.name,
          cond: firstEnteredCond(),
          countedLabel: hit?.countedBy === me.id ? 'Anda' : 'petugas lain',
          physical: hit ? Number(hit.physicalQuantity) : 0,
          rowId: hit?.id || '',
        });
        return;
      }
      toast.error(message || 'Gagal menyimpan hasil perhitungan');
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

  // ---- server-truth progress (blind: physical counts only, never system) ----
  const serverCountedRows = useMemo(
    () => (opname?.items ?? []).filter((i) => i.physicalQuantity !== null && i.physicalQuantity !== undefined).length,
    [opname],
  );
  const totalRows = opname?.items.length ?? 0;
  const remaining = totalRows - serverCountedRows;
  const progressPct = totalRows > 0 ? Math.round((serverCountedRows / totalRows) * 100) : 0;

  const openCard = (resolved: ResolvedProduct) => {
    setActiveProduct(resolved);
    setCardGood('');
    setCardDamaged('');
    setCardExpired('');
    setCardNote('');
    setScopeNotice(null);
  };

  // OP2: scan → server resolve (identity only). Unknown → exception popup + log.
  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = scanQuery.trim();
    if (!q || !id) return;
    try {
      const resolved = await inventoryService.resolveBarcode(id, q);
      setScanQuery('');
      openCard(resolved);
      const recorded = resolved.lines.filter((l) => l.physicalQuantity !== null);
      setScanNotice({
        kind: 'found',
        text: recorded.length > 0
          ? `"${resolved.product.name}" cocok — sudah tercatat (${recorded.map((l) => `${condLabel(l.condition)} ${l.physicalQuantity}`).join(' · ')}), isi untuk koreksi`
          : `"${resolved.product.name}" cocok — kartu dibuka, isi jumlah Baik/Rusak/Kadaluarsa`,
      });
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 404) {
        // Unknown barcode → exception popup + BE log, NO new line
        setMismatchQuery(q);
        setScanNotice({ kind: 'mismatch', text: `"${q}" tidak dikenal dalam opname ini — dicatat sebagai pengecualian` });
        try {
          await inventoryService.logOpnameException(id, q);
          queryClient.invalidateQueries({ queryKey: ['inventory-opname-progress', id] });
        } catch {
          /* logging is best-effort; the popup already told the counter */
        }
      } else if (status === 403) {
        setScopeNotice(`"${q}" ada di opname ini tapi di luar kategori tugas Anda — minta koordinator untuk penugasan.`);
        setScanNotice({ kind: 'scope', text: `"${q}" di luar kategori tugas Anda` });
      } else {
        toast.error(error.response?.data?.message || 'Gagal memproses scan');
      }
    }
  };

  // Live suggestions while typing (identity only — never stock figures)
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

  const pickScanMatch = async (item: any) => {
    const key = item.product?.barcode || item.product?.sku || '';
    if (!key || !id) return;
    setScanQuery(key);
    try {
      const resolved = await inventoryService.resolveBarcode(id, key);
      setScanQuery('');
      openCard(resolved);
      setScanNotice({ kind: 'found', text: `"${resolved.product.name}" cocok — kartu dibuka, isi jumlah` });
    } catch (error: any) {
      if (error.response?.status === 403) {
        setScopeNotice(`"${item.product?.name}" di luar kategori tugas Anda.`);
        setScanNotice({ kind: 'scope', text: `"${item.product?.name}" di luar kategori tugas Anda` });
      } else {
        toast.error(error.response?.data?.message || 'Gagal memproses scan');
      }
    }
  };

  const parseQty = (v: string): number | undefined => {
    if (v === undefined || v === null || String(v).trim() === '') return undefined;
    const n = parseInt(String(v), 10);
    return Number.isNaN(n) || n < 0 ? NaN : n;
  };

  const firstEnteredCond = (): Condition => {
    if (cardGood.trim() !== '') return 'good';
    if (cardDamaged.trim() !== '') return 'damaged';
    return 'expired';
  };

  // OP2: one scan saves GOOD/RUSAK/KADALUARSA together (empty = untouched)
  const saveCard = () => {
    if (!activeProduct || recordMutation.isPending) return;
    const g = parseQty(cardGood);
    const d = parseQty(cardDamaged);
    const x = parseQty(cardExpired);
    if (g === undefined && d === undefined && x === undefined) {
      toast.error('Isi minimal satu jumlah (Baik, Rusak, atau Kadaluarsa)');
      return;
    }
    if (g !== undefined && Number.isNaN(g) || d !== undefined && Number.isNaN(d as number) || x !== undefined && Number.isNaN(x as number)) {
      toast.error('Masukkan jumlah yang valid');
      return;
    }
    recordMutation.mutate(
      {
        items: [
          {
            productId: activeProduct.product.id,
            ...(g !== undefined ? { goodQuantity: g } : {}),
            ...(d !== undefined ? { damagedQuantity: d } : {}),
            ...(x !== undefined ? { expiredQuantity: x } : {}),
            notes: cardNote || undefined,
          },
        ],
      },
      {
        onSuccess: () => setActiveProduct(null),
      },
    );
  };

  const saveGridRow = (item: any) => {
    if (recordMutation.isPending) return;
    const q = counts[item.id];
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
          condition: (conditions[item.id] || item.condition || 'good') as Condition,
          notes: (notes[item.id] || item.notes) || undefined,
          force: true,
        },
      ],
    });
  };

  const handleSaveAll = () => {
    if (!opname || recordMutation.isPending) return;
    const itemsToSave = opname.items
      .filter((i) => counts[i.id] !== undefined && counts[i.id] !== '')
      .map((i) => ({
        productId: i.productId,
        physicalQuantity: parseInt(counts[i.id], 10),
        condition: (conditions[i.id] || i.condition || 'good') as Condition,
        notes: notes[i.id] || undefined,
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
        `Ajukan opname ini (${serverCountedRows} baris) untuk persetujuan? Setelah diajukan, item tidak bisa diubah lagi.`,
      )
    ) {
      completeMutation.mutate();
    }
  };

  const handleRemove = (item: any) => {
    const saved = item.physicalQuantity !== null && item.physicalQuantity !== undefined;
    if (
      window.confirm(
        `Hapus "${item.product?.name}" dari opname? ${saved ? 'Hasil hitungannya juga akan dibuang.' : ''}`,
      )
    ) {
      removeItemMutation.mutate(item.id);
    }
  };

  const condLabel = (c: string) => (c === 'damaged' ? 'Rusak' : c === 'expired' ? 'Kadaluarsa' : 'Baik');

  const myCategories: string[] = useMemo(() => {
    if (!opname?.myCategoryIds) return [];
    const byId = new Map((opname.assignments ?? []).map((a) => [a.categoryId, a.category?.name || a.categoryId]));
    return opname.myCategoryIds.map((cid) => byId.get(cid) || cid);
  }, [opname]);

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
        subtitle={`${opname.opnameNumber}${opname.code ? ` · ${opname.code}` : ''} · ${opname.branch?.name || 'Cabang'} · ${new Date(opname.opnameDate).toLocaleDateString('id-ID')}`}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-bold text-red-700">
          ● COUNTING
        </span>
        {opname.opnameType && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 border border-gray-300 px-3 py-1 text-xs font-bold text-gray-700">
            {opname.opnameType}
          </span>
        )}
        <button
          onClick={refreshAll}
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

      {/* OP2: assignment scope notice */}
      {myCategories.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <Users className="w-4 h-4 shrink-0" />
          <span>
            <b>Tugas Anda:</b> {myCategories.join(' · ')} — produk di luar kategori ini disembunyikan.
          </span>
        </div>
      )}

      {/* IGDERP-176: autosave status bar */}
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

      {/* Progress — blind: physical counts only */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-900">Progress Perhitungan</span>
          <span className="text-xs text-gray-500">
            <b className="text-primary-600">{serverCountedRows}</b> dari {totalRows} baris dihitung
            {progress && progress.byUser.length > 0 && (
              <> · <b className="text-gray-900">{progress.byUser.length}</b> petugas</>
            )}
          </span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-600 to-primary-500 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {remaining > 0 && (
          <div className="mt-2.5">
            <span className="rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-xs font-semibold text-red-700">
              {remaining} baris belum dihitung
            </span>
          </div>
        )}
        {/* OP2: who counted what (server, refreshed manually / 15s poll) */}
        {progress && progress.byUser.length > 0 && (
          <div className="mt-3 border-t border-gray-100 pt-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
              Per petugas
            </div>
            <div className="flex flex-wrap gap-2">
              {progress.byUser.map((u) => (
                <span
                  key={u.userId}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
                  title={u.lastScanAt ? `Scan terakhir ${new Date(u.lastScanAt).toLocaleString('id-ID')}` : ''}
                >
                  <b>{u.displayName}</b> {u.products} produk · {u.quantity} pcs
                </span>
              ))}
            </div>
          </div>
        )}
        {progress && progress.totals.exceptions > 0 && (
          <div className="mt-2 text-xs text-amber-700">
            ⚠️ {progress.totals.exceptions} barcode tak dikenal dicatat sebagai pengecualian
          </div>
        )}
      </div>

      {/* Scan box — OP2: server resolve, identity only */}
      <form onSubmit={handleScanSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 relative">
        <div className="flex items-center gap-3 rounded-lg border-2 border-primary-600 bg-white px-4 shadow-[0_0_0_4px_rgba(220,38,38,0.08)]">
          <ScanBarcode className="w-5 h-5 text-primary-600" />
          <input
            ref={scanInputRef}
            autoFocus
            value={scanQuery}
            onChange={(e) => setScanQuery(e.target.value)}
            placeholder="Scan barcode atau ketik SKU lalu tekan Enter…"
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
                  {m.physicalQuantity !== null && m.physicalQuantity !== undefined && (
                    <span className="text-[10px] rounded-full bg-green-100 px-2 py-0.5 font-bold text-green-700">
                      ✓ tercatat
                    </span>
                  )}
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
          Scanner USB (keyboard-wedge) langsung berfungsi — scan → kartu produk muncul → isi jumlah{' '}
          <b>Baik/Rusak/Kadaluarsa</b> → <b className="text-primary-600">Enter</b> → otomatis lanjut.
        </p>
        {scanNotice && (
          <div
            role="status"
            aria-live="polite"
            data-testid="scan-notice"
            data-kind={scanNotice.kind}
            className={`mt-2 px-3 py-2 rounded-lg text-xs font-medium ${
              scanNotice.kind === 'mismatch'
                ? 'bg-red-50 border border-red-200 text-red-700'
                : scanNotice.kind === 'scope'
                  ? 'bg-amber-50 border border-amber-200 text-amber-700'
                  : scanNotice.kind === 'double'
                    ? 'bg-amber-50 border border-amber-200 text-amber-700'
                    : 'bg-green-50 border border-green-200 text-green-700'
            }`}
          >
            {scanNotice.kind === 'mismatch' ? '🔍 ' : scanNotice.kind === 'found' ? '✅ ' : '⚠️ '}
            {scanNotice.text}
          </div>
        )}
        {scopeNotice && (
          <div className="mt-2 px-3 py-2 rounded-lg text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700">
            {scopeNotice}
          </div>
        )}
      </form>

      {/* OP2: scanned item card — GOOD/RUSAK/KADALUARSA entry, no system stock */}
      {activeProduct && (
        <div className="rounded-xl border-2 border-primary-600 bg-red-50 p-4 shadow-[0_0_0_4px_rgba(220,38,38,0.08)]">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="font-bold text-gray-900 flex items-center gap-2">
                {activeProduct.product.name}
                <span className="rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">
                  BARU DI-SCAN
                </span>
              </div>
              <div className="text-xs text-gray-500">
                SKU: {activeProduct.product.sku}
                {activeProduct.product.barcode ? ` · Barcode: ${activeProduct.product.barcode}` : ''}
                {activeProduct.product.category ? ` · ${activeProduct.product.category.name}` : ''}
              </div>
              {activeProduct.lines.filter((l) => l.physicalQuantity !== null).length > 0 && (
                <div className="mt-1 text-xs text-gray-600">
                  Tercatat:{' '}
                  {activeProduct.lines
                    .filter((l) => l.physicalQuantity !== null)
                    .map((l) => `${condLabel(l.condition)} ${l.physicalQuantity}${l.countedBy === me.id ? ' (Anda)' : ''}`)
                    .join(' · ')}
                </div>
              )}
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Baik</div>
              <input
                ref={cardGoodRef}
                type="number"
                min="0"
                value={cardGood}
                onChange={(e) => setCardGood(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveCard();
                  }
                }}
                placeholder="0"
                className="w-24 h-11 rounded-lg border-2 border-primary-600 bg-white px-3 text-xl font-bold text-center outline-none"
              />
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Rusak</div>
              <input
                type="number"
                min="0"
                value={cardDamaged}
                onChange={(e) => setCardDamaged(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveCard();
                  }
                }}
                placeholder="0"
                className="w-24 h-11 rounded-lg border-2 border-gray-300 bg-white px-3 text-xl font-bold text-center outline-none focus:border-primary-600"
              />
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Kadaluarsa</div>
              <input
                type="number"
                min="0"
                value={cardExpired}
                onChange={(e) => setCardExpired(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveCard();
                  }
                }}
                placeholder="0"
                className="w-24 h-11 rounded-lg border-2 border-gray-300 bg-white px-3 text-xl font-bold text-center outline-none focus:border-primary-600"
              />
            </div>
            <button
              onClick={saveCard}
              disabled={recordMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {recordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {recordMutation.isPending ? 'Menyimpan…' : 'Simpan'}
            </button>
            <button
              onClick={() => setActiveProduct(null)}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            value={cardNote}
            onChange={(e) => setCardNote(e.target.value)}
            placeholder="Catatan (opsional)"
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
          />
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
              {rejectInfo ? condLabel(rejectInfo.cond) : ''}). Scan ganda ditolak — data lama dipertahankan.
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
                setActiveProduct(null);
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

      {/* OP2: unknown-barcode exception popup (logged, never a count line) */}
      <Dialog
        open={mismatchQuery !== null}
        onOpenChange={(o) => {
          if (!o) {
            setMismatchQuery(null);
            setTimeout(() => scanInputRef.current?.focus(), 50);
          }
        }}
      >
        <DialogContent className="max-w-md" data-testid="mismatch-dialog">
          <DialogHeader>
            <DialogTitle>🔍 Barcode tidak dikenal</DialogTitle>
            <DialogDescription>
              <b>{mismatchQuery}</b> tidak cocok dengan produk mana pun dalam opname ini.
              Sudah dicatat sebagai pengecualian untuk koordinator — tidak ada baris hitungan baru.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              onClick={() => {
                setMismatchQuery(null);
                setTimeout(() => scanInputRef.current?.focus(), 50);
              }}
            >
              Scan lagi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grid — blind browse/edit (no system stock, no variance) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-sm font-bold text-gray-900">Daftar Item ({totalRows})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-700 uppercase">Produk</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold text-gray-700 uppercase">Stok Fisik</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-700 uppercase">Kondisi</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold text-gray-700 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {opname.items.map((item) => {
                const physRaw = counts[item.id];
                const counted = physRaw !== undefined && physRaw !== '';
                return (
                  <tr key={item.id} id={`opname-row-${item.id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                        {counted && <span className="text-green-600">✓</span>}
                        {item.product?.name || '-'}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        SKU: {item.product?.sku || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        min="0"
                        value={physRaw ?? ''}
                        onChange={(e) => setCounts({ ...counts, [item.id]: e.target.value })}
                        placeholder="—"
                        className="w-20 rounded-lg border px-2 py-1 text-sm text-right outline-none border-gray-300 bg-white focus:border-primary-500"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={conditions[item.id] || item.condition || 'good'}
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
                            <button
                              onClick={() => saveGridRow(item)}
                              disabled={recordMutation.isPending}
                              className="rounded p-1 text-primary-600 hover:bg-primary-50 disabled:opacity-50"
                              title="Simpan baris ini"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
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
          Mode buta: stok sistem &amp; selisih disembunyikan dari petugas pencacah. Koreksi eksplisit per baris
          (tombol 💾) atau massal via Draft SO.
        </div>
      </div>

      {/* OP2: coordinator — exception log */}
      {exceptions && exceptions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-4">
          <div className="text-sm font-bold text-gray-900 mb-1.5">
            ⚠️ Barcode tak dikenal ({exceptions.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {exceptions.slice(0, 20).map((ex: any) => (
              <span key={ex.id} className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs text-amber-800">
                <b>{ex.barcode}</b>
              </span>
            ))}
          </div>
        </div>
      )}

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
