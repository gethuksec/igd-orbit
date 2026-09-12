import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import kecamatanJember from '@/data/kecamatan-jember.json';
import { Camera, Plus, Search, Save, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/utils/format';
import { serviceOrdersService } from '@/services/service-orders.service';
import { colorsService } from '@/services/colors.service';
import { brandsService } from '@/services/brands.service';
import type { CompletenessItem, ServicePartItem, SmartRepairPayload } from '@/types/service';

interface ItemRow {
  id: string;
  productId: string;
  productSearch: string;
  productName: string;
  barcode: string;
  refCode: string;
  quantity: number;
  price: number;
  warrantyDays: number;
  total: number;
  available?: number | null;
  warehouseId?: string;
  warehouseName?: string;
}

const PHONE_RE = /^(\+62|0)[0-9]{9,12}$/;
const isoLocal = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

function MoneyInput({ value, onChange, className }: { value: number; onChange: (n: number) => void; className?: string }) {
  return <Input inputMode="numeric" value={value ? value.toLocaleString('id-ID') : ''} onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '') || 0))} className={className} />;
}
// Tag combobox pindah ke komponen shared (dipakai intake + detail tambah layanan)
import TagCombobox from '@/components/services/TagCombobox';
function emptyRow(): ItemRow {
  return {
    id: crypto.randomUUID(), productId: '', productSearch: '', productName: '', barcode: '', refCode: '',
    quantity: 1, price: 0, warrantyDays: 0, total: 0, available: null,
  };
}

export default function SmartRepairPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    outlet: '', warehouseId: '', receivedDate: isoLocal(), promisedDate: isoLocal(new Date(Date.now() + 24 * 3600 * 1000)),
    customerId: '', customerName: '', customerPhone: '', customerSubdistrict: '',
    deviceType: 'handphone' as 'handphone' | 'laptop' | 'tablet' | 'other',
    deviceUnit: '', deviceColor: '', deviceSerial: '', complaint: '',
    technicianId: '', downPayment: '', internalNotes: '',
    warrantyDays: '30',
  });
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [estimasiAuto, setEstimasiAuto] = useState(true);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [selectedLayanan, setSelectedLayanan] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<CompletenessItem[]>([]);
  const [openCustomer, setOpenCustomer] = useState(false);
  const [openKelengkapan, setOpenKelengkapan] = useState(false);
  const [openLayanan, setOpenLayanan] = useState(false);
  const [openBarang, setOpenBarang] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState({ name: '', phone: '', subdistrict: '' });
  const [newCompleteness, setNewCompleteness] = useState({ name: '', conditionNote: '' });
  const [newLayanan, setNewLayanan] = useState('');
  const [productDraft, setProductDraft] = useState<any | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productDraftQty, setProductDraftQty] = useState(1);
  const [productDraftWarranty, setProductDraftWarranty] = useState(0);
  const [barangWarehouseId, setBarangWarehouseId] = useState('');
  const [layananCost, setLayananCost] = useState<Record<string, number>>({});
  const [layananNotes, setLayananNotes] = useState<Record<string, string[]>>({});
  const [newLayananCost, setNewLayananCost] = useState('');
  const [newLayananTags, setNewLayananTags] = useState<string[]>([]);
  const [estimasiValue, setEstimasiValue] = useState('');
  const [estimasiManual, setEstimasiManual] = useState(false);

  const authHeader = useCallback(() => ({ Authorization: 'Bearer ' + localStorage.getItem('access_token') }), []);
  const fetchList = useCallback(async (path: string) => {
    const res = await fetch(path, { headers: authHeader() });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : json.data || [];
  }, [authHeader]);

  const { data: branches = [] } = useQuery({ queryKey: ['smart-repair', 'branches'], queryFn: () => fetchList('/api/v1/pos/branches') });
  const { data: warehouses = [] } = useQuery({
    queryKey: ['smart-repair', 'warehouses', form.outlet], enabled: Boolean(form.outlet),
    queryFn: () => fetchList('/api/v1/pos/warehouses?outletId=' + encodeURIComponent(form.outlet)),
  });
  const { data: technicians = [] } = useQuery({
    queryKey: ['smart-repair', 'technicians', form.outlet], enabled: Boolean(form.outlet),
    queryFn: () => fetchList('/api/v1/users/technicians?branchId=' + encodeURIComponent(form.outlet)),
  });
  const { data: layananList = [] } = useQuery({ queryKey: ['smart-repair', 'layanan-master'], queryFn: () => fetchList('/api/v1/service-types') });
  const { data: customerResults = [] } = useQuery({
    queryKey: ['smart-repair', 'customers', customerSearch], enabled: customerSearch.length >= 2,
    queryFn: () => fetchList('/api/v1/pos/customers?q=' + encodeURIComponent(customerSearch) + '&limit=10'),
  });
  const { data: productResults = [] } = useQuery({
    queryKey: ['smart-repair', 'products', productSearch, barangWarehouseId], enabled: openBarang && productSearch.length >= 2 && Boolean(barangWarehouseId),
    queryFn: () => fetchList('/api/v1/pos/products?q=' + encodeURIComponent(productSearch) + '&limit=10' + (barangWarehouseId ? '&warehouseId=' + encodeURIComponent(barangWarehouseId) : '')),
  });
  const { data: checkpointsMaster = [] } = useQuery({ queryKey: ['smart-repair', 'checkpoints'], queryFn: () => fetchList('/api/v1/service-checkpoints/active') });
  const { data: colorsRes } = useQuery({ queryKey: ['smart-repair', 'colors'], queryFn: () => colorsService.getAll({ status: 'active', limit: 100 }) });
  const { data: brandsRes } = useQuery({ queryKey: ['smart-repair', 'brands'], queryFn: () => brandsService.getAll({ limit: 100 }) });
  const colorNames = useMemo(() => Array.from(new Set(((colorsRes as any)?.data || []).map((c: any) => c.name).filter(Boolean))) as string[], [colorsRes]);
  const brandNames = useMemo(() => Array.from(new Set(((brandsRes as any)?.data || []).map((b: any) => b.name).filter(Boolean))) as string[], [brandsRes]);
  const docUrls = useMemo(() => docFiles.map((f) => URL.createObjectURL(f)), [docFiles]);

  useEffect(() => {
    if (branches.length === 1 && !form.outlet) setForm((f) => ({ ...f, outlet: branches[0].id }));
  }, [branches, form.outlet]);

  // Kelengkapan: seed rows from master checkpoints (preserve checked state on refetch)
  useEffect(() => {
    const cps = checkpointsMaster as any[];
    if (!cps.length) return;
    setChecklist((items) => {
      if (!items.length) return cps.map((cp) => ({ checkpointId: cp.id, name: cp.name, checked: false, conditionNote: '' }));
      const known = new Set(items.map((i) => i.checkpointId || i.name));
      const extra = cps.filter((cp) => !known.has(cp.id) && !known.has(cp.name)).map((cp) => ({ checkpointId: cp.id, name: cp.name, checked: false, conditionNote: '' }));
      return extra.length ? [...items, ...extra] : items;
    });
  }, [checkpointsMaster]);

  // Estimasi Selesai: Tgl Terima + total antrian SLA, unless CS edited it manually
  useEffect(() => {
    if (!estimasiAuto || !form.receivedDate || !selectedLayanan.length || !(layananList as any[]).length) return;
    const picked = (layananList as any[]).filter((l) => selectedLayanan.includes(l.id));
    if (!picked.length) return;
    const totalSla = picked.reduce((sum, l) => sum + Number(l.slaHours || 0), 0);
    setForm((f) => ({ ...f, promisedDate: isoLocal(new Date(new Date(f.receivedDate).getTime() + totalSla * 3600 * 1000)) }));
  }, [selectedLayanan, layananList, form.receivedDate, estimasiAuto]);

  const setF = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));
  const layananPicked = useMemo(() => selectedLayanan.map((id) => (layananList as any[]).find((l) => l.id === id)).filter(Boolean), [layananList, selectedLayanan]);
  const allTags = useMemo(() => Array.from(new Set(Object.values(layananNotes).flat())), [layananNotes]);
  const suggestTags = useCallback(async (qq: string) => {
    const rows = await fetchList('/api/v1/service-orders/tags/suggest?q=' + encodeURIComponent(qq) + '&take=5');
    return (rows as any[]).map((r) => String(r.name || '')).filter(Boolean);
  }, [fetchList]);
  // Estimasi antrian: baris UTAMA dulu, baris berikut menumpuk setelahnya (received + ΣSLA s.d. baris itu)
  const cumulativeTimes = useMemo(() => {
    if (!form.receivedDate) return selectedLayanan.map(() => '—');
    let t = new Date(form.receivedDate).getTime();
    return layananPicked.map((l: any) => { t += Number(l?.slaHours || 0) * 3600 * 1000; return new Date(t).toLocaleString('id-ID'); });
  }, [form.receivedDate, layananPicked]);
  const partsRows = rows.filter((r) => r.productId);
  const totalParts = partsRows.reduce((sum, r) => sum + r.total, 0);
  const layananTotal = selectedLayanan.reduce((sum, id) => sum + Number(layananCost[id] || 0), 0);
  const estimatedAuto = layananTotal + totalParts;
  const estimasiEfektif = estimasiManual ? Number(estimasiValue || 0) : estimatedAuto;
  const downPayment = Number(form.downPayment || 0);
  const remaining = Math.max(estimasiEfektif - downPayment, 0);

  const saveMutation = useMutation({
    mutationFn: (payload: SmartRepairPayload) => serviceOrdersService.createSmartRepair(payload),
    onSuccess: async (res) => {
      // IGDERP-136 fix round: dokumentasi intake ikut tersimpan (sebelumnya preview lokal saja)
      const orderId = res?.id;
      if (orderId && docFiles.length > 0) {
        try {
          await serviceOrdersService.uploadPhotoFiles(orderId, docFiles, 'intake');
          toast.success(`Dokumentasi (${docFiles.length} foto) tersimpan di tahap Intake`);
        } catch {
          toast.warning('Order tersimpan, tapi dokumentasi gagal diupload — tambah manual di detail');
        }
        setDocFiles([]);
      }
      toast.success('Service order berhasil disimpan');
      navigate(orderId ? `/service-orders/${orderId}` : '/service-orders');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menyimpan service order'),
  });

  const handleOutletChange = (outlet: string) => { if (form.technicianId) toast.warning('Outlet berubah — Teknisi direset, pilih ulang'); setF({ outlet, warehouseId: '', technicianId: '' }); setRows([]); setBarangWarehouseId(''); setProductDraft(null); setProductSearch(''); };
  const handleWarehouseChange = (warehouseId: string) => { setF({ warehouseId }); setRows([]); setBarangWarehouseId(warehouseId); setProductDraft(null); setProductSearch(''); };
  const handleSave = () => {
    if (!form.outlet) return toast.error('Outlet wajib dipilih');
    if (!form.warehouseId) return toast.error('Gudang wajib dipilih');
    if (!form.customerName.trim()) return toast.error('Pelanggan wajib diisi');
    if (!PHONE_RE.test(form.customerPhone.trim())) return toast.error('No. HP pelanggan tidak valid');
    if (!form.complaint.trim()) return toast.error('Deskripsi & Kondisi wajib diisi');
    if (!selectedLayanan.length) return toast.error('Minimal satu layanan wajib dipilih');
    const zeroCostId = selectedLayanan.find((id) => !(Number(layananCost[id]) > 0));
    if (zeroCostId) return toast.error('Biaya ' + ((layananList as any[]).find((l) => l.id === zeroCostId)?.name || 'layanan') + ' wajib diisi');
    if (!form.technicianId) return toast.error('Teknisi wajib dipilih');
    if (!form.deviceUnit.trim()) return toast.error('Nama Barang wajib diisi');
    if (!estimasiEfektif) return toast.error('Estimasi biaya wajib diisi');
    if (estimasiEfektif < estimatedAuto) return toast.error('Estimasi tidak boleh di bawah total layanan + barang');
    const parts: ServicePartItem[] = partsRows.map((r) => ({ productId: r.productId, quantity: r.quantity, unitPrice: r.price, purchaseType: 'internal', warrantyDays: r.warrantyDays, warehouseId: r.warehouseId }));
    saveMutation.mutate({
      branchId: form.outlet, warehouseId: form.warehouseId, customerId: form.customerId || undefined,
      customerName: form.customerName.trim(), customerPhone: form.customerPhone.trim(), customerSubdistrict: form.customerSubdistrict || undefined,
      deviceType: form.deviceType, deviceUnit: form.deviceUnit || undefined, deviceColor: form.deviceColor || undefined,
      deviceSerial: form.deviceSerial || undefined, deviceCondition: form.complaint, complaint: form.complaint,
      serviceSubType: 'quick', assignedTechnicianId: form.technicianId || undefined, layananIds: selectedLayanan,
      layananItems: selectedLayanan.map((id) => ({ serviceTypeId: id, estimatedCost: Number(layananCost[id] || 0), notes: (layananNotes[id] || []).join(', ') || undefined })),
      receivedDate: new Date(form.receivedDate).toISOString(), promisedDate: form.promisedDate ? new Date(form.promisedDate).toISOString() : undefined,
      estimatedCost: estimasiEfektif, finalPrice: estimasiEfektif, downPayment: downPayment || undefined, warrantyDays: Math.max(0, Number(form.warrantyDays || 30)),
      taxPpn: false, taxIncPpn: false, taxPph22: false, taxPph23: false,
      parts: parts.length ? parts : undefined, completenessItems: checklist, internalNotes: form.internalNotes || undefined,
    });
  };

  useHotkeys('f2', (e) => { e.preventDefault(); handleSave(); }, { enableOnFormTags: true });
  useHotkeys('f3', (e) => { e.preventDefault(); toast.info('Simpan Sementara (Draft) akan diimplementasikan di v2'); }, { enableOnFormTags: true });
  useHotkeys('f5', (e) => { e.preventDefault(); window.location.reload(); }, { enableOnFormTags: true });

  const chooseCustomer = (customer: any) => {
    setF({ customerId: customer.id, customerName: customer.name || customer.fullName || '', customerPhone: customer.phone || '', customerSubdistrict: customer.subdistrict || '' });
    setCustomerSearch(customer.name || customer.fullName || '');
    setShowCustomerResults(false);
  };
  const createCustomer = async () => {
    if (!quickCustomer.name.trim() || !PHONE_RE.test(quickCustomer.phone.trim())) return toast.error('Nama dan No. HP valid wajib diisi');
    const res = await fetch('/api/v1/customers', { method: 'POST', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ customerType: 'retail', name: quickCustomer.name.trim(), phone: quickCustomer.phone.trim(), subdistrict: quickCustomer.subdistrict || undefined }) });
    if (!res.ok) return toast.error('Gagal membuat pelanggan');
    const customer = await res.json();
    chooseCustomer(customer); setQuickCustomer({ name: '', phone: '', subdistrict: '' }); setOpenCustomer(false); toast.success('Pelanggan dibuat dan dipilih');
  };
  const addCompleteness = () => {
    if (!newCompleteness.name.trim()) return toast.error('Nama kelengkapan wajib diisi');
    setChecklist((items) => [...items, { name: newCompleteness.name.trim(), checked: true, conditionNote: newCompleteness.conditionNote }]);
    setNewCompleteness({ name: '', conditionNote: '' }); setOpenKelengkapan(false);
  };
  const addLayanan = () => {
    if (!newLayanan || selectedLayanan.includes(newLayanan)) return toast.error('Pilih layanan yang belum ditambahkan');
    setSelectedLayanan((items) => [...items, newLayanan]);
    setLayananCost((costs) => ({ ...costs, [newLayanan]: Math.max(0, Number(newLayananCost || 0)) }));
    if (newLayananTags.length) setLayananNotes((notes) => ({ ...notes, [newLayanan]: newLayananTags }));
    setNewLayanan(''); setNewLayananCost(''); setNewLayananTags([]); setOpenLayanan(false);
  };
  const selectProduct = (product: any) => { setProductDraft(product); setProductSearch(product.name || ''); setProductDraftQty(1); setProductDraftWarranty(0); };
  const addProduct = () => {
    if (!productDraft) return toast.error('Pilih produk terlebih dahulu');
    if (!barangWarehouseId) return toast.error('Pilih Gudang barang terlebih dahulu');
    if (!productDraftQty || productDraftQty < 1) return toast.error('Qty minimal 1');
    if (productDraft.available != null && productDraftQty > Number(productDraft.available)) return toast.error('Qty melebihi stok tersedia');
    const price = Number(productDraft.sellingPrice || productDraft.price || 0);
    setRows((items) => [...items, { ...emptyRow(), productId: productDraft.id, productName: productDraft.name, productSearch: productDraft.name, barcode: productDraft.barcode || '', refCode: productDraft.sku || '', quantity: productDraftQty, price, warrantyDays: productDraftWarranty, total: productDraftQty * price, available: productDraft.available, warehouseId: barangWarehouseId, warehouseName: (warehouses as any[]).find((w: any) => w.id === barangWarehouseId)?.name || 'Gudang' }]);
    setProductDraft(null); setProductSearch(''); setOpenBarang(false);
  };
  const updateRow = (index: number, patch: Partial<ItemRow>) => setRows((items) => items.map((row, i) => i === index ? { ...row, ...patch, total: (patch.quantity ?? row.quantity) * (patch.price ?? row.price) } : row));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
      <div className="sticky top-0 z-30 border-b bg-gray-50/95 px-4 py-3 backdrop-blur">
        <div className="flex items-end justify-between">
          <div><h1 className="text-xl font-bold text-gray-900">Smart Repair</h1><p className="mt-1 text-xs text-gray-600">Pencatatan servis — satu halaman, tanpa tab</p></div>
          <Button variant="outline" size="sm" className="border-primary text-primary" onClick={handleSave} disabled={saveMutation.isPending}><Save className="h-4 w-4" /> Simpan <span className="text-muted-foreground">F2</span></Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <Card><CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><Label><span className="text-red-500">*</span> Outlet</Label><Select value={form.outlet} onValueChange={handleOutletChange} className="mt-1"><option value="">Pilih Outlet</option>{branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></div>
          <div><Label><span className="text-red-500">*</span> Gudang</Label><Select value={form.warehouseId} onValueChange={handleWarehouseChange} disabled={!form.outlet} className="mt-1"><option value="">Pilih Gudang</option>{warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></div>
          <div><Label>Tgl Terima</Label><Input type="datetime-local" value={form.receivedDate} onChange={(e) => setF({ receivedDate: e.target.value })} className="mt-1" /></div>
          <div><Label>Estimasi Selesai <span className="text-muted-foreground">(auto)</span></Label><Input type="datetime-local" value={form.promisedDate} onChange={(e) => { setEstimasiAuto(false); setF({ promisedDate: e.target.value }); }} className="mt-1" /></div>
          <p className="text-xs text-muted-foreground lg:col-span-4">Estimasi selesai = antrian SLA (utama dulu, berikut menumpuk) — tetap bisa diubah manual.</p>
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <div className="mb-3 flex items-end gap-2"><div className="min-w-0 flex-1"><Label><span className="text-red-500">*</span> Pelanggan</Label><div className="relative mt-1"><Input value={customerSearch || form.customerName} onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerResults(true); setF({ customerName: e.target.value }); }} placeholder="Cari pelanggan..." /><Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />{showCustomerResults && customerResults.length > 0 && <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 overflow-auto rounded-md border bg-white shadow">{customerResults.map((c: any) => <button key={c.id} type="button" className="block w-full border-b px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => chooseCustomer(c)}>{c.name} · {c.phone}</button>)}</div>}</div></div><Button variant="outline" size="sm" className="shrink-0 border-primary text-primary" onClick={() => setOpenCustomer(true)}><Plus className="h-4 w-4" /> Tambah</Button></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><Label><span className="text-red-500">*</span> No. HP</Label><Input value={form.customerPhone} onChange={(e) => setF({ customerPhone: e.target.value })} className="mt-1" /><p className="mt-1 text-xs text-muted-foreground">Format: 08… atau +62… — dicek saat simpan.</p></div><div><Label><span className="text-red-500">*</span> Kecamatan</Label><Select value={form.customerSubdistrict} onValueChange={(customerSubdistrict) => setF({ customerSubdistrict })} className="mt-1"><option value="">Pilih Kecamatan</option>{form.customerSubdistrict && !(kecamatanJember as string[]).includes(form.customerSubdistrict) && <option value={form.customerSubdistrict}>{form.customerSubdistrict}</option>}{(kecamatanJember as string[]).map((kec) => <option key={kec} value={kec}>{kec}</option>)}</Select></div></div>
        </CardContent></Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card><CardContent className="p-4"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><Label><span className="text-red-500">*</span> Jenis Perangkat</Label><Select value={form.deviceType} onValueChange={(deviceType) => setF({ deviceType: deviceType as typeof form.deviceType })} className="mt-1"><option value="handphone">Handphone</option><option value="laptop">Laptop</option><option value="tablet">Tablet</option><option value="other">Lainnya</option></Select></div><div><Label><span className="text-red-500">*</span> Nama Barang / Tipe</Label><Input value={form.deviceUnit} onChange={(e) => setF({ deviceUnit: e.target.value })} placeholder="Samsung A54 / iPhone 13..." list="sr-brands" className="mt-1" /><datalist id="sr-brands">{brandNames.map((b) => <option key={b} value={b} />)}</datalist></div><div><Label>Serial Number</Label><Input value={form.deviceSerial} onChange={(e) => setF({ deviceSerial: e.target.value })} className="mt-1" /></div><div><Label>Warna</Label><Input value={form.deviceColor} onChange={(e) => setF({ deviceColor: e.target.value })} placeholder="Hitam..." list="sr-warna" className="mt-1" /><datalist id="sr-warna">{colorNames.map((c) => <option key={c} value={c} />)}</datalist></div></div><div className="mt-3"><Label><span className="text-red-500">*</span> Deskripsi &amp; Kondisi</Label><Textarea value={form.complaint} onChange={(e) => setF({ complaint: e.target.value })} className="mt-1 min-h-20" /></div><div className="mt-3"><Label>Catatan Internal (khusus tim — tampil di timeline)</Label><Textarea value={form.internalNotes} onChange={(e) => setF({ internalNotes: e.target.value })} placeholder="Mis. customer minta ganti ori, confirmed via WA…" className="mt-1 min-h-16" /></div><div className="mt-3 flex items-center gap-2"><Label>Masa garansi servis</Label><Input type="number" min={0} value={form.warrantyDays} onChange={(e) => setF({ warrantyDays: e.target.value })} className="h-8 w-20" /><span className="text-xs text-muted-foreground">hari (berlaku sejak serah terima)</span></div></CardContent></Card>
          <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Dokumentasi (foto awal)</CardTitle><p className="text-xs text-muted-foreground">Wadah upload — kompres &lt;1MB + thumbnail</p></CardHeader><CardContent><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Button variant="outline" className="flex h-20 cursor-pointer items-center justify-center border-dashed"><label className="flex cursor-pointer items-center"><Camera className="mr-2 h-4 w-4" /> Foto langsung<input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { setDocFiles((f) => [...f, ...Array.from(e.target.files || [])]); e.target.value = ''; }} /></label></Button><Button variant="outline" className="flex h-20 cursor-pointer items-center justify-center border-dashed"><label className="flex cursor-pointer items-center"><Upload className="mr-2 h-4 w-4" /> Upload file<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { setDocFiles((f) => [...f, ...Array.from(e.target.files || [])]); e.target.value = ''; }} /></label></Button></div>{docFiles.length > 0 && <><p className="mt-3 text-xs font-medium">Preview ({docFiles.length})</p><div className="mt-2 grid grid-cols-4 gap-2">{docUrls.map((url, i) => <div key={i} className="relative h-16 overflow-hidden rounded-md border bg-muted"><img src={url} alt={docFiles[i]?.name || `foto-${i + 1}`} className="h-full w-full object-cover" /><button type="button" onClick={() => setDocFiles((files) => files.filter((_, x) => x !== i))} className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5"><X className="h-3 w-3 text-white" /></button></div>)}</div></>}<div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">⚠ Belum ada foto — disarankan 2 (kondisi luar &amp; kerusakan). Bisa simpan dulu, tambah kemudian.</div></CardContent></Card>
        </div>

        <Card><CardHeader className="flex-row items-center justify-between space-y-0 pb-3"><CardTitle className="text-sm">✓ Kelengkapan <span className="font-normal text-muted-foreground">({checklist.filter((x) => x.checked).length}/{checklist.length} tercentang)</span></CardTitle><Button variant="outline" size="sm" className="border-primary text-primary" onClick={() => setOpenKelengkapan(true)}><Plus className="h-4 w-4" /> Tambah</Button></CardHeader><CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">{checklist.map((item, index) => <div key={`${item.name}-${index}`} className="flex min-h-7 items-center gap-2"><Checkbox checked={item.checked} onCheckedChange={(checked) => setChecklist((items) => items.map((x, i) => i === index ? { ...x, checked: Boolean(checked) } : x))} /><span className="w-28 shrink-0 break-words text-sm">{item.name}</span>{item.checked && <Input value={item.conditionNote || ''} onChange={(e) => setChecklist((items) => items.map((x, i) => i === index ? { ...x, conditionNote: e.target.value } : x))} placeholder="Kondisi..." className="h-7 text-xs" />} {!item.checkpointId && <button type="button" onClick={() => setChecklist((items) => items.filter((_, i) => i !== index))}><X className="h-4 w-4 text-red-500" /></button>}</div>)}</CardContent></Card>

        <Card><CardHeader className="flex-row items-start justify-between space-y-0 pb-3"><div><CardTitle className="text-sm">Daftar Layanan</CardTitle><p className="text-xs text-muted-foreground">Baris pertama = layanan utama (masuk Kerusakan &amp; faktur service)</p></div><Button variant="outline" size="sm" className="border-primary text-primary" onClick={() => setOpenLayanan(true)}><Plus className="h-4 w-4" /> Tambah</Button></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Layanan</TableHead><TableHead className="w-28">SLA</TableHead><TableHead className="w-44">Estimasi</TableHead><TableHead className="w-32 text-right">Biaya</TableHead><TableHead className="w-20 text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{layananPicked.map((l: any, index) => <TableRow key={l.id}><TableCell><div className="flex items-center gap-2"><Select value={l.id} onValueChange={(id) => setSelectedLayanan((items) => items.map((x) => x === l.id ? id : x))} className="h-8 max-w-xs"><option value={l.id}>{l.name}</option>{(layananList as any[]).filter((x) => !selectedLayanan.includes(x.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>{index === 0 && <Badge variant="outline" className="border-red-200 bg-red-50 text-[10px] text-red-700">UTAMA</Badge>}</div><div className="mt-1 max-w-xs"><TagCombobox value={layananNotes[l.id] || []} onChange={(tags) => setLayananNotes((notes) => ({ ...notes, [l.id]: tags }))} localSuggestions={allTags} suggestRemote={suggestTags} placeholder="Tag: bagian yang rusak..." /></div></TableCell><TableCell><Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{Number(l.slaHours)}h</Badge>{Number((l as any).durationHours || 0) > 0 && <Badge variant="outline" className="ml-1 border-emerald-200 bg-emerald-50 text-emerald-700">Durasi {Number((l as any).durationHours)}h</Badge>}</TableCell><TableCell className="font-mono text-xs">{cumulativeTimes[index] || '—'}</TableCell><TableCell className="text-right"><MoneyInput value={Number(layananCost[l.id] || 0)} onChange={(n) => setLayananCost((costs) => ({ ...costs, [l.id]: n }))} className="h-8 w-full text-right" /></TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => setSelectedLayanan((items) => items.filter((x) => x !== l.id))}><Trash2 className="h-4 w-4 text-red-500" /></Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>

        <Card><CardHeader className="flex-row items-start justify-between space-y-0 pb-3"><div><CardTitle className="text-sm">Daftar Barang</CardTitle><p className="text-xs text-muted-foreground">Cross-selling — opsional, faktur POS terpisah · stok dikunci saat Receive</p></div><Button variant="outline" size="sm" className="border-primary text-primary" onClick={() => { setBarangWarehouseId(form.warehouseId); setProductDraft(null); setProductSearch(''); setOpenBarang(true); }}><Plus className="h-4 w-4" /> Tambah</Button></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Barang</TableHead><TableHead className="text-right">Harga</TableHead><TableHead className="text-center">Qty</TableHead><TableHead>Garansi (hari)</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{partsRows.map((row) => <TableRow key={row.id}><TableCell><div>{row.productName}</div>{row.available != null ? <div className="text-xs text-green-700">● Stok {row.warehouseName || 'Gudang'}: {row.available} — tersedia</div> : <div className="text-xs text-amber-700">⚠ Stok belum dicek untuk gudang ini — hapus &amp; pilih ulang</div>}</TableCell><TableCell className="text-right font-semibold">{formatCurrency(row.price)}</TableCell><TableCell className="text-center"><Input type="number" min={1} value={row.quantity} onChange={(e) => updateRow(rows.indexOf(row), { quantity: Math.max(1, Number(e.target.value)) })} className="mx-auto h-8 w-16 text-center" /></TableCell><TableCell><Input type="number" min={0} value={row.warrantyDays || ''} onChange={(e) => updateRow(rows.indexOf(row), { warrantyDays: Math.max(0, Number(e.target.value)) })} className="h-8 w-20" /></TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => setRows((items) => items.filter((x) => x.id !== row.id))}><Trash2 className="h-4 w-4 text-red-500" /></Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>

        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Ringkasan Biaya</CardTitle><p className="text-xs text-muted-foreground">Auto dari layanan &amp; barang — Estimasi tetap bisa diubah</p></CardHeader><CardContent><div><Label><span className="text-red-500">*</span> Teknisi</Label><Select value={form.technicianId} onValueChange={(technicianId) => setF({ technicianId })} className="mt-1 max-w-md"><option value="">{form.outlet ? 'Pilih Teknisi' : 'Pilih Outlet terlebih dahulu'}</option>{technicians.map((t: any) => <option key={t.id} value={t.id}>{t.fullName || t.email}</option>)}</Select></div><Separator className="my-4" /><div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><div className="space-y-2 text-sm">{layananPicked.map((l: any) => <div key={l.id} className="flex justify-between border-b border-dashed pb-2"><span>Layanan · {l.name}</span><span>{formatCurrency(Number(layananCost[l.id] || 0))}</span></div>)}<div className="flex justify-between font-semibold"><span>Total Layanan</span><span>{formatCurrency(layananTotal)}</span></div>{partsRows.map((r) => <div key={r.id} className="flex justify-between border-b border-dashed pb-2"><span>Barang · {r.productName} ×{r.quantity}</span><span>{formatCurrency(r.total)}</span></div>)}</div><div className="space-y-3"><div><Label>Estimasi Biaya <span className="text-muted-foreground">(bisa diubah, min. total)</span></Label><MoneyInput value={estimasiManual ? Number(estimasiValue || 0) : estimatedAuto} onChange={(n) => { setEstimasiManual(true); setEstimasiValue(n ? String(n) : ''); }} className="mt-1 bg-red-50 text-right" /><p className="mt-1 text-xs text-muted-foreground">Min. total layanan + barang: {formatCurrency(estimatedAuto)}</p></div><div><Label>Uang Muka</Label><MoneyInput value={Number(form.downPayment || 0)} onChange={(n) => setF({ downPayment: n ? String(n) : '' })} className="mt-1 text-right" /></div><div className="flex justify-between border-t pt-3 text-base font-bold text-red-600"><span>Sisa (Estimasi − UM)</span><span>{formatCurrency(remaining)}</span></div></div></div></CardContent></Card>

        <Card><CardContent className="p-4"><Label>Catatan Internal (tidak tampil pada nota)</Label><Textarea value={form.internalNotes} onChange={(e) => setF({ internalNotes: e.target.value })} placeholder="Catatan internal teknisi: ..." className="mt-2 min-h-14" /></CardContent></Card>
      </div>

      <div className="shrink-0 bg-primary px-4 py-2 text-xs text-primary-foreground"><div className="flex items-center gap-6"><span><strong>F2</strong> = Simpan</span><span><strong>F3</strong> = Simpan Sementara</span><span><strong>F5</strong> = Refresh</span><div className="ml-auto opacity-80">IGD Ponsel - Smart Repair</div></div></div>

      <Dialog open={openCustomer} onOpenChange={setOpenCustomer}><DialogContent><DialogHeader><DialogTitle>Tambah Pelanggan</DialogTitle></DialogHeader><div className="space-y-3"><div><Label><span className="text-red-500">*</span> Nama</Label><Input value={quickCustomer.name} onChange={(e) => setQuickCustomer({ ...quickCustomer, name: e.target.value })} className="mt-1" /></div><div><Label><span className="text-red-500">*</span> No. HP</Label><Input value={quickCustomer.phone} onChange={(e) => setQuickCustomer({ ...quickCustomer, phone: e.target.value })} className="mt-1" /><p className="mt-1 text-xs text-muted-foreground">Format: 08… atau +62…</p></div><div><Label>Kecamatan</Label><Select value={quickCustomer.subdistrict} onValueChange={(subdistrict) => setQuickCustomer({ ...quickCustomer, subdistrict })} className="mt-1"><option value="">Pilih Kecamatan</option>{quickCustomer.subdistrict && !(kecamatanJember as string[]).includes(quickCustomer.subdistrict) && <option value={quickCustomer.subdistrict}>{quickCustomer.subdistrict}</option>}{(kecamatanJember as string[]).map((kec) => <option key={kec} value={kec}>{kec}</option>)}</Select></div></div><DialogFooter><Button variant="outline" onClick={() => setOpenCustomer(false)}>Batal</Button><Button onClick={createCustomer}>Simpan &amp; Pilih</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={openKelengkapan} onOpenChange={setOpenKelengkapan}><DialogContent><DialogHeader><DialogTitle>Tambah Kelengkapan</DialogTitle></DialogHeader><div className="space-y-3"><div><Label><span className="text-red-500">*</span> Nama kelengkapan</Label><Input value={newCompleteness.name} onChange={(e) => setNewCompleteness({ ...newCompleteness, name: e.target.value })} placeholder="Mis. Anti gores" className="mt-1" /></div><div><Label>Kondisi awal</Label><Input value={newCompleteness.conditionNote} onChange={(e) => setNewCompleteness({ ...newCompleteness, conditionNote: e.target.value })} className="mt-1" /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpenKelengkapan(false)}>Batal</Button><Button onClick={addCompleteness}>Simpan</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={openLayanan} onOpenChange={setOpenLayanan}><DialogContent><DialogHeader><DialogTitle>Tambah Layanan</DialogTitle></DialogHeader><div className="space-y-3"><div><Label><span className="text-red-500">*</span> Layanan</Label><Select value={newLayanan} onValueChange={setNewLayanan} className="mt-1"><option value="">Pilih layanan</option>{(layananList as any[]).filter((l) => !selectedLayanan.includes(l.id)).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></div><div><Label><span className="text-red-500">*</span> Biaya (Rp)</Label><MoneyInput value={Number(newLayananCost || 0)} onChange={(n) => setNewLayananCost(n ? String(n) : '')} className="mt-1" /></div><div><Label>Tag / mapping kerusakan</Label><div className="mt-1"><TagCombobox value={newLayananTags} onChange={setNewLayananTags} localSuggestions={allTags.filter((t) => !newLayananTags.includes(t))} suggestRemote={suggestTags} placeholder="Mis. Lcd, Bootloop..." /></div></div>{newLayanan && <div className="flex items-center gap-2 rounded-md border bg-muted p-2 text-xs"><Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{Number((layananList as any[]).find((l) => l.id === newLayanan)?.slaHours || 0)}h</Badge>{Number((layananList as any[]).find((l) => l.id === newLayanan)?.durationHours || 0) > 0 && <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Durasi {Number((layananList as any[]).find((l) => l.id === newLayanan)?.durationHours)}h</Badge>} Estimasi selesai mengikuti total antrian SLA.</div>}</div><DialogFooter><Button variant="outline" onClick={() => setOpenLayanan(false)}>Batal</Button><Button onClick={addLayanan}>Tambah</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={openBarang} onOpenChange={setOpenBarang}><DialogContent><DialogHeader><DialogTitle>Tambah Barang</DialogTitle></DialogHeader><div className="space-y-3"><div><Label><span className="text-red-500">*</span> Gudang sumber</Label><Select value={barangWarehouseId} onValueChange={(id) => { setBarangWarehouseId(id); setProductDraft(null); setProductSearch(''); }} disabled={!form.outlet} className="mt-1"><option value="">{form.outlet ? 'Pilih Gudang' : 'Pilih Outlet dulu di form utama'}</option>{(warehouses as any[]).map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></div><div className="relative"><Label>Cari produk</Label><Input value={productSearch} onChange={(e) => { setProductSearch(e.target.value); setProductDraft(null); }} className="mt-1" /><Search className="absolute right-3 top-8 h-4 w-4 text-muted-foreground" />{productResults.length > 0 && !productDraft && <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-md border bg-white shadow">{productResults.map((p: any) => <button key={p.id} type="button" className="block w-full border-b px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => selectProduct(p)}>{p.name} · {formatCurrency(Number(p.sellingPrice || 0))}</button>)}</div>}</div>{productDraft && <><div className="rounded-md border bg-muted p-2 text-sm">{productDraft.name}<span className="float-right text-green-700">Stok: {productDraft.available ?? '—'}</span></div><div className="grid grid-cols-3 gap-3"><div><Label>Harga</Label><Input value={formatCurrency(Number(productDraft.sellingPrice || 0))} readOnly className="mt-1" /></div><div><Label>Qty</Label><Input inputMode="numeric" value={productDraftQty || ''} placeholder="1" onChange={(e) => setProductDraftQty(Number(e.target.value.replace(/\D/g, '')) || 0)} className="mt-1" /></div><div><Label>Garansi</Label><Input inputMode="numeric" value={productDraftWarranty || ''} placeholder="0" onChange={(e) => setProductDraftWarranty(Number(e.target.value.replace(/\D/g, '')) || 0)} className="mt-1" /></div></div><div className="flex justify-end border-t pt-3 text-sm">Subtotal: <b className="ml-2">{formatCurrency(Number(productDraft.sellingPrice || 0) * productDraftQty)}</b></div></>}</div><DialogFooter><Button variant="outline" onClick={() => setOpenBarang(false)}>Batal</Button><Button onClick={addProduct} disabled={!productDraft}>Tambah</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
