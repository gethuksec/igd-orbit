import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightLeft, Plus } from 'lucide-react';
import { BreadcrumbHeader, FilterToolbar, StatusDot } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { api } from '../../services/api';
import { inventoryService } from '../../services/inventory.service';
import type { StockTransfer } from '../../services/inventory.service';

const PAGE_SIZE = 20;

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'off' | 'bad'> = {
  completed: 'ok',
  received: 'ok',
  sent: 'warn',
  pending: 'off',
  cancelled: 'bad',
};

const STATUS_LABEL: Record<string, string> = {
  completed: 'Selesai',
  received: 'Diterima',
  sent: 'Dikirim',
  pending: 'Menunggu',
  cancelled: 'Dibatalkan',
};

const statusBadge = (status: string) => (
  <StatusDot tone={STATUS_TONE[status] || 'off'}>{STATUS_LABEL[status] || status}</StatusDot>
);

export default function MutasiList() {
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
      queryKey: ['mutasi-docs', page],
      queryFn: () => inventoryService.getMutasi({ page, limit: PAGE_SIZE }),
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
        title="Mutasi Stok"
        subtitle="Riwayat pemindahan barang antara gudang pusat dan outlet"
      >
        <Button onClick={() => navigate('/inventory/mutasi/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Buat Mutasi
        </Button>
      </BreadcrumbHeader>

      {/* ── Toolbar: search inline + filter popup (IGDERP-110) ── */}
      <FilterToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari no. mutasi, outlet, atau gudang..."
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
              ? 'Belum ada dokumen mutasi.'
              : 'Tidak ada dokumen yang cocok dengan pencarian.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">No. mutasi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Dari</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Ke</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300">Produk</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Petugas</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {docs.map((doc: StockTransfer) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    onClick={() => navigate(`/inventory/mutasi/${doc.id}`)}
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
                        {branchName(doc.fromBranchId) || 'Gudang pusat'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      <div className="font-medium text-gray-800 dark:text-gray-200">
                        {doc.toWarehouse?.name || '-'}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {branchName(doc.toBranchId) || 'Gudang pusat'}
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
