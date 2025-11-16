import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit,
  Wrench,
  User,
  Phone,
  Mail,
  Package,
  Loader2,
  UserCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { serviceOrdersService } from '../../services/service-orders.service';
import { toast } from 'sonner';
import StatusTimeline from '@/pages/public/components/StatusTimeline';
import { api } from '@/services/api';

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function ServiceOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = getCurrentUser();
  const userRoles: string[] =
    currentUser?.roles ||
    (currentUser?.role?.code ? [currentUser.role.code] : []);

  const [assigningTechnicianId, setAssigningTechnicianId] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [quotedPriceInput, setQuotedPriceInput] = useState<string>('');
  const [approvedPriceInput, setApprovedPriceInput] = useState<string>('');

  const { data: serviceOrder, isLoading } = useQuery({
    queryKey: ['service-order', id],
    queryFn: () => serviceOrdersService.getById(id!),
  });

  const { data: technicians } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      try {
        const res = await api.get('/users', {
          params: {
            page: 1,
            limit: 100,
            'filter[role]': 'TC',
          },
        });
        const raw = res.data?.data || res.data || [];
        // Extra safety: only keep users that actually have TC role
        return raw.filter((user: any) =>
          Array.isArray(user.roles) &&
          user.roles.some((r: any) => r.code === 'TC'),
        );
      } catch (error) {
        return [];
      }
    },
    enabled: userRoles.includes('HS') || userRoles.includes('SPV'),
  });

  const assignTechnicianMutation = useMutation({
    mutationFn: () =>
      serviceOrdersService.assignTechnician(id!, {
        technicianId: assigningTechnicianId,
        notes: assignNotes || undefined,
      }),
    onSuccess: () => {
      toast.success('Teknisi berhasil di-assign');
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal assign teknisi');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (payload: {
      status: string;
      notes?: string;
      quotedPrice?: number;
      customerApprovedPrice?: number;
    }) => serviceOrdersService.updateStatus(id!, payload),
    onSuccess: () => {
      toast.success('Status service berhasil diupdate');
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
      setStatusNotes('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal update status service');
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => serviceOrdersService.complete(id!),
    onSuccess: () => {
      toast.success('Service berhasil diselesaikan');
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyelesaikan service');
    },
  });

  const qcMutation = useMutation({
    mutationFn: (qcStatus: 'pass' | 'fail') =>
      serviceOrdersService.qcCheck(id!, {
        status: qcStatus,
        notes: statusNotes || undefined,
      }),
    onSuccess: () => {
      toast.success('QC berhasil diproses');
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
      setStatusNotes('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal memproses QC');
    },
  });

  const deliverMutation = useMutation({
    mutationFn: () => serviceOrdersService.deliver(id!),
    onSuccess: () => {
      toast.success('Service berhasil diserahkan ke customer');
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyerahkan service');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!serviceOrder) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Service order tidak ditemukan</p>
        <button
          onClick={() => navigate('/service-orders')}
          className="mt-4 text-primary-600 hover:text-primary-700"
        >
          Kembali ke daftar service order
        </button>
      </div>
    );
  }

  const order = serviceOrder as any;

  const canAssignTechnician = userRoles.includes('HS') || userRoles.includes('SPV');
  const isTechnician = userRoles.includes('TC');

  const normalizedStatus = String(order.status || 'pending').toLowerCase();

  const getNextStatuses = (status: string): string[] => {
    const validTransitions: Record<string, string[]> = {
      pending: ['diagnosed', 'cancelled'],
      diagnosed: ['quoted', 'cancelled'],
      quoted: ['approved', 'cancelled'],
      approved: ['in-progress', 'cancelled'],
      'in-progress': ['qc', 'cancelled'],
      qc: ['completed', 'in-progress'],
      completed: ['delivered'],
      delivered: [],
      cancelled: [],
    };
    return validTransitions[status] || [];
  };

  const nextStatuses = getNextStatuses(normalizedStatus);

  const getStatusColor = (status: string) => {
    const s = String(status || '').toLowerCase();
    switch (s) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'diagnosed':
      case 'quoted':
      case 'approved':
      case 'in-progress':
      case 'qc':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
      case 'delivered':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/service-orders')}
              className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold mb-1">
                {order.serviceNumber || 'Service Order'}
              </h1>
              <p className="text-primary-100">Detail Service Order</p>
            </div>
          </div>
          <Link
            to={`/service-orders/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all"
          >
            <Edit className="w-4 h-4" />
            <span>Edit</span>
          </Link>
        </div>
      </div>

      {/* Status & Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Status Summary & Actions */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm text-gray-500">Status</label>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border ${getStatusColor(
                    order.status || 'pending',
                  )}`}
                >
                  <Clock className="w-4 h-4" />
                  <span className="uppercase">{order.status || 'pending'}</span>
                </span>
              </div>
            </div>
            {order.createdAt && (
              <div className="text-right">
                <label className="text-sm text-gray-500">Tanggal Dibuat</label>
                <p className="text-base font-semibold text-gray-900">
                  {new Date(order.createdAt).toLocaleDateString('id-ID')}
                </p>
              </div>
            )}
          </div>

          {/* Assign Technician */}
          {canAssignTechnician && (
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <div className="flex items-center gap-2">
                <UserCircle className="w-4 h-4 text-gray-400" />
                <p className="text-sm font-semibold text-gray-700">Teknisi</p>
              </div>
              <div className="space-y-2">
                <select
                  value={assigningTechnicianId || order.assignedTechnician?.id || ''}
                  onChange={(e) => setAssigningTechnicianId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                >
                  <option value="">Pilih teknisi</option>
                  {(technicians || []).map((tech: any) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.fullName || tech.email}
                    </option>
                  ))}
                </select>
                <textarea
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  rows={2}
                  placeholder="Catatan assign (opsional)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-sm"
                />
                <button
                  type="button"
                  disabled={!assigningTechnicianId || assignTechnicianMutation.isPending}
                  onClick={() => assignTechnicianMutation.mutate()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
                >
                  {assignTechnicianMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserCircle className="w-4 h-4" />
                  )}
                  <span>{order.assignedTechnician ? 'Ubah Teknisi' : 'Assign Teknisi'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Status Actions */}
          {(isTechnician || canAssignTechnician) && nextStatuses.length > 0 && (
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gray-400" />
                <p className="text-sm font-semibold text-gray-700">Aksi Status</p>
              </div>

              {/* Input harga yang berhubungan dengan status (hanya tampil di fase terkait) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {nextStatuses.includes('quoted') && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Quoted Price (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={quotedPriceInput}
                      onChange={(e) => setQuotedPriceInput(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-xs"
                      placeholder="Isi saat akan set QUOTED"
                    />
                  </div>
                )}

                {nextStatuses.includes('approved') && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Customer Approved Price (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={approvedPriceInput}
                      onChange={(e) => setApprovedPriceInput(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-xs"
                      placeholder="Isi saat akan set APPROVED"
                    />
                  </div>
                )}
              </div>

              <textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                rows={2}
                placeholder="Catatan perubahan status (opsional)"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-sm"
              />

              <div className="flex flex-wrap gap-2">
                {nextStatuses.map((s) => {
                  // Skip QC transition button for non-teknisi; mereka pakai panel QC khusus saat status "qc"
                  if (s === 'qc' && !isTechnician) {
                    return null;
                  }

                  const labelMap: Record<string, string> = {
                    diagnosed: 'Set Diagnosed',
                    quoted: 'Kirim Quotation',
                    approved: 'Set Approved',
                    'in-progress': 'Mulai Pengerjaan',
                    qc: isTechnician ? 'Ready QC' : 'Kirim ke QC',
                    completed: 'Tandai Selesai',
                    delivered: 'Serahkan ke Customer',
                    cancelled: 'Batalkan',
                  };

                  const handler = () => {
                    const loading =
                      updateStatusMutation.isPending ||
                      completeMutation.isPending ||
                      qcMutation.isPending ||
                      deliverMutation.isPending;
                    if (loading) return;

                    // Validasi input harga sebelum konfirmasi
                    if (s === 'quoted') {
                      const value = Number(quotedPriceInput);
                      if (!value || Number.isNaN(value) || value <= 0) {
                        toast.error('Isi Quoted Price (Rp) dengan nominal yang valid');
                        return;
                      }
                    }

                    if (s === 'approved') {
                      const value = Number(approvedPriceInput);
                      if (!value || Number.isNaN(value) || value <= 0) {
                        toast.error('Isi Customer Approved Price (Rp) dengan nominal yang valid');
                        return;
                      }
                    }

                    setConfirmAction(s);
                  };

                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={handler}
                      disabled={
                        updateStatusMutation.isPending ||
                        completeMutation.isPending ||
                        qcMutation.isPending ||
                        deliverMutation.isPending
                      }
                      className="px-3 py-1.5 rounded-lg border text-xs font-semibold text-primary-700 border-primary-200 bg-primary-50 hover:bg-primary-100 disabled:opacity-50"
                    >
                      {labelMap[s] || s}
                    </button>
                  );
                })}
              </div>

              {/* Confirmation panel */}
              {confirmAction && (
                <div className="mt-3 p-3 border border-amber-200 bg-amber-50 rounded-lg text-xs space-y-2">
                  <p className="font-semibold text-amber-800">
                    Konfirmasi aksi: ubah status menjadi "{confirmAction.toUpperCase()}"
                  </p>
                  <p className="text-amber-700">
                    Pastikan data sudah benar. Aksi ini akan mempengaruhi progres service dan perhitungan harga.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
                      onClick={() => setConfirmAction(null)}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs rounded-lg bg-primary-600 text-white hover:bg-primary-700"
                      onClick={() => {
                        const action = confirmAction;
                        setConfirmAction(null);

                        if (action === 'completed') {
                          completeMutation.mutate();
                          return;
                        }

                        if (action === 'qc') {
                          // Untuk teknisi, "Ready QC" hanya mengubah status ke 'qc'
                          if (isTechnician) {
                            updateStatusMutation.mutate({
                              status: 'qc',
                              notes: statusNotes || undefined,
                            });
                            return;
                          }

                          // HS/SPV akan memproses QC lewat tombol khusus saat status sudah 'qc'
                          return;
                        }

                        if (action === 'delivered') {
                          deliverMutation.mutate();
                          return;
                        }

                        const payload: any = {
                          status: action,
                          notes: statusNotes || undefined,
                        };

                        if (action === 'quoted') {
                          payload.quotedPrice = Number(quotedPriceInput);
                        }

                        if (action === 'approved') {
                          payload.customerApprovedPrice = Number(approvedPriceInput);
                        }

                        updateStatusMutation.mutate(payload);
                      }}
                    >
                      Ya, lanjut
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* QC actions khusus HS/SPV saat status sudah QC */}
        {normalizedStatus === 'qc' && canAssignTechnician && (
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 space-y-2 lg:col-span-3">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-gray-400" />
              QC Oleh HS/SPV
            </p>
            <p className="text-xs text-gray-500">
              Gunakan tombol di bawah untuk menandai hasil QC. Jika gagal, status akan kembali ke IN-PROGRESS.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (qcMutation.isPending) return;
                  const confirmed = window.confirm('QC LULUS dan lanjut ke proses berikutnya?');
                  if (!confirmed) return;
                  qcMutation.mutate('pass');
                }}
                className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
                disabled={qcMutation.isPending}
              >
                QC Lulus
              </button>
              <button
                type="button"
                onClick={() => {
                  if (qcMutation.isPending) return;
                  const confirmed = window.confirm('QC GAGAL dan kembalikan ke teknisi?');
                  if (!confirmed) return;
                  qcMutation.mutate('fail');
                }}
                className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                disabled={qcMutation.isPending}
              >
                QC Gagal
              </button>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="lg:col-span-2">
          <StatusTimeline
            currentStatus={normalizedStatus}
            statusHistory={Array.isArray(order.statusHistory) ? order.statusHistory : []}
          />
        </div>
      </div>

      {/* Detail Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Customer Information */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
              <User className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Informasi Customer</h2>
          </div>
          <div className="space-y-3">
            {order.customerName && (
              <div>
                <label className="text-sm text-gray-500">Nama</label>
                <p className="text-base font-semibold text-gray-900">{order.customerName}</p>
              </div>
            )}
            {order.customerPhone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <a
                  href={`tel:${order.customerPhone}`}
                  className="text-base text-primary-600 hover:text-primary-700"
                >
                  {order.customerPhone}
                </a>
              </div>
            )}
            {order.customerEmail && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <a
                  href={`mailto:${order.customerEmail}`}
                  className="text-base text-primary-600 hover:text-primary-700"
                >
                  {order.customerEmail}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Device Information */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Informasi Perangkat</h2>
          </div>
          <div className="space-y-3">
            {order.deviceType && (
              <div>
                <label className="text-sm text-gray-500">Jenis Perangkat</label>
                <p className="text-base font-semibold text-gray-900">{order.deviceType}</p>
              </div>
            )}
            {order.deviceBrand && (
              <div>
                <label className="text-sm text-gray-500">Brand</label>
                <p className="text-base font-semibold text-gray-900">{order.deviceBrand}</p>
              </div>
            )}
            {order.deviceModel && (
              <div>
                <label className="text-sm text-gray-500">Model</label>
                <p className="text-base font-semibold text-gray-900">{order.deviceModel}</p>
              </div>
            )}
            {order.deviceSerial && (
              <div>
                <label className="text-sm text-gray-500">Serial Number</label>
                <p className="text-base font-semibold text-gray-900">{order.deviceSerial}</p>
              </div>
            )}
          </div>
        </div>

        {/* Service Information */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Informasi Service</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {order.complaint && (
              <div className="md:col-span-2">
                <label className="text-sm text-gray-500">Keluhan</label>
                <p className="text-base text-gray-900 mt-1">{order.complaint}</p>
              </div>
            )}
            {order.initialDiagnosis && (
              <div className="md:col-span-2">
                <label className="text-sm text-gray-500">Diagnosis Awal</label>
                <p className="text-base text-gray-900 mt-1">{order.initialDiagnosis}</p>
              </div>
            )}
            {order.estimatedCost && (
              <div>
                <label className="text-sm text-gray-500">Estimasi Biaya</label>
                <p className="text-base font-semibold text-gray-900">
                  {new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                  }).format(order.estimatedCost)}
                </p>
              </div>
            )}
            {order.priority && (
              <div>
                <label className="text-sm text-gray-500">Prioritas</label>
                <p className="text-base font-semibold text-gray-900 uppercase">{order.priority}</p>
              </div>
            )}
            {order.promisedDate && (
              <div>
                <label className="text-sm text-gray-500">Promised Date</label>
                <p className="text-base font-semibold text-gray-900">
                  {new Date(order.promisedDate).toLocaleDateString('id-ID')}
                </p>
              </div>
            )}
            {order.customerNotes && (
              <div className="md:col-span-2">
                <label className="text-sm text-gray-500">Catatan Customer</label>
                <p className="text-base text-gray-900 mt-1">{order.customerNotes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

