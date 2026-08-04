import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatCurrency } from '@/utils/format';
import { useBranchStore } from '@/stores/branchStore';
import { toast } from 'sonner';
import { Search, Plus, Trash2, X, Wrench, Calculator, Loader2 } from 'lucide-react';
import { serviceOrdersService } from '@/services/service-orders.service';
import type { CompletenessItem, SmartRepairPayload } from '@/types/service';
import KelengkapanChecklist from '@/components/service/KelengkapanChecklist';

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

type ServiceTab = 'inap' | 'quick';

// ─── Constants ───────────────────────────────────

const EMPTY_ROWS = 5;
const PHONE_RE = /^(\+62|0)[0-9]{9,12}$/;

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

export default function SmartRepairPage() {
  const navigate = useNavigate();
  const { currentBranchId } = useBranchStore();
  const today = new Date().toISOString().slice(0, 10);

  const [tab, setTab] = useState<ServiceTab>('inap');

  // ── Form state ──
  const [form, setForm] = useState({
    outlet: '',
    tanggalTerima: today,
    estimasiSelesai: '',
    customerName: '',
    customerPhone: '',
    deviceType: 'handphone' as 'handphone' | 'laptop' | 'tablet' | 'other',
    deviceUnit: '',
    deviceSerial: '',
    warrantyActive: false,
    warrantyExpiry: '',
    complaint: '',
    technicianId: '',
    hargaJualServis: '',
    internalNotes: '',
    downPayment: '',
    warehouseId: '',
    laborCost: '',
    otherCost: '',
  });

  const [tax, setTax] = useState({ ppn: false, incPpn: false, pph22: false, pph23: false });
  const [checklist, setChecklist] = useState<CompletenessItem[]>([]);

  // ── Customer search ──
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerResults, setShowCustomerResults] = useState(false);

  // ── Product search (Quick Service) ──
  const [quickSearch, setQuickSearch] = useState('');
  const [rows, setRows] = useState<ItemRow[]>(createInitialRows);
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const barcodeTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const authHeader = useCallback(() => ({ Authorization: 'Bearer ' + localStorage.getItem('access_token') }), []);
  const fetchList = useCallback(
    async (path: string) => {
      const res = await fetch(path, { headers: authHeader() });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.data || [];
    },
    [authHeader],
  );

  // ── Queries ──
  const { data: branches = [] } = useQuery({
    queryKey: ['smart-repair', 'branches'],
    queryFn: () => fetchList('/api/v1/pos/branches'),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['smart-repair', 'warehouses'],
    queryFn: () => fetchList('/api/v1/pos/warehouses'),
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['smart-repair', 'technicians'],
    queryFn: () => fetchList('/api/v1/users/technicians'),
  });

  const { data: customerResults = [] } = useQuery({
    queryKey: ['smart-repair', 'customers', customerSearch],
    enabled: customerSearch.length >= 2,
    queryFn: () => fetchList('/api/v1/pos/customers?q=' + encodeURIComponent(customerSearch) + '&limit=10'),
  });

  const { data: productResults = [] } = useQuery({
    queryKey: ['smart-repair', 'products', quickSearch],
    enabled: quickSearch.length >= 2,
    queryFn: () => fetchList('/api/v1/pos/products?q=' + encodeURIComponent(quickSearch) + '&limit=10'),
  });

  // Preselect outlet from branch store
  useEffect(() => {
    if (!form.outlet && currentBranchId) {
      setForm((prev) => ({ ...prev, outlet: currentBranchId }));
    }
  }, [currentBranchId, form.outlet]);

  // ── Barcode scanner buffer (captures rapid typing outside inputs) ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
      if (!isTyping) setBarcodeBuffer((b) => b + e.key);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (barcodeBuffer.length > 0) {
      if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current);
      barcodeTimeoutRef.current = setTimeout(async () => {
        if (barcodeBuffer.length >= 3) {
          try {
            const res = await fetch('/api/v1/pos/products?q=' + barcodeBuffer + '&limit=1', { headers: authHeader() });
            const products = await res.json();
            const product = products[0];
            if (product) {
              handleQuickSearchSelect(product);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcodeBuffer, authHeader]);

  // ── Row helpers ──
  const addProductToRow = useCallback((rowIndex: number, product: any, qty: number) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIndex] = {
        ...next[rowIndex],
        productId: product.id || '',
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

  const handleQuickSearchSelect = (product: any) => {
    const emptyIdx = rows.findIndex((r) => !r.productId);
    if (emptyIdx >= 0) {
      addProductToRow(emptyIdx, product, 1);
    } else {
      setRows((prev) => [
        ...prev,
        {
          ...createEmptyRow(),
          productId: product.id || '',
          productName: product.name || product.productName || '',
          barcode: product.barcode || '',
          refCode: product.sku || product.productSku || '',
          quantity: 1,
          price: product.sellingPrice || product.price || 0,
          total: product.sellingPrice || product.price || 0,
        },
      ]);
    }
    setQuickSearch('');
  };

  const updateRow = (index: number, field: keyof ItemRow, value: any) => {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[index] };
      (row as any)[field] = value;
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
      while (next.length < EMPTY_ROWS) next.push(createEmptyRow());
      return next;
    });
  };

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);

  // ── Computed totals ──
  const partsRows = rows.filter((r) => r.productId);
  const totalParts = partsRows.reduce((s, r) => s + (r.total || 0), 0);
  const laborCost = parseFloat(form.laborCost) || 0;
  const otherCost = parseFloat(form.otherCost) || 0;
  const quickTotal = totalParts + laborCost + otherCost;
  const hargaJual = tab === 'inap' ? parseFloat(form.hargaJualServis) || 0 : quickTotal;

  // ── Submit ──
  const saveMutation = useMutation({
    mutationFn: (payload: SmartRepairPayload) => serviceOrdersService.createSmartRepair(payload),
    onSuccess: (res) => {
      toast.success('Service order berhasil disimpan');
      const id = res?.id;
      if (id) navigate(`/service-orders/${id}`);
      else navigate('/service-orders');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Gagal menyimpan service order');
    },
  });

  const handleSave = () => {
    if (!form.customerName.trim()) {
      toast.error('Pelanggan wajib diisi');
      return;
    }
    if (!PHONE_RE.test(form.customerPhone.trim())) {
      toast.error('No. HP pelanggan tidak valid (contoh: 081234567890 atau +6281234567890)');
      return;
    }
    if (!form.complaint.trim()) {
      toast.error('Deskripsi & Kondisi wajib diisi');
      return;
    }
    if (tab === 'quick' && partsRows.length === 0) {
      toast.error('Minimal satu barang spare part wajib diisi');
      return;
    }

    const parts = partsRows.map((r) => {
      const qty = r.quantity || 0;
      const effectiveUnit = qty > 0 ? r.total / qty : r.price;
      return {
        productId: r.productId,
        quantity: qty,
        unitPrice: Math.round(effectiveUnit * 100) / 100,
      };
    });

    const payload: SmartRepairPayload = {
      branchId: form.outlet || undefined,
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      deviceType: form.deviceType,
      deviceUnit: form.deviceUnit.trim() || undefined,
      deviceSerial: form.deviceSerial.trim() || undefined,
      deviceCondition: form.complaint.trim(),
      complaint: form.complaint.trim(),
      serviceSubType: tab,
      assignedTechnicianId: form.technicianId || undefined,
      finalPrice: hargaJual > 0 ? hargaJual : undefined,
      promisedDate: form.estimasiSelesai || undefined,
      taxPpn: tax.ppn,
      taxIncPpn: tax.incPpn,
      taxPph22: tax.pph22,
      taxPph23: tax.pph23,
      downPayment: tab === 'inap' && form.downPayment ? parseFloat(form.downPayment) : undefined,
      internalNotes: form.internalNotes.trim() || undefined,
    };

    if (tab === 'inap') {
      payload.completenessItems = checklist;
    } else {
      payload.warehouseId = form.warehouseId || undefined;
      payload.laborCost = laborCost > 0 ? laborCost : undefined;
      payload.otherCost = otherCost > 0 ? otherCost : undefined;
      payload.parts = parts;
    }

    saveMutation.mutate(payload);
  };

  // ── Keyboard shortcuts ──
  useHotkeys('f2', (e) => {
    e.preventDefault();
    handleSave();
  }, { enableOnFormTags: true });

  useHotkeys('f3', (e) => {
    e.preventDefault();
    toast.info('Simpan Sementara (Draft) akan diimplementasikan di v2');
  }, { enableOnFormTags: true });

  useHotkeys('f5', (e) => {
    e.preventDefault();
    window.location.reload();
  }, { enableOnFormTags: true });

  const setF = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-gray-50">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {/* ═══ Header (PoS-style, no gradient) ═══ */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Smart Repair</h1>
            <p className="text-xs text-gray-600 mt-1">Pencatatan servis — Rawat Inap atau Quick Service</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/service-orders')}>
              <X className="w-3.5 h-3.5 mr-1" /> Batal
            </Button>
          </div>
        </div>

        {/* ═══ Service Type Tabs ═══ */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as ServiceTab)} className="mb-4">
          <TabsList>
            <TabsTrigger value="quick">Quick Servis</TabsTrigger>
            <TabsTrigger value="inap">Rawat Inap</TabsTrigger>
            <TabsTrigger value="garansi" disabled>Klaim Garansi (v2)</TabsTrigger>
          </TabsList>

        {/* ═══ Transaction Header ═══ */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4">
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
              {/* Outlet */}
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">
                  <span className="text-red-500">*</span> Outlet
                </Label>
                <select
                  value={form.outlet}
                  onChange={(e) => setF({ outlet: e.target.value })}
                  className="w-full h-9 border border-gray-300 rounded-md px-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                >
                  <option value="">Please select</option>
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Tanggal Terima */}
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">Tgl Terima</Label>
                <Input type="date" value={form.tanggalTerima} onChange={(e) => setF({ tanggalTerima: e.target.value })} className="h-9 text-sm" />
              </div>

              {/* Estimasi Selesai */}
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">Estimasi Selesai</Label>
                <Input type="date" value={form.estimasiSelesai} onChange={(e) => setF({ estimasiSelesai: e.target.value })} className="h-9 text-sm" />
              </div>

              {/* Tax flags */}
              <div className="lg:col-span-3">
                <Label className="text-xs font-medium text-gray-700 mb-1 block">Pajak</Label>
                <div className="flex items-center gap-4 flex-wrap pt-1">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <Checkbox checked={tax.ppn} onCheckedChange={(v) => setTax((prev) => ({ ...prev, ppn: Boolean(v) }))} /> PPN
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <Checkbox checked={tax.incPpn} onCheckedChange={(v) => setTax((prev) => ({ ...prev, incPpn: Boolean(v) }))} /> IncPPN
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <Checkbox checked={tax.pph22} onCheckedChange={(v) => setTax((prev) => ({ ...prev, pph22: Boolean(v) }))} /> PPH22
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <Checkbox checked={tax.pph23} onCheckedChange={(v) => setTax((prev) => ({ ...prev, pph23: Boolean(v) }))} /> PPH23
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Tab Content ═══ */}
        <TabsContent value="inap" className="mt-0">
          {/* Customer + Device */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4">
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                {/* Pelanggan */}
                <div className="relative">
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">
                    <span className="text-red-500">*</span> Pelanggan
                  </Label>
                  <div className="relative">
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
                  {showCustomerResults && customerResults.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {customerResults.map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 border-b border-gray-100 last:border-0"
                          onClick={() => {
                            setF({ customerName: c.name || c.fullName || '', customerPhone: c.phone || '' });
                            setCustomerSearch(c.name || c.fullName || '');
                            setShowCustomerResults(false);
                          }}
                        >
                          <div className="font-medium">{c.name || c.fullName}</div>
                          <div className="text-xs text-gray-500">{c.phone || c.email || ''}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* No. HP */}
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">
                    <span className="text-red-500">*</span> No. HP
                  </Label>
                  <Input
                    value={form.customerPhone}
                    onChange={(e) => setF({ customerPhone: e.target.value })}
                    placeholder="081234567890"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                {/* Device type */}
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">
                    <span className="text-red-500">*</span> Jenis Perangkat
                  </Label>
                  <select
                    value={form.deviceType}
                    onChange={(e) => setF({ deviceType: e.target.value as any })}
                    className="w-full h-9 border border-gray-300 rounded-md px-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                  >
                    <option value="handphone">Handphone</option>
                    <option value="laptop">Laptop</option>
                    <option value="tablet">Tablet</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>

                {/* Serial Number */}
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">Serial Number</Label>
                  <Input value={form.deviceSerial} onChange={(e) => setF({ deviceSerial: e.target.value })} placeholder="SN perangkat" className="h-9 text-sm" />
                </div>

                {/* Nama Barang */}
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">Nama Barang / Tipe</Label>
                  <Input value={form.deviceUnit} onChange={(e) => setF({ deviceUnit: e.target.value })} placeholder="Samsung A54 / iPhone 13..." className="h-9 text-sm" />
                </div>
              </div>

              {/* Warranty */}
              <div className="flex items-center gap-4 mb-3">
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <Checkbox checked={form.warrantyActive} onCheckedChange={(v) => setF({ warrantyActive: Boolean(v) })} />
                  Dalam Garansi
                </label>
                {form.warrantyActive && (
                  <Input
                    type="date"
                    value={form.warrantyExpiry}
                    onChange={(e) => setF({ warrantyExpiry: e.target.value })}
                    className="h-8 w-44 text-sm"
                  />
                )}
              </div>

              {/* Deskripsi & Kondisi */}
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">
                  <span className="text-red-500">*</span> Deskripsi &amp; Kondisi
                </Label>
                <Textarea
                  value={form.complaint}
                  onChange={(e) => setF({ complaint: e.target.value })}
                  className="min-h-[80px] resize-y"
                  placeholder="Deskripsikan kerusakan dan kondisi perangkat..."
                />
              </div>
            </div>
          </div>

          {/* Kelengkapan */}
          <div className="mb-4">
            <KelengkapanChecklist items={checklist} onChange={setChecklist} />
          </div>

          {/* Technician + Pricing */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4">
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {/* Teknisi */}
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">Teknisi</Label>
                  <select
                    value={form.technicianId}
                    onChange={(e) => setF({ technicianId: e.target.value })}
                    className="w-full h-9 border border-gray-300 rounded-md px-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                  >
                    <option value="">Pilih Teknisi</option>
                    {technicians.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.fullName}{t.position ? ` — ${t.position}` : ''}</option>
                    ))}
                  </select>
                </div>

                {/* Harga Jual Servis */}
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">Harga Jual Servis</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.hargaJualServis}
                    onChange={(e) => setF({ hargaJualServis: e.target.value })}
                    placeholder="0"
                    className="h-9 text-sm text-right"
                  />
                </div>

                {/* Uang Muka */}
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">Uang Muka</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.downPayment}
                    onChange={(e) => setF({ downPayment: e.target.value })}
                    placeholder="0"
                    className="h-9 text-sm text-right"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="quick" className="mt-0">
          {/* Customer + Complaint */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4">
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div className="relative">
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">
                    <span className="text-red-500">*</span> Pelanggan
                  </Label>
                  <div className="relative">
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
                  {showCustomerResults && customerResults.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {customerResults.map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 border-b border-gray-100 last:border-0"
                          onClick={() => {
                            setF({ customerName: c.name || c.fullName || '', customerPhone: c.phone || '' });
                            setCustomerSearch(c.name || c.fullName || '');
                            setShowCustomerResults(false);
                          }}
                        >
                          <div className="font-medium">{c.name || c.fullName}</div>
                          <div className="text-xs text-gray-500">{c.phone || c.email || ''}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">
                    <span className="text-red-500">*</span> No. HP
                  </Label>
                  <Input
                    value={form.customerPhone}
                    onChange={(e) => setF({ customerPhone: e.target.value })}
                    placeholder="081234567890"
                    className="h-9 text-sm"
                  />
                </div>

                {/* Gudang */}
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">
                    <span className="text-red-500">*</span> Gudang
                  </Label>
                  <select
                    value={form.warehouseId}
                    onChange={(e) => setF({ warehouseId: e.target.value })}
                    className="w-full h-9 border border-gray-300 rounded-md px-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                  >
                    <option value="">Pilih Gudang</option>
                    {warehouses.map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">
                  <span className="text-red-500">*</span> Deskripsi &amp; Kondisi
                </Label>
                <Textarea
                  value={form.complaint}
                  onChange={(e) => setF({ complaint: e.target.value })}
                  className="min-h-[60px] resize-y"
                  placeholder="Deskripsikan kerusakan dan kondisi perangkat..."
                />
              </div>
            </div>
          </div>

          {/* Product search + table */}
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
              {quickSearch.length >= 2 && productResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                  {productResults.map((p: any, i: number) => (
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
                        {p.sellingPrice && ` | Rp ${formatCurrency(p.sellingPrice)}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-gray-800">Daftar Barang</h2>
              </div>
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
                        <td className="px-2 py-1.5 text-center">
                          {row.productId && (
                            <button
                              onClick={() => removeRow(i)}
                              className="w-6 h-6 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center"
                            >
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center text-xs text-gray-500">{i + 1}</td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={row.productSearch}
                            onChange={(e) => updateRow(i, 'productSearch', e.target.value)}
                            placeholder="Cari produk..."
                            className="w-full h-8 px-2 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                          {row.productId && (
                            <div className="text-[11px] text-gray-400 mt-0.5">
                              {row.barcode && `Barcode: ${row.barcode}`}
                              {row.refCode && ` | ${row.refCode}`}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min="0"
                            value={row.quantity || ''}
                            onChange={(e) => updateRow(i, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-full h-8 px-2 border border-gray-300 rounded text-xs text-center focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min="0"
                            value={row.price || ''}
                            onChange={(e) => updateRow(i, 'price', parseInt(e.target.value) || 0)}
                            className="w-full h-8 px-2 border border-gray-300 rounded text-xs text-right focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min="0"
                            value={row.discount || ''}
                            onChange={(e) => updateRow(i, 'discount', parseInt(e.target.value) || 0)}
                            className="w-full h-8 px-2 border border-gray-300 rounded text-xs text-right focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right text-xs font-medium text-gray-800">
                          {formatCurrency(row.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2">
                <Button onClick={addRow} size="sm" className="bg-primary text-primary-foreground hover:bg-primary-700 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Tambah Data
                </Button>
              </div>
            </div>
          </div>

          {/* Cost Summary */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold text-gray-800">Ringkasan Biaya</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">Total Jasa</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.laborCost}
                    onChange={(e) => setF({ laborCost: e.target.value })}
                    placeholder="0"
                    className="h-9 text-sm text-right"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">Total Spare Part (otomatis)</Label>
                  <Input value={formatCurrency(totalParts)} readOnly className="h-9 text-sm text-right bg-gray-50" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">Ongkos Kirim</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.otherCost}
                    onChange={(e) => setF({ otherCost: e.target.value })}
                    placeholder="0"
                    className="h-9 text-sm text-right"
                  />
                </div>
                <div className="flex items-end">
                  <div className="w-full rounded-lg bg-primary-50 border border-primary-100 px-3 py-2 flex justify-between items-center">
                    <span className="text-xs font-semibold text-primary-800">Harga Pokok Servis</span>
                    <span className="text-base font-bold text-primary">{formatCurrency(quickTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        </Tabs>

        {/* ═══ Notes (shared) ═══ */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4">
          <div className="p-4">
            <Label className="text-xs font-medium text-gray-700 mb-2 block">Catatan Internal (tidak tampil pada nota)</Label>
            <Textarea
              value={form.internalNotes}
              onChange={(e) => setF({ internalNotes: e.target.value })}
              className="min-h-[60px] resize-y"
              placeholder="Catatan untuk tim internal..."
            />
          </div>
        </div>
      </div>

      {/* ═══ Footer Status Bar ═══ */}
      <div className="shrink-0 bg-primary text-primary-foreground text-xs py-2 px-4 flex items-center gap-6">
        <span><strong>F2</strong> = Simpan</span>
        <span><strong>F3</strong> = Simpan Sementara</span>
        <span><strong>F5</strong> = Refresh</span>
        <div className="ml-auto text-primary-200">IGD Ponsel - Smart Repair</div>
        <Button
          size="sm"
          className="text-xs bg-white text-primary hover:bg-primary-50"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Wrench className="w-3.5 h-3.5 mr-1" />}
          Simpan
        </Button>
      </div>
    </div>
  );
}
