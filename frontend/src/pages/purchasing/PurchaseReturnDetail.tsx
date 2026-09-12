import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const fmtQty = (n: number) => new Intl.NumberFormat('id-ID').format(n);

export default function PurchaseReturnDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: ret, isLoading, error } = useQuery({
    queryKey: ['purchase-return', id],
    queryFn: () => purchasingService.getPurchaseReturn(id!),
    enabled: !!id,
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
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="font-semibold">Central-good:</span> −{fmtQty(Number(ret.totalQty))} unit ·{' '}
            <span className="font-semibold">Central-bad:</span> +{fmtQty(Number(ret.totalQty))} unit
            <div className="mt-1">
              Unit fisik menunggu di <span className="font-semibold">Gudang Pusat (BAD)</span> sampai
              dikirim kembali ke supplier.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
