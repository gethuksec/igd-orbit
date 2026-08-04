import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/utils/format';
import { useBranchStore } from '@/stores/branchStore';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Trash2,
  Pencil,
  Copy,
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
  tipePenjualan: string;
  gudang: string;
  tanggalFaktur: string;
  pelanggan: string;
  pelangganId: string;
  transferOutlet: boolean;
  barangDikirim: boolean;
  manualFaktur: boolean;
  keterangan: string;
}

// ─── Constants ────────────────────────────────────

const EMPTY_ROWS = 5;

function createEmptyRow(): ItemRow {
  return {
    id: crypto.randomUUID(),
    productId: '',
    productSearch: '',
    barcode: '',
    productName: '',
    refCode: '',
    quantity: 1,
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
  const { currentBranchId } = useBranchStore();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  // ── Form State ──
  const [form, setForm] = useState<FormData>({
    outletPenjual: '',
    termin: 'Tunai',
    tanggalJatuhTempo: '',
    sales: '',
    tipePenjualan: '',
    gudang: '',
    tanggalFaktur: today,
    pelanggan: '',
    pelangganId: '',
    transferOutlet: false,
    barangDikirim: false,
    manualFaktur: false,
    keterangan: '',
  });

  // ── Item Rows ──
  const [rows, setRows] = useState<ItemRow[]>(createInitialRows);

  // ── Totals ──
  const totalQty = rows.reduce((sum, r) => sum + (r.quantity || 0), 0);
  const subTotal = rows.reduce((sum, r) => sum + (r.total || 0), 0);

  // ── Customer search ──
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const customerRef = useRef<HTMLDivElement>(null);

  const { data: customerResults = [] } = useQuery({
    queryKey: ['pos-customers', customerSearch],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/pos/customers?q=' + encodeURIComponent(customerSearch) + '&limit=10', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: customerSearch.length >= 2,
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
    queryKey: ['pos-products', productSearchState.query, currentBranchId],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/pos/products?q=' + encodeURIComponent(productSearchState.query) + '&limit=10', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) return [];
      return res.json();
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
  }, [barcodeBuffer, currentBranchId, rows, addProductToRow]);

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
    const typeId = salesTypes.find((st: any) => st.name === form.tipePenjualan)?.id || undefined;
    const total = items.reduce((s, i) => s + i.quantity * i.unitPrice - i.discountAmount, 0);
    const payload: any = {
      branchId: form.outletPenjual,
      customerId: form.pelangganId || undefined,
      paymentTermId: termId,
      salesPersonId: form.sales || undefined,
      warehouseId: form.gudang || undefined,
      salesTypeId: typeId,
      taxPercentage: 0, // T21: tax disabled by decision — charge what's shown
      items,
      internalNotes: form.keterangan || undefined,
      status,
    };
    if (status === 'completed' && total > 0) {
      payload.payment = { method: paymentMethod, amount: total };
    }
    return payload;
  };

  // ── Save transaction (real POST — T21 rewiring) ──
  const saveTransaction = async (status: 'completed' | 'held') => {
    if (!form.outletPenjual) { toast.error('Outlet Penjual wajib diisi'); return; }
    if (!form.sales) { toast.error('Sales wajib diisi'); return; }
    if (!form.tipePenjualan) { toast.error('Tipe Penjualan wajib diisi'); return; }
    if (!form.pelangganId) { toast.error('Pelanggan wajib diisi'); return; }
    const items = rows.filter((r) => r.productId);
    if (items.length === 0) { toast.error('Minimal satu barang wajib diisi'); return; }

    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch('/api/v1/pos/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(buildPayload(status)),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = Array.isArray(err?.message) ? err.message.join(', ') : (err?.message || 'Gagal menyimpan transaksi');
        toast.error(msg);
        return;
      }
      const data = await res.json();
      if (status === 'held') {
        // T21 decision: draft stays on page — data kept for further editing
        toast.success('Draf penjualan tersimpan');
        return;
      }
      toast.success('Transaksi berhasil disimpan');
      setRows(createInitialRows);
      setForm((prev) => ({
        ...prev,
        pelanggan: '', pelangganId: '', keterangan: '', termin: 'Tunai',
        sales: '', tipePenjualan: '', gudang: '', tanggalJatuhTempo: '',
      }));
      setCustomerSearch('');
      setQuickSearch('');
      if (data?.id) navigate(`/sales/transactions/${data.id}`);
    } catch {
      toast.error('Gagal menyimpan transaksi');
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
  const { data: branches = [] } = useQuery({
    queryKey: ['pos-branches'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/pos/branches', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: paymentTerms = [] } = useQuery({
    queryKey: ['pos-payment-terms'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/pos/payment-terms', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: salesTypes = [] } = useQuery({
    queryKey: ['pos-sales-types'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/pos/sales-types', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // T21: sales persons + warehouses (were empty dropdowns)
  const { data: salesPersons = [] } = useQuery({
    queryKey: ['pos-sales-persons'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/pos/sales-persons', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['pos-warehouses'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/pos/warehouses', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // T21: top search bar results (was disconnected from quickSearch — never populated)
  // Strip the "qty space" prefix before querying: "2 baterai" → "baterai"
  const quickClean = quickSearch.trim().replace(/^\d+\s+/, '');
  const { data: quickResults = [] } = useQuery({
    queryKey: ['pos-quick-products', quickClean],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/pos/products?q=' + encodeURIComponent(quickClean) + '&limit=10', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: quickClean.length >= 2,
  });

  // ── Render ──

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ═══ Top Alert Banner ═══ */}
      <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 text-center text-sm text-orange-800">
        Inputkan data lalu tekan tombol <strong>Simpan</strong> untuk menyimpan
      </div>

      <div className="px-4 py-4 max-w-full">
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
                  onChange={(e) => setForm((prev) => ({ ...prev, outletPenjual: e.target.value }))}
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

              {/* Tipe Penjualan */}
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">
                  <span className="text-red-500">*</span> Tipe Penjualan
                </Label>
                <select
                  value={form.tipePenjualan}
                  onChange={(e) => setForm((prev) => ({ ...prev, tipePenjualan: e.target.value }))}
                  className="w-full h-9 border border-gray-300 rounded-md px-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                >
                  <option value="">Please select</option>
                  {salesTypes.map((st: any) => (
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
          <div className="md:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <Label className="text-xs font-medium text-gray-700 mb-2 block">Keterangan</Label>
            <Textarea
              value={form.keterangan}
              onChange={(e) => setForm((prev) => ({ ...prev, keterangan: e.target.value }))}
              className="w-full min-h-[100px] resize-y"
              placeholder="Catatan transaksi..."
            />
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
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-medium text-gray-700">Metode Bayar</Label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="h-8 border border-gray-300 rounded-md px-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                >
                  {Object.entries(PAYMENT_LABELS).map(([key, label]) => (
                    <option key={key} value={key} disabled={key !== 'cash'}>{label}</option>
                  ))}
                </select>
              </div>
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
      <div className="sticky bottom-0 bg-primary text-primary-foreground text-xs py-2 px-4 flex items-center gap-6">
        {hasPermission('action.pos.create') && <span><strong>F2</strong> = Simpan</span>}
        {hasPermission('action.pos.create') && <span><strong>F3</strong> = Simpan Sementara</span>}
        <span><strong>F5</strong> = Refresh</span>
        <div className="ml-auto text-primary-200">IGD Ponsel - Sistem ERP</div>
      </div>
    </div>
  );
}
