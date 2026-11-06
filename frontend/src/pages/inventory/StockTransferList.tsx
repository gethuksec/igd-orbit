import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightLeft, Plus } from 'lucide-react';
import { BreadcrumbHeader, FilterToolbar } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { api } from '../../services/api';
import { inventoryService } from '../../services/inventory.service';
import type { StockTransfer } from '../../services/inventory.service';

const PAGE_SIZE = 20;

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    completed: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
    pending: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
    cancelled: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300',
  };
  const labels: Record<string, string> = {
    completed: 'Selesai',
    pending: 'Menunggu',
    cancelled: 'Dibatalkan',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        styles[status] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
      }`}
    >
      {labels[status] || status}
    </span>
  );
};

export default function StockTransferList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches');
      return res.data.data || res.data;
    },
  });

  const { data: result = { data: [], meta: { total: 0, page: 1, totalPages: 0 } } } =
    useQuery({
      queryKey: ['transfer-docs', page],
      queryFn: () => inventoryService.getTransfers({ page, limit: PAGE_SIZE }),
    });

  const docs = result.data.filter((d) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      d.transferNumber.toLowerCase().includes(q) ||
      (d.fromWarehouse?.name || '').toLowerCase().includes(q) ||
      (d.toWarehouse?.name || '').toLowerCase().includes(q) ||
      (d.fromBranch?.name || '').toLowerCase().includes(q) ||
      (d.toBranch?.name || '').toLowerCase().includes(q)
    );
  });

  const branchName = (id: string | null | undefined) =>
    id ? (branches as any[]).find((b: any) => b.id === id)?.name || '-' : null;

  return (
    <div className="w-full space-y-4">
      <BreadcrumbHeader
        title="Transfer Stok"
        subtitle="Riwayat pemindahan barang antar gudang dalam satu outlet"
      >
        <Button onClick={() => navigate('/inventory/transfer/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Buat Transfer
        </Button>
      </BreadcrumbHeader>

      {/* ── Toolbar: search inline + filter popup (IGDERP-110) ── */}
      <FilterToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari no. transfer, outlet, atau gudang..."
        fields={[]}
        values={{}}
        onFieldChange={() => {}}
        onReset={() => {}}
      />

      {/* ── Documents table ── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
        {docs.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {result.meta.total === 0
              ? 'Belum ada dokumen transfer.'
              : 'Tidak ada dokumen yang cocok dengan pencarian.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 dark:from-gray-900 to-gray-100 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">No. Transfer</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Dari</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Ke</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Produk</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Petugas</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {docs.map((doc: StockTransfer) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    onClick={() => navigate(`/inventory/transfer/${doc.id}`)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-primary-600 dark:text-primary-400">
                      {doc.transferNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(doc.createdAt).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      <div className="font-medium text-gray-800 dark:text-gray-200">
                        {doc.fromWarehouse?.name || '-'}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {branchName(doc.fromBranchId) || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      <div className="font-medium text-gray-800 dark:text-gray-200">
                        {doc.toWarehouse?.name || '-'}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {branchName(doc.toBranchId) || 'Central Bad Stock'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                        <ArrowRightLeft className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                        {doc.items.length}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{doc.picName || '-'}</td>
                    <td className="px-4 py-3">{statusBadge(doc.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {result.meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
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
    </div>
  );
}
