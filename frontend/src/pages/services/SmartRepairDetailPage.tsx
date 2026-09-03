import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  User as UserIcon,
  Info,
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
import { Select } from '@/components/ui/select';
import { BreadcrumbHeader } from '@/components/shared';
import { serviceOrdersService } from '@/services/service-orders.service';
import { formatCurrency } from '@/utils/format';

// ─── Status vocabulary (IGDERP-133: 6 + Cancel) ───────────────────────
const STATUS_LABELS: Record<string, string> = {
  pending: 'Receive',
  diagnosed: 'Diagnose',
  'in-progress': 'In Progress',
  ready: 'Ready',
  done: 'Done',
  cancelled: 'Cancel',
  quoted: 'Quoted',
  approved: 'Approved',
  qc: 'QC',
  completed: 'Completed',
  delivered: 'Delivered',
};

const STATUS_PILL: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  diagnosed: 'bg-blue-100 text-blue-800 border-blue-200',
  'in-progress': 'bg-blue-100 text-blue-800 border-blue-200',
  ready: 'bg-blue-100 text-blue-800 border-blue-200',
  done: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  quoted: 'bg-blue-100 text-blue-800 border-blue-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-200',
  qc: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  delivered: 'bg-green-100 text-green-800 border-green-200',
};

const SR_FLOW = ['pending', 'diagnosed', 'in-progress', 'ready', 'done'] as const;
const SR_NEXT_LABEL: Record<string, string> = {
  diagnosed: 'Tandai Diagnose',
  'in-progress': 'Mulai Pengerjaan',
  ready: 'Tandai Ready',
  done: 'Tandai Done',
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

  const { data: order, isLoading } = useQuery({
    queryKey: ['service-order', id],
    queryFn: () => serviceOrdersService.getById(id!),
    enabled: !!id,
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['sr-technicians', order?.branchId],
    queryFn: async () => {
      const path = order?.branchId
        ? `/users/technicians?branchId=${order.branchId}`
        : '/users/technicians';
      const res = await fetch(path, {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('access_token') },
      });
      const json = await res.json();
      return Array.isArray(json) ? json : json.data || [];
    },
    enabled: !!order,
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

  if (isLoading) return <div className="p-10 text-center text-gray-500">Memuat…</div>;
  if (!order) return <div className="p-10 text-center text-gray-500">Service order tidak ditemukan</div>;

  const status = String(order.status || 'pending').toLowerCase();
  const history: any[] = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  const historyByStatus = new Map(history.map((h) => [String(h.status).toLowerCase(), h]));
  const isCancelled = status === 'cancelled';
  const currentIndex = SR_FLOW.indexOf(status as any);

  const partRows: any[] = Array.isArray(order.partsUsed) ? order.partsUsed : [];
  const subtotalParts = partRows.reduce((sum, p) => sum + Number(p.totalPrice || 0), 0);
  const totalFee = Number(order.finalPrice ?? order.estimatedCost ?? 0) || 0;

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
            <p className="text-xs text-gray-500">{Number(order.downPayment) > 0 ? `Uang muka ${formatCurrency(Number(order.downPayment))}` : ''}</p>
          </div>
          <div>
            <Label className="text-sm text-gray-500">Tanggal Masuk</Label>
            <p className="font-bold text-lg">{formatDateTime(order.receivedDate || order.createdAt)}</p>
            <p className="text-xs text-gray-500">{formatTime(order.receivedDate || order.createdAt)}</p>
          </div>
          <div>
            <Label className="text-sm text-gray-500">Estimasi Selesai</Label>
            <p className="font-semibold">{order.slaDueDate ? formatDateTime(order.slaDueDate) : formatDateTime(order.promisedDate)}</p>
            <p className="text-xs text-gray-500">{order.slaDueDate ? formatTime(order.slaDueDate) : ''}</p>
          </div>
          <div>
            <Label className="text-sm text-gray-500">Teknisi</Label>
            <p className="font-semibold">{order.assignedTechnician?.fullName || 'Belum di-assign'}</p>
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
          </div>
        </div>
      </div>

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
              {order.serviceType ? (
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
                  <th className="text-center px-2 py-2 font-semibold w-12">Qty</th>
                  <th className="text-right px-2 py-2 font-semibold w-24">Harga</th>
                  <th className="text-right px-2 py-2 font-semibold w-24">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {partRows.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="px-3 py-2">
                      <p className="font-semibold">{p.product?.name || '—'}</p>
                    </td>
                    <td className="text-center py-2">{Number(p.quantity)}</td>
                    <td className="text-right py-2">{compact(p.unitPrice)}</td>
                    <td className="text-right py-2 font-semibold">{compact(p.totalPrice)}</td>
                  </tr>
                ))}
                {partRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-gray-400">
                      Belum ada barang
                    </td>
                  </tr>
                )}
              </tbody>
              {partRows.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="px-3 py-2 text-right font-bold">Subtotal:</td>
                    <td className="px-3 py-2 text-right font-extrabold text-primary-600">
                      {formatCurrency(subtotalParts)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between border-red-200 text-red-700 bg-red-50 hover:bg-red-100">
                Aksi Status <span className="opacity-70">▾</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              {currentIndex >= 0 && currentIndex < SR_FLOW.length - 1 && !isCancelled && (
                <DropdownMenuItem
                  className="font-semibold"
                  onClick={() => statusMutation.mutate({ status: SR_FLOW[currentIndex + 1] })}
                >
                  {SR_NEXT_LABEL[SR_FLOW[currentIndex + 1]]}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                disabled
                onClick={() => toast.info('Fitur Tambah Waktu menyusul (IGDERP-134)')}
              >
                Tambah Waktu
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled
                onClick={() => toast.info('Fitur Tambah Barang menyusul (IGDERP-138)')}
              >
                Tambah Barang
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 font-semibold"
                onClick={() => setOpenCancel(true)}
              >
                Batal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-xs text-gray-500 mt-4 flex items-center gap-2">
            <Phone className="w-3 h-3" /> {order.customerPhone}
          </p>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-6">Service Status Timeline</h3>
          <div className="space-y-6">
            {SR_FLOW.map((s, idx) => {
              const entry = historyByStatus.get(s);
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
                          {s === 'in-progress' && (
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
                      </>
                    ) : (
                      !current && (
                        <div className="text-xs text-gray-400 mt-1">
                          {s === 'ready' ? 'Selesai dikerjakan — siap diambil customer' : s === 'done' ? 'Sudah diambil / diserahkan ke customer' : ''}
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
                    <span className="font-semibold">Oleh: </span>{historyByStatus.get('cancelled')?.changedByUser?.fullName || '—'}
                  </div>
                  {historyByStatus.get('cancelled')?.notes && (
                    <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                      <span className="font-semibold">Catatan: </span>
                      {historyByStatus.get('cancelled')?.notes}
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
            <Button variant="outline" onClick={() => setOpenTeknisi(false)}>Batal</Button>
            <Button
              disabled={!techId || teknisiMutation.isPending}
              onClick={() => teknisiMutation.mutate(techId)}
            >
              Ubah Teknisi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
