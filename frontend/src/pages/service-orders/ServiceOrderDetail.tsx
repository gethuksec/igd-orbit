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
  Plus,
  Trash2,
  ShoppingCart,
  Receipt,
  Printer,
  X,
} from 'lucide-react';
import { serviceOrdersService } from '../../services/service-orders.service';
import { serviceReturnsService } from '../../services/service-returns.service';
import { toast } from 'sonner';
import StatusTimeline from '@/pages/public/components/StatusTimeline';
import { api } from '@/services/api';
import { useBranchStore } from '@/stores/branchStore';
import { RotateCcw } from 'lucide-react';

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
  const [approvedPriceInput, setApprovedPriceInput] = useState<string>('');
  const [laborCostInput, setLaborCostInput] = useState<string>('');
  const [discountAmountInput, setDiscountAmountInput] = useState<string>('');
  const [promoCodeInput, setPromoCodeInput] = useState<string>('');
  const [qcModalMode, setQcModalMode] = useState<'pass' | 'fail' | null>(null);
  const [showAddPartsModal, setShowAddPartsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeletePartModal, setShowDeletePartModal] = useState(false);
  const [partToDelete, setPartToDelete] = useState<any>(null);
  const [partsToAdd, setPartsToAdd] = useState<Array<{
    productId: string;
    quantity: number;
    unitCost: number;
    unitPrice: number;
    purchaseType?: 'internal' | 'external';
  }>>([]);
  const [productSearch, setProductSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'e_wallet' | 'credit_card' | 'debit_card'>('cash');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const { currentBranchId } = useBranchStore();

  // Fetch service returns for this service order
  const { data: serviceReturns } = useQuery({
    queryKey: ['service-returns', 'by-service-order', id],
    queryFn: async () => {
      try {
        const response = await serviceReturnsService.getAll({
          page: 1,
          limit: 100,
        });
        // Filter returns for this service order
        return response.data.filter((ret: any) => ret.serviceOrderId === id);
      } catch {
        return [];
      }
    },
    enabled: !!id,
  });

  // Check if there's an active return (not rejected)
  const hasActiveReturn = serviceReturns?.some(
    (ret: any) => ret.status !== 'rejected',
  );

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

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products', 'for-service', productSearch, currentBranchId],
    queryFn: async () => {
      try {
        // Build query params with include stock
        // Backend DTO supports comma-separated string: "category,brand,stock"
        const params: any = {
          page: 1,
          limit: 100,
          search: productSearch,
          'filter[status]': 'active',
          include: 'category,brand,stock', // Include stock untuk mendapatkan stockSummary
        };

        const res = await api.get('/products', { params });
        const productsData = res.data?.data || res.data || [];
        
        // Filter products with stock > 0 for current branch
        // Stock info is in stockSummary or productStocks
        return productsData
          .map((p: any) => {
            // Get stock for current branch
            let stockQty = 0;
            if (currentBranchId && p.stockSummary?.branches) {
              const branchStock = p.stockSummary.branches.find(
                (b: any) => b.branchId === currentBranchId,
              );
              stockQty = branchStock?.available || 0;
            } else if (p.stockSummary?.totalAvailable) {
              // Fallback to total if no branch-specific stock
              stockQty = p.stockSummary.totalAvailable;
            } else if (p.stock) {
              // Fallback to simple stock field
              stockQty = p.stock;
            }

            return {
              ...p,
              categoryName: p.category?.name || 'Tanpa Kategori',
              brandName: p.brand?.name || '',
              stockDisplay: stockQty,
            };
          })
          .filter((p: any) => p.stockDisplay > 0);
      } catch (error) {
        console.error('Error fetching products:', error);
        return [];
      }
    },
    enabled: showAddPartsModal,
  });

  const addPartsMutation = useMutation({
    mutationFn: (payload: { parts: Array<any> }) => serviceOrdersService.addParts(id!, payload),
    onSuccess: () => {
      toast.success('Sparepart berhasil ditambahkan');
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
      setShowAddPartsModal(false);
      setPartsToAdd([]);
      setProductSearch('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menambahkan sparepart');
    },
  });

  const removePartMutation = useMutation({
    mutationFn: (partId: string) => serviceOrdersService.removePart(id!, partId),
    onSuccess: () => {
      toast.success('Sparepart berhasil dihapus');
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
      setShowDeletePartModal(false);
      setPartToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus sparepart');
    },
  });

  const processPaymentMutation = useMutation({
    mutationFn: (payload: any) => serviceOrdersService.processPayment(id!, payload),
    onSuccess: () => {
      toast.success('Pembayaran berhasil diproses');
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentNotes('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal memproses pembayaran');
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

  const canAssignTechnician = userRoles.includes('HS') || userRoles.includes('SPV') || userRoles.includes('SUPERADMIN');
  const isTechnician = userRoles.includes('TC');
  const canAddParts = userRoles.includes('CS') || userRoles.includes('HS') || userRoles.includes('SPV') || userRoles.includes('SUPERADMIN');

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
              <div className="space-y-2">
                {/* Labor Cost input - muncul setelah status diagnosed */}
                {(normalizedStatus === 'diagnosed' || nextStatuses.includes('quoted')) && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Biaya Jasa (Rp) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={laborCostInput || order.laborCost || ''}
                      onChange={(e) => setLaborCostInput(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-xs"
                      placeholder="Masukkan biaya jasa service"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Quoted Price akan otomatis = Biaya Jasa + Biaya Sparepart
                    </p>
                  </div>
                )}

                {/* Quoted Price - Read-only, auto-calculated */}
                {nextStatuses.includes('quoted') && (
                  <div className="p-2 bg-gray-50 rounded-lg">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Quoted Price (Rp) - Otomatis
                    </label>
                    <div className="text-sm font-semibold text-gray-900">
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                      }).format(
                        (Number(laborCostInput || order.laborCost || 0)) +
                        (Number(order.partsCost || 0))
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      = Biaya Jasa + Biaya Sparepart
                    </p>
                  </div>
                )}

                {/* Approved Price - bisa berbeda dari quoted (dengan diskon) */}
                {nextStatuses.includes('approved') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Customer Approved Price (Rp) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={approvedPriceInput || order.customerApprovedPrice || order.quotedPrice || ''}
                        onChange={(e) => setApprovedPriceInput(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-xs"
                        placeholder="Harga setelah diskon (jika ada)"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Bisa berbeda dari Quoted Price jika ada diskon
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Diskon (Rp)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={discountAmountInput || order.discountAmount || ''}
                        onChange={(e) => setDiscountAmountInput(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-xs"
                        placeholder="Jumlah diskon"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Kode Promo (Opsional)
                      </label>
                      <input
                        type="text"
                        value={promoCodeInput || order.promoCode || ''}
                        onChange={(e) => setPromoCodeInput(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-xs"
                        placeholder="Kode promo/diskon"
                      />
                    </div>
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

                    // Validasi labor cost jika status diagnosed atau akan ke quoted
                    if ((normalizedStatus === 'diagnosed' || s === 'quoted') && !order.laborCost) {
                      const laborValue = Number(laborCostInput);
                      if (!laborValue || Number.isNaN(laborValue) || laborValue <= 0) {
                        toast.error('Isi Biaya Jasa (Rp) dengan nominal yang valid');
                        return;
                      }
                    }

                    // Validasi approved price
                    if (s === 'approved') {
                      const value = Number(approvedPriceInput || order.quotedPrice || 0);
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

                        // Tambahkan laborCost jika ada input (untuk diagnosed atau quoted)
                        if (laborCostInput && (action === 'diagnosed' || action === 'quoted')) {
                          payload.laborCost = Number(laborCostInput);
                        }

                        // Quoted price otomatis = laborCost + partsCost (tidak perlu input manual)

                        if (action === 'approved') {
                          payload.customerApprovedPrice = Number(approvedPriceInput || order.quotedPrice || 0);
                          if (discountAmountInput) {
                            payload.discountAmount = Number(discountAmountInput);
                          }
                          if (promoCodeInput) {
                            payload.promoCode = promoCodeInput;
                          }
                        }

                        updateStatusMutation.mutate(payload);
                      }}
                    >
                      Ya, lanjut
                    </button>
                  </div>
                </div>
              )}

              {/* QC oleh HS/SPV di dalam card Status, hanya saat status sudah QC */}
              {normalizedStatus === 'qc' && canAssignTechnician && (
                <div className="mt-4 border-t border-gray-100 pt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-gray-400" />
                    <p className="text-sm font-semibold text-gray-700">QC Oleh HS/SPV</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    Gunakan tombol di bawah untuk menandai hasil QC. Jika gagal, status akan kembali ke
                    IN-PROGRESS.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => !qcMutation.isPending && setQcModalMode('pass')}
                      className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
                      disabled={qcMutation.isPending}
                    >
                      QC Lulus
                    </button>
                    <button
                      type="button"
                      onClick={() => !qcMutation.isPending && setQcModalMode('fail')}
                      className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                      disabled={qcMutation.isPending}
                    >
                      QC Gagal
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* QC Modal for HS/SPV */}
        {qcModalMode && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 mx-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gray-500" />
                Konfirmasi Hasil QC
              </h3>
              <p className="text-xs text-gray-600 mb-4">
                {qcModalMode === 'pass'
                  ? 'QC LULUS: perangkat siap dilanjutkan ke tahap berikutnya.'
                  : 'QC GAGAL: perangkat akan dikembalikan ke teknisi (status kembali ke IN-PROGRESS).'
                }
              </p>
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
                  onClick={() => setQcModalMode(null)}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs rounded-lg text-white ${
                    qcModalMode === 'pass' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                  onClick={() => {
                    const mode = qcModalMode;
                    setQcModalMode(null);
                    qcMutation.mutate(mode);
                  }}
                  disabled={qcMutation.isPending}
                >
                  Ya, {qcModalMode === 'pass' ? 'QC Lulus' : 'QC Gagal'}
                </button>
              </div>
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
            {order.deviceUnit && (
              <div>
                <span className="text-sm font-medium text-gray-500">Unit</span>
                <p className="text-base font-semibold text-gray-900">{order.deviceUnit}</p>
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

        {/* Return & Complaint Section - Only show if delivered */}
        {normalizedStatus === 'delivered' && (
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 md:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg">
                  <RotateCcw className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Retur & Komplain</h2>
              </div>
              {!hasActiveReturn ? (
                <Link
                  to={`/service-returns/new?serviceOrderId=${id}`}
                  className="px-4 py-2 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Buat Retur
                </Link>
              ) : (
                <div className="px-4 py-2 bg-gray-300 text-gray-600 rounded-xl font-semibold flex items-center gap-2 cursor-not-allowed">
                  <RotateCcw className="w-4 h-4" />
                  Sudah Ada Retur Aktif
                </div>
              )}
            </div>

            {/* Return History */}
            {serviceReturns && serviceReturns.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Riwayat Retur</h3>
                <div className="space-y-2">
                  {serviceReturns.map((ret: any) => (
                    <Link
                      key={ret.id}
                      to={`/service-returns/${ret.id}`}
                      className="block p-3 bg-gray-50 hover:bg-primary-50 border border-gray-200 rounded-lg transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-primary-600">{ret.returnNumber}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            {ret.returnType} • {ret.status}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            {new Date(ret.returnedAt).toLocaleDateString('id-ID')}
                          </p>
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border mt-1 ${
                              ret.status === 'pending' || ret.status === 'investigating'
                                ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                : ret.status === 'approved'
                                  ? 'bg-green-100 text-green-800 border-green-200'
                                  : ret.status === 'rejected'
                                    ? 'bg-red-100 text-red-800 border-red-200'
                                    : 'bg-blue-100 text-blue-800 border-blue-200'
                            }`}
                          >
                            {ret.status}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {(!serviceReturns || serviceReturns.length === 0) && (
              <p className="text-sm text-gray-500 text-center py-4">
                Belum ada retur untuk service order ini
              </p>
            )}
          </div>
        )}
      </div>

      {/* Sparepart & Accessories */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Sparepart & Accessories</h2>
          </div>
          {(canAddParts) && normalizedStatus !== 'delivered' && normalizedStatus !== 'cancelled' && (
            <button
              onClick={() => setShowAddPartsModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Sparepart</span>
            </button>
          )}
        </div>

        {order.partsUsed && Array.isArray(order.partsUsed) && order.partsUsed.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Produk</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Qty</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Harga Satuan</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Subtotal</th>
                  {(canAddParts) && normalizedStatus !== 'delivered' && normalizedStatus !== 'cancelled' && (
                    <th className="text-center py-2 px-3 font-semibold text-gray-700">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {order.partsUsed.map((part: any) => {
                  // Use totalPrice from backend (already calculated: unitPrice * quantity)
                  const subtotal = Number(part.totalPrice || 0);
                  const purchaseType = part.purchaseType || 'internal';
                  return (
                    <tr key={part.id} className="border-b border-gray-100">
                      <td className="py-2 px-3">
                        <div>
                          <p className="font-medium text-gray-900">{part.product?.name || 'N/A'}</p>
                          {part.notes && <p className="text-xs text-gray-500">{part.notes}</p>}
                        </div>
                      </td>
                      <td className="text-center py-2 px-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                          purchaseType === 'internal' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {purchaseType === 'internal' ? 'Internal' : 'Eksternal'}
                        </span>
                      </td>
                      <td className="text-right py-2 px-3 text-gray-700">{part.quantity}</td>
                      <td className="text-right py-2 px-3 text-gray-700">
                        {new Intl.NumberFormat('id-ID', {
                          style: 'currency',
                          currency: 'IDR',
                        }).format(Number(part.unitPrice || 0))}
                      </td>
                      <td className="text-right py-2 px-3 font-semibold text-gray-900">
                        {new Intl.NumberFormat('id-ID', {
                          style: 'currency',
                          currency: 'IDR',
                        }).format(subtotal)}
                      </td>
                      {(canAddParts) && normalizedStatus !== 'delivered' && normalizedStatus !== 'cancelled' && (
                        <td className="text-center py-2 px-3">
                          <button
                            onClick={() => {
                              setPartToDelete(part);
                              setShowDeletePartModal(true);
                            }}
                            disabled={removePartMutation.isPending}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            title="Hapus sparepart"
                          >
                            {removePartMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td 
                    colSpan={(canAddParts) && normalizedStatus !== 'delivered' && normalizedStatus !== 'cancelled' ? 6 : 5} 
                    className="py-2 px-3 font-semibold text-gray-900 text-right"
                  >
                    Total Biaya Sparepart:
                  </td>
                  <td className="py-2 px-3 font-bold text-lg text-primary-600">
                    {new Intl.NumberFormat('id-ID', {
                      style: 'currency',
                      currency: 'IDR',
                    }).format(Number(order.partsCost || 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>Belum ada sparepart yang digunakan</p>
          </div>
        )}
      </div>

      {/* Ringkasan Biaya */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Ringkasan Biaya</h2>
          {order.quotationNumber && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-gray-500">Quotation:</span>
              <span className="text-sm font-semibold text-primary-600">{order.quotationNumber}</span>
              <button
                onClick={() => {
                  window.open(`/service-orders/${id}/print?type=quotation`, '_blank');
                }}
                className="p-1.5 text-primary-600 hover:bg-primary-50 rounded"
                title="Cetak Quotation"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          )}
          {order.invoiceNumber && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-gray-500">Invoice:</span>
              <span className="text-sm font-semibold text-green-600">{order.invoiceNumber}</span>
              <button
                onClick={() => {
                  window.open(`/service-orders/${id}/print?type=invoice`, '_blank');
                }}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                title="Cetak Invoice"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {order.quotedPrice && (
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Quoted Price</span>
              <span className="font-semibold text-gray-900">
                {new Intl.NumberFormat('id-ID', {
                  style: 'currency',
                  currency: 'IDR',
                }).format(Number(order.quotedPrice))}
              </span>
            </div>
          )}
          {order.customerApprovedPrice && (
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Customer Approved Price</span>
              <span className="font-semibold text-gray-900">
                {new Intl.NumberFormat('id-ID', {
                  style: 'currency',
                  currency: 'IDR',
                }).format(Number(order.customerApprovedPrice))}
              </span>
            </div>
          )}
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Biaya Jasa</span>
            <span className="font-semibold text-gray-900">
              {new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
              }).format(Number(order.laborCost || 0))}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Biaya Sparepart</span>
            <span className="font-semibold text-gray-900">
              {new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
              }).format(Number(order.partsCost || 0))}
            </span>
          </div>
          {Number(order.otherCost || 0) > 0 && (
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Biaya Lain-lain</span>
              <span className="font-semibold text-gray-900">
                {new Intl.NumberFormat('id-ID', {
                  style: 'currency',
                  currency: 'IDR',
                }).format(Number(order.otherCost || 0))}
              </span>
            </div>
          )}
          {/* Calculate totals based on approvedPrice or quotedPrice */}
          {(() => {
            const quotedPrice = Number(order.quotedPrice || 0);
            const approvedPrice = Number(order.customerApprovedPrice || quotedPrice);
            const discountAmount = Number(order.discountAmount || 0);
            const finalPrice = approvedPrice - discountAmount;
            const taxAmount = Math.round(finalPrice * 0.11);
            const totalPrice = Math.round(finalPrice * 1.11);

            return (
              <>
                {discountAmount > 0 && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Diskon</span>
                    <span className="font-semibold text-red-600">
                      - {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                      }).format(discountAmount)}
                    </span>
                  </div>
                )}
                {order.promoCode && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Kode Promo</span>
                    <span className="font-semibold text-gray-900">{order.promoCode}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Harga Setelah Diskon</span>
                  <span className="font-semibold text-gray-900">
                    {new Intl.NumberFormat('id-ID', {
                      style: 'currency',
                      currency: 'IDR',
                    }).format(finalPrice)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Pajak (11%)</span>
                  <span className="font-semibold text-gray-900">
                    {new Intl.NumberFormat('id-ID', {
                      style: 'currency',
                      currency: 'IDR',
                    }).format(taxAmount)}
                  </span>
                </div>
                <div className="flex justify-between py-3 bg-primary-50 rounded-lg px-3">
                  <span className="font-bold text-lg text-gray-900">Total</span>
                  <span className="font-bold text-lg text-primary-600">
                    {new Intl.NumberFormat('id-ID', {
                      style: 'currency',
                      currency: 'IDR',
                    }).format(totalPrice)}
                  </span>
                </div>
              </>
            );
          })()}
          {order.paymentStatus && (
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Status Pembayaran</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  order.paymentStatus === 'paid'
                    ? 'bg-green-100 text-green-800'
                    : order.paymentStatus === 'partial'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                }`}
              >
                {order.paymentStatus === 'paid'
                  ? 'Lunas'
                  : order.paymentStatus === 'partial'
                    ? 'Sebagian'
                    : 'Belum Bayar'}
              </span>
            </div>
          )}
            {(normalizedStatus === 'completed' || normalizedStatus === 'delivered') &&
            order.paymentStatus !== 'paid' &&
            (canAssignTechnician || userRoles.includes('CS')) && (
              <button
                onClick={() => {
                  // Calculate total price
                  const quotedPrice = Number(order.quotedPrice || 0);
                  const approvedPrice = Number(order.customerApprovedPrice || quotedPrice);
                  const discountAmount = Number(order.discountAmount || 0);
                  const finalPrice = approvedPrice - discountAmount;
                  const totalPrice = Math.round(finalPrice * 1.11);
                  setPaymentAmount(String(totalPrice));
                  setShowPaymentModal(true);
                }}
                className="w-full mt-3 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
              >
                <Receipt className="w-4 h-4 inline mr-2" />
                Buat Nota Pembayaran
              </button>
            )}
        </div>
      </div>

      {/* Add Parts Modal */}
      {showAddPartsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Pilih Sparepart & Accessories</h3>
                <p className="text-xs text-gray-500 mt-1">Pilih produk yang akan digunakan untuk service ini</p>
              </div>
              <button
                onClick={() => {
                  setShowAddPartsModal(false);
                  setPartsToAdd([]);
                  setProductSearch('');
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Cari produk, kategori, atau SKU..."
                  className="w-full px-4 py-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Products List */}
            {productsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
              </div>
            ) : products && products.length > 0 ? (
              <div className="mb-4 max-h-96 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {products.map((product: any) => {
                  const isAlreadyAdded = !!partsToAdd.find((p) => p.productId === product.id);
                  const stockStatus =
                    product.stockDisplay > 10
                      ? 'text-green-600'
                      : product.stockDisplay > 0
                        ? 'text-yellow-600'
                        : 'text-red-600';

                  return (
                    <button
                      key={product.id}
                      onClick={() => {
                        if (!isAlreadyAdded) {
                          // Determine purchase type: internal if stock available, external if not
                          const purchaseType = product.stockDisplay > 0 ? 'internal' : 'external';
                          setPartsToAdd([
                            ...partsToAdd,
                            {
                              productId: product.id,
                              quantity: 1,
                              unitCost: product.costPrice || 0,
                              unitPrice: product.sellingPrice || 0,
                              purchaseType,
                            },
                          ]);
                        }
                      }}
                      disabled={isAlreadyAdded}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                        isAlreadyAdded ? 'bg-green-50 opacity-60 cursor-not-allowed' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Category Badge */}
                          <div className="mb-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700">
                              {product.categoryName}
                            </span>
                            {product.brandName && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                {product.brandName}
                              </span>
                            )}
                          </div>

                          {/* Product Name */}
                          <p className="font-semibold text-gray-900 mb-1">{product.name}</p>

                          {/* SKU & Info */}
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="font-mono">{product.sku || 'N/A'}</span>
                            <span className="font-semibold text-gray-700">
                              {new Intl.NumberFormat('id-ID', {
                                style: 'currency',
                                currency: 'IDR',
                              }).format(product.sellingPrice || 0)}
                            </span>
                          </div>
                        </div>

                        {/* Stock & Add Button */}
                        <div className="flex flex-col items-end gap-2">
                          <div className={`text-sm font-semibold ${stockStatus}`}>
                            Stok: {product.stockDisplay.toLocaleString('id-ID')}
                          </div>
                          {isAlreadyAdded ? (
                            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Ditambahkan
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="p-1.5 text-primary-600 hover:bg-primary-50 rounded transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Determine purchase type: internal if stock available, external if not
                                const purchaseType = product.stockDisplay > 0 ? 'internal' : 'external';
                                setPartsToAdd([
                                  ...partsToAdd,
                                  {
                                    productId: product.id,
                                    quantity: 1,
                                    unitCost: product.costPrice || 0,
                                    unitPrice: product.sellingPrice || 0,
                                    purchaseType,
                                  },
                                ]);
                              }}
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 border border-gray-200 rounded-lg">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 text-sm">
                  {productSearch ? 'Tidak ada produk yang ditemukan' : 'Tidak ada produk tersedia'}
                </p>
                {productSearch && (
                  <button
                    onClick={() => setProductSearch('')}
                    className="mt-2 text-xs text-primary-600 hover:text-primary-700"
                  >
                    Hapus filter pencarian
                  </button>
                )}
              </div>
            )}

            {/* Selected Products */}
            {partsToAdd.length > 0 && (
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">
                    Produk yang akan ditambahkan ({partsToAdd.length})
                  </p>
                  <button
                    onClick={() => setPartsToAdd([])}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Hapus Semua
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {partsToAdd.map((part, idx) => {
                    const product = products?.find((p: any) => p.id === part.productId);
                    const subtotal = (part.quantity || 0) * (part.unitPrice || 0);
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 bg-gradient-to-r from-primary-50 to-white rounded-lg border border-primary-100"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-primary-100 text-primary-700 font-medium">
                              {product?.categoryName || 'N/A'}
                            </span>
                            <p className="text-sm font-semibold text-gray-900">{product?.name || 'N/A'}</p>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Jenis Pembelian</label>
                              <select
                                value={part.purchaseType || 'internal'}
                                onChange={(e) => {
                                  const newParts = [...partsToAdd];
                                  newParts[idx].purchaseType = e.target.value as 'internal' | 'external';
                                  setPartsToAdd(newParts);
                                }}
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                              >
                                <option value="internal">Internal (Stok Sendiri)</option>
                                <option value="external">Eksternal (Beli di Luar)</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Qty</label>
                              <input
                                type="number"
                                min={1}
                                max={part.purchaseType === 'internal' ? (product?.stockDisplay || 999) : 999}
                                value={part.quantity}
                                onChange={(e) => {
                                  const newParts = [...partsToAdd];
                                  const qty = Math.max(1, Math.min(Number(e.target.value) || 1, part.purchaseType === 'internal' ? (product?.stockDisplay || 999) : 999));
                                  newParts[idx].quantity = qty;
                                  setPartsToAdd(newParts);
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                              />
                              {part.purchaseType === 'internal' && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  Max: {product?.stockDisplay || 0}
                                </p>
                              )}
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Harga Satuan</label>
                              <input
                                type="number"
                                min={0}
                                value={part.unitPrice}
                                onChange={(e) => {
                                  const newParts = [...partsToAdd];
                                  newParts[idx].unitPrice = Number(e.target.value) || 0;
                                  setPartsToAdd(newParts);
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Subtotal</label>
                              <div className="px-2 py-1.5 text-sm font-semibold text-primary-600 bg-primary-50 rounded">
                                {new Intl.NumberFormat('id-ID', {
                                  style: 'currency',
                                  currency: 'IDR',
                                }).format(subtotal)}
                              </div>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setPartsToAdd(partsToAdd.filter((_, i) => i !== idx));
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">Total Biaya Sparepart:</span>
                    <span className="text-lg font-bold text-primary-600">
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                      }).format(
                        partsToAdd.reduce(
                          (sum, part) => sum + (part.quantity || 0) * (part.unitPrice || 0),
                          0,
                        ),
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddPartsModal(false);
                  setPartsToAdd([]);
                  setProductSearch('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (partsToAdd.length === 0) {
                    toast.error('Pilih minimal satu produk');
                    return;
                  }
                  addPartsMutation.mutate({ parts: partsToAdd });
                }}
                disabled={addPartsMutation.isPending}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {addPartsMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin inline" />
                ) : (
                  'Tambah'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Pembayaran Service</h3>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount('');
                  setPaymentReference('');
                  setPaymentNotes('');
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Metode Pembayaran
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(
                      e.target.value as 'cash' | 'transfer' | 'e_wallet' | 'credit_card' | 'debit_card',
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="cash">Cash</option>
                  <option value="transfer">Transfer</option>
                  <option value="e_wallet">E-Wallet</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="debit_card">Debit Card</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jumlah Pembayaran (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={paymentAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Only allow whole numbers (no decimals)
                    if (val === '' || /^\d+$/.test(val)) {
                      setPaymentAmount(val);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Total: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(order.totalPrice || 0))}
                </p>
              </div>

              {(paymentMethod === 'transfer' || paymentMethod === 'e_wallet') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nomor Referensi
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Nomor referensi pembayaran"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan (Opsional)</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Catatan tambahan..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount('');
                  setPaymentReference('');
                  setPaymentNotes('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const amount = Number(paymentAmount);
                  if (!amount || amount <= 0) {
                    toast.error('Jumlah pembayaran harus lebih dari 0');
                    return;
                  }
                  // Calculate total price
                  const quotedPrice = Number(order.quotedPrice || 0);
                  const approvedPrice = Number(order.customerApprovedPrice || quotedPrice);
                  const discountAmount = Number(order.discountAmount || 0);
                  const finalPrice = approvedPrice - discountAmount;
                  const totalPrice = Math.round(finalPrice * 1.11);
                  if (amount > totalPrice) {
                    toast.error('Jumlah pembayaran tidak boleh melebihi total');
                    return;
                  }
                  processPaymentMutation.mutate({
                    paymentMethod,
                    amount,
                    reference: paymentReference || undefined,
                    notes: paymentNotes || undefined,
                  });
                }}
                disabled={processPaymentMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {processPaymentMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin inline" />
                ) : (
                  'Proses Pembayaran'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Part Modal */}
      {showDeletePartModal && partToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Hapus Sparepart</h3>
              <button
                onClick={() => {
                  setShowDeletePartModal(false);
                  setPartToDelete(null);
                }}
                className="p-1 hover:bg-gray-100 rounded"
                disabled={removePartMutation.isPending}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-100 rounded-full">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-red-900 mb-1">
                      Yakin ingin menghapus sparepart ini?
                    </p>
                    <p className="text-sm text-red-700">
                      Sparepart yang dihapus tidak dapat dikembalikan. Stok akan dikembalikan ke inventory.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Produk:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {partToDelete.product?.name || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Quantity:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {partToDelete.quantity}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Harga Satuan:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                      }).format(Number(partToDelete.unitPrice || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="text-sm font-semibold text-gray-900">Subtotal:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                      }).format(Number(partToDelete.totalPrice || 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowDeletePartModal(false);
                  setPartToDelete(null);
                }}
                disabled={removePartMutation.isPending}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (partToDelete?.id) {
                    removePartMutation.mutate(partToDelete.id);
                  }
                }}
                disabled={removePartMutation.isPending}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {removePartMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Sparepart</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

