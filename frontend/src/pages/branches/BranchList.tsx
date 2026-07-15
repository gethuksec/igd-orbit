import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Store,
  Eye,
  Edit,
  Trash2,
  AlertTriangle,
  Loader2,
  MapPin,
} from 'lucide-react';
import { branchesService } from '../../services/branches.service';
import { PageHeader } from '@/components/shared';
import { StatCard } from '@/components/shared';
import { SearchFilter } from '@/components/shared';
import { DataTable } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '../../components/ui/modal';
import { toast } from 'sonner';

type StatusFilter = 'all' | 'active' | 'inactive';

interface SimpleFormData {
  name: string;
  code: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  province: string;
  isActive: boolean;
}

const defaultForm: SimpleFormData = {
  name: '',
  code: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  province: '',
  isActive: true,
};

export default function BranchList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const limit = 20;
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [formData, setFormData] = useState<SimpleFormData>(defaultForm);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['branches', page, limit, searchTerm, statusFilter],
    queryFn: () => branchesService.getAll({
      page,
      limit,
      search: searchTerm || undefined,
      status: statusFilter === 'all' ? 'all' : statusFilter === 'active' ? 'active' : 'inactive',
    }),
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  useEffect(() => {
    refetch();
  }, [statusFilter]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => branchesService.delete(id),
    onSuccess: () => {
      toast.success('Cabang berhasil dihapus');
      setDeleteModalOpen(false);
      setBranchToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus cabang');
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => branchesService.create(data),
    onSuccess: () => {
      toast.success('Cabang berhasil ditambahkan');
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setShowFormModal(false);
      setEditingBranch(null);
      setFormData(defaultForm);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Gagal menambahkan cabang');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => branchesService.update(id, data),
    onSuccess: () => {
      toast.success('Cabang berhasil diupdate');
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setShowFormModal(false);
      setEditingBranch(null);
      setFormData(defaultForm);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Gagal mengupdate cabang');
    },
  });

  const branches = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };
  const activeCount = branches.filter((b: any) => b.isActive).length;

  const openCreateModal = () => {
    setEditingBranch(null);
    setFormData(defaultForm);
    setShowFormModal(true);
  };

  const openEditModal = (branch: any) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name || '',
      code: branch.code || '',
      phone: branch.phone || '',
      email: branch.email || '',
      address: branch.address || '',
      city: branch.city || '',
      province: branch.province || '',
      isActive: branch.isActive !== false,
    });
    setShowFormModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBranch) {
      updateMutation.mutate({ id: editingBranch.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Kode & Nama',
      cell: (branch) => (
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 h-14 w-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <Store className="w-7 h-7" />
          </div>
          <div>
            <div className="text-base font-semibold text-foreground">{branch.name}</div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">{branch.code || '-'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Lokasi',
      cell: (branch) => (
        <div className="flex items-start gap-2 max-w-md">
          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-muted-foreground">
            {branch.address && <div>{branch.address}</div>}
            <div className="text-xs text-muted-foreground mt-0.5">
              {[branch.city, branch.province].filter(Boolean).join(', ') || '-'}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Kontak',
      cell: (branch) => (
        <div className="text-sm text-muted-foreground">
          {branch.phone || '-'}
          {branch.email && <div className="text-xs">{branch.email}</div>}
        </div>
      ),
    },
    {
      key: 'stats',
      header: 'Statistik',
      cell: (branch) => (
        <div className="text-xs text-muted-foreground">
          <div>Users: {branch.userCount || 0}</div>
          <div>Stok: {branch.productStockCount || 0}</div>
          <div>Transaksi: {branch.salesTransactionCount || 0}</div>
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      cell: (branch) => (
        <span
          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            branch.isActive
              ? 'bg-green-100 text-green-800 border-green-200'
              : 'bg-gray-100 text-gray-800 border-gray-200'
          }`}
        >
          {branch.isActive ? 'Aktif' : 'Tidak Aktif'}
        </span>
      ),
    },
  ];

  const statusBtns: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'active', label: 'Aktif' },
    { key: 'inactive', label: 'Tidak Aktif' },
  ];

  return (
    <div className="w-full space-y-3">
      <PageHeader title="Manajemen Cabang" subtitle="Kelola cabang dan lokasi">
        <Button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-white text-primary-600 hover:bg-primary-50"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Cabang</span>
        </Button>
      </PageHeader>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          icon={<Store className="w-6 h-6 text-white" />}
          iconBg="from-primary-500 to-primary-600"
          label="Total Cabang"
          value={isLoading ? '-' : pagination.total}
          subtitle="Semua cabang terdaftar"
        />
        <StatCard
          icon={<Store className="w-6 h-6 text-white" />}
          iconBg="from-blue-500 to-blue-600"
          label="Total Terisi"
          value={isLoading ? '-' : branches.length}
          subtitle="Cabang pada halaman ini"
        />
        <StatCard
          icon={<Store className="w-6 h-6 text-white" />}
          iconBg="from-green-500 to-green-600"
          label="Cabang Aktif"
          value={isLoading ? '-' : activeCount}
          badge={{ text: 'Active', className: 'bg-green-100 text-green-800' }}
        />
      </div>

      <SearchFilter
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama cabang, kode, lokasi, atau kontak..."
      />

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">Status:</span>
        <div className="flex gap-1">
          {statusBtns.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setStatusFilter(btn.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === btn.key
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={branches}
        keyExtractor={(b: any) => b.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada cabang ditemukan"
        emptyIcon={<Store className="w-16 h-16" />}
        actions={(branch: any) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/branches/${branch.id}`)}
              title="Lihat Detail"
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditModal(branch)}
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              onClick={() => {
                setBranchToDelete({ id: branch.id, name: branch.name });
                setDeleteModalOpen(true);
              }}
              title="Hapus"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      />

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="bg-white px-6 py-4 rounded-xl border border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, pagination.total)} dari{' '}
            {pagination.total} cabang
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sebelumnya
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}

      {/* Form Modal */}
      <Modal
        open={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingBranch(null);
          setFormData(defaultForm);
        }}
        title={editingBranch ? 'Edit Cabang' : 'Tambah Cabang'}
        size="md"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Cabang <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nama cabang"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kode Cabang
            </label>
            <Input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="Kode cabang (opsional)"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telepon
              </label>
              <Input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Nomor telepon"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Email (opsional)"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alamat
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Alamat lengkap (opsional)"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kota
              </label>
              <Input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Kota"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provinsi
              </label>
              <Input
                type="text"
                value={formData.province}
                onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                placeholder="Provinsi"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm text-gray-600">{formData.isActive ? 'Aktif' : 'Tidak Aktif'}</span>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowFormModal(false);
                setEditingBranch(null);
                setFormData(defaultForm);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              disabled={isPending}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                editingBranch ? 'Update' : 'Simpan'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setBranchToDelete(null);
        }}
        title="Hapus Cabang"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-800">
              Apakah Anda yakin ingin menghapus cabang <strong>{branchToDelete?.name}</strong>?
              <br />
              <span className="text-xs text-red-600 mt-1 block">
                Tindakan ini tidak dapat dibatalkan. Cabang akan dinonaktifkan.
              </span>
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => {
                setDeleteModalOpen(false);
                setBranchToDelete(null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              onClick={() => {
                if (branchToDelete) {
                  deleteMutation.mutate(branchToDelete.id);
                }
              }}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Hapus
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
