import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Modal } from '@/components/ui/modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { purchasingService } from '@/services/purchasing.service';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'sonner';

const fmtQty = (n: number) => new Intl.NumberFormat('id-ID').format(n);

export default function PurchaseReturnDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: ret, isLoading, error } = useQuery({
    queryKey: ['purchase-return', id],
    queryFn: () => purchasingService.getPurchaseReturn(id!),
    enabled: !!id,
  });

  const queryClient = useQueryClient();
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeChecked, setCompleteChecked] = useState(false);

  const completeMutation = useMutation({
    mutationFn: () => purchasingService.completePurchaseReturn(id!),
    onSuccess: (updated) => {
      toast.success(`Retur ${updated.returnNumber} selesai — stok central-bad berkurang`);
      setCompleteOpen(false);
      setCompleteChecked(false);
      queryClient.invalidateQueries({ queryKey: ['purchase-return', id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-returns'] });
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg || 'Gagal menyelesaikan retur');
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !ret) {
    return (
      <div className="space-y-6">
        <BreadcrumbHeader title="Detail Retur Pembelian" />
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Retur tidak ditemukan.
            <div className="mt-4">
              <Button variant="outline" onClick={() => navigate('/purchasing/returns')}>
                Kembali ke daftar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BreadcrumbHeader title={ret.returnNumber}>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 border border-gray-300 text-gray-700">
            {ret.purchaseOrder ? 'Dari PO' : 'Manual (tanpa PO)'}
          </span>
          {ret.status === 'completed' ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 border border-green-300 text-green-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Selesai
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 border border-amber-300 text-amber-700">
              Pending
            </span>
          )}
          {ret.status !== 'completed' && (
            <Button onClick={() => setCompleteOpen(true)}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Tandai Selesai
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate('/purchasing/returns')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
        </div>
      </BreadcrumbHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Supplier</div>
            <div className="font-semibold mt-1">{ret.supplier?.name || '-'}</div>
            <div className="text-xs text-gray-500 mt-0.5">{ret.supplier?.customerCode}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">No. Invoice</div>
            <div className="font-semibold mt-1">{ret.invoiceNumber || '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Purchase Order</div>
            {ret.purchaseOrder ? (
              <Link
                to={`/purchasing/po/${ret.purchaseOrder.id}`}
                className="font-semibold mt-1 text-red-600 hover:underline block"
              >
                {ret.purchaseOrder.poNumber}
              </Link>
            ) : (
              <div className="font-semibold mt-1 text-gray-400">— (manual)</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Diproses oleh</div>
            <div className="font-semibold mt-1">{ret.processedByUser?.fullName || '-'}</div>
            <div className="text-xs text-gray-500 mt-0.5">{formatDate(ret.createdAt)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alasan &amp; Catatan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex gap-4">
            <div className="w-32 shrink-0 text-gray-500">Alasan retur</div>
            <div>{ret.reason}</div>
          </div>
          <div className="flex gap-4">
            <div className="w-32 shrink-0 text-gray-500">Catatan</div>
            <div className={ret.notes ? '' : 'text-gray-400'}>{ret.notes || '—'}</div>
          </div>
          {ret.status === 'completed' && (
            <div className="flex gap-4">
              <div className="w-32 shrink-0 text-gray-500">Diselesaikan oleh</div>
              <div>
                {ret.completedByUser?.fullName || '-'}
                {ret.completedAt ? ` · ${formatDate(ret.completedAt)}` : ''}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Harga</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead>Alasan Baris</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(ret.items || []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.product?.name || item.productId}</div>
                    <div className="text-xs text-gray-500">{item.product?.sku}</div>
                  </TableCell>
                  <TableCell className="text-right">{fmtQty(Number(item.quantity))}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(item.unitPrice))}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(Number(item.subtotal))}
                  </TableCell>
                  <TableCell className="text-gray-500">{item.reason || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end gap-10 mt-4 pt-4 border-t border-gray-100">
            <div className="text-right">
              <div className="text-xs text-gray-500">Total Qty</div>
              <div className="text-lg font-bold">{fmtQty(Number(ret.totalQty))}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Total Nilai (kredit supplier)</div>
              <div className="text-lg font-bold text-red-600">{formatCurrency(Number(ret.totalValue))}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dampak Stok</CardTitle>
        </CardHeader>
        <CardContent>
          {ret.status === 'completed' ? (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <span className="font-semibold">Retur selesai</span> — barang sudah dikirim kembali ke
              supplier. Central-bad berkurang {fmtQty(Number(ret.totalQty))} unit
              {ret.completedByUser?.fullName ? ` (oleh ${ret.completedByUser.fullName})` : ''}.
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="font-semibold">Central-good:</span> −{fmtQty(Number(ret.totalQty))} unit ·{' '}
              <span className="font-semibold">Central-bad:</span> +{fmtQty(Number(ret.totalQty))} unit
              <div className="mt-1">
                Unit fisik menunggu di <span className="font-semibold">Gudang Pusat (BAD)</span> sampai
                dikirim kembali ke supplier.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completion modal — same pattern as the create-PO total confirmation. */}
      <Modal
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="Konfirmasi Retur Selesai"
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Total Qty Retur</p>
            <p className="text-2xl font-bold text-primary">{fmtQty(Number(ret.totalQty))} unit</p>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={completeChecked}
              onCheckedChange={(checked) => setCompleteChecked(checked)}
              className="mt-0.5"
            />
            <span className="text-sm">
              Saya sudah memastikan <strong>barang retur ini sudah dikirim kembali ke supplier</strong>.
              Stok central-bad akan berkurang {fmtQty(Number(ret.totalQty))} unit.
            </span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCompleteOpen(false)}>
              Batal
            </Button>
            <Button
              className="flex-1"
              onClick={() => completeMutation.mutate()}
              disabled={!completeChecked || completeMutation.isPending}
            >
              {completeMutation.isPending ? 'Menyelesaikan...' : 'Ya, Selesaikan'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
