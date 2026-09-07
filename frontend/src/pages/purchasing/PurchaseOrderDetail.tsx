import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCircle, XCircle, Package, AlertCircle, Loader2, Eye } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
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
import { Modal } from '@/components/ui/modal';
import AttachmentPanel from '@/components/purchasing/AttachmentPanel';

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const getCurrentUser = () => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const currentUser = getCurrentUser();
  const userRoles: string[] = currentUser?.roles || (currentUser?.role?.code ? [currentUser.role.code] : []);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const { data: po, isLoading, error } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => purchasingService.getPurchaseOrder(id!),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: (notes?: string) => purchasingService.approvePurchaseOrder(id!, notes),
    onSuccess: () => {
      toast.success('Purchase order berhasil disetujui');
      setApproveModalOpen(false);
      setApproveNotes('');
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyetujui purchase order');
    },
  });

  const orderMutation = useMutation({
    mutationFn: () => purchasingService.orderPurchaseOrder(id!),
    onSuccess: () => {
      toast.success('Purchase order berhasil ditandai sebagai ordered');
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menandai purchase order');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason?: string) => purchasingService.cancelPurchaseOrder(id!, reason),
    onSuccess: () => {
      toast.success('Purchase order berhasil dibatalkan');
      setCancelModalOpen(false);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      navigate('/purchasing/po');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membatalkan purchase order');
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'approved':
        return <Badge>Approved</Badge>;
      case 'ordered':
        return <Badge variant="outline">Ordered</Badge>;
      case 'partially_received':
        return <Badge variant="outline">Partially Received</Badge>;
      case 'received':
        return <Badge>Received</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return null;
    }
  };

  const canApprove = (userRoles.includes('CSO') || userRoles.includes('CFO') || userRoles.includes('OWNER')) &&
    (po?.status === 'draft' || po?.status === 'pending');
  const canOrder = po?.status === 'approved' && (userRoles.includes('CSO') || userRoles.includes('SPV') || userRoles.includes('HS'));
  const canCancel = po?.status !== 'received' && po?.status !== 'cancelled';

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-16 h-16 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <p className="text-destructive">Gagal memuat purchase order</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <BreadcrumbHeader title={po.poNumber} subtitle={getStatusBadge(po.status)}>
        <div className="flex gap-2">
          {canApprove && (
            <Button variant="outline" onClick={() => setApproveModalOpen(true)} disabled={approveMutation.isPending}>
              <CheckCircle />
              Approve
            </Button>
          )}
          {canOrder && (
            <Button variant="outline" onClick={() => orderMutation.mutate()} disabled={orderMutation.isPending}>
              <Package />
              Mark as Ordered
            </Button>
          )}
          {canCancel && (
            <Button variant="destructive" onClick={() => setCancelModalOpen(true)} disabled={cancelMutation.isPending}>
              <XCircle />
              Cancel
            </Button>
          )}
        </div>
      </BreadcrumbHeader>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Supplier</h3>
            <p className="text-lg font-bold">{po.supplier?.name || 'N/A'}</p>
            <p className="text-sm text-muted-foreground">{po.supplier?.customerCode}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Tanggal Order</h3>
            <p className="text-lg font-bold">{formatDate(po.orderDate)}</p>
            {po.expectedDeliveryDate && (
              <p className="text-sm text-muted-foreground">ETA: {formatDate(po.expectedDeliveryDate)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Total Amount</h3>
            <p className="text-2xl font-bold text-primary">{formatCurrency(po.totalAmount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Qty Ordered</TableHead>
                <TableHead>Qty Received</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-semibold">{item.product?.name || 'N/A'}</div>
                    <div className="text-sm text-muted-foreground">{item.product?.sku}</div>
                  </TableCell>
                  <TableCell>{item.quantityOrdered}</TableCell>
                  <TableCell>{item.quantityReceived}</TableCell>
                  <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                  <TableCell className="font-semibold text-right">{formatCurrency(item.subtotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <tfoot className="border-t bg-muted/40">
              <tr>
                <td colSpan={4} className="p-4 text-right font-semibold">Subtotal</td>
                <td className="p-4 font-bold text-right">{formatCurrency(po.subtotal)}</td>
              </tr>
              {po.discountAmount > 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-right font-semibold">Discount</td>
                  <td className="p-4 font-bold text-destructive text-right">-{formatCurrency(po.discountAmount)}</td>
                </tr>
              )}
              {po.taxAmount > 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-right font-semibold">Tax</td>
                  <td className="p-4 font-bold text-right">{formatCurrency(po.taxAmount)}</td>
                </tr>
              )}
              {po.shippingCost > 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-right font-semibold">Shipping</td>
                  <td className="p-4 font-bold text-right">{formatCurrency(po.shippingCost)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={4} className="p-4 text-right font-bold text-lg">Total</td>
                <td className="p-4 font-bold text-2xl text-primary text-right">{formatCurrency(po.totalAmount)}</td>
              </tr>
            </tfoot>
          </Table>
        </CardContent>
      </Card>

      {/* Goods Receipts */}
      {po.goodsReceipts && po.goodsReceipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Goods Receipts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GR Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.goodsReceipts.map((gr) => (
                  <TableRow key={gr.id}>
                    <TableCell className="font-mono text-sm">{gr.grNumber}</TableCell>
                    <TableCell className="text-sm">{formatDate(gr.receiptDate)}</TableCell>
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
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {po.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-muted-foreground">{po.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Approve Modal */}
      <Modal
        open={approveModalOpen}
        onClose={() => {
          setApproveModalOpen(false);
          setApproveNotes('');
        }}
        title="Setujui Purchase Order"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-blue-100 rounded-full">
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p>
                Apakah Anda yakin ingin menyetujui Purchase Order <strong>{po.poNumber}</strong>?
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">
              Catatan Approval (Opsional)
            </label>
            <Textarea
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              placeholder="Tambahkan catatan jika diperlukan..."
              rows={3}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setApproveModalOpen(false);
                setApproveNotes('');
              }}
            >
              Batal
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                approveMutation.mutate(approveNotes || undefined);
              }}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Menyetujui...' : 'Ya, Setujui'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        open={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setCancelReason('');
        }}
        title="Batalkan Purchase Order"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-red-100 rounded-full">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p>
                Apakah Anda yakin ingin membatalkan Purchase Order <strong>{po.poNumber}</strong>?
              </p>
              <p className="text-sm text-muted-foreground mt-1">Tindakan ini tidak dapat dibatalkan.</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">
              Alasan Pembatalan *
            </label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Masukkan alasan pembatalan..."
              rows={3}
              required
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setCancelModalOpen(false);
                setCancelReason('');
              }}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                if (!cancelReason.trim()) {
                  toast.error('Alasan pembatalan harus diisi');
                  return;
                }
                cancelMutation.mutate(cancelReason);
              }}
              disabled={cancelMutation.isPending || !cancelReason.trim()}
            >
              {cancelMutation.isPending ? 'Membatalkan...' : 'Ya, Batalkan'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* IGDERP-81: supplier invoice / order confirmation documents */}
      {po && <AttachmentPanel entityType="PURCHASE_ORDER" entityId={po.id} title="Lampiran Invoice / Konfirmasi PO" />}
    </div>
  );
}
