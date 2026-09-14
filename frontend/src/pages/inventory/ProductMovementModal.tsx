import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUp, ArrowDown, ArrowRightLeft, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { inventoryService } from '../../services/inventory.service';

interface Props {
  product: { id: string; name?: string; sku?: string } | null;
  open: boolean;
  onClose: () => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function typeBadge(type: string) {
  switch (type) {
    case 'IN':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
          <ArrowUp className="w-3 h-3" /> Masuk
        </span>
      );
    case 'OUT':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
          <ArrowDown className="w-3 h-3" /> Keluar
        </span>
      );
    case 'TRANSFER':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
          <ArrowRightLeft className="w-3 h-3" /> Transfer
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-700">
          <Package className="w-3 h-3" /> {type}
        </span>
      );
  }
}

// IGDERP-90: per-product movement history modal — opened from the stock list
// product cell. Replaces the dedicated movements page for day-to-day use.
export default function ProductMovementModal({ product, open, onClose }: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [movementType, setMovementType] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['product-movements', product?.id, page, pageSize, startDate, endDate, movementType],
    enabled: open && !!product?.id,
    queryFn: () =>
      inventoryService.getStockMovementHistory({
        productId: product!.id,
        page,
        limit: pageSize,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        movementType: movementType || undefined,
      }),
  });

  const movements = data?.data || [];
  const totalPages = data?.meta?.totalPages || 1;
  const total = data?.meta?.total || 0;

  const close = () => {
    setPage(1);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="w-[75vw] max-w-[75vw] h-[50vh] max-h-[50vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Riwayat pergerakan — {product?.name || '-'}
            <span className="ml-2 font-normal text-muted-foreground">{product?.sku || ''}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">Tipe</Label>
            <select
              value={movementType}
              onChange={(e) => {
                setMovementType(e.target.value);
                setPage(1);
              }}
              className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Semua</option>
              <option value="IN">Masuk</option>
              <option value="OUT">Keluar</option>
              <option value="TRANSFER">Transfer</option>
              <option value="ADJUSTMENT">Penyesuaian</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Dari</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Sampai</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
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
          <span className="ml-auto text-xs text-muted-foreground">{total} pergerakan</span>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Memuat...</div>
          ) : !movements.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Tidak ada pergerakan untuk filter ini.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="py-2 pr-2">Tanggal</th>
                  <th className="py-2 pr-2">Tipe</th>
                  <th className="py-2 pr-2 text-right">Stok awal</th>
                  <th className="py-2 pr-2 text-right">Perubahan</th>
                  <th className="py-2 pr-2 text-right">Stok akhir</th>
                  <th className="py-2">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movements.map((m: any) => (
                  <tr key={m.id}>
                    <td className="py-2 pr-2 whitespace-nowrap text-xs">
                      {new Date(m.createdAt).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-2 pr-2">{typeBadge(m.movementType)}</td>
                    <td className="py-2 pr-2 text-right">{m.quantityBefore ?? '-'}</td>
                    <td
                      className={`py-2 pr-2 text-right font-semibold ${
                        Number(m.quantityChange) < 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {Number(m.quantityChange) > 0 ? '+' : ''}
                      {m.quantityChange}
                    </td>
                    <td className="py-2 pr-2 text-right">{m.quantityAfter}</td>
                    <td className="py-2 text-xs text-muted-foreground whitespace-normal break-words min-w-[180px]">
                      {m.notes || m.referenceType || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-xs text-muted-foreground">
            Halaman {page} dari {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
