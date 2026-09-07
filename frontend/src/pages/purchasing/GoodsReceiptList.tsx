import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package, Eye, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { BreadcrumbHeader, FilterToolbar } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { purchasingService, type GoodsReceipt } from '@/services/purchasing.service';
import { formatDate } from '@/utils/format';
import { useBranchFilter } from '@/components/branch/BranchFilter';

const STATUS_META: Record<string, { label: string; variant: 'secondary' | 'default' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  received: { label: 'Received', variant: 'outline' },
  inspected: { label: 'Inspected', variant: 'outline' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

export default function GoodsReceiptList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;
  const { branchId, setBranchId } = useBranchFilter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['goods-receipts', page, limit, searchTerm, statusFilter, branchId],
    queryFn: async () => {
      try {
        const result = await purchasingService.getGoodsReceipts({
          page,
          limit,
          search: searchTerm || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          branchId: branchId || undefined,
        });
        return result;
      } catch (err: any) {
        console.error('Error fetching goods receipts:', err);
        throw err;
      }
    },
  });

  // Backend returns { data: [], total, page, limit, totalPages }
  const goodsReceipts = data?.data || [];
  const total = data?.total || 0;

  const getStatusBadge = (status: string) => {
    const meta = STATUS_META[status];
    return meta ? <Badge variant={meta.variant}>{meta.label}</Badge> : null;
  };

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader title="Goods Receipt" subtitle="Kelola penerimaan barang">
        <Button asChild>
          <Link to="/purchasing/goods-receipt/new">
            <Plus />
            GR Baru
          </Link>
        </Button>
      </BreadcrumbHeader>

      {/* Toolbar: search inline + branch inline + filter popup (IGDERP-110) */}
      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={(v) => {
          setSearchTerm(v);
          setPage(1);
        }}
        searchPlaceholder="Cari nomor GR, PO..."
        branchFilter={{ value: branchId, onChange: setBranchId, allowAll: true }}
        fields={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'draft', label: 'Draft' },
              { value: 'received', label: 'Received' },
              { value: 'inspected', label: 'Inspected' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
        ]}
        values={{
          status: statusFilter === 'all' ? '' : statusFilter,
        }}
        onFieldChange={(key, v) => {
          if (key === 'status') {
            setStatusFilter(v || 'all');
            setPage(1);
          }
        }}
        onReset={() => {
          setStatusFilter('all');
          setPage(1);
        }}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Memuat data...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <p className="text-destructive">Gagal memuat data goods receipt</p>
            </div>
          ) : goodsReceipts.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Tidak ada data goods receipt</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nomor GR</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {goodsReceipts.map((gr: GoodsReceipt) => (
                    <TableRow key={gr.id}>
                      <TableCell>
                        <Link
                          to={`/purchasing/goods-receipt/${gr.id}`}
                          className="font-mono font-semibold text-primary hover:underline"
                        >
                          {gr.grNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {gr.purchaseOrder?.poNumber ? (
                          <Link
                            to={`/purchasing/po/${gr.purchaseOrderId}`}
                            className="font-mono text-primary hover:underline"
                          >
                            {gr.purchaseOrder.poNumber}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{formatDate(gr.receiptDate)}</span>
                      </TableCell>
                      <TableCell>{getStatusBadge(gr.status)}</TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="icon">
                          <Link to={`/purchasing/goods-receipt/${gr.id}`}>
                            <Eye />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {data && data.totalPages > 1 && (
                <div className="px-6 py-4 border-t flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Menampilkan {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} dari {total}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Sebelumnya
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                      disabled={page >= data.totalPages}
                    >
                      Selanjutnya
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
