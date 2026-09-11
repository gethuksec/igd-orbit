import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Eye, Plus, CheckCircle, XCircle, Clock, Package, AlertCircle } from 'lucide-react';
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
import { purchasingService, type PurchaseOrder } from '@/services/purchasing.service';
import { formatCurrency, formatDate } from '@/utils/format';
import { useBranchFilter } from '@/components/branch/BranchFilter';
import { BreadcrumbHeader, FilterToolbar } from '@/components/shared';

export default function PurchaseOrderList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;
  const { branchId, setBranchId } = useBranchFilter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-orders', page, limit, searchTerm, statusFilter, branchId],
    queryFn: async () => {
      return purchasingService.getPurchaseOrders({
        page,
        limit,
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        branchId: branchId || undefined,
      });
    },
  });

  // Backend returns { data: [], total, page, limit, totalPages }
  const purchaseOrders = data?.data || [];
  const total = data?.total || 0;

  const filteredOrders = purchaseOrders.filter((order: PurchaseOrder) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      order.poNumber.toLowerCase().includes(search) ||
      order.supplier?.name.toLowerCase().includes(search) ||
      order.supplier?.customerCode.toLowerCase().includes(search)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return (
          <Badge variant="secondary">
            <FileText className="w-3 h-3" />
            Draft
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline">
            <Clock className="w-3 h-3" />
            Pending
          </Badge>
        );
      case 'approved':
        return (
          <Badge>
            <CheckCircle className="w-3 h-3" />
            Approved
          </Badge>
        );
      case 'ordered':
        return (
          <Badge variant="outline">
            <Package className="w-3 h-3" />
            Ordered
          </Badge>
        );
      case 'partially_received':
        return (
          <Badge variant="outline">
            <Package className="w-3 h-3" />
            Partial
          </Badge>
        );
      case 'received':
        return (
          <Badge>
            <CheckCircle className="w-3 h-3" />
            Received
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3" />
            Cancelled
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="bg-red-900">
            <XCircle className="w-3 h-3" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  const statusCounts = {
    draft: filteredOrders.filter((o: PurchaseOrder) => o.status === 'draft').length,
    pending: filteredOrders.filter((o: PurchaseOrder) => o.status === 'pending').length,
    approved: filteredOrders.filter((o: PurchaseOrder) => o.status === 'approved').length,
    ordered: filteredOrders.filter((o: PurchaseOrder) => o.status === 'ordered').length,
    received: filteredOrders.filter((o: PurchaseOrder) => o.status === 'received' || o.status === 'partially_received').length,
    rejected: filteredOrders.filter((o: PurchaseOrder) => o.status === 'rejected').length,
    cancelled: filteredOrders.filter((o: PurchaseOrder) => o.status === 'cancelled').length,
  };

  const statCards = [
    { label: 'Total PO', value: total, icon: FileText, color: 'text-foreground' },
    { label: 'Pending', value: statusCounts.pending, icon: Clock, color: 'text-yellow-600' },
    { label: 'Approved', value: statusCounts.approved, icon: CheckCircle, color: 'text-blue-600' },
    { label: 'Received', value: statusCounts.received, icon: Package, color: 'text-green-600' },
    { label: 'Rejected', value: statusCounts.rejected, icon: XCircle, color: 'text-red-600' },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <BreadcrumbHeader title="Purchase Order" subtitle="Kelola purchase order dan pembelian">
        <Button asChild>
          <Link to="/purchasing/po/new">
            <Plus />
            PO Baru
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
        searchPlaceholder="Cari nomor PO, supplier..."
        fields={[
          {
            key: 'branch',
            label: 'Cabang',
            type: 'branch',
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'draft', label: 'Draft' },
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'ordered', label: 'Ordered' },
              { value: 'partially_received', label: 'Partially Received' },
              { value: 'received', label: 'Received' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
        ]}
        values={{
          branch: branchId || '',
          status: statusFilter === 'all' ? '' : statusFilter,
        }}
        onFieldChange={(key, v) => {
          if (key === 'status') {
            setStatusFilter(v || 'all');
            setPage(1);
          } else if (key === 'branch') {
            setBranchId(v || '');
            setPage(1);
          }
        }}
        onReset={() => {
          setStatusFilter('all');
          setBranchId('');
          setPage(1);
        }}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {statCards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{c.label}</p>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <c.icon className="w-6 h-6 text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4 text-muted-foreground">Memuat data...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <p className="text-destructive">Gagal memuat data purchase order</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Tidak ada data purchase order</p>
              <Link to="/purchasing/po/new" className="mt-4 text-primary hover:underline inline-block">
                Buat PO baru
              </Link>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nomor PO</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order: PurchaseOrder) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Link
                          to={`/purchasing/po/${order.id}`}
                          className="font-mono font-semibold text-primary hover:underline"
                        >
                          {order.poNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-sm">{order.supplier?.name || 'N/A'}</div>
                        <div className="text-xs text-muted-foreground">{order.supplier?.customerCode}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(order.orderDate)}</div>
                        {order.expectedDeliveryDate && (
                          <div className="text-xs text-muted-foreground">
                            Perkiraan: {formatDate(order.expectedDeliveryDate)}
                          </div>
                        )}
                        {order.dueDate && (
                          <div
                            className={`text-xs ${
                              order.isOverdue ? 'font-medium text-red-600' : 'text-muted-foreground'
                            }`}
                          >
                            Jatuh tempo: {formatDate(order.dueDate)}
                            {order.isOverdue && ' (terlambat)'}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-semibold">{formatCurrency(order.totalAmount)}</div>
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="icon">
                          <Link to={`/purchasing/po/${order.id}`}>
                            <Eye />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
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
