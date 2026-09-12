import { useCallback, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Circle,
  Clock,
  User as UserIcon,
  Info,
  Printer,
  Trash2,
  Pencil,
  Package,
  Wrench,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { BreadcrumbHeader } from '@/components/shared';
import TagCombobox from '@/components/services/TagCombobox';
import PatternPad from '@/components/services/PatternPad';
import QcModal from '@/components/services/QcModal';
import { LOCK_TYPE_LABELS } from '@/components/services/LockModal';
import { serviceOrdersService } from '@/services/service-orders.service';
import { formatCurrency } from '@/utils/format';

// ─── Status vocabulary (IGDERP-168: proposal B + Cancel) ────────────────────
const STATUS_LABELS: Record<string, string> = {
  pending: 'Receive',
  diagnosed: 'Diagnose',
  'in-progress': 'In Progress',
  qc: 'QC',
  ready: 'Ready',
  done: 'Done',
  cancelled: 'Cancel',
};

const STATUS_PILL: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  diagnosed: 'bg-blue-100 text-blue-800 border-blue-200',
  'in-progress': 'bg-blue-100 text-blue-800 border-blue-200',
  qc: 'bg-amber-100 text-amber-800 border-amber-200',
  ready: 'bg-blue-100 text-blue-800 border-blue-200',
  done: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

const SR_FLOW = ['pending', 'diagnosed', 'in-progress', 'qc', 'ready', 'done'] as const;
const SR_NEXT_LABEL: Record<string, string> = {
  diagnosed: 'Tandai Diagnose',
  'in-progress': 'Mulai Pengerjaan',
  qc: 'Mulai QC',
};

const formatDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const formatTime = (d?: string | null) =>
  d ? new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
const formatSLA = (hours: number) => `${Number(hours)}h`;

const compact = (v?: string | number | null) =>
  v !== undefined && v !== null && v !== '' ? Number(v).toLocaleString('id-ID') : '—';

function StatusIcon({ done, current }: { done: boolean; current: boolean }) {
  if (done) return <CheckCircle2 className="w-6 h-6 text-green-500" />;
  if (current) return <Clock className="w-6 h-6 text-blue-500 animate-pulse" />;
  return <Circle className="w-6 h-6 text-gray-300" />;
}

export default function SmartRepairDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [openCancel, setOpenCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [openTeknisi, setOpenTeknisi] = useState(false);
  const [techId, setTechId] = useState('');
  const [openWaktu, setOpenWaktu] = useState(false);
  const [openTambahLayanan, setOpenTambahLayanan] = useState(false);
  const [layananModalPick, setLayananModalPick] = useState('');
  const [layananModalTags, setLayananModalTags] = useState<string[]>([]);
  const [waktuLayanan, setWaktuLayanan] = useState('');
  const [waktuAlasan, setWaktuAlasan] = useState('');
  const [waktuEstimasi, setWaktuEstimasi] = useState('');
  const [openBarang, setOpenBarang] = useState(false);
  const [barangSearch, setBarangSearch] = useState('');
  const [barangRows, setBarangRows] = useState<any[]>([]);
  const [openBayar, setOpenBayar] = useState(false);
  // IGDERP-168: QC popup state
  const [openQc, setOpenQc] = useState(false);
  // IGDERP-185: lock viewer state (reveal gated server-side, audit logged)
  const [openLockView, setOpenLockView] = useState(false);
  const [lockReveal, setLockReveal] = useState<{ lockType: string; value: string | null } | null>(null);
  const [showLockValue, setShowLockValue] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const [bayarAmount, setBayarAmount] = useState('');
  const [bayarMethod, setBayarMethod] = useState('cash');
  const [bayarRef, setBayarRef] = useState('');

  const { data: order, isLoading } = useQuery({
    queryKey: ['service-order', id],
    queryFn: () => serviceOrdersService.getById(id!),
    enabled: !!id,
  });

  // IGDERP-185: open viewer + fetch decrypted credential (audit line appears in timeline)
  const openLockViewer = () => {
    setLockReveal(null);
    setShowLockValue(false);
    setOpenLockView(true);
  };
  const handleRevealLock = async () => {
    setLockLoading(true);
    try {
      const res = await serviceOrdersService.revealLock(id!);
      setLockReveal(res);
      setShowLockValue(true);
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Tidak dapat membuka kunci');
    } finally {
      setLockLoading(false);
    }
  };
  const lockNodes: number[] =
    lockReveal && lockReveal.lockType === 'pattern' && lockReveal.value
      ? lockReveal.value
          .replace(/^pattern:/, '')
          .split('-')
          .map(Number)
          .filter((n) => Number.isInteger(n) && n >= 0 && n <= 8)
      : [];

  const authHeader = useCallback(
    () => ({ Authorization: 'Bearer ' + localStorage.getItem('access_token') }),
    [],
  );
  const fetchList = useCallback(
    async (path: string) => {
      const res = await fetch(path, { headers: authHeader() });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.data || [];
    },
    [authHeader],
  );

  const { data: technicians = [] } = useQuery({
    queryKey: ['sr-technicians', order?.branchId || 'all'],
    queryFn: () =>
      fetchList(
        `/api/v1/users/technicians?branchId=${encodeURIComponent(order?.branchId || '')}`,
      ),
    enabled: !!order,
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ['sr-service-types'],
    queryFn: () => fetchList('/api/v1/service-types'),
    enabled: openWaktu || openTambahLayanan,
  });

  // IGDERP-136 fix round: saran tag server (UpperFirst, cap 5) untuk modal tambah layanan
  const suggestTags = useCallback(
    async (qq: string) => {
      const rows = await fetchList('/api/v1/service-orders/tags/suggest?q=' + encodeURIComponent(qq) + '&take=5');
      return (rows as any[]).map((r) => String(r.name || '')).filter(Boolean);
    },
    [fetchList],
  );

  const { data: posFaktur = null } = useQuery({
    queryKey: ['sr-pos-faktur', id],
    queryFn: async () => {
      const list = await fetchList(`/api/v1/sales/transactions?serviceOrderId=${id}`);
      return (list as any[])[0] || null;
    },
    enabled: !!id && !!order,
  });

  const { data: barangResults = [] } = useQuery({
    queryKey: ['sr-barang-search', barangSearch],
    queryFn: () =>
      fetchList(`/api/v1/pos/products?q=${encodeURIComponent(barangSearch)}&limit=10`),
    enabled: openBarang && barangSearch.length >= 2,
  });

  // IGDERP-136 fix round: daftar gudang outlet utk pilihan gudang per-baris barang
  const { data: detailWarehouses = [] } = useQuery({
    queryKey: ['sr-detail-warehouses', order?.branchId || ''],
    queryFn: () => fetchList(`/api/v1/pos/warehouses?outletId=${encodeURIComponent(order?.branchId || '')}`),
    enabled: openBarang && Boolean(order?.branchId),
  });

  const statusMutation = useMutation({
    mutationFn: (payload: { status: string; notes?: string }) =>
      serviceOrdersService.updateStatus(id!, payload),
    onSuccess: (_res, variables) => {
      toast.success(`Status berhasil diubah ke ${STATUS_LABELS[variables.status] || variables.status}`);
      setOpenCancel(false);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal mengubah status'),
  });

  const teknisiMutation = useMutation({
    mutationFn: (technicianId: string) => serviceOrdersService.assignTechnician(id!, { technicianId }),
    onSuccess: () => {
      toast.success('Teknisi berhasil diubah');
      setOpenTeknisi(false);
      setTechId('');
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal mengubah teknisi'),
  });

  const addTimeMutation = useMutation({
    mutationFn: (payload: {
      serviceTypeId?: string;
      notes: string;
      newEstimatedAt: string;
    }) => serviceOrdersService.addTime(id!, payload),
    onSuccess: () => {
      toast.success('Waktu berhasil ditambahkan');
      setOpenWaktu(false);
      setWaktuAlasan('');
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal tambah waktu'),
  });

  const addPartsMutation = useMutation({
    mutationFn: (payload: { parts: any[] }) => serviceOrdersService.addParts(id!, payload),
    onSuccess: () => {
      toast.success('Barang berhasil ditambahkan');
      setOpenBarang(false);
      setBarangRows([]);
      setBarangSearch('');
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal tambah barang'),
  });

  const addLayananMutation = useMutation({
    mutationFn: (payload: { serviceTypeId: string; notes?: string }) =>
      serviceOrdersService.addLayanan(id!, payload),
    onSuccess: () => {
      toast.success('Layanan berhasil ditambahkan');
      setOpenTambahLayanan(false);
      setLayananModalPick('');
      setLayananModalTags([]);
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal tambah layanan'),
  });

  const removeLayananMutation = useMutation({
    mutationFn: (rowId: string) => serviceOrdersService.removeLayanan(id!, rowId),
    onSuccess: () => {
      toast.success('Layanan dihapus — tercatat di timeline');
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal hapus layanan'),
  });

  // IGDERP-137: final tag mapping per row — Ready only
  const [editingTags, setEditingTags] = useState<{ id: string; tags: string[] } | null>(null);
  const tagsMutation = useMutation({
    mutationFn: ({ rowId, notes }: { rowId: string; notes: string }) =>
      serviceOrdersService.updateLayanan(id!, rowId, { notes }),
    onSuccess: () => {
      toast.success('Tag final tersimpan — tercatat di timeline');
      setEditingTags(null);
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal simpan tag'),
  });

  const removePartMutation = useMutation({
    mutationFn: (partId: string) => serviceOrdersService.removePart(id!, partId),
    onSuccess: () => {
      toast.success('Barang dihapus — stok dikembalikan ke gudang sumber');
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal hapus barang'),
  });

  const paymentMutation = useMutation({
    mutationFn: (payload: { paymentMethod: 'cash' | 'transfer' | 'qris'; amount: number; reference?: string }) =>
      serviceOrdersService.processPayment(id!, payload),
    onSuccess: async () => {
      toast.success('Pembayaran tercatat');
      setOpenBayar(false); setBayarAmount(''); setBayarRef('');
      await queryClient.invalidateQueries({ queryKey: ['service-order', id] });
      await queryClient.invalidateQueries({ queryKey: ['sr-pos-faktur', id] });
      // IGDERP-171: faktur opens in a new tab (service + POS when cross-sold)
      try {
        const list = await fetchList(`/api/v1/sales/transactions?serviceOrderId=${id}`);
        const posId = (list as any[])[0]?.id;
        window.open(`/service-orders/${id}/print?type=invoice${posId ? `&pos=${posId}` : ''}`, '_blank');
      } catch {
        // popup blocked — user can still print from the faktur banner
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal mencatat pembayaran'),
  });

  // IGDERP-171: void mistaken payment (approver role asserted server-side)
  const [openVoid, setOpenVoid] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const voidMutation = useMutation({
    mutationFn: (reason: string) => serviceOrdersService.voidPayment(id!, { reason }),
    onSuccess: () => {
      toast.success('Pembayaran di-void — order kembali ke Ready');
      setOpenVoid(false); setVoidReason('');
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
      queryClient.invalidateQueries({ queryKey: ['sr-pos-faktur', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal void pembayaran'),
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: ({ files, photoType }: { files: File[]; photoType: string }) =>
      serviceOrdersService.uploadPhotoFiles(id!, files, photoType),
    onSuccess: (_res, vars) => {
      toast.success(`Foto ${vars.photoType} terunggah`);
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal mengunggah foto'),
  });

  if (isLoading) return <div className="p-10 text-center text-gray-500">Memuat…</div>;
  if (!order) return <div className="p-10 text-center text-gray-500">Service order tidak ditemukan</div>;

  const status = String(order.status || 'pending').toLowerCase();
  const history: any[] = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  // IGDERP-136 detail round: JANGAN collapse per status — semua entri tampil (Tambah Waktu ×2 dsb.)
  const historyByStage = new Map<string, any[]>();
  history.forEach((h) => {
    const k = String(h.status).toLowerCase();
    if (!historyByStage.has(k)) historyByStage.set(k, []);
    historyByStage.get(k)!.push(h);
  });
  const isCancelled = status === 'cancelled';
  const currentIndex = SR_FLOW.indexOf(status as any);

  const partRows: any[] = Array.isArray(order.partsUsed) ? order.partsUsed : [];
  const subtotalParts = partRows.reduce((sum, p) => sum + Number(p.totalPrice || 0), 0);
  const totalFee = Number(order.finalPrice ?? order.estimatedCost ?? 0) || 0;
  const paidSoFar = Number(order.downPayment || 0);
  const sisaBayar = Math.max(0, totalFee - paidSoFar);
  const isPaid = String(order.paymentStatus || '').toLowerCase() === 'paid' || (totalFee > 0 && sisaBayar <= 0);
  const frozen = ['done', 'cancelled'].includes(status);
  // IGDERP-136 detail round: estimasi antrian per baris (received + ΣSLA s.d. baris itu)
  const receivedBase = order.receivedDate || order.createdAt;
  const layananEta: string[] = (() => {
    if (!receivedBase || !(order.layanan || []).length) return [];
    let acc = new Date(receivedBase).getTime();
    return (order.layanan as any[]).map((l) => {
      acc += Number(l.slaHours || 0) * 3600 * 1000;
      const d = new Date(acc);
      return `${formatDateTime(d.toISOString())} ${formatTime(d.toISOString())}`;
    });
  })();
  // Past-due = order-level, dari Estimasi Selesai yang sama dengan yang tampil (slaDue || promised)
  const dueDate = order.slaDueDate || order.promisedDate;
  const isOverdue = !frozen && !!dueDate && new Date(dueDate).getTime() < Date.now();
  // IGDERP-184: remaining/active warranty display (checkbox removed from intake)
  const warrantyInfo: { label: string; sub: string } = (() => {
    const days = Number((order as any).warrantyDays ?? 0);
    const expiry = (order as any).warrantyExpiryDate ? new Date((order as any).warrantyExpiryDate).getTime() : 0;
    if (expiry) {
      const left = Math.ceil((expiry - Date.now()) / 86400000);
      return left > 0 ? { label: `Sisa ${left} hari`, sub: 'masa garansi berjalan' } : { label: 'Kadaluarsa', sub: 'masa garansi habis' };
    }
    return days > 0 ? { label: `${days} hari`, sub: 'aktif sejak serah terima' } : { label: '—', sub: '' };
  })();
  const waNumber = (() => {
    const digits = String(order.customerPhone || '').replace(/\D/g, '');
    if (digits.startsWith('0')) return '62' + digits.slice(1);
    return digits;
  })();
  const waLink = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`Halo ${order.customerName || ''}, info service ${order.serviceNumber || ''} (${STATUS_LABELS[status] || status})`)}` : '';
  // IGDERP-171: digital faktur via click-to-open WA (never auto-send)
  const waFakturLink = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`Faktur Service ${order.serviceNumber || ''} — Total ${formatCurrency(totalFee)} — LUNAS. Terima kasih!`)}`
    : '';

  const handleCancel = () => {
    if (!cancelReason.trim()) {
      toast.error('Alasan pembatalan wajib diisi');
      return;
    }
    statusMutation.mutate({ status: 'cancelled', notes: cancelReason.trim() });
  };

  const openTeknisiModal = () => {
    setTechId(order.assignedTechnician?.id || '');
    setOpenTeknisi(true);
  };

  return (
    <div className="w-full space-y-3 p-4">
      {/* Header — flat, no action buttons */}
      <BreadcrumbHeader title={order.serviceNumber || 'Service Order'} subtitle="Detail Service Order">
        <Button variant="ghost" size="sm" onClick={() => navigate('/services/smart-repair')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
      </BreadcrumbHeader>

      {/* ─── Section A1: Informasi Service ─── */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Informasi Service</h2>
          </div>
          <Badge
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border ${STATUS_PILL[status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}
          >
            <Clock className="w-4 h-4" />
            <span className="uppercase">{STATUS_LABELS[status] || status}</span>
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-4 mb-1">
            <Label className="text-sm text-gray-500">Keluhan</Label>
            <p className="text-sm">{order.complaint || '—'}</p>
          </div>
          <div>
            <Label className="text-sm text-gray-500">Estimasi Biaya</Label>
            <p className="font-bold text-lg">{formatCurrency(totalFee)}</p>
            <p className="text-xs text-gray-500">
              {paidSoFar > 0 ? `Uang muka ${formatCurrency(paidSoFar)} · ` : ''}Sisa {formatCurrency(sisaBayar)}
              {isPaid ? ' · Lunas' : ''}
            </p>
          </div>
          <div>
            <Label className="text-sm text-gray-500">Tanggal Masuk</Label>
            <p className="font-bold text-lg">{formatDateTime(order.receivedDate || order.createdAt)}</p>
            <p className="text-xs text-gray-500">{formatTime(order.receivedDate || order.createdAt)}</p>
          </div>
          <div>
            <Label className="text-sm text-gray-500">Estimasi Selesai</Label>
            <p className={`font-semibold ${isOverdue ? 'text-red-600' : ''}`}>
              {order.slaDueDate ? formatDateTime(order.slaDueDate) : formatDateTime(order.promisedDate)}
              {isOverdue ? ' · Terlambat' : ''}
            </p>
            <p className="text-xs text-gray-500">{order.slaDueDate ? formatTime(order.slaDueDate) : ''}</p>
          </div>
          <div>
            <Label className="text-sm text-gray-500">Teknisi</Label>
            <p className="font-semibold">{order.assignedTechnician?.fullName || 'Belum di-assign'}</p>
          </div>
          <div>
            <Label className="text-sm text-gray-500">Garansi</Label>
            <p className="font-semibold">{warrantyInfo.label}</p>
            {warrantyInfo.sub ? <p className="text-xs text-gray-500">{warrantyInfo.sub}</p> : null}
          </div>
          <div>
            <Label className="text-sm text-gray-500">Outlet</Label>
            <p className="font-semibold">{order.branch?.name || '—'}</p>
          </div>
          <div>
            <Label className="text-sm text-gray-500">Gudang Service</Label>
            <p className="font-semibold">{(order as any).warehouse?.name || '—'}</p>
          </div>
        </div>
      </div>

      {/* ─── Section A2: Customer + Perangkat ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
              <UserIcon className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Informasi Customer</h2>
          </div>
          <div className="flex gap-6 flex-wrap">
            <div>
              <Label className="text-sm text-gray-500">Nama</Label>
              <p className="font-semibold">{order.customerName}</p>
            </div>
            <div>
              <Label className="text-sm text-gray-500">No. HP</Label>
              <p className="font-semibold text-primary-600">{order.customerPhone}</p>
            </div>
            {order.customerSubdistrict && (
              <div>
                <Label className="text-sm text-gray-500">Kecamatan</Label>
                <p className="font-semibold">{order.customerSubdistrict}</p>
              </div>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Informasi Perangkat</h2>
          </div>
          <div className="flex gap-6 flex-wrap">
            <div>
              <Label className="text-sm text-gray-500">Jenis</Label>
              <p className="font-semibold capitalize">{order.deviceType || '—'}</p>
            </div>
            <div>
              <Label className="text-sm text-gray-500">Unit</Label>
              <p className="font-semibold">{order.deviceUnit || '—'}</p>
            </div>
            <div>
              <Label className="text-sm text-gray-500">Serial</Label>
              <p className="font-semibold font-mono text-sm">{order.deviceSerial || '—'}</p>
            </div>
            <div>
              <Label className="text-sm text-gray-500">Kunci layar</Label>
              {(order as any).deviceLockType && (order as any).deviceLockType !== 'none' ? (
                <p className="flex items-center gap-2">
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    Ada ({(LOCK_TYPE_LABELS as any)[(order as any).deviceLockType] || (order as any).deviceLockType})
                  </Badge>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={openLockViewer}>
                    Lihat
                  </Button>
                </p>
              ) : (
                <p className="font-semibold text-gray-400">Tidak ada</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Section A2b: Kelengkapan ─── */}
      {Array.isArray((order as any).completenessItems) && (order as any).completenessItems.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Kelengkapan</h2>
            <span className="text-sm text-gray-500">({(order as any).completenessItems.filter((x: any) => x.checked).length}/{(order as any).completenessItems.length} ada)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(order as any).completenessItems.map((item: any, i: number) => (
              <div key={`${item.name}-${i}`} className="flex items-center gap-2 text-sm">
                {item.checked ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <Circle className="w-4 h-4 text-gray-300 shrink-0" />}
                <span className={item.checked ? 'font-medium' : 'text-gray-400'}>{item.name}</span>
                {item.checked && item.conditionNote && <span className="text-xs text-gray-500">· {item.conditionNote}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Section A3: Layanan & Barang ─── */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg">
            <Info className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Layanan & Barang</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-sm font-bold text-gray-700">Layanan</div>
            <div className="p-2">
              {(order.layanan || []).length > 0 ? (
                <div>
                  {(order.layanan as any[]).map((l, li) => (
                    <div
                      key={l.id}
                      className="border-b border-dashed border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-center gap-2 px-2 py-2">
                        <span className="font-semibold text-sm flex-1">{l.name}{(l.notes ? String(l.notes).split(',').map((t) => t.trim()).filter(Boolean) : []).map((t) => <span key={t} className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-normal text-amber-800">🏷 {t}</span>)}</span>
                        <span className="text-xs text-gray-600 font-mono whitespace-nowrap">
                          SLA {formatSLA(Number(l.slaHours))}
                        </span>
                        {layananEta[li] && (
                          <span className={`text-xs whitespace-nowrap ${isOverdue && !frozen ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                            ETA {layananEta[li]}
                          </span>
                        )}
                        <span className="text-xs text-gray-600 whitespace-nowrap">
                          {formatCurrency(Number(l.estimatedCost || 0))}
                        </span>
                        {status === 'ready' && !isCancelled && (
                          <button
                            type="button"
                            title="Edit tag final"
                            onClick={() => setEditingTags({ id: l.id, tags: String(l.notes || '').split(',').map((t: string) => t.trim()).filter(Boolean) })}
                          >
                            <Pencil className="h-4 w-4 text-amber-600" />
                          </button>
                        )}
                        {status === 'in-progress' && !isCancelled && (order.layanan as any[]).length > 1 && (
                          <button
                            type="button"
                            title="Hapus layanan"
                            onClick={() => { if (window.confirm(`Hapus layanan ${l.name}? Tercatat di timeline.`)) removeLayananMutation.mutate(l.id); }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </button>
                        )}
                      </div>
                      {/* IGDERP-137: final tag editor — Ready only */}
                      {editingTags && editingTags.id === l.id && (
                        <div className="px-2 pb-2">
                          <TagCombobox value={editingTags.tags} onChange={(tags) => setEditingTags({ id: l.id, tags })} localSuggestions={[]} suggestRemote={suggestTags} placeholder="Tag final: Lcd, Baterai..." />
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" disabled={tagsMutation.isPending} onClick={() => tagsMutation.mutate({ rowId: l.id, notes: editingTags.tags.join(', ') })}>Simpan tag final</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingTags(null)}>Batal</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-end gap-2 px-2 py-2 border-t border-gray-100 text-sm">
                    <span className="text-gray-500 font-semibold">Total Layanan:</span>
                    <span className="font-extrabold text-primary-600">
                      {formatCurrency(
                        (order.layanan as any[]).reduce((s, l) => s + Number(l.estimatedCost || 0), 0),
                      )}
                    </span>
                  </div>
                  {status === 'in-progress' && !isCancelled && (
                    <div className="mt-2 border-t border-dashed border-gray-200 pt-2">
                      <p className="px-2 text-xs text-gray-400">Tambah layanan via menu Aksi Status.</p>
                    </div>
                  )}
                </div>
              ) : order.serviceType ? (
                <div className="flex items-center gap-2 px-2 py-2 border-b border-dashed border-gray-100">
                  <span className="font-semibold text-sm flex-1">{order.serviceType.name}</span>
                  <span className="text-xs text-gray-600 font-mono">SLA {formatSLA(Number(order.serviceType.slaHours))}</span>
                </div>
              ) : (
                <div className="p-2 text-sm text-gray-500">Belum ada layanan</div>
              )}
            </div>
          </div>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-sm font-bold text-gray-700">
              Barang — faktur POS (No Service)
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-gray-500 bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-3 py-2 font-semibold">Barang</th>
                  <th className="text-left px-2 py-2 font-semibold">Gudang</th>
                  <th className="text-center px-2 py-2 font-semibold w-12">Qty</th>
                  <th className="text-right px-2 py-2 font-semibold w-24">Harga</th>
                  <th className="text-center px-2 py-2 font-semibold w-20">Garansi</th>
                  <th className="text-right px-2 py-2 font-semibold w-24">Subtotal</th>
                  {!frozen && <th className="w-10"></th>}
                </tr>
              </thead>
              <tbody>
                {partRows.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="px-3 py-2">
                      <p className="font-semibold">{p.product?.name || '—'}</p>
                    </td>
                    <td className="px-2 py-2">
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700 whitespace-nowrap">{p.warehouse?.name || '—'}</span>
                    </td>
                    <td className="text-center py-2">{Number(p.quantity)}</td>
                    <td className="text-right py-2">{compact(p.unitPrice)}</td>
                    <td className="text-center py-2 text-gray-600">
                      {p.warrantyDays ? `${Number(p.warrantyDays)} hari` : '—'}
                    </td>
                    <td className="text-right py-2 font-semibold">{compact(p.totalPrice)}</td>
                    {!frozen && (
                      <td className="text-center py-2">
                        <button
                          type="button"
                          title="Hapus barang (stok kembali ke gudang sumber)"
                          onClick={() => { if (window.confirm(`Hapus ${p.product?.name || 'barang'}? Stok dikembalikan ke ${p.warehouse?.name || 'gudang sumber'} dan tercatat di timeline.`)) removePartMutation.mutate(p.id); }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {partRows.length === 0 && (
                  <tr>
                    <td colSpan={!frozen ? 7 : 6} className="px-3 py-4 text-center text-gray-400">
                      Belum ada barang
                    </td>
                  </tr>
                )}
              </tbody>
              {partRows.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={!frozen ? 6 : 5} className="px-3 py-2 text-right font-bold">Subtotal:</td>
                    <td className="px-3 py-2 text-right font-extrabold text-primary-600">
                      {formatCurrency(subtotalParts)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
            {posFaktur && (
              <div className="mt-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm">
                <span className="text-gray-600">Faktur POS No Service:</span>
                <Link
                  to={`/sales/transactions/${posFaktur.id}`}
                  className="font-semibold text-green-700 hover:underline"
                >
                  {posFaktur.transactionNumber}
                </Link>
                <span className="text-xs text-gray-500">({posFaktur.paymentStatus})</span>
                <div className="ml-auto flex gap-2">
                  {waFakturLink && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(waFakturLink, '_blank')}
                    >
                      Faktur WA
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      window.open(
                        `/service-orders/${id}/print?type=invoice&pos=${posFaktur.id}`,
                        '_blank',
                      )
                    }
                  >
                    <Printer className="w-4 h-4 mr-1" /> Cetak Faktur (Service + POS)
                  </Button>
                </div>
              </div>
            )}
            {/* IGDERP-171: paid service-only order — faktur actions without POS link */}
            {isPaid && !posFaktur && (
              <div className="mt-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm">
                <span className="text-gray-600">Lunas — faktur siap dibagikan:</span>
                <div className="ml-auto flex gap-2">
                  {waFakturLink && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(waFakturLink, '_blank')}
                    >
                      Faktur WA
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/service-orders/${id}/print?type=invoice`, '_blank')}
                  >
                    <Printer className="w-4 h-4 mr-1" /> Cetak Faktur
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Section A4: Dokumentasi per tahap ─── */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Dokumentasi</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(['intake', 'diagnosis', 'repair', 'completed'] as const).map((stage) => {
            const stagePhotos = ((order as any).photos || []).filter((ph: any) => ph.photoType === stage);
            const canUpload = stage === 'completed' ? !isCancelled : !frozen;
            return (
              <div key={stage} className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-sm font-bold text-gray-700 capitalize flex items-center justify-between">
                  {stage}
                  {canUpload && (
                    <label className="text-xs font-semibold text-primary-600 hover:underline cursor-pointer">
                      + Foto
                      <input
                        type="file" accept="image/*" multiple className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          e.target.value = '';
                          if (files.length > 0) uploadPhotoMutation.mutate({ files, photoType: stage });
                        }}
                      />
                    </label>
                  )}
                </div>
                <div className="p-2 grid grid-cols-3 gap-2">
                  {stagePhotos.length === 0 && <div className="col-span-3 p-2 text-xs text-gray-400">Belum ada foto</div>}
                  {stagePhotos.map((ph: any) => (
                    <a key={ph.id} href={ph.photoUrl} target="_blank" rel="noreferrer" title={ph.description || stage}>
                      <img src={ph.photoUrl} alt={`${stage} photo`} className="h-16 w-full object-cover rounded-md border border-gray-100" loading="lazy" />
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-gray-100 my-1" />

      {/* ─── Section B: Aksi + Timeline ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Aksi Status */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-gray-400" /> Aksi Status
          </p>
          {/* IGDERP-136 bugfix: order batal = semua aksi nonaktif (dropdown disembunyikan) */}
          {!isCancelled && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between border-red-200 text-red-700 bg-red-50 hover:bg-red-100">
                Aksi Status <span className="opacity-70">▾</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              {currentIndex >= 0 && currentIndex < SR_FLOW.length - 1 && !isCancelled && status !== 'qc' && status !== 'ready' && (
                <DropdownMenuItem
                  className="font-semibold"
                  onClick={() => statusMutation.mutate({ status: SR_FLOW[currentIndex + 1] })}
                >
                  {SR_NEXT_LABEL[SR_FLOW[currentIndex + 1]]}
                </DropdownMenuItem>
              )}
              {/* IGDERP-168: QC runs through the popup (checklist + general checkup + note/row) */}
              {status === 'qc' && !isCancelled && (
                <DropdownMenuItem
                  className="font-semibold"
                  onClick={() => setOpenQc(true)}
                >
                  Pemeriksaan QC
                </DropdownMenuItem>
              )}
              {status === 'in-progress' && !isCancelled && (
                <DropdownMenuItem
                  className="font-semibold"
                  onClick={() => {
                    setWaktuEstimasi(
                      order?.promisedDate
                        ? new Date(order.promisedDate).toISOString().slice(0, 16)
                        : '',
                    );
                    setWaktuAlasan('');
                    setWaktuLayanan('');
                    setOpenWaktu(true);
                  }}
                >
                  Tambah Waktu
                </DropdownMenuItem>
              )}
              {(!status || status !== 'in-progress') && (
                <DropdownMenuItem disabled>
                  Tambah Waktu
                </DropdownMenuItem>
              )}
              {status === 'in-progress' && !isCancelled && (
                <DropdownMenuItem
                  className="font-semibold"
                  onClick={() => { setLayananModalPick(''); setLayananModalTags([]); setOpenTambahLayanan(true); }}
                >
                  Tambah Layanan
                </DropdownMenuItem>
              )}
              {(status === 'in-progress' || status === 'ready') && !isCancelled && (
                <DropdownMenuItem
                  className="font-semibold"
                  onClick={() => {
                    setBarangRows([]);
                    setBarangSearch('');
                    setOpenBarang(true);
                  }}
                >
                  Tambah Barang
                </DropdownMenuItem>
              )}
              {(status === 'ready' || status === 'done') && !isCancelled && !isPaid && (
                <DropdownMenuItem
                  className="font-semibold"
                  onClick={() => { setBayarAmount(String(sisaBayar)); setBayarMethod('cash'); setBayarRef(''); setOpenBayar(true); }}
                >
                  Terima Pembayaran {sisaBayar > 0 ? `(${formatCurrency(sisaBayar)})` : ''}
                </DropdownMenuItem>
              )}
              {/* IGDERP-171: void mistaken payment — approver asserted server-side */}
              {status === 'done' && isPaid && !isCancelled && (
                <DropdownMenuItem
                  className="text-red-600 font-semibold"
                  onClick={() => { setVoidReason(''); setOpenVoid(true); }}
                >
                  Void pembayaran
                </DropdownMenuItem>
              )}
              {(!status || (status !== 'in-progress' && status !== 'ready')) && (
                <DropdownMenuItem disabled>
                  Tambah Barang
                </DropdownMenuItem>
              )}
              {/* IGDERP-168: cancel blocked once QC starts */}
              {['pending', 'diagnosed', 'in-progress'].includes(status ?? '') && !isCancelled && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 font-semibold"
                    onClick={() => setOpenCancel(true)}
                  >
                    Batal
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          )}
          <p className="text-xs text-gray-500 mt-4 flex items-center gap-2">
            <Phone className="w-3 h-3" />
            {waLink ? (
              <a href={waLink} target="_blank" rel="noreferrer" className="text-green-700 font-semibold hover:underline">
                {order.customerPhone} (WA)
              </a>
            ) : order.customerPhone}
          </p>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-6">Service Status Timeline</h3>
          <div className="space-y-6">
            {SR_FLOW.map((s, idx) => {
              const entries = historyByStage.get(s) || [];
              const entry = entries[0];
              const done = currentIndex > idx;
              const current = currentIndex === idx && !isCancelled;
              const skipped = currentIndex === -1 && !isCancelled;
              const label = STATUS_LABELS[s];
              return (
                <div key={s} className={`flex gap-4 ${((skipped && idx > 0) || (currentIndex >= 0 && idx > currentIndex)) ? 'opacity-60' : ''}`}>
                  <div className="flex flex-col items-center">
                    <StatusIcon done={done} current={current} />
                    {idx < SR_FLOW.length - 1 && <div className={`w-0.5 flex-1 mt-2 ${done ? 'bg-green-500' : 'bg-gray-200'}`} />}
                  </div>
                  <div className="flex-1 pb-6">
                    <div className={`font-medium ${done ? 'text-green-700' : current ? 'text-blue-700' : 'text-gray-400'}`}>
                      {label}
                    </div>
                    {entry ? (
                      <>
                        <div className="text-sm text-gray-500 mt-1">
                          {formatDateTime(entry.createdAt)}, {formatTime(entry.createdAt)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          <span className="font-semibold">Oleh: </span>
                          {entry.changedByUser?.fullName || entry.changedByUser?.email || '—'}
                          {s === 'in-progress' && status === 'in-progress' && (
                            <>
                              {' '}
                              <button
                                type="button"
                                onClick={openTeknisiModal}
                                className="text-primary-600 font-semibold hover:underline"
                              >
                                Ubah teknisi
                              </button>
                            </>
                          )}
                        </div>
                        {entry.notes && (
                          <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                            <span className="font-semibold">Catatan: </span>
                            {entry.notes}
                          </div>
                        )}
                        {entries.slice(1).map((e: any) => e.notes && (
                          <div key={e.id} className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                            <span className="font-semibold">Catatan: </span>
                            {e.notes}
                            <div className="text-gray-400 mt-1">
                              {formatDateTime(e.createdAt)}, {formatTime(e.createdAt)}
                              {e.changedByUser ? ` · ${e.changedByUser.fullName || e.changedByUser.email}` : ''}
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      !current && (
                        <div className="text-xs text-gray-400 mt-1">
                          {s === 'qc' ? 'Pemeriksaan kualitas — siap diambil bila lolos' : s === 'ready' ? 'Selesai dikerjakan — siap diambil customer' : s === 'done' ? 'Sudah diambil / diserahkan ke customer' : ''}
                        </div>
                      )
                    )}
                    {current && (
                      <div className="text-sm text-blue-600 mt-1 font-medium">Current Status</div>
                    )}
                  </div>
                </div>
              );
            })}
            {isCancelled && (
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <Circle className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-red-700">Cancel</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {formatDateTime(order.cancelledAt)}, {formatTime(order.cancelledAt)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    <span className="font-semibold">Oleh: </span>{historyByStage.get('cancelled')?.[0]?.changedByUser?.fullName || '—'}
                  </div>
                  {historyByStage.get('cancelled')?.[0]?.notes && (
                    <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                      <span className="font-semibold">Catatan: </span>
                      {historyByStage.get('cancelled')?.[0]?.notes}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Batal modal (alasan wajib) ─── */}
      <Dialog open={openCancel} onOpenChange={setOpenCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-700">Batal Service</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-sm text-gray-600">
              Alasan pembatalan <span className="text-red-500">*</span>
            </Label>
            <Textarea
              rows={3}
              placeholder="cth: customer tidak jadi melakukan service"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCancel(false)}>Kembali</Button>
            <Button className="bg-red-600 hover:bg-red-700" disabled={statusMutation.isPending} onClick={handleCancel}>
              Batalkan Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Ubah Teknisi modal ─── */}
      <Dialog open={openTeknisi} onOpenChange={setOpenTeknisi}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Teknisi</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-sm text-gray-600">Teknisi</Label>
            <Select value={techId} onValueChange={setTechId} className="w-full">
              <option value="">Pilih teknisi</option>
              {(technicians as any[]).map((t) => (
                <option key={t.id} value={t.id}>{t.fullName || t.email}</option>
              ))}
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenTeknisi(false)}>Kembali</Button>
            <Button
              disabled={!techId || teknisiMutation.isPending}
              onClick={() => teknisiMutation.mutate(techId)}
            >
              Ubah Teknisi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Tambah Waktu modal (IGDERP-134) ─── */}
      <Dialog open={openWaktu} onOpenChange={setOpenWaktu}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Waktu</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm text-gray-600">Layanan</Label>
              <Select
                value={waktuLayanan}
                onValueChange={setWaktuLayanan}
                className="w-full"
              >
                <option value="">Pilih layanan</option>
                {((order?.layanan?.length
                  ? (order.layanan as any[]).map((l) => ({
                      id: l.serviceTypeId,
                      name: l.name,
                    }))
                  : (serviceTypes as any[]))).map((st: any) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-gray-600">
                Alasan <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={waktuAlasan}
                onChange={(e) => setWaktuAlasan(e.target.value)}
                placeholder="Alasan perpanjangan waktu"
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-gray-600">
                Estimasi Baru <span className="text-red-500">*</span>
              </Label>
              <Input
                type="datetime-local"
                value={waktuEstimasi}
                onChange={(e) => setWaktuEstimasi(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenWaktu(false)}>Batal</Button>
            <Button
              disabled={
                !waktuAlasan.trim() ||
                !waktuEstimasi ||
                addTimeMutation.isPending
              }
              onClick={() =>
                addTimeMutation.mutate({
                  serviceTypeId: waktuLayanan || undefined,
                  notes: waktuAlasan.trim(),
                  newEstimatedAt: new Date(waktuEstimasi).toISOString(),
                })
              }
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Tambah Barang modal (IGDERP-138) ─── */}
      <Dialog open={openBarang} onOpenChange={setOpenBarang}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tambah Barang</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Input
                value={barangSearch}
                onChange={(e) => setBarangSearch(e.target.value)}
                placeholder="Cari produk (nama/barcode)"
              />
              {barangSearch.length >= 2 && barangResults.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                  {(barangResults as any[]).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2"
                      onClick={() => {
                        setBarangRows((rows) => [
                          ...rows,
                          {
                            productId: p.id,
                            name: p.name || 'Produk',
                            quantity: '1',
                            price: String(p.sellingPrice || p.price || 0),
                            warrantyDays: String(p.warrantyDays ?? 90),
                            warehouseId: (order as any)?.warehouseId || '',
                          },
                        ]);
                        setBarangSearch('');
                      }}
                    >
                      <span className="text-sm font-medium">{p.name || p.sku}</span>
                      <span className="text-xs text-gray-500">{formatCurrency(p.sellingPrice || p.price || 0)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {barangRows.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase text-gray-500 bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-3 py-2 font-semibold">Barang</th>
                      <th className="text-left px-2 py-2 font-semibold">Gudang</th>
                      <th className="text-center px-2 py-2 font-semibold w-16">Qty</th>
                      <th className="text-right px-2 py-2 font-semibold w-28">Harga</th>
                      <th className="text-center px-2 py-2 font-semibold w-24">Garansi (hari)</th>
                      <th className="text-right px-2 py-2 font-semibold w-28">Subtotal</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {barangRows.map((r, idx) => (
                      <tr key={idx} className="border-b border-gray-50">
                        <td className="px-3 py-2 font-medium">{r.name}</td>
                        <td className="px-2 py-2">
                          <Select
                            value={r.warehouseId || ''}
                            onChange={(e) =>
                              setBarangRows((rows) =>
                                rows.map((x, i) => (i === idx ? { ...x, warehouseId: e.target.value } : x)),
                              )
                            }
                            className="h-8 text-xs"
                          >
                            <option value="">Pilih Gudang</option>
                            {(detailWarehouses as any[]).map((w: any) => (
                              <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                          </Select>
                        </td>
                        <td className="text-center py-2">
                          <Input
                            inputMode="numeric"
                            className="w-16 text-center"
                            placeholder="1"
                            value={r.quantity}
                            onChange={(e) =>
                              setBarangRows((rows) =>
                                rows.map((x, i) => (i === idx ? { ...x, quantity: e.target.value.replace(/\D/g, '') } : x)),
                              )
                            }
                          />
                        </td>
                        <td className="text-right py-2">
                          <Input
                            inputMode="numeric"
                            className="w-28 text-right"
                            placeholder="0"
                            value={r.price ? Number(r.price).toLocaleString('id-ID') : ''}
                            onChange={(e) =>
                              setBarangRows((rows) =>
                                rows.map((x, i) => (i === idx ? { ...x, price: e.target.value.replace(/\D/g, '') } : x)),
                              )
                            }
                          />
                        </td>
                        <td className="text-center py-2">
                          <Input
                            inputMode="numeric"
                            className="w-20 text-center"
                            placeholder="90"
                            value={r.warrantyDays}
                            onChange={(e) =>
                              setBarangRows((rows) =>
                                rows.map((x, i) => (i === idx ? { ...x, warrantyDays: e.target.value.replace(/\D/g, '') } : x)),
                              )
                            }
                          />
                        </td>
                        <td className="text-right py-2 font-semibold">
                          {formatCurrency((Number(r.quantity) || 0) * (Number(r.price) || 0))}
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => setBarangRows((rows) => rows.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td colSpan={4} className="px-3 py-2 text-right font-bold">Subtotal:</td>
                      <td className="px-3 py-2 text-right font-extrabold text-primary-600">
                        {formatCurrency(
                          barangRows.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.price) || 0), 0),
                        )}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBarang(false)}>Batal</Button>
            <Button
              disabled={barangRows.length === 0 || addPartsMutation.isPending}
              onClick={() =>
                addPartsMutation.mutate({
                  parts: barangRows.map((r) => ({
                    productId: r.productId,
                    quantity: Math.max(1, Number(r.quantity) || 1),
                    unitCost: Number(r.price) || 0,
                    unitPrice: Number(r.price) || 0,
                    warrantyDays: Math.max(0, Number(r.warrantyDays) || 0),
                    warehouseId: r.warehouseId || undefined,
                  })),
                })
              }
            >
              Tambah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openTambahLayanan} onOpenChange={setOpenTambahLayanan}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Layanan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label><span className="text-red-500">*</span> Layanan</Label>
              <Select value={layananModalPick} onValueChange={setLayananModalPick} className="mt-1">
                <option value="">Pilih layanan</option>
                {(serviceTypes as any[])
                  .filter((st) => !(order.layanan as any[]).some((l) => l.serviceTypeId === st.id))
                  .map((st) => <option key={st.id} value={st.id}>{st.name} · SLA {formatSLA(Number(st.slaHours))}</option>)}
              </Select>
            </div>
            <div>
              <Label>Tag / mapping kerusakan</Label>
              <div className="mt-1">
                <TagCombobox value={layananModalTags} onChange={setLayananModalTags} localSuggestions={[]} suggestRemote={suggestTags} placeholder="Mis. Lcd, Bootloop..." />
              </div>
            </div>
            {layananModalPick && (
              <div className="rounded-md border bg-muted p-2 text-xs">
                Estimasi selesai mengikuti total antrian SLA (dihitung dari Tgl Terima).
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenTambahLayanan(false)}>Batal</Button>
            <Button
              disabled={!layananModalPick || addLayananMutation.isPending}
              onClick={() => addLayananMutation.mutate({
                serviceTypeId: layananModalPick,
                notes: layananModalTags.join(', ') || undefined,
              })}
            >
              Tambah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* IGDERP-185: lock viewer — reveal gated server-side (TC/HS/SPV), audit logged */}
      <Dialog open={openLockView} onOpenChange={setOpenLockView}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Kunci Layar Perangkat</DialogTitle>
          </DialogHeader>
          {!lockReveal ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Kunci tersimpan terenkripsi. Klik Lihat untuk membuka — tercatat di histori.</p>
              <Button onClick={handleRevealLock} disabled={lockLoading} className="w-full">
                {lockLoading ? 'Membuka...' : 'Lihat'}
              </Button>
            </div>
          ) : lockReveal.lockType === 'pattern' ? (
            <div className="space-y-2">
              <PatternPad value={lockNodes} readOnly />
              <p className="text-xs text-muted-foreground">Ikuti urutan angka untuk membuka HP customer · tercatat di histori</p>
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs font-semibold text-muted-foreground">{(LOCK_TYPE_LABELS as any)[lockReveal.lockType] || lockReveal.lockType}</p>
              <p className="font-mono text-lg tracking-widest">
                {showLockValue ? lockReveal.value : '••••••'}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowLockValue((v) => !v)}>
                  {showLockValue ? 'Sembunyikan' : 'Lihat'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Tercatat di histori</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* IGDERP-168: QC popup — intake checklist + general checkup + note/row; pass → ready, fail → in-progress */}
      <QcModal
        open={openQc}
        onOpenChange={setOpenQc}
        items={((order as any)?.completenessItems || []).filter((x: any) => x.checked).map((x: any) => ({ name: x.name, conditionNote: x.conditionNote }))}
        busy={statusMutation.isPending}
        onPass={(notes) => {
          setOpenQc(false);
          statusMutation.mutate({ status: 'ready', notes });
        }}
        onFail={(notes) => {
          setOpenQc(false);
          statusMutation.mutate({ status: 'in-progress', notes });
        }}
      />
      {/* IGDERP-171: void confirm — reason mandatory, approver asserted server-side */}
      <Dialog open={openVoid} onOpenChange={setOpenVoid}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Void Pembayaran</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Order kembali ke Ready dan pembayaran dibuka ulang untuk koreksi. Butuh peran approver.
            </p>
            <div><Label>Alasan void <span className="text-red-500">*</span></Label><Input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Mis. salah input metode…" className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenVoid(false)}>Batal</Button>
            <Button
              variant="destructive"
              disabled={!voidReason.trim() || voidMutation.isPending}
              onClick={() => voidMutation.mutate(voidReason.trim())}
            >
              Void
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={openBayar} onOpenChange={setOpenBayar}>
        <DialogContent>
          <DialogHeader><DialogTitle>Terima Pembayaran</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted p-2 text-sm">
              Total {formatCurrency(totalFee)} · Sudah masuk {formatCurrency(paidSoFar)} · <b>Sisa {formatCurrency(sisaBayar)}</b>
            </div>
            <div><Label>Nominal (Rp)</Label><Input inputMode="numeric" value={bayarAmount ? Number(bayarAmount).toLocaleString('id-ID') : ''} onChange={(e) => setBayarAmount(e.target.value.replace(/\D/g, ''))} className="mt-1" /></div>
            <div><Label>Metode</Label><div className="mt-1 grid grid-cols-3 gap-2">{([['cash', 'Tunai'], ['transfer', 'Transfer'], ['qris', 'QRIS']] as const).map(([v, l]) => (<button key={v} type="button" onClick={() => setBayarMethod(v)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${bayarMethod === v ? 'border-primary bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}>{l}</button>))}</div></div>
            <div><Label>Referensi (opsional)</Label><Input value={bayarRef} onChange={(e) => setBayarRef(e.target.value)} placeholder="No. referensi transfer…" className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBayar(false)}>Batal</Button>
            <Button
              disabled={!Number(bayarAmount) || Number(bayarAmount) <= 0 || paymentMutation.isPending}
              onClick={() => {
                const amount = Number(bayarAmount);
                if (amount > sisaBayar) { toast.error(`Maksimal sisa pembayaran ${formatCurrency(sisaBayar)}`); return; }
                paymentMutation.mutate({ paymentMethod: bayarMethod as any, amount, reference: bayarRef.trim() || undefined });
              }}
            >
              Simpan Pembayaran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
