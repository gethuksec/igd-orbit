import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Loader2, Eye, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const actionBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (actionBarRef.current && !actionBarRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

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

  const rejectMutation = useMutation({
    mutationFn: (reason?: string) => purchasingService.rejectPurchaseOrder(id!, reason),
    onSuccess: () => {
      toast.success('Purchase order berhasil ditolak');
      setRejectModalOpen(false);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menolak purchase order');
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
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return null;
    }
  };

  const canApprove =
    (userRoles.includes('CSO') || userRoles.includes('CFO') || userRoles.includes('OWNER') || userRoles.includes('SUPERADMIN')) &&
    (po?.status === 'draft' || po?.status === 'pending');
  // 8 Sep: the manual "send order" step was dropped — GR can be created
  // straight from an approved PO (legacy 'ordered' rows keep working too).
  // "cancel" is no longer part of the PO action set.
  const canBuatGR =
    po?.status === 'approved' || po?.status === 'ordered' || po?.status === 'partially_received';

  const primaryAction: string | null =
    po?.status === 'draft' || po?.status === 'pending'
      ? canApprove
        ? 'approve'
        : null
      : canBuatGR
        ? 'buat GR'
        : null;

  const dropdownItems: { label: string; destructive: boolean; onSelect: () => void }[] = [];
  if (canApprove) {
    dropdownItems.push({ label: 'approve', destructive: false, onSelect: () => setApproveModalOpen(true) });
    dropdownItems.push({ label: 'reject', destructive: true, onSelect: () => setRejectModalOpen(true) });
  }

  const primaryDisabled = primaryAction === 'approve' ? approveMutation.isPending : false;

  const hasActions = primaryAction !== null || dropdownItems.length > 0;

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
        {hasActions && (
          <div className="relative" ref={actionBarRef}>
            <div className="flex">
              {primaryAction && (
                <Button
                  className="rounded-r-none"
                  onClick={() => {
                    if (primaryAction === 'approve') {
                      setApproveModalOpen(true);
                    } else if (primaryAction === 'buat GR') {
                      navigate(`/purchasing/goods-receipt/new/${id}`);
                    }
                  }}
                  disabled={primaryDisabled}
                >
                  {primaryAction}
                </Button>
              )}
              <Button
                variant={primaryAction ? 'default' : 'outline'}
                className={primaryAction ? 'rounded-l-none' : ''}
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="More actions"
              >
                {menuOpen ? <ChevronUp /> : <ChevronDown />}
              </Button>
            </div>
            {menuOpen && (
              <div className="absolute right-0 z-50 mt-1 min-w-40 overflow-hidden rounded-lg border bg-white py-1 shadow">
                {dropdownItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={`block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-muted ${
                      item.destructive ? 'font-semibold text-red-600' : 'text-gray-700'
                    }`}
                    onClick={() => {
                      setMenuOpen(false);
                      item.onSelect();
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </BreadcrumbHeader>

      {/* Rejection reason */}
      {po.status === 'rejected' && po.rejectionReason && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>Alasan penolakan: {po.rejectionReason}</span>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Supplier</h3>
            <p className="text-lg font-bold">{po.supplier?.name || 'N/A'}</p>
            <p className="text-sm text-muted-foreground">{po.supplier?.customerCode}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Invoice Supplier</h3>
            <p className="text-lg font-bold">{po.invoiceNumber || '—'}</p>
            <p className="text-sm text-muted-foreground">
              {po.invoiceDate ? formatDate(po.invoiceDate) : 'Tanggal invoice: —'}
            </p>
            {po.dueDate && (
              <p className="text-sm text-muted-foreground">Jatuh tempo: {formatDate(po.dueDate)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Tanggal Order</h3>
            <p className="text-lg font-bold">{formatDate(po.orderDate)}</p>
            {po.expectedDeliveryDate && (
              <p className="text-sm text-muted-foreground">Perkiraan diterima: {formatDate(po.expectedDeliveryDate)}</p>
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

      {/* Reject Modal */}
      <Modal
        open={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setRejectReason('');
        }}
        title="Tolak Purchase Order"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-red-100 rounded-full">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p>
                Apakah Anda yakin ingin menolak Purchase Order <strong>{po.poNumber}</strong>?
              </p>
              <p className="text-sm text-muted-foreground mt-1">Tindakan ini tidak dapat dibatalkan.</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">
              Alasan Penolakan *
            </label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Alasan penolakan (wajib)..."
              rows={3}
              required
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setRejectModalOpen(false);
                setRejectReason('');
              }}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                if (!rejectReason.trim()) {
                  toast.error('Alasan penolakan harus diisi');
                  return;
                }
                rejectMutation.mutate(rejectReason);
              }}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
            >
              {rejectMutation.isPending ? 'Menolak...' : 'Ya, Tolak'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* IGDERP-81: supplier invoice / order confirmation documents */}
      {po && <AttachmentPanel entityType="PURCHASE_ORDER" entityId={po.id} title="Lampiran Invoice / Konfirmasi PO" />}
    </div>
  );
}
