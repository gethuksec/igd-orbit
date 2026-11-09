import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BreadcrumbHeader } from '@/components/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  ClipboardCheck,
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Download,
} from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { toast } from 'sonner';
import { api } from '@/services/api';

export default function StockOpnameDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: opname, isLoading, error } = useQuery({
    queryKey: ['inventory-opname', id],
    queryFn: () => inventoryService.getOpnameById(id!),
    enabled: !!id,
  });

  // IGDERP-235 (OP3): variance review — selisih-first C2 layout for
  // reviewers; counters receive the same groups without variance figures.
  const { data: review } = useQuery({
    queryKey: ['inventory-opname-review', id],
    queryFn: () => inventoryService.getOpnameReview(id!),
    enabled: !!id,
  });
  const reviewProbe =
    review?.selisih?.[0] ?? review?.cocok?.[0] ?? review?.belumDihitung?.[0];
  const hasVariance = !!reviewProbe && 'variance' in reviewProbe;

  // IGDERP-236 (OP4): approval + correction history (role-gated; hidden on 403)
  const { data: approvals } = useQuery({
    queryKey: ['inventory-opname-approvals', id],
    queryFn: () => inventoryService.listOpnameApprovals(id!),
    enabled: !!id,
    retry: false,
  });
  const { data: corrections } = useQuery({
    queryKey: ['inventory-opname-corrections', id],
    queryFn: () => inventoryService.listOpnameCorrections(id!),
    enabled: !!id,
    retry: false,
  });

  // IGDERP-260: members — add/remove mid-session, counts/scans stay
  const [memberPick, setMemberPick] = useState('');
  const { data: assignments } = useQuery({
    queryKey: ['inventory-opname-assignments', id],
    queryFn: () => inventoryService.listAssignments(id!),
    enabled: !!id,
    retry: false,
  });
  const { data: usersData } = useQuery({
    queryKey: ['users-all'],
    queryFn: async () => {
      const res = await api.get('/users', { params: { page: 1, limit: 100 } });
      return res.data.data || res.data || [];
    },
    retry: false,
  });
  const memberIds: string[] = [...new Set((assignments || []).map((a: any) => a.userId))];
  const memberOptions: any[] = (Array.isArray(usersData) ? usersData : []).filter(
    (u: any) => !memberIds.includes(u.id),
  );
  const addMemberMutation = useMutation({
    mutationFn: (userId: string) => inventoryService.addAssignments(id!, { userId }),
    onSuccess: () => {
      toast.success('Anggota ditambahkan');
      setMemberPick('');
      queryClient.invalidateQueries({ queryKey: ['inventory-opname-assignments', id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menambahkan anggota');
    },
  });
  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => inventoryService.removeAssignment(id!, { userId }),
    onSuccess: () => {
      toast.success('Anggota dihapus — hasil scan tetap tersimpan');
      queryClient.invalidateQueries({ queryKey: ['inventory-opname-assignments', id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus anggota');
    },
  });
  const isActiveOpname = opname && (opname.status === 'draft' || opname.status === 'counting');

  const completeMutation = useMutation({
    mutationFn: () => inventoryService.completeOpname(id!),
    onSuccess: () => {
      toast.success('Opname berhasil diselesaikan');
      queryClient.invalidateQueries({ queryKey: ['inventory-opname', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-opnames'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyelesaikan opname');
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => inventoryService.approveOpname(id!),
    onSuccess: () => {
      toast.success('Opname berhasil disetujui');
      queryClient.invalidateQueries({ queryKey: ['inventory-opname', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-opnames'] });
      queryClient.invalidateQueries({ queryKey: ['product-stocks'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyetujui opname');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => inventoryService.cancelOpname(id!),
    onSuccess: () => {
      toast.success('Opname dibatalkan — outlet bebas untuk opname baru');
      queryClient.invalidateQueries({ queryKey: ['inventory-opname', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-opnames'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membatalkan opname');
    },
  });

  // IGDERP-177: Excel export state (hooks above early returns).
  const [exporting, setExporting] = useState(false);

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
          <p className="text-gray-600 font-semibold text-lg">Memuat data opname...</p>
        </div>
      </div>
    );
  }

  if (error || !opname) {
    return (
      <div className="w-full space-y-3">
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">
            {(error as Error)?.message || 'Opname tidak ditemukan'}
          </p>
        </div>
        <Link
          to="/inventory/opname"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Daftar
        </Link>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'counting':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'counting':
        return 'Sedang Dihitung';
      case 'completed':
        return 'Selesai - Menunggu Persetujuan';
      case 'approved':
        return 'Disetujui';
      case 'cancelled':
        return 'Dibatalkan';
      default:
        return status;
    }
  };

  const countedItems = opname.items.filter((item) => item.physicalQuantity !== null).length;
  const totalItems = opname.items.length;

  // IGDERP-235 (OP3): C2 figures come from the review (product-level,
  // OPEN-aware). Counters see counts only — no variance figures.
  const summary = review?.summary;
  const c2Products = summary?.products ?? totalItems;
  const c2Counted = summary?.countedProducts ?? countedItems;
  const c2Selisih = summary?.selisih ?? opname.items.filter((item) => Number(item.discrepancy || 0) !== 0).length;
  const c2Cocok = summary?.cocok ?? 0;
  const c2VarianceTotal = hasVariance ? Number(summary?.totalVarianceValue ?? 0) : null;
  const c2Large = (review?.selisih ?? []).filter((p: any) => {
    const base = Number(p.expected || 0);
    return base > 0 && (Math.abs(Number(p.variance || 0)) / base) * 100 > 5;
  });
  const itemsWithLargeDiscrepancy = hasVariance || review
    ? c2Large
    : opname.items.filter((item) => {
        const systemQty = Number(item.systemQuantity);
        const discrepancy = Number(item.discrepancy || 0);
        const percentage = systemQty > 0 ? Math.abs((discrepancy / systemQty) * 100) : 0;
        return percentage > 5;
      });

  const canComplete = opname.status === 'counting' && countedItems === totalItems;
  const canApprove = opname.status === 'completed';

  // IGDERP-235 (OP3): C2 groups from the review. Reviewers get
  // selisih-first + cocok collapsed; counters get one blind "tercatat" group.
  const selisihGroup: any[] = review?.selisih ?? [];
  const cocokGroup: any[] = review?.cocok ?? [];
  const belumGroup: any[] = review?.belumDihitung ?? [];
  const blindCounted: any[] = !hasVariance && review ? [...selisihGroup, ...cocokGroup] : [];

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await inventoryService.exportOpnameExcel(opname.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `opname-${opname.opnameNumber}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Gagal mengekspor hasil opname');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <BreadcrumbHeader title={opname.opnameNumber} subtitle="Detail Stock Opname">
        <span
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${getStatusColor(
            opname.status,
          )}`}
        >
          {getStatusLabel(opname.status)}
        </span>
        {/* IGDERP-177: result document export (Excel-only) */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'Mengekspor…' : 'Export Excel'}
        </button>
        {/* IGDERP-177: signed result document (print/PDF) */}
        <Link
          to={`/inventory/opname/${opname.id}/dokumen`}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <ClipboardCheck className="w-4 h-4" />
          Dokumen
        </Link>
      </BreadcrumbHeader>

      {/* Stats Cards — IGDERP-235 (OP3): C2 figures from the review */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Produk</span>
            <Package className="w-5 h-5 text-primary-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{c2Products}</h3>
          <p className="text-xs text-gray-500 mt-1">
            {c2Counted} sudah dihitung ({c2Products > 0 ? Math.round((c2Counted / c2Products) * 100) : 0}%)
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Nilai Selisih</span>
            {c2VarianceTotal === null ? (
              <CheckCircle className="w-5 h-5 text-gray-400" />
            ) : c2VarianceTotal > 0 ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : c2VarianceTotal < 0 ? (
              <TrendingDown className="w-5 h-5 text-red-600" />
            ) : (
              <CheckCircle className="w-5 h-5 text-gray-600" />
            )}
          </div>
          {c2VarianceTotal === null ? (
            <h3 className="text-2xl font-bold text-gray-300">—</h3>
          ) : (
            <h3
              className={`text-2xl font-bold ${
                c2VarianceTotal > 0
                  ? 'text-green-600'
                  : c2VarianceTotal < 0
                    ? 'text-red-600'
                    : 'text-gray-900'
              }`}
            >
              {c2VarianceTotal > 0 ? '+' : c2VarianceTotal < 0 ? '−' : ''}
              {formatCurrency(Math.abs(c2VarianceTotal))}
            </h3>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {hasVariance ? 'Netto semua produk · dasar harga beli' : 'Disembunyikan untuk petugas pencacah'}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              {hasVariance ? 'Produk Selisih' : 'Tercatat'}
            </span>
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{hasVariance ? c2Selisih : c2Counted}</h3>
          {hasVariance && summary && summary.movementCount! > 0 && (
            <p className="text-xs text-gray-500 mt-1">{summary.movementCount} mutasi selama sesi OPEN</p>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              {hasVariance ? 'Cocok' : 'Belum Dihitung'}
            </span>
            {hasVariance ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
          </div>
          <h3 className={`text-2xl font-bold ${hasVariance ? 'text-green-600' : 'text-red-600'}`}>
            {hasVariance ? c2Cocok : (summary?.belumDihitung ?? totalItems - countedItems)}
          </h3>
          {!hasVariance && <p className="text-xs text-gray-500 mt-1">Perlu dihitung</p>}
        </div>
      </div>

      {/* Opname Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary-600" />
            Informasi Opname
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Gudang</p>
              <p className="text-base font-semibold text-gray-900">
                {opname.warehouse ? `${opname.warehouse.name} (${opname.warehouse.code})` : '-'}
              </p>
              {opname.warehouse && (
                <p className="text-xs text-gray-500">
                  {opname.warehouse.scope === 'SYSTEM' ? 'Central' : 'Outlet'} · {opname.warehouse.type}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">Cabang</p>
              <p className="text-base font-semibold text-gray-900">{opname.branch?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tanggal Opname</p>
              <p className="text-base font-semibold text-gray-900">
                {new Date(opname.opnameDate).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            {opname.completedAt && (
              <div>
                <p className="text-sm text-gray-600">Selesai Pada</p>
                <p className="text-base font-semibold text-gray-900">
                  {new Date(opname.completedAt).toLocaleString('id-ID')}
                </p>
              </div>
            )}
            {opname.approvedAt && (
              <div>
                <p className="text-sm text-gray-600">Disetujui Pada</p>
                <p className="text-base font-semibold text-gray-900">
                  {new Date(opname.approvedAt).toLocaleString('id-ID')}
                </p>
              </div>
            )}
            {opname.notes && (
              <div>
                <p className="text-sm text-gray-600">Catatan</p>
                <p className="text-base text-gray-900">{opname.notes}</p>
              </div>
            )}
          </div>
        </div>

        {itemsWithLargeDiscrepancy.length > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-xl shadow-md p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-yellow-900 mb-2">Peringatan</h3>
                <p className="text-sm text-yellow-800">
                  Terdapat {itemsWithLargeDiscrepancy.length} item dengan discrepancy lebih dari 5%. Harap
                  lakukan investigasi sebelum menyetujui opname ini.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* IGDERP-260: members — add/remove mid-session, history stays */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Anggota Counting</h2>
        <p className="text-xs text-gray-500 mb-4">Hasil scan anggota yang dihapus tetap tersimpan.</p>
        <div className="flex flex-wrap gap-2">
          {memberIds.length === 0 && (
            <span className="text-sm text-gray-400">Belum ada anggota tambahan.</span>
          )}
          {memberIds.map((uid: string) => {
            const u = (Array.isArray(usersData) ? usersData : []).find((x: any) => x.id === uid);
            return (
              <span
                key={uid}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-primary-50 text-primary-700 border border-primary-200"
              >
                {u ? u.fullName || u.username : uid.slice(0, 8)}
                {isActiveOpname && (
                  <button
                    type="button"
                    onClick={() => removeMemberMutation.mutate(uid)}
                    disabled={removeMemberMutation.isPending}
                    className="font-bold hover:text-red-600 disabled:opacity-50"
                    title="Hapus anggota"
                  >
                    ✕
                  </button>
                )}
              </span>
            );
          })}
        </div>
        {isActiveOpname && (
          <div className="flex gap-2 mt-4">
            <select
              value={memberPick}
              onChange={(e) => setMemberPick(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            >
              <option value="">+ Tambah anggota…</option>
              {memberOptions.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.fullName || u.username}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => memberPick && addMemberMutation.mutate(memberPick)}
              disabled={!memberPick || addMemberMutation.isPending}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 text-sm"
            >
              Tambah
            </button>
          </div>
        )}
      </div>

      {/* D2 timeline — IGDERP-236 (OP4): counting → review → approval → posting */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Alur Persetujuan</h2>
        <OpnameTimeline opname={opname} approvals={approvals} />
        {approvals && approvals.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">
              Riwayat persetujuan
            </div>
            <div className="space-y-1">
              {approvals.map((a: any) => (
                <div key={a.id} className="text-xs text-gray-600">
                  ✓ {a.decision} · {new Date(a.createdAt).toLocaleString('id-ID')}
                  {a.note ? ` — ${a.note}` : ''}
                </div>
              ))}
            </div>
          </div>
        )}
        {corrections && corrections.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">
              Riwayat koreksi ({corrections.length})
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {corrections.slice(0, 30).map((c: any) => (
                <div key={c.id} className="text-xs text-gray-600">
                  {c.product?.name || c.productId}: {c.oldQuantity ?? '—'} → <b>{c.newQuantity}</b>
                  {c.condition ? ` (${c.condition})` : ''} · “{c.reason}” ·{' '}
                  {new Date(c.createdAt).toLocaleString('id-ID')}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hasil — IGDERP-235 (OP3): C2 variance-first review */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-600" />
            Hasil Perhitungan
          </h2>
          {opname.status === 'counting' && (
            <Link
              to={`/inventory/opname/${opname.id}/count`}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <ClipboardCheck className="w-4 h-4" />
              Lanjutkan Menghitung
            </Link>
          )}
        </div>

        {!review ? (
          <p className="text-sm text-gray-400 py-4 text-center">Memuat hasil perhitungan…</p>
        ) : hasVariance ? (
          <>
            {/* Variance banner */}
            <div className="rounded-xl border-2 border-yellow-300 bg-yellow-50 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1">
              <span className="text-sm font-bold text-yellow-900">
                Selisih {c2Selisih} produk · Cocok {c2Cocok} · Belum {belumGroup.length}
              </span>
              <span className="text-sm font-extrabold text-gray-900">
                Netto {c2VarianceTotal! > 0 ? '+' : c2VarianceTotal! < 0 ? '−' : ''}
                {formatCurrency(Math.abs(c2VarianceTotal ?? 0))}
              </span>
              {review && (opname.opnameType === 'OPEN' || (review as any).opnameType === 'OPEN') && (
                <span className="text-xs text-yellow-800">
                  Sesi OPEN — expected = snapshot + mutasi selama sesi
                  {summary?.movementCount ? ` (${summary.movementCount} mutasi)` : ''}
                </span>
              )}
            </div>

            {/* Selisih group on top */}
            <section>
              <h3 className="text-sm font-bold uppercase tracking-wide text-red-700 mb-2">
                Selisih ({selisihGroup.length})
              </h3>
              {selisihGroup.length === 0 ? (
                <p className="text-sm text-gray-400">Tidak ada selisih — semua yang dihitung cocok.</p>
              ) : (
                <div className="space-y-2">
                  {selisihGroup.map((p: any) => (
                    <ReviewProductRow key={p.productId} p={p} showVariance formatCurrency={formatCurrency} />
                  ))}
                </div>
              )}
            </section>

            {/* Cocok group collapsed */}
            <details className="rounded-xl border border-green-200 bg-green-50/50 px-4 py-2">
              <summary className="cursor-pointer text-sm font-bold text-green-800">
                Cocok ({cocokGroup.length}) — klik untuk melihat
              </summary>
              <div className="mt-2 space-y-2">
                {cocokGroup.map((p: any) => (
                  <ReviewProductRow key={p.productId} p={p} showVariance formatCurrency={formatCurrency} />
                ))}
              </div>
            </details>

            {/* Belum dihitung */}
            {belumGroup.length > 0 && (
              <section>
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">
                  Belum dihitung ({belumGroup.length})
                </h3>
                <div className="space-y-2">
                  {belumGroup.map((p: any) => (
                    <ReviewProductRow key={p.productId} p={p} showVariance formatCurrency={formatCurrency} />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <>
            {/* Blind: one counted group, no variance figures */}
            <section>
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-2">
                Tercatat ({blindCounted.length})
              </h3>
              <div className="space-y-2">
                {blindCounted.map((p: any) => (
                  <ReviewProductRow key={p.productId} p={p} showVariance={false} formatCurrency={formatCurrency} />
                ))}
              </div>
            </section>
            {belumGroup.length > 0 && (
              <section>
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">
                  Belum dihitung ({belumGroup.length})
                </h3>
                <div className="space-y-2">
                  {belumGroup.map((p: any) => (
                    <ReviewProductRow key={p.productId} p={p} showVariance={false} formatCurrency={formatCurrency} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      {opname.status !== 'approved' && opname.status !== 'cancelled' && (
        <div className="flex items-center justify-end gap-3">
          {(opname.status === 'draft' ||
            opname.status === 'counting' ||
            opname.status === 'completed') && (
            <button
              onClick={() => {
                if (
                  confirm(
                    'Yakin ingin membatalkan opname ini? Hasil perhitungan yang sudah masuk tetap tersimpan sebagai riwayat, tapi sesi ini berakhir dan stok tidak berubah.',
                  )
                ) {
                  cancelMutation.mutate();
                }
              }}
              disabled={cancelMutation.isPending}
              className="px-6 py-3 bg-white text-red-600 border border-red-300 rounded-lg font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {cancelMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              <span>Batalkan</span>
            </button>
          )}
          {canComplete && (
            <button
              onClick={() => {
                if (confirm('Yakin ingin menyelesaikan opname ini? Pastikan semua item sudah dihitung.')) {
                  completeMutation.mutate();
                }
              }}
              disabled={completeMutation.isPending}
              className="px-6 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {completeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span>Selesaikan</span>
            </button>
          )}
          {canApprove && (
            <button
              onClick={() => {
                if (
                  confirm(
                    'Yakin ingin menyetujui opname ini? Stok akan disesuaikan sesuai hasil opname.',
                  )
                ) {
                  approveMutation.mutate();
                }
              }}
              disabled={approveMutation.isPending}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {approveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span>Setujui</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * IGDERP-236 (OP4): D2 timeline — counting → review → approval → posting.
 * Review = completed (counted, awaiting approval); posting rides the approval
 * transaction, so approval + posting share the approved stamp (CLOSED).
 */
function OpnameTimeline({ opname, approvals }: { opname: any; approvals?: any[] }) {
  const order = ['draft', 'counting', 'completed', 'approved', 'cancelled'];
  const stageIdx = Math.max(0, order.indexOf(opname.status));
  const approvedAt = opname.approvedAt || approvals?.[0]?.createdAt || null;
  const stages = [
    { key: 'counting', label: 'Pencacahan', at: opname.createdAt, done: stageIdx >= 1 },
    { key: 'review', label: 'Review', at: opname.completedAt, done: stageIdx >= 2 && opname.status !== 'cancelled' },
    { key: 'approval', label: 'Persetujuan', at: opname.approvedAt, done: opname.status === 'approved' },
    { key: 'posting', label: 'Posting stok', at: approvedAt, done: opname.status === 'approved' },
  ];
  return (
    <ol className="flex flex-col sm:flex-row gap-2">
      {stages.map((s, i) => (
        <li
          key={s.key}
          className={`flex-1 rounded-xl border px-3 py-2 ${
            s.done ? 'border-green-300 bg-green-50' : i === stages.findIndex((x) => !x.done) && opname.status !== 'cancelled' && opname.status !== 'approved'
              ? 'border-primary-400 bg-red-50'
              : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex w-5 h-5 items-center justify-center rounded-full text-[11px] font-bold text-white ${
                s.done ? 'bg-green-600' : 'bg-gray-400'
              }`}
            >
              {s.done ? '✓' : i + 1}
            </span>
            <span className="text-xs font-bold text-gray-900">{s.label}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-gray-500">
            {s.at ? new Date(s.at).toLocaleString('id-ID') : '—'}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * IGDERP-235 (OP3): one product in the C2 review — figures on top,
 * expandable count detail (breakdown + condition rows + OPEN movements).
 * Blind (showVariance=false) shows identity + physical only.
 */
function ReviewProductRow({
  p,
  showVariance,
  formatCurrency,
}: {
  p: any;
  showVariance: boolean;
  formatCurrency: (n: number) => string;
}) {
  const condLabel = (c: string) => (c === 'damaged' ? 'Rusak' : c === 'expired' ? 'Kadaluarsa' : 'Baik');
  const variance = p.variance;
  const uncounted = p.physical === null || p.physical === undefined;
  return (
    <div
      className={`rounded-xl border px-4 py-2.5 ${
        showVariance && !uncounted && variance !== 0
          ? 'border-red-200 bg-red-50/50'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <div className="flex-1 min-w-[180px]">
          <div className="text-sm font-bold text-gray-900">{p.product?.name || '-'}</div>
          <div className="text-[11px] text-gray-400">SKU: {p.product?.sku || '-'}</div>
        </div>
        {showVariance && (
          <>
            <span className="text-xs text-gray-500">
              Snapshot <b className="text-gray-900">{p.snapshot}</b>
            </span>
            {'expected' in p && p.expected !== p.snapshot && (
              <span className="text-xs text-gray-500">
                Expected <b className="text-gray-900">{p.expected}</b>
              </span>
            )}
            <span className="text-xs text-gray-500">
              Fisik <b className="text-gray-900">{uncounted ? '—' : p.physical}</b>
            </span>
            {!uncounted && (
              <span
                className={`text-sm font-extrabold ${
                  variance > 0 ? 'text-green-600' : variance < 0 ? 'text-red-600' : 'text-gray-400'
                }`}
              >
                {variance > 0 ? '+' : ''}
                {variance}
                {p.varianceValue !== null && p.varianceValue !== undefined && variance !== 0 && (
                  <span className="ml-2 text-xs font-semibold">
                    {p.varianceValue > 0 ? '+' : '−'}
                    {formatCurrency(Math.abs(p.varianceValue))}
                  </span>
                )}
              </span>
            )}
          </>
        )}
        {!showVariance && (
          <span className="text-sm font-bold text-gray-900">
            Fisik {uncounted ? '—' : p.physical}
          </span>
        )}
      </div>
      {!uncounted && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-[11px] font-semibold text-primary-600">
            Rincian hitungan
            {p.breakdown &&
              ` — Baik ${p.breakdown.good} · Rusak ${p.breakdown.damaged} · Kadaluarsa ${p.breakdown.expired}`}
          </summary>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(p.rows ?? []).map((r: any) => (
              <span
                key={r.itemId}
                className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] text-gray-700"
              >
                {condLabel(r.condition)} {r.physicalQuantity}
              </span>
            ))}
          </div>
          {showVariance && (p.movements ?? []).length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {(p.movements ?? []).map((m: any) => (
                <div key={m.id} className="text-[11px] text-gray-500">
                  {m.movementType} {Number(m.quantityChange) > 0 ? '+' : ''}
                  {m.quantityChange}
                  {m.referenceType ? ` · ${m.referenceType}` : ''}
                  {m.referenceId ? ` ${m.referenceId}` : ''}
                </div>
              ))}
            </div>
          )}
        </details>
      )}
    </div>
  );
}

