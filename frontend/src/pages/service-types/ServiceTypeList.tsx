import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Wrench,
  Clock,
  Save,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { serviceTypesService } from '../../services/service-types.service';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { PageHeader, StatCard, SearchFilter, DataTable } from '@/components/shared';
import type { Column } from '@/components/shared';

export default function ServiceTypeList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [serviceTypeToDelete, setServiceTypeToDelete] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  type StatusFilter = 'all' | 'active' | 'inactive';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Form Modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingServiceType, setEditingServiceType] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    basePrice: '',
    minPrice: '',
    maxPrice: '',
    slaHours: '',
    isActive: true,
  });

  const { data: serviceTypes = [], isLoading, error, refetch } = useQuery({
    queryKey: ['service-types', searchTerm, statusFilter],
    queryFn: () => serviceTypesService.getAll(statusFilter !== 'active' ? true : undefined),
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, refetch]);

  useEffect(() => {
    refetch();
  }, [statusFilter, refetch]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => serviceTypesService.delete(id),
    onSuccess: () => {
      toast.success('Layanan berhasil dihapus');
      setDeleteModalOpen(false);
      setServiceTypeToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['service-types'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus layanan');
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      const submitData = {
        ...data,
        basePrice: parseFloat(data.basePrice),
        minPrice: data.minPrice ? parseFloat(data.minPrice) : undefined,
        maxPrice: data.maxPrice ? parseFloat(data.maxPrice) : undefined,
        slaHours: parseInt(data.slaHours, 10) || 0,
      };
      if (editingServiceType) {
        return serviceTypesService.update(editingServiceType.id, submitData);
      }
      return serviceTypesService.create(submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-types'] });
      toast.success(editingServiceType ? 'Layanan berhasil diupdate' : 'Layanan berhasil ditambahkan');
      setFormModalOpen(false);
      setEditingServiceType(null);
      setFormData({
        name: '',
        code: '',
        description: '',
        basePrice: '',
        minPrice: '',
        maxPrice: '',
        slaHours: '',
        isActive: true,
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Terjadi kesalahan');
    },
  });

  const openCreateModal = () => {
    setEditingServiceType(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      basePrice: '',
      minPrice: '',
      maxPrice: '',
      slaHours: '',
      isActive: true,
    });
    setFormModalOpen(true);
  };

  const openEditModal = (st: any) => {
    setEditingServiceType(st);
    setFormData({
      name: st.name || '',
      code: st.code || '',
      description: st.description || '',
      basePrice: st.basePrice?.toString() || '',
      minPrice: st.minPrice?.toString() || '',
      maxPrice: st.maxPrice?.toString() || '',
      slaHours: st.slaHours?.toString() || '',
      isActive: st.isActive !== false,
    });
    setFormModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  // Filter by search term and status
  const filteredServiceTypes = serviceTypes.filter((st) => {
    // Status filter (only applies client-side for 'inactive', since backend handles 'all' and 'active')
    if (statusFilter === 'inactive' && st.isActive) return false;

    // Search term filter
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      st.name.toLowerCase().includes(search) ||
      st.code.toLowerCase().includes(search) ||
      (st.description && st.description.toLowerCase().includes(search))
    );
  });

  const activeCount = serviceTypes.filter((st) => st.isActive).length;
  const totalServiceOrders = serviceTypes.reduce((acc, st) => acc + (st.serviceOrderCount || 0), 0);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatSLA = (hours: number) => {
    if (hours < 24) {
      return `${hours} jam`;
    }
    return `${Math.floor(hours / 24)} hari`;
  };

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Layanan',
      cell: (st) => (
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 h-14 w-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <Wrench className="w-7 h-7" />
          </div>
          <div>
            <div className="text-base font-semibold text-foreground">{st.name}</div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">{st.code}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Harga',
      cell: (st) => (
        <div className="text-sm">
          {st.minPrice && st.maxPrice ? (
            <div>
              <div className="font-semibold text-foreground">
                {formatPrice(st.minPrice)} - {formatPrice(st.maxPrice)}
              </div>
              <div className="text-xs text-muted-foreground">Base: {formatPrice(st.basePrice)}</div>
            </div>
          ) : (
            <div className="font-semibold text-foreground">{formatPrice(st.basePrice)}</div>
          )}
        </div>
      ),
    },
    {
      key: 'sla',
      header: 'SLA',
      cell: (st) => (
        <div className="text-sm font-semibold text-foreground">{formatSLA(st.slaHours)}</div>
      ),
    },
    {
      key: 'serviceOrderCount',
      header: 'Service Order',
      cell: (st) => (
        <div className="text-sm font-semibold text-foreground">{st.serviceOrderCount || 0}</div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      cell: (st) => (
        <span
          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            st.isActive
              ? 'bg-green-100 text-green-800 border-green-200'
              : 'bg-gray-100 text-gray-800 border-gray-200'
          }`}
        >
          {st.isActive ? 'Aktif' : 'Tidak Aktif'}
        </span>
      ),
    },
  ];

  return (
    <div className="w-full space-y-3">
      <PageHeader title="Manajemen Layanan" subtitle="Kelola jenis layanan servis">
        <Button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-white text-primary-600 hover:bg-primary-50"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Layanan</span>
        </Button>
      </PageHeader>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          icon={<Wrench className="w-6 h-6 text-white" />}
          iconBg="from-primary-500 to-primary-600"
          label="Total Layanan"
          value={isLoading ? '-' : serviceTypes.length}
          subtitle="Semua layanan terdaftar"
        />
        <StatCard
          icon={<Clock className="w-6 h-6 text-white" />}
          iconBg="from-green-500 to-green-600"
          label="Total Service Order"
          value={isLoading ? '-' : totalServiceOrders}
          subtitle="Dari semua layanan"
        />
        <StatCard
          icon={<Wrench className="w-6 h-6 text-white" />}
          iconBg="from-blue-500 to-blue-600"
          label="Layanan Aktif"
          value={isLoading ? '-' : activeCount}
          badge={{ text: 'Active', className: 'bg-green-100 text-green-800' }}
        />
      </div>

      <SearchFilter
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama layanan, kode, atau deskripsi..."
      />

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        {(['all', 'active', 'inactive'] as StatusFilter[]).map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === filter
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {filter === 'all' ? 'Semua' : filter === 'active' ? 'Aktif' : 'Tidak Aktif'}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filteredServiceTypes}
        keyExtractor={(st: any) => st.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada layanan ditemukan"
        emptyIcon={<Wrench className="w-16 h-16" />}
        actions={(st: any) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/service-types/${st.id}`)}
              title="Lihat Detail"
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditModal(st)}
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              onClick={(e) => {
                e.stopPropagation();
                setServiceTypeToDelete({ id: st.id, name: st.name });
                setDeleteModalOpen(true);
              }}
              title="Hapus"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      />

      {/* Form Modal */}
      <Modal
        open={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingServiceType(null);
          setFormData({
            name: '',
            code: '',
            description: '',
            basePrice: '',
            minPrice: '',
            maxPrice: '',
            slaHours: '',
            isActive: true,
          });
        }}
        title={editingServiceType ? 'Edit Layanan' : 'Tambah Layanan'}
        size="md"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Layanan <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Nama layanan"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kode Layanan <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Kode layanan"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deskripsi
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Deskripsi layanan (opsional)"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Harga Dasar <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min={0}
                value={formData.basePrice}
                onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Harga Minimum
              </label>
              <input
                type="number"
                min={0}
                value={formData.minPrice}
                onChange={(e) => setFormData({ ...formData, minPrice: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0 (opsional)"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Harga Maksimum
              </label>
              <input
                type="number"
                min={0}
                value={formData.maxPrice}
                onChange={(e) => setFormData({ ...formData, maxPrice: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0 (opsional)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SLA (Jam) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min={0}
                value={formData.slaHours}
                onChange={(e) => setFormData({ ...formData, slaHours: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="24"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.isActive ? 'active' : 'inactive'}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="active">Aktif</option>
              <option value="inactive">Tidak Aktif</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setFormModalOpen(false);
                setEditingServiceType(null);
                setFormData({
                  name: '',
                  code: '',
                  description: '',
                  basePrice: '',
                  minPrice: '',
                  maxPrice: '',
                  slaHours: '',
                  isActive: true,
                });
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              disabled={saveMutation.isPending}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Simpan
                </>
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
          setServiceTypeToDelete(null);
        }}
        title="Konfirmasi Hapus"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-red-100 rounded-full">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-700 mb-2">
                Apakah Anda yakin ingin menghapus layanan <strong>{serviceTypeToDelete?.name}</strong>?
              </p>
              <p className="text-xs text-gray-500">
                Tindakan ini akan melakukan soft delete (set isActive = false). Layanan tidak akan muncul di daftar, tetapi masih tersimpan di database.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setDeleteModalOpen(false);
                setServiceTypeToDelete(null);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              disabled={deleteMutation.isPending}
            >
              Batal
            </button>
            <button
              onClick={() => {
                if (serviceTypeToDelete) {
                  deleteMutation.mutate(serviceTypeToDelete.id);
                }
              }}
              disabled={deleteMutation.isPending}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                'Hapus'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
