import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { BreadcrumbHeader, FilterToolbar } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { inventoryService } from '../../services/inventory.service';
import type { StockOut } from '../../services/inventory.service';
import StockOutForm from './StockOutForm';

const PAGE_SIZE = 20;

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);

/**
 * Stok Keluar — history list first (Option B, 07 Nov thread).
 * Default view is the document history with search + outlet/date filters;
 * creating a new document happens in a large modal reusing StockOutForm.
 * Mirrors the Transfer/Mutasi list pattern (IGDERP-139/140).
 */
export default function StockOut() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: result = { data: [], meta: { total: 0, page: 1, totalPages: 0 } } } =
    useQuery({
      queryKey: ['stock-out-docs', page, branchId, startDate, endDate],
      queryFn: () =>
        inventoryService.getStockOuts({
          page,
          limit: PAGE_SIZE,
          ...(branchId ? { outletId: branchId } : {}),
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
        }),
    });

  const docs = result.data.filter((d) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      d.documentNumber.toLowerCase().includes(q) ||
      (d.outlet?.name || '').toLowerCase().includes(q) ||
      (d.warehouse?.name || '').toLowerCase().includes(q) ||
      d.reason.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full space-y-4">
      <BreadcrumbHeader
        title="Stok Keluar"
        subtitle="Riwayat dokumen stok keluar non-penjualan (buang, kadaluarsa, rusak, koreksi stok)"
      >
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Buat Stok Keluar
        </Button>
      </BreadcrumbHeader>

      {/* ── Toolbar: search inline + outlet inline + date popup (IGDERP-110) ── */}
      <FilterToolbar
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Cari no. dokumen, gudang, atau alasan..."
        branchFilter={{ value: branchId, onChange: (v) => { setBranchId(v); setPage(1); }, allowAll: true }}
        fields={[
          {
            key: 'date',
            label: 'Tanggal',
            type: 'date-range',
          },
        ]}
        values={{
          dateFrom: startDate,
          dateTo: endDate,
        }}
        onFieldChange={(key, v) => {
          if (key === 'dateFrom') setStartDate(v);
          else if (key === 'dateTo') setEndDate(v);
          setPage(1);
        }}
        onReset={() => {
          setStartDate('');
          setEndDate('');
          setPage(1);
        }}
      />

      {/* ── Documents table ── */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        {docs.length === 0 ? (
          <p className="text-sm text-gray-500">
            {result.meta.total === 0
              ? 'Belum ada dokumen stok keluar.'
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
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Alasan</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Total Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {docs.map((doc: StockOut) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-primary-600">
                      {doc.documentNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(doc.documentDate).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {doc.outlet?.name || 'Central Bad Stock'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{doc.warehouse?.name || '-'}</td>
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

      {/* ── Create modal (large: full form incl. import dialog) ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[90vw] max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buat Stok Keluar</DialogTitle>
            <DialogDescription>
              Pencatatan stok keluar non-penjualan (buang, kadaluarsa, rusak, koreksi stok).
            </DialogDescription>
          </DialogHeader>
          <StockOutForm
            onSaved={() => setCreateOpen(false)}
            onClose={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
