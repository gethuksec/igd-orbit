import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Package,
  DollarSign,
  Barcode,
  History,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Upload,
} from 'lucide-react';

import { api } from '../../services/api';
import { productsService } from '../../services/products.service';
import { customerTiersService } from '../../services/customer-tiers.service';
import ProductImportModal from './ProductImportModal';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTimeId } from "@/lib/utils";
import { Button } from '../../components/ui/button';
import { BreadcrumbHeader, StatCard, DataTable, FilterToolbar, ExportButton, datedFilename, StatusDot } from '@/components/shared';
import type { Column } from '@/components/shared';

export default function ProductList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [stockOp, setStockOp] = useState<string>('');
  const [stockValue, setStockValue] = useState<string>('');
  const [soldOp, setSoldOp] = useState<string>('');
  const [soldValue, setSoldValue] = useState<string>('');
  const [ageOp, setAgeOp] = useState<string>('');
  const [ageValue, setAgeValue] = useState<string>('');
  const [ageUnit, setAgeUnit] = useState<string>('');
  const [costOp, setCostOp] = useState<string>('');
  const [costValue, setCostValue] = useState<string>('');
  const [priceOp, setPriceOp] = useState<string>('');
  const [priceValue, setPriceValue] = useState<string>('');
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

  // Sub-categories of the selected category (or all sub-categories)
  const treeCategories: any[] = Array.isArray(categoriesData)
    ? categoriesData
    : categoriesData
      ? [categoriesData]
      : [];
  const allSubCategories = treeCategories.flatMap((c: any) =>
    (c.children || c.subCategories || []).map((s: any) => ({ ...s, parentId: c.id, parentName: c.name })),
  );
  const subCategoryOptions = selectedCategory
    ? allSubCategories.filter((s: any) => s.parentId === selectedCategory)
    : allSubCategories;

  // Searchable option fetchers for the filter popup (limit 20 per keystroke)
  const fetchMasterOptions = (url: string, toLabel: (r: any) => string) => async (q: string) => {
    const res = await api.get(url, { params: { search: q || undefined, limit: 20 } });
    const rows = res.data.data || res.data || [];
    return (Array.isArray(rows) ? rows : [])
      .map((r: any) => ({ value: r.id, label: toLabel(r) }))
      .filter((o: any) => o.value);
  };
  const fetchCategories = async (q: string) => {
    const needle = (q || '').toLowerCase();
    return categories
      .filter((c: any) => !needle || c.name.toLowerCase().includes(needle))
      .slice(0, 20)
      .map((c: any) => ({ value: c.id, label: c.name }));
  };
  const fetchSubCategories = async (q: string) => {
    const needle = (q || '').toLowerCase();
    return subCategoryOptions
      .filter((s: any) => !needle || s.name.toLowerCase().includes(needle))
      .slice(0, 20)
      .map((s: any) => ({ value: s.id, label: s.parentName ? `${s.name} (${s.parentName})` : s.name }));
  };
  const fetchBrands = fetchMasterOptions('/brands', (b: any) => b.name);
  const fetchColors = fetchMasterOptions('/colors', (c: any) => c.name);
  const fetchSizes = fetchMasterOptions('/sizes', (s: any) => s.name);
  const fetchUnits = fetchMasterOptions('/units', (u: any) => u.name);
  const fetchSuppliers = fetchMasterOptions(
    '/suppliers',
    (s: any) => (s.customerCode ? `${s.name} (${s.customerCode})` : s.name),
  );

  const filterParams = {
    'filter[status]': selectedStatus,
    'filter[category]': selectedCategory || undefined,
    'filter[subCategory]': selectedSubCategory || undefined,
    'filter[brand]': selectedBrand || undefined,
    'filter[color]': selectedColor || undefined,
    'filter[size]': selectedSize || undefined,
    'filter[unit]': selectedUnit || undefined,
    'filter[supplier]': selectedSupplier || undefined,
    'filter[stockOp]': stockValue ? stockOp || 'gt' : undefined,
    'filter[stockValue]': stockValue || undefined,
    'filter[soldOp]': soldValue ? soldOp || 'gt' : undefined,
    'filter[soldValue]': soldValue || undefined,
    'filter[ageOp]': ageValue ? ageOp || 'gt' : undefined,
    'filter[ageValue]': ageValue || undefined,
    'filter[ageUnit]': ageValue ? ageUnit || 'days' : undefined,
    'filter[costOp]': costValue ? costOp || 'gt' : undefined,
    'filter[costValue]': costValue || undefined,
    'filter[priceOp]': priceValue ? priceOp || 'gt' : undefined,
    'filter[priceValue]': priceValue || undefined,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['products', page, limit, searchTerm, selectedStatus, filterParams],
    queryFn: async () => {
      const response = await api.get('/products', {
        params: {
          page,
          limit,
          search: searchTerm || undefined,
          ...filterParams,
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
  }, [searchTerm, selectedStatus, selectedCategory, selectedSubCategory, selectedBrand, selectedColor, selectedSize, selectedUnit, selectedSupplier, stockOp, stockValue, soldOp, soldValue, ageOp, ageValue, ageUnit, costOp, costValue, priceOp, priceValue]);

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

  // IGDERP-310: tier perak untuk lapis harga bawah (merah). Harga silver =
  // simpanan memberPricing tier SILVER, fallback ke Harga Jual Minimum.
  const { data: tiersData } = useQuery({
    queryKey: ['customer-tiers-active'],
    queryFn: () => customerTiersService.getAll({ limit: 50 }),
    staleTime: 300000,
  });
  const silverTier = (tiersData?.data || []).find((t: any) => t.code === 'SILVER');
  const silverPriceOf = (product: any): number | null => {
    const stored = silverTier ? product?.memberPricing?.[silverTier.id] : undefined;
    if (typeof stored === 'number' && stored > 0) return stored;
    if (stored && typeof stored.price === 'number' && stored.price > 0) return stored.price;
    if (stored && typeof stored.discount === 'number') {
      return Math.round((product?.sellingPrice || 0) * (1 - stored.discount / 100));
    }
    return product?.minSellingPrice ?? null;
  };
  const relationName = (v: any): string => (typeof v === 'string' ? v : v?.name || '');
  const classStyle: Record<string, string> = {
    fast: 'text-green-600 dark:text-green-400',
    medium: 'text-blue-600 dark:text-blue-400',
    slow: 'text-amber-600 dark:text-amber-400',
    dead: 'text-red-600 dark:text-red-400',
  };

  const [showImportModal, setShowImportModal] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

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
      key: 'barcode',
      header: 'Barcode',
      cell: (product) => (
        <span className="font-mono text-[13px] tabular-nums text-foreground">
          {product.barcode || '-'}
        </span>
      ),
    },
    {
      key: 'product',
      header: 'Produk',
      stickyLeft: true,
      frozenWidth: 280,
      cell: (product) => (
        <div className="flex items-center gap-4">
          <Link to={`/products/${product.id}`} className="flex-shrink-0 hover:opacity-80 transition-opacity">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <Package className="h-5 w-5" />
            </div>
          </Link>
          <div className="min-w-0 max-w-[200px]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="group/tooltip relative min-w-0">
                <Link to={`/products/${product.id}`} className="block truncate text-[15px] font-medium text-foreground hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-default">
                  {product.name}
                </Link>
                <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg rounded-lg p-3 text-gray-900 dark:text-gray-100 text-xs whitespace-normal break-words max-w-[280px] z-50 hidden group-hover/tooltip:block pointer-events-none">
                  <p className="font-semibold text-sm mb-1.5">{product.name}</p>
                  <p className="text-gray-500 dark:text-gray-400 mb-0.5">Harga Min. {formatCurrency(product.costPrice)}</p>
                  <p className="text-gray-500 dark:text-gray-400">Stok: {(product as any).stockSummary?.totalAvailable ?? (product as any).totalStock ?? 0}</p>
                </div>
              </div>
              {(product as any).isService && (
                <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">
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
      key: 'price',
      header: 'Harga',
      cell: (product) => {
        const silver = silverPriceOf(product);
        return (
          <div
            className="flex flex-col"
            title={`User: ${formatCurrency(product.sellingPrice)}${silver ? ` • Silver: ${formatCurrency(silver)}` : ''}`}
          >
            <span className="font-medium tabular-nums text-foreground">{formatCurrency(product.sellingPrice)}</span>
            {silver ? (
              <span className="text-xs text-red-600 dark:text-red-400 tabular-nums">{formatCurrency(silver)}</span>
            ) : (
              <span className="text-xs text-muted-foreground">-</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'stock',
      header: 'Stok',
      cell: (product) => (
        <div className="flex items-center gap-2">
          {(product as any).stockSummary?.branches ? (
            <div className="group relative">
              <span
                className={`font-mono text-base font-medium tabular-nums cursor-help ${
                  ((product as any).totalStock || 0) < ((product as any).minStock || 0)
                    ? 'text-red-600 dark:text-red-400'
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
                      <span className="text-gray-300 dark:text-gray-600">{branch.branchName}:</span>
                      <span className="font-semibold">{branchStock}</span>
                    </div>
                  );
                })}
                <div className="mt-2 pt-2 border-t border-gray-700 text-gray-400 dark:text-gray-500 text-xs">
                  Tersedia: {(product as any).stockSummary.totalAvailable || 0} |
                  Reserved: {(product as any).stockSummary.totalReserved || 0}
                </div>
              </div>
            </div>
          ) : (
            <span
              className={`font-mono text-base font-medium tabular-nums ${
                ((product as any).totalStock || 0) < ((product as any).minStock || 0)
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-foreground'
              }`}
            >
              {(product as any).totalStock || 0}
            </span>
          )}
          {((product as any).totalStock || 0) < ((product as any).minStock || 0) && (
            <StatusDot tone="bad">Rendah</StatusDot>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Kategori',
      cell: (product) => (
        <span className="text-sm text-muted-foreground">
          {product.category?.name || product.categoryId}
        </span>
      ),
    },
    {
      key: 'grade',
      header: 'Grade',
      cell: (product) => (
        <span className="text-sm text-foreground">{(product as any).grade || '-'}</span>
      ),
    },
    {
      key: 'brand',
      header: 'Merek',
      cell: (product) => (
        <span className="text-sm text-foreground">{product.brand?.name || '-'}</span>
      ),
    },
    {
      key: 'color',
      header: 'Warna',
      cell: (product) => (
        <span className="text-sm text-foreground">{relationName((product as any).color) || '-'}</span>
      ),
    },
    {
      key: 'class',
      header: 'Class',
      cell: (product) => {
        const kelas = (product as any).kelas as string | null;
        if (!kelas) return <span className="text-sm text-muted-foreground">-</span>;
        return (
          <span
            className={`text-sm font-semibold capitalize tabular-nums ${classStyle[kelas] || ''}`}
            title="fast: ≥1x/hari • medium: ≥3x/minggu • slow: < itu • dead: 90 hari tak terjual"
          >
            {kelas}
          </span>
        );
      },
    },
    {
      key: 'modal',
      header: 'Modal',
      cell: (product) => {
        const v = (product as any).modalTerakhir ?? product.costPrice;
        const hasHist = (product as any).modalTerakhir != null;
        return (
          <div
            className="text-sm font-medium tabular-nums text-foreground"
            title={hasHist ? 'Harga beli terakhir (goods receipt)' : 'Belum ada pembelian — modal master'}
          >
            {formatCurrency(v)}
          </div>
        );
      },
    },
    {
      key: 'modalPurata',
      header: 'Modal Purata',
      cell: (product) => {
        const v = (product as any).modalPurata ?? product.costPrice;
        const hasHist = (product as any).modalPurata != null;
        return (
          <div
            className="text-sm font-medium tabular-nums text-foreground"
            title={hasHist ? 'Rata-rata tertimbang harga beli (goods receipt)' : 'Belum ada pembelian — modal master'}
          >
            {formatCurrency(v)}
          </div>
        );
      },
    },
    {
      key: 'umur',
      header: 'Umur',
      cell: (product) => {
        const v = (product as any).umurHari;
        return (
          <span
            className="text-sm tabular-nums text-foreground"
            title="Hari sejak terakhir dibeli"
          >
            {v != null ? `${v} hr` : '-'}
          </span>
        );
      },
    },
    {
      key: 'usia',
      header: 'Usia',
      cell: (product) => {
        const v = (product as any).usiaHari;
        return (
          <span
            className="text-sm tabular-nums text-foreground"
            title="Lama di gudang (hari)"
          >
            {v != null ? `${v} hr` : '-'}
          </span>
        );
      },
    },
    {
      key: 'unit',
      header: 'Satuan',
      cell: (product) => (
        <span className="text-sm text-muted-foreground">{relationName((product as any).unit) || '-'}</span>
      ),
    },
    {
      key: 'type',
      header: 'Jenis',
      cell: (product) => (
        <span className="text-sm text-muted-foreground">{(product as any).isService ? 'Jasa' : 'Produk'}</span>
      ),
    },
    {
      key: 'log',
      header: 'Log',
      cell: (product) => (
        <Link
          to={`/products/${product.id}`}
          title="Riwayat aktivitas"
          className="inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          <History className="h-4 w-4" />
          Log
        </Link>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      cell: (product) => (
        <StatusDot tone={(product as any).isActive ? 'ok' : 'off'}>
          {(product as any).isActive ? 'Aktif' : 'Tidak Aktif'}
        </StatusDot>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Terakhir Diupdate',
      cell: (product) => (
        <div className="text-sm tabular-nums text-muted-foreground">
          {formatDateTimeId((product as any).updatedAt)}
        </div>
      ),
    },
  ];

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Manajemen Produk" subtitle="Sparepart HP — stok, harga, dan penjualan per cabang">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowImportModal(true)}

        >
          <Upload className="w-4 h-4 mr-1" />
          Import
        </Button>
        <ExportButton
          label="Export"
          filename={() => datedFilename('products')}
          onExport={() => productsService.exportProductsXlsx()}
        />
        <Link to="/products/new">
          <Button className="flex items-center gap-2 bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 border border-gray-200 dark:border-gray-700 hover:bg-primary-50 dark:hover:bg-primary-950">
            <Plus className="w-5 h-5" />
            <span>Tambah Produk</span>
          </Button>
        </Link>
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 dark:text-red-200 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Package className="h-5 w-5" />}
          label="Total Produk"
          value={isLoading ? '-' : totalProducts}
          subtitle="Semua produk terdaftar"
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Nilai Stok"
          value={isLoading ? '-' : formatCurrency(totalStockValue)}
          subtitle="Total nilai inventori"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Stok Rendah"
          value={isLoading ? '-' : lowStockCount}
          subtitle="Perlu restock segera"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Produk Aktif"
          value={isLoading ? '-' : (statistics?.sumRegular != null ? formatCurrency(statistics.sumRegular) : activeCount)}
          subtitle={
            isLoading
              ? 'Sedang aktif dijual'
              : (statistics?.sumRegular != null
                ? `Silver: ${formatCurrency(statistics.sumSilver || 0)} • Aktif: ${activeCount}`
                : 'Sedang aktif dijual')
          }
        />
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari produk, SKU, barcode"
        fields={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'active', label: 'Aktif' },
              { value: 'inactive', label: 'Tidak Aktif' },
            ],
          },
          {
            key: 'category',
            label: 'Kategori',
            type: 'search-select',
            fetchOptions: fetchCategories,
            placeholder: 'Ketik untuk mencari kategori...',
          },
          {
            key: 'subCategory',
            label: 'Sub kategori',
            type: 'search-select',
            fetchOptions: fetchSubCategories,
            placeholder: 'Ketik untuk mencari sub kategori...',
          },
          {
            key: 'brand',
            label: 'Brand',
            type: 'search-select',
            fetchOptions: fetchBrands,
            placeholder: 'Ketik untuk mencari brand...',
          },
          {
            key: 'color',
            label: 'Warna',
            type: 'search-select',
            fetchOptions: fetchColors,
            placeholder: 'Ketik untuk mencari warna...',
          },
          {
            key: 'size',
            label: 'Ukuran',
            type: 'search-select',
            fetchOptions: fetchSizes,
            placeholder: 'Ketik untuk mencari ukuran...',
          },
          {
            key: 'unit',
            label: 'Satuan',
            type: 'search-select',
            fetchOptions: fetchUnits,
            placeholder: 'Ketik untuk mencari satuan...',
          },
          {
            key: 'supplier',
            label: 'Supplier',
            type: 'search-select',
            fetchOptions: fetchSuppliers,
            placeholder: 'Ketik untuk mencari supplier...',
          },
          {
            key: 'stock',
            label: 'Perkiraan jumlah',
            type: 'number-compare',
            placeholder: '0',
          },
          {
            key: 'sold',
            label: 'Total unit terjual',
            type: 'number-compare',
            placeholder: '0',
          },
          {
            key: 'age',
            label: 'Umur produk (dari restock)',
            type: 'age',
          },
          {
            key: 'cost',
            label: 'Harga modal',
            type: 'number-compare',
            placeholder: 'Rp',
          },
          {
            key: 'price',
            label: 'Harga jual',
            type: 'number-compare',
            placeholder: 'Rp',
          },
        ]}
        values={{
          status: selectedStatus === 'all' ? '' : selectedStatus,
          category: selectedCategory,
          subCategory: selectedSubCategory,
          brand: selectedBrand,
          color: selectedColor,
          size: selectedSize,
          unit: selectedUnit,
          supplier: selectedSupplier,
          stock: stockValue,
          stockOp,
          sold: soldValue,
          soldOp,
          age: ageValue,
          ageOp,
          ageUnit,
          cost: costValue,
          costOp,
          price: priceValue,
          priceOp,
        }}
        onFieldChange={(key, v) => {
          setPage(1);
          switch (key) {
            case 'status': setSelectedStatus(v || 'all'); break;
            case 'category':
              setSelectedCategory(v || '');
              setSelectedSubCategory('');
              break;
            case 'subCategory': setSelectedSubCategory(v || ''); break;
            case 'brand': setSelectedBrand(v || ''); break;
            case 'color': setSelectedColor(v || ''); break;
            case 'size': setSelectedSize(v || ''); break;
            case 'unit': setSelectedUnit(v || ''); break;
            case 'supplier': setSelectedSupplier(v || ''); break;
            case 'stock': setStockValue(v || ''); break;
            case 'stockOp': setStockOp(v || ''); break;
            case 'sold': setSoldValue(v || ''); break;
            case 'soldOp': setSoldOp(v || ''); break;
            case 'age': setAgeValue(v || ''); break;
            case 'ageOp': setAgeOp(v || ''); break;
            case 'ageUnit': setAgeUnit(v || ''); break;
            case 'cost': setCostValue(v || ''); break;
            case 'costOp': setCostOp(v || ''); break;
            case 'price': setPriceValue(v || ''); break;
            case 'priceOp': setPriceOp(v || ''); break;
          }
        }}
        onReset={() => {
          setSelectedStatus('active');
          setSelectedCategory('');
          setSelectedSubCategory('');
          setSelectedBrand('');
          setSelectedColor('');
          setSelectedSize('');
          setSelectedUnit('');
          setSelectedSupplier('');
          setStockOp('');
          setStockValue('');
          setSoldOp('');
          setSoldValue('');
          setAgeOp('');
          setAgeValue('');
          setAgeUnit('');
          setCostOp('');
          setCostValue('');
          setPriceOp('');
          setPriceValue('');
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={products}
        keyExtractor={(p: any) => p.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada produk ditemukan"
        emptyIcon={<Package className="w-16 h-16" />}
        actionsPosition="left"
        actions={(product: any) => (
          <div className="flex items-center justify-end gap-2">
            <Link
              to={`/products/${product.id}`}
              title="Lihat Detail"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Eye className="h-4 w-4" />
            </Link>
            <Link
              to={`/products/${product.id}/edit`}
              title="Edit"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Edit className="h-4 w-4" />
            </Link>
            <button
              type="button"
              title="Hapus"
              onClick={() => {
                setProductToDelete({ id: product.id, name: product.name });
                setDeleteModalOpen(true);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      />

      {/* Pagination */}
      {!isLoading && products.length > 0 && pagination.totalPages > 1 && (
        <div className="bg-white dark:bg-gray-900 px-6 py-4 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm tabular-nums text-gray-700 dark:text-gray-300">
            Menampilkan {products.length} dari{' '}
            <span className="font-semibold">{pagination.total}</span> produk
            <span className="ml-2 text-gray-500 dark:text-gray-400">
              (Halaman {pagination.page} dari {pagination.totalPages})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Per Hal:</label>
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
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sebelumnya
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= pagination.totalPages}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}

      {/* Import Excel Modal (xlsx 3-step) */}
      <ProductImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImported={() => {
          setShowImportModal(false);
          refetch();
          queryClient.invalidateQueries({ queryKey: ['products'] });
        }}
      />

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
            <div className="flex-1">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                Apakah Anda yakin ingin menghapus produk <strong>{productToDelete?.name}</strong>?
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tindakan ini akan melakukan soft delete. Data produk tidak akan muncul di daftar, tetapi masih tersimpan di database.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { setDeleteModalOpen(false); setProductToDelete(null); }}
              disabled={deleteMutation.isPending}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
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
