import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Upload } from 'lucide-react';
import { BreadcrumbHeader, FilterToolbar } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { inventoryService } from '../../services/inventory.service';
import type { StockIn } from '../../services/inventory.service';
import StockInForm from './StockInForm';
import StockImportModal from './StockImportModal';

const PAGE_SIZE = 20;

const NO_SUPPLIER = 'NO_SUPPLIER';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);

const docTotalQty = (d: StockIn) =>
  (d.items || []).reduce((s, it) => s + Number((it as any).quantity || 0), 0);

const docMatchesProduct = (d: StockIn, q: string) =>
  (d.items || []).some((it) => {
    const p = (it as any).product || {};
    return (
      ((it as any).productName || '').toLowerCase().includes(q) ||
      ((it as any).productSku || '').toLowerCase().includes(q) ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q)
    );
  });

/**
 * Stok Masuk — history list first (Option B, 07 Nov thread).
 * Default view is the document history with search + outlet/warehouse/date/
 * product/operator/quantity filters; creating a new document happens in a
 * large modal reusing StockInForm.
 * Mirrors the Transfer/Mutasi list pattern (IGDERP-139/140).
 */
export default function StockIn() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [productText, setProductText] = useState('');
  const [operator, setOperator] = useState('');
  const [qty, setQty] = useState('');
  const [qtyOp, setQtyOp] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  // IGDERP-97 (I4): Excel import/export lives on the list (next to Buat),
  // not inside the create modal — same template, round-trip.
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const queryClient = useQueryClient();

  const handleExport = async () => {
    if (!warehouseId) {
      toast.error('Pilih gudang terlebih dahulu (filter Gudang)');
      return;
    }
    setExporting(true);
    try {
      const blob = await inventoryService.exportStockSnapshot('in', warehouseId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stok-masuk-${warehouseId.slice(0, 8)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error('Gagal mengunduh export');
    } finally {
      setExporting(false);
    }
  };

  const { data: warehouses = [] } = useQuery({
    queryKey: ['stock-in-filter-warehouses', branchId],
    queryFn: () => inventoryService.getStockInWarehouses(branchId || undefined),
  });

  const { data: result = { data: [], meta: { total: 0, page: 1, totalPages: 0 } } } =
    useQuery({
      queryKey: ['stock-in-docs', page, branchId, warehouseId, operator, startDate, endDate],
      queryFn: () =>
        inventoryService.getStockIns({
          page,
          limit: PAGE_SIZE,
          ...(branchId ? { outletId: branchId } : {}),
          ...(warehouseId ? { warehouseId } : {}),
          ...(operator.trim() ? { operator: operator.trim() } : {}),
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
        }),
    });

  const docs = result.data
    .filter((d) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        d.documentNumber.toLowerCase().includes(q) ||
        (d.outlet?.name || '').toLowerCase().includes(q) ||
        (d.warehouse?.name || '').toLowerCase().includes(q) ||
        (d.supplierName || '').toLowerCase().includes(q) ||
        (d.poNumber || '').toLowerCase().includes(q) ||
        (d.operatorName || '').toLowerCase().includes(q) ||
        d.reason.toLowerCase().includes(q)
      );
    })
    .filter((d) => {
      if (!productText.trim()) return true;
      return docMatchesProduct(d, productText.trim().toLowerCase());
    })
    .filter((d) => {
      if (!qty.trim()) return true;
      const target = parseFloat(qty);
      if (Number.isNaN(target)) return true;
      const total = docTotalQty(d);
      const op = qtyOp || 'eq';
      return op === 'gt' ? total > target : op === 'lt' ? total < target : total === target;
    });

  const resetFilters = () => {
    setWarehouseId('');
    setProductText('');
    setOperator('');
    setQty('');
    setQtyOp('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="w-full space-y-4">
      <BreadcrumbHeader
        title="Stok Masuk"
        subtitle="Riwayat dokumen stok masuk non-pembelian (stok awal, barang hadiah, dll)"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={!warehouseId || exporting}
          >
            <Download className="w-4 h-4 mr-2" />
            {exporting ? 'Mengunduh…' : 'Export Excel'}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Buat Stok Masuk
          </Button>
        </div>
      </BreadcrumbHeader>
      <StockImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        kind="in"
        onImported={() => queryClient.invalidateQueries({ queryKey: ['stock-in-docs'] })}
      />

      {/* ── Toolbar: search + outlet inline, filter popup (IGDERP-110) ── */}
      <FilterToolbar
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Cari no. dokumen, supplier, alasan, atau PO..."
        branchFilter={{
          value: branchId,
          onChange: (v) => {
            setBranchId(v);
            setWarehouseId('');
            setPage(1);
          },
          allowAll: true,
        }}
        fields={[
          {
            key: 'warehouse',
            label: 'Gudang',
            type: 'select',
            options: warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
          },
          {
            key: 'product',
            label: 'Barcode / Nama Produk / Kode Ref',
            type: 'input',
            placeholder: 'cth. 899... / Minyak Telon',
          },
          {
            key: 'operator',
            label: 'Operator',
            type: 'input',
            placeholder: 'Nama pembuat dokumen',
          },
          {
            key: 'qty',
            label: 'Perkiraan Jumlah',
            type: 'number-compare',
            placeholder: '0',
          },
          {
            key: 'date',
            label: 'Tanggal',
            type: 'date-range',
          },
        ]}
        values={{
          warehouse: warehouseId,
          product: productText,
          operator,
          qty,
          qtyOp,
          dateFrom: startDate,
          dateTo: endDate,
        }}
        onFieldChange={(key, v) => {
          if (key === 'warehouse') setWarehouseId(v);
          else if (key === 'product') setProductText(v);
          else if (key === 'operator') setOperator(v);
          else if (key === 'qty') setQty(v);
          else if (key === 'qtyOp') setQtyOp(v);
          else if (key === 'dateFrom') setStartDate(v);
          else if (key === 'dateTo') setEndDate(v);
          setPage(1);
        }}
        onReset={resetFilters}
      />

      {/* ── Documents table ── */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        {docs.length === 0 ? (
          <p className="text-sm text-gray-500">
            {result.meta.total === 0
              ? 'Belum ada dokumen stok masuk.'
              : 'Tidak ada dokumen yang cocok dengan pencarian.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">No. Dokumen</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Outlet</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Gudang</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Operator</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Alasan</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Total Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {docs.map((doc: StockIn) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-primary-600">
                      {doc.documentNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(doc.documentDate).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{doc.outlet?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{doc.warehouse?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {doc.supplierId === NO_SUPPLIER ? 'Tanpa Supplier' : doc.supplierName || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{doc.operatorName || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[220px] truncate">{doc.reason}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                      {formatCurrency(doc.totalValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {result.meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Total {result.meta.total} dokumen — halaman {result.meta.page} dari{' '}
              {result.meta.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= result.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create modal (large: full form incl. import + add-product dialogs) ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[90vw] max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buat Stok Masuk</DialogTitle>
            <DialogDescription>
              Pencatatan stok masuk non-pembelian (stok awal, barang hadiah, dll).
            </DialogDescription>
          </DialogHeader>
          <StockInForm
            onSaved={() => setCreateOpen(false)}
            onClose={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
