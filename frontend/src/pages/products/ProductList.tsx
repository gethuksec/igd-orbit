import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Package,
  DollarSign,
  Barcode,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Upload,
  X,
} from 'lucide-react';

import { api } from '../../services/api';
import { productsService } from '../../services/products.service';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { PageHeader } from '@/components/shared';
import { StatCard } from '@/components/shared';
import { DataTable } from '@/components/shared';
import type { Column } from '@/components/shared';

export default function ProductList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<10 | 20 | 50 | 100>(20);

  // Fetch categories for filter
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return res.data.data || res.data || [];
    },
  });

  // Flatten categories tree for dropdown
  const flattenCategories = (cats: any[]): any[] => {
    const result: any[] = [];
    cats?.forEach((cat) => {
      result.push({ id: cat.id, name: cat.name });
      if (cat.children && cat.children.length > 0) {
        result.push(...flattenCategories(cat.children));
      }
    });
    return result;
  };

  const categories = categoriesData ? flattenCategories(Array.isArray(categoriesData) ? categoriesData : [categoriesData]) : [];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['products', page, limit, searchTerm, selectedStatus, selectedCategory],
    queryFn: async () => {
      const response = await api.get('/products', {
        params: {
          page,
          limit,
          search: searchTerm || undefined,
          'filter[status]': selectedStatus,
          'filter[category]': selectedCategory || undefined,
          include: 'category,brand,stock',
        },
      });
      return response.data;
    },
    staleTime: 10000,
  });

  useEffect(() => {
    if (data) console.log('Products data:', data);
    if (error) console.error('Products error:', error);
  }, [data, error]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, selectedStatus, selectedCategory]);

  const products = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const { data: statistics } = useQuery({
    queryKey: ['products-statistics'],
    queryFn: () => productsService.getStatistics(),
  });

  const totalProducts = statistics?.total || pagination.total;
  const totalStockValue = statistics?.totalStockValue || 0;
  const lowStockCount = statistics?.lowStockCount || 0;
  const activeCount = statistics?.activeCount || 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  const handleExport = async () => {
    try {
      const response = await api.get('/products/export', {
        params: {
          page,
          limit,
          search: searchTerm || undefined,
          'filter[status]': selectedStatus,
          'filter[category]': selectedCategory || undefined,
        },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `products_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      console.error('Export failed:', err);
      if (err.response?.status === 404) {
        toast.error('Fitur export belum tersedia. Silakan hubungi administrator.');
      }
    }
  };

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: (result: any) => {
      const createdText = result.created > 0 ? `${result.created} dibuat` : '';
      const updatedText = result.updated > 0 ? `${result.updated} diupdate` : '';
      const successText = [createdText, updatedText].filter(Boolean).join(', ');
      toast.success(`Import berhasil! ${successText}${result.failed > 0 ? `, ${result.failed} gagal` : ''}`);
      if (result.errors?.length > 0) {
        const errorDetails = result.errors.slice(0, 5).map((e: any) => `Baris ${e.row}: ${e.error}`).join('; ');
        toast.warning(`Beberapa data gagal: ${errorDetails}${result.errors.length > 5 ? '...' : ''}`, { duration: 5000 });
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
    mutationFn: (id: string) => productsService.delete(id),
    onSuccess: () => {
      toast.success('Produk berhasil dihapus');
      setDeleteModalOpen(false);
      setProductToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus produk');
    },
  });

  const columns: Column<any>[] = [
    {
      key: 'product',
      header: 'Produk',
      cell: (product) => (
        <div className="flex items-center gap-4">
          <Link to={`/products/${product.id}`} className="flex-shrink-0 hover:opacity-80 transition-opacity">
            <div className="h-14 w-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white shadow-md">
              <Package className="w-7 h-7" />
            </div>
          </Link>
          <div className="min-w-0 max-w-[200px]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="group/tooltip relative min-w-0">
                <Link to={`/products/${product.id}`} className="block truncate text-base font-semibold text-foreground hover:text-primary-600 transition-colors cursor-default">
                  {product.name}
                </Link>
                <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 shadow-lg rounded-lg p-3 text-gray-900 text-xs whitespace-normal break-words max-w-[280px] z-50 hidden group-hover/tooltip:block pointer-events-none">
                  <p className="font-semibold text-sm mb-1.5">{product.name}</p>
                  <p className="text-gray-500 mb-0.5">Harga Min. {formatCurrency(product.costPrice)}</p>
                  <p className="text-gray-500">Stok: {(product as any).stockSummary?.totalAvailable ?? (product as any).totalStock ?? 0}</p>
                </div>
              </div>
              {(product as any).isService && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                  Jasa
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
              <Barcode className="w-3.5 h-3.5" />
              <span className="font-mono truncate max-w-[150px]">{product.sku}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'sellingPrice',
      header: 'Harga Jual',
      cell: (product) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{formatCurrency(product.sellingPrice)}</span>
          {(product as any).minSellingPrice ? (
            <span className="text-xs text-red-600">{formatCurrency((product as any).minSellingPrice)}</span>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Stok',
      cell: (product) => (
        <div className="flex items-center gap-2">
          {(product as any).stockSummary?.branches ? (
            <div className="group relative">
              <span
                className={`text-base font-bold cursor-help ${
                  ((product as any).totalStock || 0) < ((product as any).minStock || 0)
                    ? 'text-red-600'
                    : 'text-foreground'
                }`}
              >
                {(product as any).totalStock || 0}
              </span>
              <div className="absolute left-0 top-full mt-2 w-64 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 p-3">
                <div className="font-semibold mb-2 pb-2 border-b border-gray-700">Stok Per Cabang</div>
                {(product as any).stockSummary.branches.map((branch: any) => {
                  const branchStock = branch.available - branch.reserved;
                  return (
                    <div key={branch.branchId} className="flex justify-between items-center py-1">
                      <span className="text-gray-300">{branch.branchName}:</span>
                      <span className="font-semibold">{branchStock}</span>
                    </div>
                  );
                })}
                <div className="mt-2 pt-2 border-t border-gray-700 text-gray-400 text-xs">
                  Tersedia: {(product as any).stockSummary.totalAvailable || 0} |
                  Reserved: {(product as any).stockSummary.totalReserved || 0}
                </div>
              </div>
            </div>
          ) : (
            <span
              className={`text-base font-bold ${
                ((product as any).totalStock || 0) < ((product as any).minStock || 0)
                  ? 'text-red-600'
                  : 'text-foreground'
              }`}
            >
              {(product as any).totalStock || 0}
            </span>
          )}
          {((product as any).totalStock || 0) < ((product as any).minStock || 0) && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Rendah
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Kategori',
      cell: (product) => (
        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
          {product.category?.name || product.categoryId}
        </span>
      ),
    },
    {
      key: 'brand',
      header: 'Merk',
      cell: (product) => (
        <span className="text-sm text-foreground">{product.brand?.name || '-'}</span>
      ),
    },
    {
      key: 'costPrice',
      header: 'Harga Beli',
      cell: (product) => (
        <div className="text-sm font-semibold text-foreground">{formatCurrency(product.costPrice)}</div>
      ),
    },
  ];

  return (
    <div className="w-full space-y-3">
      <PageHeader title="Manajemen Produk" subtitle="Kelola inventori dan harga produk dengan mudah">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowImportModal(true)}
          className="text-white/80 hover:text-white hover:bg-white/20"
        >
          <Upload className="w-4 h-4 mr-1" />
          Import
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExport}
          disabled={isLoading}
          className="text-white/80 hover:text-white hover:bg-white/20"
        >
          <Download className="w-4 h-4 mr-1" />
          Export
        </Button>
        <Link to="/products/new">
          <Button className="flex items-center gap-2 bg-white text-primary-600 hover:bg-primary-50">
            <Plus className="w-5 h-5" />
            <span>Tambah Produk</span>
          </Button>
        </Link>
      </PageHeader>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Package className="w-6 h-6 text-white" />}
          iconBg="from-primary-500 to-primary-600"
          label="Total Produk"
          value={isLoading ? '-' : totalProducts}
          subtitle="Semua produk terdaftar"
        />
        <StatCard
          icon={<DollarSign className="w-6 h-6 text-white" />}
          iconBg="from-green-500 to-green-600"
          label="Nilai Stok"
          value={isLoading ? '-' : formatCurrency(totalStockValue)}
          subtitle="Total nilai inventori"
        />
        <StatCard
          icon={<AlertTriangle className="w-6 h-6 text-white" />}
          iconBg="from-yellow-500 to-yellow-600"
          label="Stok Rendah"
          value={isLoading ? '-' : lowStockCount}
          subtitle="Perlu restock segera"
          badge={{ text: 'Alert', className: 'bg-yellow-100 text-yellow-800' }}
        />
        <StatCard
          icon={<CheckCircle2 className="w-6 h-6 text-white" />}
          iconBg="from-blue-500 to-blue-600"
          label="Produk Aktif"
          value={isLoading ? '-' : activeCount}
          subtitle="Sedang aktif dijual"
          badge={{ text: 'Active', className: 'bg-green-100 text-green-800' }}
        />
      </div>

      {/* Search — full width */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari nama produk, SKU, atau barcode..."
          className="w-full pl-10 h-11 text-sm"
        />
      </div>

      {/* Filter Row — category, per-page, status */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {/* Kategori dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Kategori:</label>
          <select
            value={selectedCategory}
            onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
            className="h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Semua Kategori</option>
            {categories.map((cat: any) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Per Halaman dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Per Hal:</label>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(parseInt(e.target.value) as 10 | 20 | 50 | 100);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {/* Status buttons */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Status:</span>
          <div className="flex gap-1">
            {(['all', 'active', 'inactive'] as const).map((key) => (
              <button
                key={key}
                onClick={() => { setSelectedStatus(key); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedStatus === key
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {key === 'all' ? 'Semua' : key === 'active' ? 'Aktif' : 'Tidak Aktif'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={products}
        keyExtractor={(p: any) => p.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada produk ditemukan"
        emptyIcon={<Package className="w-16 h-16" />}
        actions={(product: any) => (
          <div className="flex items-center justify-end gap-1">
            <Link to={`/products/${product.id}`}>
              <Button variant="ghost" size="sm" title="Lihat Detail">
                <Eye className="w-4 h-4" />
              </Button>
            </Link>
            <Link to={`/products/${product.id}/edit`}>
              <Button variant="ghost" size="sm" title="Edit">
                <Edit className="w-4 h-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              onClick={() => {
                setProductToDelete({ id: product.id, name: product.name });
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
      {!isLoading && products.length > 0 && pagination.totalPages > 1 && (
        <div className="bg-white px-6 py-4 rounded-xl border border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Menampilkan {products.length} dari{' '}
            <span className="font-semibold">{pagination.total}</span> produk
            <span className="ml-2 text-gray-500">
              (Halaman {pagination.page} dari {pagination.totalPages})
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sebelumnya
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= pagination.totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowImportModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Import Produk</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setShowImportModal(false); setImportFile(null); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Pilih File CSV</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setImportFile(file);
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                <p className="text-xs text-gray-500 mt-2">Format: CSV dengan header sesuai template.</p>
              </div>
              {importFile && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium">{importFile.name}</p>
                  <p className="text-xs text-gray-500">{(importFile.size / 1024).toFixed(2)} KB</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  type="button"
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
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          if (!open) { setDeleteModalOpen(false); setProductToDelete(null); }
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
                Apakah Anda yakin ingin menghapus produk <strong>{productToDelete?.name}</strong>?
              </p>
              <p className="text-xs text-gray-500">
                Tindakan ini akan melakukan soft delete. Data produk tidak akan muncul di daftar, tetapi masih tersimpan di database.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { setDeleteModalOpen(false); setProductToDelete(null); }}
              disabled={deleteMutation.isPending}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Batal
            </button>
            <button
              onClick={() => { if (productToDelete) deleteMutation.mutate(productToDelete.id); }}
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
    </div>
  );
}
