import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { History, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '../../services/api';
import { formatDateTimeId } from '@/lib/utils';

interface Props {
  product: { id: string; name?: string; sku?: string } | null;
  open: boolean;
  onClose: () => void;
}

// Approved mock: table version of Riwayat Aktivitas — Tanggal | Aktivitas |
// Deskripsi | Stok Awal | Perubahan | Stok Akhir | Cabang. Filters apply to
// the loaded rows (endpoint serves page 1 x 50 like the detail tab).
const TYPE_META: Record<string, { label: string; text: string; dot: string }> = {
  STOCK_IN: { label: 'Stok Masuk', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-600' },
  STOCK_OUT: { label: 'Stok Keluar', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-600' },
  SALES: { label: 'Penjualan', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-600' },
  SALES_PENDING: { label: 'Penjualan', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-600' },
  SALES_RETURN: { label: 'Retur Jual', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-600' },
  STOCK_TRANSFER: { label: 'Transfer', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-600' },
  STOCK_ADJUSTMENT: { label: 'Penyesuaian', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-600' },
  STOCK_CHANGE: { label: 'Penyesuaian', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-600' },
  SERVICE_USAGE: { label: 'Service', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-600' },
  SERVICE_USAGE_PENDING: { label: 'Service', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-600' },
};

const TYPE_FILTERS: { value: string; label: string; types: string[] }[] = [
  { value: '', label: 'Semua', types: [] },
  { value: 'IN', label: 'Stok Masuk', types: ['STOCK_IN'] },
  { value: 'OUT', label: 'Stok Keluar', types: ['STOCK_OUT'] },
  { value: 'SALES', label: 'Penjualan', types: ['SALES', 'SALES_PENDING'] },
  { value: 'RETURN', label: 'Retur Jual', types: ['SALES_RETURN'] },
  { value: 'TRANSFER', label: 'Transfer', types: ['STOCK_TRANSFER'] },
  { value: 'ADJUST', label: 'Penyesuaian', types: ['STOCK_ADJUSTMENT', 'STOCK_CHANGE'] },
  { value: 'SERVICE', label: 'Service', types: ['SERVICE_USAGE', 'SERVICE_USAGE_PENDING'] },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function toInputDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultRange() {
  const now = new Date();
  return { from: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: toInputDate(now) };
}

export default function ProductActivityModal({ product, open, onClose }: Props) {
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [range, setRange] = useState(defaultRange);

  const { data, isLoading } = useQuery({
    queryKey: ['product-activity-modal', product?.id],
    enabled: open && !!product?.id,
    staleTime: 30000,
    queryFn: async () => {
      const response = await api.get(`/products/${product!.id}/activity`, {
        params: { page: 1, limit: 50 },
      });
      return response.data;
    },
  });

  const rows = useMemo(() => {
    const list: any[] = data?.data || [];
    const active = TYPE_FILTERS.find((f) => f.value === typeFilter);
    return list.filter((a: any) => {
      if (active && active.types.length && !active.types.includes(a.type)) return false;
      if (range.from && String(a.createdAt).slice(0, 10) < range.from) return false;
      if (range.to && String(a.createdAt).slice(0, 10) > range.to) return false;
      return true;
    });
  }, [data, typeFilter, range]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const close = () => {
    setPage(1);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="w-[75vw] max-w-[75vw] h-[50vh] max-h-[50vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            Riwayat aktivitas — {product?.name || '-'}
            <span className="font-normal text-muted-foreground">{product?.sku || ''}</span>
            {rows.length > 0 && (
              <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                {rows.length} aktivitas
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">Tipe</Label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {TYPE_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Dari</Label>
            <Input
              type="date"
              value={range.from}
              onChange={(e) => {
                setRange((r) => ({ ...r, from: e.target.value }));
                setPage(1);
              }}
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Sampai</Label>
            <Input
              type="date"
              value={range.to}
              onChange={(e) => {
                setRange((r) => ({ ...r, to: e.target.value }));
                setPage(1);
              }}
              className="h-9"
            />
          </div>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-background px-1 text-xs"
            title="Baris per halaman"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} / halaman
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-muted-foreground">{rows.length} aktivitas</span>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary-500 dark:text-primary-400 animate-spin" />
            </div>
          ) : !pageRows.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Tidak ada aktivitas untuk filter ini.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="sticky top-0 bg-white dark:bg-gray-900">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-2">Tanggal</th>
                  <th className="py-2 pr-2">Aktivitas</th>
                  <th className="py-2 pr-2">Deskripsi</th>
                  <th className="py-2 pr-2 text-right">Stok Awal</th>
                  <th className="py-2 pr-2 text-right">Perubahan</th>
                  <th className="py-2 pr-2 text-right">Stok Akhir</th>
                  <th className="py-2">Cabang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {pageRows.map((a: any) => {
                  const meta = TYPE_META[a.type] || {
                    label: a.type,
                    text: 'text-gray-600 dark:text-gray-400',
                    dot: 'bg-gray-400',
                  };
                  const hasBalance = a.quantityBefore !== undefined && a.quantityAfter !== undefined;
                  const delta = hasBalance
                    ? Number(a.quantityAfter) - Number(a.quantityBefore)
                    : Number(a.quantityChange) || 0;
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2 pr-2 whitespace-nowrap text-xs tabular-nums">
                        {formatDateTimeId(a.createdAt)}
                      </td>
                      <td className="py-2 pr-2">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${meta.text}`}>
                          <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-2 pr-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {a.description}
                        </p>
                        {a.referenceId && a.referenceType === 'SALES_TRANSACTION' && (
                          <Link
                            to={`/sales/transactions/${a.referenceId}`}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Lihat transaksi →
                          </Link>
                        )}
                        {a.referenceId && a.referenceType === 'SERVICE_ORDER' && (
                          <Link
                            to={`/service-orders/${a.referenceId}`}
                            className="text-xs text-orange-600 dark:text-orange-400 hover:underline"
                          >
                            Lihat service order →
                          </Link>
                        )}
                        {a.notes && (
                          <p
                            className="text-xs text-gray-400 dark:text-gray-500 italic mt-0.5"
                            title={a.notes}
                          >
                            {a.notes}
                          </p>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {hasBalance ? (
                          a.quantityBefore
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500 italic">—</span>
                        )}
                      </td>
                      <td
                        className={`py-2 pr-2 text-right tabular-nums font-semibold ${
                          delta > 0
                            ? 'text-green-600 dark:text-green-400'
                            : delta < 0
                              ? 'text-red-600 dark:text-red-400'
                              : ''
                        }`}
                      >
                        {delta !== 0 ? `${delta > 0 ? '+' : ''}${delta}` : '0'}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {hasBalance ? (
                          a.quantityAfter
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500 italic">—</span>
                        )}
                      </td>
                      <td className="py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {a.branch?.name || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-xs text-muted-foreground">
            Halaman {safePage} dari {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
