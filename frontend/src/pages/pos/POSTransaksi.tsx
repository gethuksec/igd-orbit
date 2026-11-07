import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/utils/format';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { salesService } from '../../services/sales.service';
import { api } from '@/services/api';
// IGDERP-239: offline outbox + sync (cash-only offline)
import { posOutbox, provisionalNumber, posCatalogCache } from '@/lib/offline-db';
import { syncPendingSales } from '@/services/pos-offline-sync.service';
import {
  fetchCatalog,
  getCachedCatalog,
  filterProducts,
  filterCustomers,
  CATALOG_TTL_MS as CATALOG_TTL,
  type PosCatalog,
} from '@/services/pos-catalog.service';
import {
  Search,
  Plus,
  Trash2,
  Pencil,
  Copy,
  RefreshCw,
  FileText,
  Repeat,
  Info,
  User,
  Save,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

// ─── Types ───────────────────────────────────────

interface ItemRow {
  id: string;
  productId: string;
  productSearch: string;
  barcode: string;
  productName: string;
  refCode: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
}

interface FormData {
  outletPenjual: string;
  termin: string;
  tanggalJatuhTempo: string;
  sales: string;
  tipeCustomer: string;
  gudang: string;
  tanggalFaktur: string;
  pelanggan: string;
  pelangganId: string;
  transferOutlet: boolean;
  barangDikirim: boolean;
  manualFaktur: boolean;
  keterangan: string;
  keteranganStruk: string;
}

// ─── Constants ────────────────────────────────────

const EMPTY_ROWS = 1;

function createEmptyRow(): ItemRow {
  return {
    id: crypto.randomUUID(),
    productId: '',
    productSearch: '',
    barcode: '',
    productName: '',
    refCode: '',
    quantity: 0,
    price: 0,
    discount: 0,
    total: 0,
  };
}

function createInitialRows(): ItemRow[] {
  return Array.from({ length: EMPTY_ROWS }, () => createEmptyRow());
}

// ─── Component ───────────────────────────────────

export default function POSTransaksi() {
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  // ── Form State ──
  const [form, setForm] = useState<FormData>({
    outletPenjual: '',
    termin: 'Tunai',
    tanggalJatuhTempo: '',
    sales: '',
    tipeCustomer: '',
    gudang: '',
    tanggalFaktur: today,
    pelanggan: '',
    pelangganId: '',
    transferOutlet: false,
    barangDikirim: false,
    manualFaktur: false,
    keterangan: '',
    keteranganStruk: '',
  });

  // ── Item Rows ──
  const [rows, setRows] = useState<ItemRow[]>(createInitialRows);

  // ── Totals ──
  const totalQty = rows.reduce((sum, r) => sum + (r.quantity || 0), 0);
  const subTotal = rows.reduce((sum, r) => sum + (r.total || 0), 0);

  // IGDERP-244: declared early — search queryFns + catalog logic below read it.
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  // ── Customer search ──
  // IGDERP-244: offline catalog (stored on page render). queryFns below read
  // catalogRef so offline search/barcode/dropdowns work without network.
  const [catalog, setCatalog] = useState<PosCatalog | null>(null);
  const catalogRef = useRef<PosCatalog | null>(null);
  const [catalogRefreshing, setCatalogRefreshing] = useState(false);
  const applyCatalog = useCallback((c: PosCatalog | null) => {
    catalogRef.current = c;
    setCatalog(c);
  }, []);
  const refreshCatalog = useCallback(async (warehouseId?: string, silent = true) => {
    if (!navigator.onLine) return null;
    if (!silent) setCatalogRefreshing(true);
    try {
      const fresh = await fetchCatalog(warehouseId);
      catalogRef.current = fresh;
      setCatalog(fresh);
      return fresh;
    } catch {
      return null;
    } finally {
      if (!silent) setCatalogRefreshing(false);
    }
  }, []);

  // IGDERP-244: catalog stored on page render — seed from cache instantly for
  // offline use, refresh in background while online; re-scoped on warehouse change.
  const gudangRef = useRef(form.gudang);
  gudangRef.current = form.gudang;
  useEffect(() => {
    let cancelled = false;
    getCachedCatalog(form.gudang).then((c) => {
      if (!cancelled && c) applyCatalog(c);
    });
    if (navigator.onLine) {
      refreshCatalog(form.gudang).catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [form.gudang, applyCatalog, refreshCatalog]);

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const customerRef = useRef<HTMLDivElement>(null);

  const { data: customerResults = [] } = useQuery({
    queryKey: ['pos-customers', customerSearch],
    networkMode: 'always', // IGDERP-244: run queryFn offline (local catalog fallback)
    queryFn: async () => {
      // IGDERP-244: offline → local catalog; online → API with cache fallback.
      if (!navigator.onLine) {
        return filterCustomers(catalogRef.current?.customers, customerSearch);
      }
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch('/api/v1/pos/customers?q=' + encodeURIComponent(customerSearch) + '&limit=10', {
          headers: { Authorization: 'Bearer ' + token }
        });
        if (!res.ok) return filterCustomers(catalogRef.current?.customers, customerSearch);
        return res.json();
      } catch {
        return filterCustomers(catalogRef.current?.customers, customerSearch);
      }
    },
    enabled: customerSearch.length >= 2,
  });

  // Show selected customer deposit balance in POS (live check — online only;
  // deposit payments are disabled offline, so no offline fallback needed)
  const { data: posDepositBalance } = useQuery({
    queryKey: ['pos-deposit-balance', form.pelangganId],
    queryFn: () => salesService.getDepositBalance(form.pelangganId.toString()),
    enabled: !!form.pelangganId && isOnline,
  });

  // Close customer dropdown on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) {
        setShowCustomerResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Product search per row ──
  const [productSearchState, setProductSearchState] = useState<{ rowId: string; query: string }>({ rowId: '', query: '' });

  const { data: productResults = [] } = useQuery({
    queryKey: ['pos-products', productSearchState.query],
    networkMode: 'always', // IGDERP-244: run queryFn offline (local catalog fallback)
    queryFn: async () => {
      const q = productSearchState.query;
      // IGDERP-244: offline → local catalog; online → API with cache fallback.
      if (!navigator.onLine) return filterProducts(catalogRef.current?.products, q);
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch('/api/v1/pos/products?q=' + encodeURIComponent(q) + '&limit=10', {
          headers: { Authorization: 'Bearer ' + token }
        });
        if (!res.ok) return filterProducts(catalogRef.current?.products, q);
        return res.json();
      } catch {
        return filterProducts(catalogRef.current?.products, q);
      }
    },
    enabled: productSearchState.query.length >= 2,
  });

  // ── Barcode scanner buffer ──
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const barcodeTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);

  // ── Search bar (top) ──
  const [quickSearch, setQuickSearch] = useState('');

  // ── Helper: add product to a row ──
  const addProductToRow = useCallback((rowIndex: number, product: any, qty: number) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIndex] = {
        ...next[rowIndex],
        productId: product.id,
        productName: product.name || product.productName || '',
        barcode: product.barcode || '',
        refCode: product.sku || product.productSku || '',
        quantity: qty,
        price: product.sellingPrice || product.price || 0,
        discount: 0,
        total: qty * (product.sellingPrice || product.price || 0),
        productSearch: product.name || product.productName || '',
      };
      return next;
    });
  }, []);

  // ── Barcode handler ──
  useEffect(() => {
    if (barcodeBuffer.length > 0) {
      if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current);
      barcodeTimeoutRef.current = setTimeout(async () => {
        if (barcodeBuffer.length >= 3) {
          try {
              const token = localStorage.getItem('access_token');
              const barcodeRes = await fetch('/api/v1/pos/products?q=' + barcodeBuffer + '&limit=1', {
                headers: { Authorization: 'Bearer ' + token }
              });
              const barcodeProducts = await barcodeRes.json();
              const product = barcodeProducts[0];
              if (product) {
                // Find first empty row
                const emptyIdx = rows.findIndex((r) => !r.productName && !r.barcode);
                if (emptyIdx >= 0) {
                  addProductToRow(emptyIdx, product, 1);
                } else {
                  // Add a new row
                  setRows((prev) => [...prev, { ...createEmptyRow(), ...product, productId: product.id, quantity: 1 }]);
                }
                setBarcodeBuffer('');
                setQuickSearch('');
              }
            } catch {
              // Not found
            }
        }
        setBarcodeBuffer('');
      }, 150);
    }
    return () => {
      if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current);
    };
  }, [barcodeBuffer, rows, addProductToRow]);

  // ── Quick search (top bar) product handler ──
  const handleQuickSearchSelect = (product: any) => {
    // Parse "qty space barcode/name" syntax, e.g. "2 IP15-128"
    let qty = 1;
    const m = quickSearch.trim().match(/^(\d+)\s+(.+)$/);
    if (m) qty = parseInt(m[1]) || 1;
    const emptyIdx = rows.findIndex((r) => !r.productName && !r.barcode);
    if (emptyIdx >= 0) {
      addProductToRow(emptyIdx, product, qty);
    } else {
      const newRow = { ...createEmptyRow(), productId: product.id, productName: product.name || product.productName || '', barcode: product.barcode || '', refCode: product.sku || product.productSku || '', quantity: qty, price: product.sellingPrice || product.price || 0, total: qty * (product.sellingPrice || product.price || 0) };
      setRows((prev) => [...prev, newRow]);
    }
    setQuickSearch('');
  };

  // ── Row update ──
  const updateRow = (index: number, field: keyof ItemRow, value: any) => {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[index] };
      (row as any)[field] = value;

      // Recalculate total
      if (field === 'quantity' || field === 'price' || field === 'discount') {
        const qty = row.quantity || 0;
        const price = row.price || 0;
        const disc = row.discount || 0;
        row.total = qty * price - disc;
        if (row.total < 0) row.total = 0;
      }

      next[index] = row;
      return next;
    });
  };

  const removeRow = (index: number) => {
    setRows((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      // Ensure at least EMPTY_ROWS empty rows
      while (next.length < EMPTY_ROWS) {
        next.push(createEmptyRow());
      }
      return next;
    });
  };

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  // ── Get today's date in Indonesian format for display ──

  // ── Payment method (T21: only Tunai enabled for now) ──
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'e_wallet' | 'credit_card'>('cash');

  const PAYMENT_LABELS: Record<string, string> = {
    cash: 'Tunai',
    transfer: 'Transfer',
    e_wallet: 'E-Wallet',
    credit_card: 'Kartu',
  };

  // ── IGDERP-239: offline mode (cash-only, outbox queue) ──
  // (isOnline declared near top — search/catalog logic reads it)
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  // IGDERP-241 (D5): expandable queue for offline print-from-queue
  const [showQueue, setShowQueue] = useState(false);
  const [pendingSales, setPendingSales] = useState<any[]>([]);
  // Idempotency key for the in-progress sale — stable across retries, rotated after save/queue
  const saleKeyRef = useRef(crypto.randomUUID());
  const draftLoadedRef = useRef(false);

  const refreshPending = useCallback(async () => {
    try {
      const all = await posOutbox.list();
      setPendingCount(all.length);
      // IGDERP-241 (D5): keep the printable queue rows fresh
      setPendingSales(all.sort((a, b) => b.createdAt - a.createdAt));
    } catch {
      // IndexedDB unavailable (private mode) — outbox disabled
    }
  }, []);

  const handleSyncNow = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await syncPendingSales();
      if (res.synced === 0 && res.failed === 0) {
        toast.info('Tidak ada antrean offline');
      } else {
        toast.success(`${res.synced} tersinkron` + (res.failed ? `, ${res.failed} butuh review` : ''));
      }
    } catch {
      toast.error('Sync gagal — coba lagi');
    }
    setSyncing(false);
    refreshPending();
  }, [refreshPending]);

  // Heartbeat for stuck states (IGDERP-239 E2E find): after an offline reload
  // some browsers report navigator.onLine=true and never fire `online`, so the
  // queue would sit until manual sync. Reconcile every 15s while pending exists.
  const syncingRef = useRef(false);
  useEffect(() => {
    if (pendingCount === 0) return;
    const t = setInterval(async () => {
      if (!navigator.onLine || syncingRef.current) return;
      syncingRef.current = true;
      try {
        const res = await syncPendingSales();
        if (res.synced > 0) toast.success(`${res.synced} transaksi offline tersinkron`);
        if (res.failed > 0) toast.warning(`${res.failed} transaksi butuh review`);
        if (res.synced > 0 || res.failed > 0) refreshPending();
      } catch {
        // next tick retries — never park on transient errors here
      }
      syncingRef.current = false;
    }, 15000);
    return () => clearInterval(t);
  }, [pendingCount, refreshPending]);

  useEffect(() => {
    refreshPending();
    const goOnline = async () => {
      setIsOnline(true);
      // IGDERP-244: re-store the catalog as soon as we're back online.
      refreshCatalog(gudangRef.current).catch(() => {});
      const res = await syncPendingSales().catch(() => null);
      if (res) {
        if (res.synced > 0) toast.success(`${res.synced} transaksi offline tersinkron`);
        if (res.failed > 0) toast.warning(`${res.failed} transaksi butuh review`);
        refreshPending();
      }
    };
    const goOffline = () => {
      setIsOnline(false);
      setPaymentMethod('cash');
      toast.warning('Offline — mode Tunai saja, transaksi akan diantre');
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [refreshPending]);

  // Draft persistence — form survives reload (queue in IndexedDB survives too)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pos-draft');
      if (raw) {
        const d = JSON.parse(raw);
        if (d.form) setForm((prev) => ({ ...prev, ...d.form }));
        if (Array.isArray(d.rows) && d.rows.length) setRows(d.rows);
      }
    } catch {
      // corrupt draft — ignore
    }
    draftLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!draftLoadedRef.current) return;
    try {
      localStorage.setItem('pos-draft', JSON.stringify({ form, rows }));
    } catch {
      // quota — draft is best-effort
    }
  }, [form, rows]);

  // ── Build transaction payload ──
  const buildPayload = (status: 'completed' | 'held') => {
    const items = rows
      .filter((r) => r.productId)
      .map((r) => ({
        productId: r.productId,
        quantity: r.quantity || 0,
        unitPrice: r.price || 0,
        discountAmount: r.discount || 0,
      }));
    const termId = paymentTerms.find((pt: any) => pt.name === form.termin)?.id || undefined;
    const typeId = customerTypes.find((st: any) => st.name === form.tipeCustomer)?.id || undefined;
    const total = items.reduce((s, i) => s + i.quantity * i.unitPrice - i.discountAmount, 0);
    const payload: any = {
      // IGDERP-239: idempotency key — server dedupes reconnect replays
      clientMutationId: saleKeyRef.current,
      branchId: form.outletPenjual,
      customerId: form.pelangganId || undefined,
      paymentTermId: termId,
      salesPersonId: form.sales || undefined,
      warehouseId: form.gudang || undefined,
      customerTypeId: typeId,
      taxPercentage: 0, // T21: tax disabled by decision — charge what's shown
      items,
      internalNotes: form.keterangan || undefined,
      receiptNotes: form.keteranganStruk || undefined,
      status,
    };
    if (status === 'completed' && total > 0) {
      payload.payment = { method: paymentMethod, amount: total };
    }
    return payload;
  };

  // ── Queue an offline cash sale (IGDERP-239) ──
  const queueOfflineSale = async (payload: any, failedOnline = false) => {
    try {
      // IGDERP-241 (D5): freeze display data for offline print-from-queue.
      const saleRows = rows.filter((r) => r.productId);
      const subtotal = saleRows.reduce((s, r) => s + (r.quantity || 0) * (r.price || 0), 0);
      const discountTotal = saleRows.reduce((s, r) => s + (r.discount || 0), 0);
      await posOutbox.add({
        clientMutationId: saleKeyRef.current,
        payload,
        provisionalNumber: provisionalNumber(form.outletPenjual),
        createdAt: Date.now(),
        attempts: 0,
        status: 'pending',
        snapshot: {
          storeName: 'IGD PONSEL',
          branchName: branches.find((b: any) => b.id === form.outletPenjual)?.name,
          cashierName: salesPersons.find((sp: any) => sp.id === form.sales)?.fullName,
          customerName: form.pelanggan || 'Walk-in',
          items: saleRows.map((r) => ({
            name: r.productName || 'Item',
            sku: r.refCode || undefined,
            quantity: r.quantity || 0,
            unitPrice: r.price || 0,
            discountAmount: r.discount || 0,
          })),
          subtotal,
          discountAmount: discountTotal,
          total: subtotal - discountTotal,
          paidAmount: subtotal - discountTotal,
          createdAt: Date.now(),
        },
      });
    } catch {
      toast.error('Gagal antre — IndexedDB tidak tersedia, jangan tutup halaman');
      return;
    }
    saleKeyRef.current = crypto.randomUUID();
    refreshPending();
    toast.success(failedOnline ? 'Koneksi putus — penjualan masuk antrean offline' : 'Offline — penjualan Tunai masuk antrean');
    setRows(createInitialRows);
    setForm((prev) => ({
      ...prev,
      pelanggan: '', pelangganId: '', keterangan: '', keteranganStruk: '', termin: 'Tunai',
      sales: '', tipeCustomer: '', gudang: '', tanggalJatuhTempo: '',
    }));
    setCustomerSearch('');
    setQuickSearch('');
    try {
      localStorage.removeItem('pos-draft');
    } catch {
      // ignore
    }
  };

  // ── Save transaction (real POST — T21 rewiring) ──
  const saveTransaction = async (status: 'completed' | 'held') => {
    if (!form.outletPenjual) { toast.error('Outlet Penjual wajib diisi'); return; }
    if (!form.sales) { toast.error('Sales wajib diisi'); return; }
    if (!form.tipeCustomer) { toast.error('Tipe Customer wajib diisi'); return; }
    if (!form.pelangganId) { toast.error('Pelanggan wajib diisi'); return; }
    const items = rows.filter((r) => r.productId);
    if (items.length === 0) { toast.error('Minimal satu barang wajib diisi'); return; }

    const payload = buildPayload(status);

    // IGDERP-239: drafts are server-side (held) — queue completed sales only
    if (!navigator.onLine && status === 'held') {
      toast.error('Draf butuh koneksi — hanya penjualan selesai (Simpan) yang bisa antre offline');
      return;
    }

    // IGDERP-239: fully offline → queue, don't lose the sale
    if (!navigator.onLine) {
      await queueOfflineSale(payload);
      return;
    }

    // IGDERP-241/D4: online POST via the api instance so an expired access
    // token triggers silent refresh + retry instead of failing the sale.
    try {
      const { data } = await api.post('/pos/transactions', payload);
      saleKeyRef.current = crypto.randomUUID();
      if (status === 'held') {
        // T21 decision: draft stays on page — data kept for further editing
        toast.success('Draf penjualan tersimpan');
        return;
      }
      toast.success('Transaksi berhasil disimpan');
      setRows(createInitialRows);
      setForm((prev) => ({
        ...prev,
        pelanggan: '', pelangganId: '', keterangan: '', keteranganStruk: '', termin: 'Tunai',
        sales: '', tipeCustomer: '', gudang: '', tanggalJatuhTempo: '',
      }));
      setCustomerSearch('');
      setQuickSearch('');
      try {
        localStorage.removeItem('pos-draft');
      } catch {
        // ignore
      }
      if (data?.id) navigate(`/sales/transactions/${data.id}`);
    } catch (e: any) {
      // Server responded (4xx/5xx validation) → show it, don't queue.
      // No response at all → network died mid-request, queue instead of losing the sale
      // (server dedupes by clientMutationId if the POST actually landed).
      if (e?.response) {
        const err = e.response.data;
        const msg = Array.isArray(err?.message) ? err.message.join(', ') : (err?.message || 'Gagal menyimpan transaksi');
        toast.error(msg);
        return;
      }
      await queueOfflineSale(payload, true);
    }
  };

  // ── Keyboard shortcuts ──
  useHotkeys('f2', (e) => {
    e.preventDefault();
    if (!hasPermission('action.pos.create')) return;
    saveTransaction('completed');
  }, { enableOnFormTags: true });

  useHotkeys('f3', (e) => {
    e.preventDefault();
    if (!hasPermission('action.pos.create')) return;
    saveTransaction('held');
  }, { enableOnFormTags: true });

  useHotkeys('f5', (e) => {
    e.preventDefault();
    // Refresh - reload page
    window.location.reload();
  }, { enableOnFormTags: true });

  // ── Fetch options for dropdowns ──
  // IGDERP-244: masters are cached on fetch and read from cache when offline.
  // Cache-through helper: online → fetch + store; offline → stored list.
  const cachedFetch = useCallback(async (key: string, url: string): Promise<any[]> => {
    if (!navigator.onLine) {
      return (await posCatalogCache.get<any[]>(key, CATALOG_TTL)) ?? [];
    }
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(url, {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) return (await posCatalogCache.get<any[]>(key, CATALOG_TTL)) ?? [];
      const data = await res.json();
      await posCatalogCache.set(key, data);
      return data;
    } catch {
      return (await posCatalogCache.get<any[]>(key, CATALOG_TTL)) ?? [];
    }
  }, []);

  const { data: branches = [] } = useQuery({
    queryKey: ['pos-branches'],
    networkMode: 'always', // IGDERP-244: run queryFn offline (local catalog fallback)
    queryFn: () => cachedFetch('pos-branches', '/api/v1/pos/branches'),
  });

  const { data: paymentTerms = [] } = useQuery({
    queryKey: ['pos-payment-terms'],
    networkMode: 'always', // IGDERP-244: run queryFn offline (local catalog fallback)
    queryFn: () => cachedFetch('pos-payment-terms', '/api/v1/pos/payment-terms'),
  });

  const { data: customerTypes = [] } = useQuery({
    queryKey: ['pos-customer-types'],
    networkMode: 'always', // IGDERP-244: run queryFn offline (local catalog fallback)
    queryFn: () => cachedFetch('pos-customer-types', '/api/v1/pos/customer-types'),
  });

  // T21: sales persons + warehouses (were empty dropdowns)
  // D5: both scoped to the selected outlet (per-page explicit branch model)
  const { data: salesPersons = [] } = useQuery({
    queryKey: ['pos-sales-persons', form.outletPenjual || 'all'],
    networkMode: 'always', // IGDERP-244: run queryFn offline (local catalog fallback)
    queryFn: () => {
      const url = form.outletPenjual
        ? '/api/v1/pos/sales-persons?outletId=' + encodeURIComponent(form.outletPenjual)
        : '/api/v1/pos/sales-persons';
      // IGDERP-244: scoped cache key per outlet so offline keeps the right list.
      return cachedFetch(`pos-sales-persons:${form.outletPenjual || 'all'}`, url);
    },
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['pos-warehouses', form.outletPenjual || 'all'],
    networkMode: 'always', // IGDERP-244: run queryFn offline (local catalog fallback)
    enabled: Boolean(form.outletPenjual),
    queryFn: () => cachedFetch(
      `pos-warehouses:${form.outletPenjual}`,
      '/api/v1/pos/warehouses?outletId=' + encodeURIComponent(form.outletPenjual),
    ),
  });

  // D5: auto-select outlet when only one branch exists (decision #32)
  useEffect(() => {
    if (branches.length === 1 && !form.outletPenjual) {
      setForm((prev) => ({ ...prev, outletPenjual: branches[0].id }));
    }
  }, [branches, form.outletPenjual]);

  // D5: auto-select warehouse when the outlet has exactly one
  useEffect(() => {
    if (warehouses.length === 1 && !form.gudang) {
      setForm((prev) => ({ ...prev, gudang: warehouses[0].id }));
    }
  }, [warehouses, form.gudang]);

  // D5: outlet change resets outlet-scoped selections (warehouse + salesperson)
  const handleOutletChange = (outletId: string) => {
    setForm((prev) => ({ ...prev, outletPenjual: outletId, gudang: '', sales: '' }));
  };

  // T21: top search bar results (was disconnected from quickSearch — never populated)
  // Strip the "qty space" prefix before querying: "2 baterai" → "baterai"
  const quickClean = quickSearch.trim().replace(/^\d+\s+/, '');
  const { data: quickResults = [] } = useQuery({
    queryKey: ['pos-quick-products', quickClean],
    networkMode: 'always', // IGDERP-244: run queryFn offline (local catalog fallback)
    queryFn: async () => {
      // IGDERP-244: offline → local catalog; online → API with cache fallback.
      if (!navigator.onLine) return filterProducts(catalogRef.current?.products, quickClean);
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch('/api/v1/pos/products?q=' + encodeURIComponent(quickClean) + '&limit=10', {
          headers: { Authorization: 'Bearer ' + token }
        });
        if (!res.ok) return filterProducts(catalogRef.current?.products, quickClean);
        return res.json();
      } catch {
        return filterProducts(catalogRef.current?.products, quickClean);
      }
    },
    enabled: quickClean.length >= 2,
  });

  // ── Render ──

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-gray-50">
      {/* ═══ Top Alert Banner ═══ */}
      <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 text-center text-sm text-orange-800">
        Inputkan data lalu tekan tombol <strong>Simpan</strong> untuk menyimpan
        {/* IGDERP-244: catalog freshness + manual refresh (online) */}
        {catalog && (
          <span className="ml-2 text-orange-700">
            • Katalog {new Date(catalog.cachedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            <button
              className="ml-1 underline disabled:no-underline disabled:opacity-50"
              disabled={!isOnline || catalogRefreshing}
              title={isOnline ? 'Muat ulang katalog' : 'Butuh online untuk muat ulang'}
              onClick={() => refreshCatalog(gudangRef.current, false)}
            >
              <RefreshCw className={`inline w-3 h-3 ${catalogRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </span>
        )}
      </div>
      {/* IGDERP-239: offline mode + pending-queue banners */}
      {!isOnline && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-center text-sm text-yellow-800">
          Mode offline — Tunai saja. Penjualan akan diantre dan tersinkron otomatis saat online.
          {/* IGDERP-244: catalog freshness — search/scan/dropdown read this offline copy */}
          {catalog && (
            <span className="ml-2 text-yellow-700">
              Katalog per {new Date(catalog.cachedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}
      {pendingCount > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-800">
          <div className="flex items-center justify-center gap-3">
            <button className="underline font-medium" onClick={() => setShowQueue((v) => !v)}>
              {pendingCount} transaksi offline menunggu sync {showQueue ? '▴' : '▾'}
            </button>
            <Button size="sm" variant="outline" onClick={handleSyncNow} disabled={syncing || !isOnline}>
              {syncing ? 'Syncing…' : 'Sync sekarang'}
            </Button>
          </div>
          {/* IGDERP-241 (D5): print-from-queue while items wait */}
          {showQueue && (
            <div className="max-w-xl mx-auto mt-2 text-left bg-white border border-blue-200 rounded">
              {pendingSales.map((s) => (
                <div key={s.clientMutationId} className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-blue-100 last:border-0 text-xs">
                  <span className="font-mono">{s.provisionalNumber}</span>
                  <span className="text-gray-500">{new Date(s.createdAt).toLocaleString('id-ID')}</span>
                  <a href={`/pos/offline-receipt/${s.clientMutationId}`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline">Cetak</Button>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 max-w-full">
        {/* ═══ Header Section ═══ */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Pencatatan Transaksi Penjualan</h1>
            <label className="flex items-center gap-2 mt-1 text-xs text-gray-600 cursor-pointer">
              <Checkbox
                checked={form.manualFaktur}
                onCheckedChange={(v) => setForm((prev) => ({ ...prev, manualFaktur: Boolean(v) }))}
              />
              Centang untuk menentukan No Faktur Penjualan secara manual
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs border-primary text-primary hover:bg-primary-50">
              <Copy className="w-3.5 h-3.5 mr-1" />
              Duplikasi Penjualan
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-primary text-primary hover:bg-primary-50"
              onClick={() => saveTransaction('held')}
            >
              <FileText className="w-3.5 h-3.5 mr-1" />
              Draf Penjualan
            </Button>
            <Button size="sm" className="text-xs bg-primary text-primary-foreground hover:bg-primary-700">
              <Repeat className="w-3.5 h-3.5 mr-1" />
              Tukar Tambah
            </Button>
          </div>
        </div>

        {/* ═══ Form Grid ═══ */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4">
          <div className="p-4">
            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
              {/* Outlet Penjual */}
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">
                  <span className="text-red-500">*</span> Outlet Penjual
                </Label>
                <select
                  value={form.outletPenjual}
                  onChange={(e) => handleOutletChange(e.target.value)}
                  className="w-full h-9 border border-gray-300 rounded-md px-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                >
                  <option value="">Please select</option>
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Termin */}
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">
                  <span className="text-red-500">*</span> Termin
                </Label>
                <div className="flex items-center gap-1">
                  <select
                    value={form.termin}
                    onChange={(e) => setForm((prev) => ({ ...prev, termin: e.target.value }))}
                    className="flex-1 h-9 border border-gray-300 rounded-md px-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                  >
                    <option value="Tunai">Tunai</option>
                    {paymentTerms.map((pt: any) => (
                      <option key={pt.id} value={pt.name}>{pt.name}</option>
                    ))}
                  </select>
                  <Info className="w-4 h-4 text-gray-400 shrink-0 cursor-help" />
                </div>
              </div>

              {/* Jatuh Tempo */}
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">Tanggal Jatuh Tempo</Label>
                <Input
                  type="date"
                  value={form.tanggalJatuhTempo}
                  onChange={(e) => setForm((prev) => ({ ...prev, tanggalJatuhTempo: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>

              {/* Sales */}
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">
                  <span className="text-red-500">*</span> Sales
                </Label>
                <div className="flex items-center gap-1">
                  <select
                    value={form.sales}
                    onChange={(e) => setForm((prev) => ({ ...prev, sales: e.target.value }))}
                    className="flex-1 h-9 border border-gray-300 rounded-md px-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                  >
                    <option value="">Please select</option>
                    {salesPersons.map((sp: any) => (
                      <option key={sp.id} value={sp.id}>{sp.fullName}</option>
                    ))}
                  </select>
                  <Info className="w-4 h-4 text-gray-400 shrink-0 cursor-help" />
                </div>
              </div>

              {/* Tipe Customer */}
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">
                  <span className="text-red-500">*</span> Tipe Customer
                </Label>
                <select
                  value={form.tipeCustomer}
                  onChange={(e) => setForm((prev) => ({ ...prev, tipeCustomer: e.target.value }))}
                  className="w-full h-9 border border-gray-300 rounded-md px-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                >
                  <option value="">Please select</option>
                  {customerTypes.map((st: any) => (
                    <option key={st.id} value={st.name}>{st.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Gudang */}
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">
                  <span className="text-red-500">*</span> Gudang
                </Label>
                <select
                  value={form.gudang}
                  onChange={(e) => setForm((prev) => ({ ...prev, gudang: e.target.value }))}
                  className="w-full h-9 border border-gray-300 rounded-md px-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                  disabled={!form.outletPenjual}
                >
                  <option value="">{form.outletPenjual ? 'Pilih Gudang' : 'Tentukan Outlet Penjual'}</option>
                  {warehouses.map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Tanggal Faktur */}
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">
                  <span className="text-red-500">*</span> Tanggal Faktur
                </Label>
                <Input
                  type="date"
                  value={form.tanggalFaktur}
                  onChange={(e) => setForm((prev) => ({ ...prev, tanggalFaktur: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>

              {/* Pelanggan */}
              <div className="relative" ref={customerRef}>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">
                  <span className="text-red-500">*</span> Pelanggan
                </Label>
                <div className="flex items-center gap-1">
                  <div className="relative flex-1">
                    <Input
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerResults(true);
                      }}
                      onFocus={() => setShowCustomerResults(true)}
                      placeholder="Cari pelanggan..."
                      className="h-9 text-sm pr-8"
                    />
                    <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                </div>
                {/* Customer results dropdown */}
                {showCustomerResults && customerResults.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {customerResults.map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 border-b border-gray-100 last:border-0"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, pelanggan: c.name || c.fullName, pelangganId: c.id }));
                          setCustomerSearch(c.name || c.fullName);
                          setShowCustomerResults(false);
                        }}
                      >
                        <div className="font-medium">{c.name || c.fullName}</div>
                        <div className="text-xs text-gray-500">{c.phone || c.email || ''}</div>
                      </button>
                    ))}
                  </div>
                )}
                {/* Checkboxes below pelanggan */}
                <div className="flex items-center gap-4 mt-1.5">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <Checkbox
                      checked={form.transferOutlet}
                      onCheckedChange={(v) => setForm((prev) => ({ ...prev, transferOutlet: Boolean(v) }))}
                    />
                    Transfer Outlet
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <Checkbox
                      checked={form.barangDikirim}
                      onCheckedChange={(v) => setForm((prev) => ({ ...prev, barangDikirim: Boolean(v) }))}
                    />
                    Barang Dikirim
                  </label>
                  {form.pelangganId && posDepositBalance !== undefined && (
                    <span className="ml-auto text-xs font-semibold text-red-700 bg-red-50 border border-red-100 rounded-md px-2 py-0.5">
                      Saldo Deposit: {formatCurrency(posDepositBalance)}
                    </span>
                  )}
                </div>
              </div>

              {/* Spacer for remaining columns */}
              <div className="lg:col-span-2"></div>
            </div>
          </div>
        </div>

        {/* ═══ Product Search Bar ═══ */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4">
          <div className="p-4 pb-0">
            <div className="relative">
              <Input
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Qty + spasi + Scan Barcode atau Ketik Nama Barang"
                className="h-10 text-sm pr-10 border-primary-200 focus:border-primary"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
            </div>
            {/* Quick search results */}
            {quickSearch.length >= 2 && quickResults.length > 0 && (
              <div className="border border-gray-200 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                {quickResults.map((p: any, i: number) => (
                  <button
                    key={p.id || i}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 border-b border-gray-100 last:border-0"
                    onClick={() => handleQuickSearchSelect(p)}
                  >
                    <div className="font-medium">{p.name || p.productName}</div>
                    <div className="text-xs text-gray-500">
                      {p.barcode && `Barcode: ${p.barcode}`}
                      {p.sku && ` | SKU: ${p.sku}`}
                      {p.price && ` | Rp ${formatCurrency(p.price)}`}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ═══ Daftar Barang Table ═══ */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-800">Daftar Barang</h2>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <Checkbox />
                  Tampilkan Data Bahan
                </label>
                <button className="text-xs text-primary hover:text-primary-800 underline flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  Isi Table via Excel
                </button>
              </div>
            </div>

            {/* Scrollable Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="w-10 px-2 py-2 text-center"></th>
                    <th className="w-10 px-2 py-2 text-center text-xs font-semibold text-gray-600">No</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 min-w-[250px]">
                      <span className="text-red-500">*</span> Barcode / Nama Produk / Kode Ref
                    </th>
                    <th className="w-20 px-2 py-2 text-center text-xs font-semibold text-gray-600">
                      <span className="text-red-500">*</span> Jumlah
                    </th>
                    <th className="w-28 px-2 py-2 text-right text-xs font-semibold text-gray-600">@Harga</th>
                    <th className="w-24 px-2 py-2 text-right text-xs font-semibold text-gray-600">@Diskon</th>
                    <th className="w-28 px-2 py-2 text-right text-xs font-semibold text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      {/* Delete button */}
                      <td className="px-2 py-1.5 text-center">
                        {(row.productName || row.barcode) && (
                          <button
                            onClick={() => removeRow(i)}
                            className="w-6 h-6 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                        )}
                      </td>

                      {/* Row number */}
                      <td className="px-2 py-1.5 text-center text-xs text-gray-500">{i + 1}</td>

                      {/* Product field */}
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={row.productSearch}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateRow(i, 'productSearch', v);
                              setProductSearchState({ rowId: row.id, query: v });
                            }}
                            onFocus={() => setFocusedRowIndex(i)}
                            placeholder="Cari produk..."
                            className="flex-1 h-8 px-2 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                          {/* Product search results dropdown per row */}
                          {focusedRowIndex === i && productSearchState.rowId === row.id && productSearchState.query.length >= 2 && productResults.length > 0 && (
                            <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto"
                              style={{ top: '100%', left: 0, right: 0 }}
                            >
                              {productResults.map((p: any, pi: number) => (
                                <button
                                  key={p.id || pi}
                                  type="button"
                                  className="w-full text-left px-2 py-1.5 text-xs hover:bg-primary-50 border-b border-gray-100 last:border-0"
                                  onClick={() => {
                                    addProductToRow(i, p, rows[i].quantity || 1);
                                    setProductSearchState({ rowId: '', query: '' });
                                    setFocusedRowIndex(null);
                                  }}
                                >
                                  {p.name || p.productName}
                                  <span className="text-gray-400 ml-1">{p.barcode || p.sku || ''}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          <button className="w-6 h-6 rounded bg-primary-50 hover:bg-primary-100 flex items-center justify-center shrink-0">
                            <Search className="w-3 h-3 text-primary" />
                          </button>
                          <button className="w-6 h-6 rounded bg-gray-50 hover:bg-gray-100 flex items-center justify-center shrink-0">
                            <Pencil className="w-3 h-3 text-gray-500" />
                          </button>
                        </div>
                      </td>

                      {/* Qty */}
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min="0"
                          value={row.quantity || ''}
                          onChange={(e) => updateRow(i, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-full h-8 px-2 border border-gray-300 rounded text-xs text-center focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                      </td>

                      {/* Price */}
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min="0"
                          value={row.price || ''}
                          onChange={(e) => updateRow(i, 'price', parseInt(e.target.value) || 0)}
                          className="w-full h-8 px-2 border border-gray-300 rounded text-xs text-right focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                      </td>

                      {/* Discount */}
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min="0"
                          value={row.discount || ''}
                          onChange={(e) => updateRow(i, 'discount', parseInt(e.target.value) || 0)}
                          className="w-full h-8 px-2 border border-gray-300 rounded text-xs text-right focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                      </td>

                      {/* Total */}
                      <td className="px-2 py-1.5 text-right text-xs font-medium text-gray-800">
                        {formatCurrency(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add Data Button */}
            <div className="mt-2">
              {hasPermission('action.pos.create') && (
                <Button
                  onClick={addRow}
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary-700 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Tambah Data
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ═══ Bottom Section: Notes + Summary ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Notes */}
          <div className="md:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-4">
            <div>
              <Label className="text-xs font-medium text-gray-700 mb-2 block">Catatan Internal</Label>
              <Textarea
                value={form.keterangan}
                onChange={(e) => setForm((prev) => ({ ...prev, keterangan: e.target.value }))}
                className="w-full min-h-[80px] resize-y"
                placeholder="Catatan untuk tim internal (tidak tercetak di struk)..."
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700 mb-2 block">Catatan Struk</Label>
              <Textarea
                value={form.keteranganStruk}
                onChange={(e) => setForm((prev) => ({ ...prev, keteranganStruk: e.target.value }))}
                className="w-full min-h-[80px] resize-y"
                placeholder="Catatan yang tercetak di struk pembeli..."
              />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Qty :</span>
                <span className="font-semibold">{totalQty}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Sub Total :</span>
                <span className="font-semibold">{formatCurrency(subTotal)}</span>
              </div>
              <hr className="my-2" />
              {/* T21: payment method — only Tunai enabled for now */}
              {/* IGDERP-239: offline forces Tunai (transfer/e-wallet/kartu need online) */}
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-medium text-gray-700">Metode Bayar</Label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  disabled={!isOnline}
                  title={!isOnline ? 'Offline: Tunai saja' : undefined}
                  className="h-8 border border-gray-300 rounded-md px-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white disabled:bg-gray-100"
                >
                  {Object.entries(PAYMENT_LABELS).map(([key, label]) => (
                    <option key={key} value={key} disabled={key !== 'cash'}>{label}</option>
                  ))}
                </select>
              </div>
              {!isOnline && (
                <p className="text-[11px] text-yellow-700">Offline: pembayaran Tunai saja — opsi lain aktif lagi saat online.</p>
              )}
              <div className="flex justify-between text-base font-bold">
                <span>Total :</span>
                <span className="text-primary font-bold">{formatCurrency(subTotal)}</span>
              </div>
              {hasPermission('action.pos.create') && (
                <Button
                  onClick={() => saveTransaction('completed')}
                  size="sm"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary-700"
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  Simpan
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Status Bar ═══ */}
      <div className="shrink-0 bg-primary text-primary-foreground text-xs py-2 px-4 flex items-center gap-6">
        <span><strong>F2</strong> = Simpan</span>
        <span><strong>F3</strong> = Simpan Sementara</span>
        <span><strong>F5</strong> = Refresh</span>
        <div className="ml-auto text-primary-200">ORBIT - POS</div>
      </div>
    </div>
  );
}
