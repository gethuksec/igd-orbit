import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Users,
  Eye,
  Edit,
  Trash2,
  AlertTriangle,
  Loader2,
  Upload,
  Download,
  Phone,
  Mail,
} from 'lucide-react';
import { customersService } from '../../services/customers.service';
import { toast } from 'sonner';
import { BreadcrumbHeader, StatCard, FilterToolbar, DataTable, RowsPerPageSelect } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CustomerFormModal from './CustomerFormModal';

export default function CustomerList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<10 | 20 | 50 | 100>(20);
  const [sortBy, setSortBy] = useState<'createdAt' | 'name'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<{ id: string; name: string } | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | undefined>(undefined);
  const [showFormModal, setShowFormModal] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customers', page, limit, searchTerm, filterType, filterStatus, sortBy, sortOrder],
    queryFn: () =>
      customersService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        type: filterType || undefined,
        status: filterStatus || undefined,
        sort: sortBy,
        order: sortOrder,
      }),
  });

  // Fetch statistics separately (from entire database, not paginated)
  const { data: statistics } = useQuery({
    queryKey: ['customers-statistics'],
    queryFn: () => customersService.getStatistics(),
  });

  // Handle 403 errors
  useEffect(() => {
    if (error && (error as any).response?.status === 403) {
      const msg = (error as any).response?.data?.message || 'Akses ditolak';
      const roles = (error as any).response?.data?.requiredRoles || [];
      toast.error(`${msg}${roles.length ? `. Required roles: ${roles.join(', ')}` : ''}`, { duration: 5000 });
    }
  }, [error]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const customers = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };
  const totalCustomers = statistics?.total || pagination.total;

  const importMutation = useMutation({
    mutationFn: (file: File) => customersService.import(file),
    onSuccess: (result) => {
      const createdText = result.created > 0 ? `${result.created} dibuat` : '';
      const updatedText = result.updated > 0 ? `${result.updated} diupdate` : '';
      const successText = [createdText, updatedText].filter(Boolean).join(', ');
      toast.success(`Import berhasil! ${successText}${result.failed > 0 ? `, ${result.failed} gagal` : ''}`);
      if (result.errors.length > 0) {
        const errorDetails = result.errors.slice(0, 5).map((e: any) => `Baris ${e.row}: ${e.error}`).join('; ');
        toast.warning(`Beberapa data gagal: ${errorDetails}${result.errors.length > 5 ? '...' : ''}`);
      }
      setShowImportModal(false);
      setImportFile(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal mengimport data');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customersService.delete(id),
    onSuccess: () => {
      toast.success('Pelanggan berhasil dihapus');
      setDeleteModalOpen(false);
      setCustomerToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-statistics'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus pelanggan');
    },
  });

  const handleExport = async () => {
    try {
      await customersService.export({ page, limit, search: searchTerm || undefined });
      toast.success('Data berhasil diekspor');
    } catch {
      toast.error('Gagal mengekspor data');
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column as 'createdAt' | 'name');
      setSortOrder(column === 'name' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return (
      <div>
        <div className="text-sm font-medium text-foreground">
          {date.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    );
  };

  const getPageNumbers = (current: number, totalPages: number): (number | '...')[] => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = new Set<number>([1, current - 1, current, current + 1, totalPages]);
    const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    const result: (number | '...')[] = [];
    let prev = 0;
    for (const p of sorted) {
      if (p - prev > 1) result.push('...');
      result.push(p);
      prev = p;
    }
    return result;
  };

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Kode & Nama',
      sortable: true,
      cell: (customer) => (
        <div
          className="flex items-center gap-4 cursor-pointer"
          onClick={() => navigate(`/customers/${customer.id}`)}
        >
          <div className="flex-shrink-0 h-14 w-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-base font-semibold text-foreground hover:text-primary-600 transition-colors">
              {customer.name}
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">{customer.customerCode}</div>
            <div className="text-xs text-muted-foreground mt-0.5 capitalize">
              {customer.customerType === 'retail' ? 'Retail' : customer.customerType === 'wholesale' ? 'Wholesale' : 'Corporate'}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Telepon & Email',
      cell: (customer) => (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span>{customer.phone}</span>
          </div>
          {customer.alternatePhone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="truncate max-w-xs">{customer.alternatePhone}</span>
            </div>
          )}
          {customer.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="truncate max-w-xs">{customer.email}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'address',
      header: 'Alamat',
      cell: (customer) => (
        <div className="text-sm text-muted-foreground max-w-xs">
          {customer.address ? (
            <div className="truncate">{customer.address}</div>
          ) : (
            <span className="italic">-</span>
          )}
          {(customer.city || customer.province) && (
            <div className="text-xs text-muted-foreground mt-1">
              {[customer.city, customer.province].filter(Boolean).join(', ')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Tanggal Dibuat',
      sortable: true,
      cell: (customer) => formatDate(customer.createdAt),
    },
  ];

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Manajemen Pelanggan" subtitle="Kelola data pelanggan dan riwayat transaksi">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowImportModal(true)}

        >
          <Upload className="w-4 h-4 mr-1" />
          Import
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExport}

        >
          <Download className="w-4 h-4 mr-1" />
          Export
        </Button>
        <Button
          onClick={() => setShowFormModal(true)}
          className="flex items-center gap-2 bg-white text-primary-600 border border-gray-200 hover:bg-primary-50"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Pelanggan</span>
        </Button>
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">
            {(error as any).response?.data?.message || (error as Error).message || 'Terjadi kesalahan'}
          </p>
          {(error as any).response?.data?.requiredRoles && (
            <p className="text-red-700 text-sm mt-1">
              Required roles: {(error as any).response.data.requiredRoles.join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
        <StatCard
          icon={<Users className="w-6 h-6 text-white" />}
          iconBg="from-primary-500 to-primary-600"
          label="Total Pelanggan"
          value={isLoading ? '-' : totalCustomers}
          subtitle="Semua pelanggan terdaftar"
        />
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama, telepon, email, atau kode pelanggan..."
        fields={[
          {
            key: 'type',
            label: 'Tipe Pelanggan',
            type: 'select',
            options: [
              { value: 'retail', label: 'Retail' },
              { value: 'wholesale', label: 'Wholesale' },
              { value: 'corporate', label: 'Corporate' },
            ],
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'active', label: 'Aktif' },
              { value: 'inactive', label: 'Terhapus' },
            ],
          },
        ]}
        values={{ type: filterType, status: filterStatus }}
        onFieldChange={(key, v) => {
          if (key === 'type') {
            setFilterType(v);
            setPage(1);
          }
          if (key === 'status') {
            setFilterStatus(v);
            setPage(1);
          }
        }}
        onReset={() => {
          setFilterType('');
          setFilterStatus('');
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={customers}
        keyExtractor={(c: any) => c.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada pelanggan ditemukan"
        emptyIcon={<Users className="w-16 h-16" />}
        sortColumn={sortBy}
        sortDirection={sortOrder}
        onSort={handleSort}
        actions={(customer: any) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/customers/${customer.id}`)}
              title="Lihat Detail"
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingCustomerId(customer.id);
                setShowFormModal(true);
              }}
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              onClick={() => {
                setCustomerToDelete({ id: customer.id, name: customer.name });
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
      {!isLoading && customers.length > 0 && (
        <div className="bg-white px-6 py-4 rounded-xl border border-gray-200 flex items-center justify-between gap-3">
          <RowsPerPageSelect
            value={limit}
            options={[10, 20, 50, 100]}
            onChange={(v) => {
              setLimit(v as 10 | 20 | 50 | 100);
              setPage(1);
            }}
          />
          <div className="text-sm text-gray-700">
            Menampilkan {customers.length} dari{' '}
            <span className="font-semibold">{pagination.total}</span> pelanggan
            <span className="ml-2 text-gray-500">
              (Halaman {pagination.page} dari {pagination.totalPages})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              Sebelumnya
            </Button>
            {getPageNumbers(pagination.page, pagination.totalPages).map((n, i) =>
              n === '...' ? (
                <span key={`e${i}`} className="px-1 text-gray-400">
                  …
                </span>
              ) : (
                <Button
                  key={n}
                  variant={n === pagination.page ? 'default' : 'outline'}
                  size="sm"
                  className={n === pagination.page ? 'bg-primary text-white' : ''}
                  onClick={() => setPage(n)}
                >
                  {n}
                </Button>
              ),
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= pagination.totalPages}
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      )}

      {/* Import Modal */}
      <Dialog
        open={showImportModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowImportModal(false);
            setImportFile(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Pelanggan</DialogTitle>
          </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pilih File CSV</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setImportFile(file);
              }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
            <p className="text-xs text-gray-500 mt-2">Format: CSV dengan header sesuai template</p>
          </div>
          {importFile && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium">{importFile.name}</p>
              <p className="text-xs text-gray-500">{(importFile.size / 1024).toFixed(2)} KB</p>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setShowImportModal(false); setImportFile(null); }}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={() => { if (importFile) importMutation.mutate(importFile); }}
              disabled={!importFile || importMutation.isPending}
              className="flex-1"
            >
              {importMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Mengimport...
                </span>
              ) : (
                'Import'
              )}
            </Button>
          </div>
        </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteModalOpen(false);
            setCustomerToDelete(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Hapus</DialogTitle>
          </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-red-100 rounded-full">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-700 mb-2">
                Apakah Anda yakin ingin menghapus pelanggan <strong>{customerToDelete?.name}</strong>?
              </p>
              <p className="text-xs text-gray-500">
                Tindakan ini akan melakukan soft delete. Data pelanggan tidak akan muncul di daftar, tetapi masih tersimpan di database.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { setDeleteModalOpen(false); setCustomerToDelete(null); }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              disabled={deleteMutation.isPending}
            >
              Batal
            </button>
            <button
              onClick={() => { if (customerToDelete) deleteMutation.mutate(customerToDelete.id); }}
              disabled={deleteMutation.isPending}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Menghapus...</>
              ) : 'Hapus'}
            </button>
          </div>
        </div>
        </DialogContent>
      </Dialog>

      {/* Customer Form Modal (Create / Edit with tabs) */}
      <CustomerFormModal
        open={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingCustomerId(undefined);
        }}
        customerId={editingCustomerId}
      />
    </div>
  );
}
