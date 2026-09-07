import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  CheckCheck,
  AlertCircle,
  Loader2,
  History,
} from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/utils/format';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import { purchasingService } from '@/services/purchasing.service';
import AttachmentPanel from '@/components/purchasing/AttachmentPanel';

const REVISIT_REASONS = [
  'Kuantitas tidak sesuai',
  'Data item atau harga salah',
  'Dokumen invoice belum lengkap',
  'Lainnya',
];

const ACTION_LABEL: Record<string, string> = {
  created: 'Dibuat',
  received: 'Diterima',
  revisit: 'Revisit',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
};

const PROCESSOR_ROLES = ['SODO', 'HS', 'SPV', 'SUPERADMIN', 'OWNER'];

export default function GoodsReceiptDetail() {
  const { id } = useParams<{ id: string }>();
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
  const userId = currentUser?.id || '';
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [revisitModalOpen, setRevisitModalOpen] = useState(false);
  const [approveData, setApproveData] = useState({
    notes: '',
  });
  const [cancelReason, setCancelReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [revisitReason, setRevisitReason] = useState(REVISIT_REASONS[0]);
  const [revisitNote, setRevisitNote] = useState('');

  const { data: gr, isLoading, error } = useQuery({
    queryKey: ['goods-receipt', id],
    queryFn: () => purchasingService.getGoodsReceipt(id!),
    enabled: !!id,
  });

  // Receiving rows state (editable in draft/received/revisit)
  const [receiving, setReceiving] = useState<Record<string, { received: number; rejected: number }>>({});
  const [checkAll, setCheckAll] = useState(false);
  const isEditingStatus = gr && ['draft', 'received', 'revisit'].includes(gr.status);
  const canEditReceiving =
    !!gr &&
    isEditingStatus &&
    (gr.receivedBy === userId || PROCESSOR_ROLES.some((r) => userRoles.includes(r)));

  const approveMutation = useMutation({
    mutationFn: (data?: any) => purchasingService.approveGoodsReceipt(id!, data),
    onSuccess: () => {
      toast.success('Goods receipt disetujui');
      queryClient.invalidateQueries({ queryKey: ['goods-receipt', id] });
      setApproveModalOpen(false);
      setApproveData({ notes: '' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => purchasingService.rejectGoodsReceipt(id!, reason),
    onSuccess: () => {
      toast.success('Goods receipt ditolak');
      queryClient.invalidateQueries({ queryKey: ['goods-receipt', id] });
      setRejectModalOpen(false);
      setRejectReason('');
    },
  });

  const revisitMutation = useMutation({
    mutationFn: (reason: string) => purchasingService.revisitGoodsReceipt(id!, reason),
    onSuccess: () => {
      toast.success('GR dikembalikan ke SODO');
      queryClient.invalidateQueries({ queryKey: ['goods-receipt', id] });
      setRevisitModalOpen(false);
      setRevisitNote('');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason?: string) => purchasingService.cancelGoodsReceipt(id!, reason),
    onSuccess: () => {
      toast.success('Goods receipt dibatalkan');
      queryClient.invalidateQueries({ queryKey: ['goods-receipt', id] });
      setCancelModalOpen(false);
      setCancelReason('');
    },
  });

  const receivingMutation = useMutation({
    mutationFn: (items: Array<{ id: string; quantity_received: number; quantity_rejected: number }>) =>
      purchasingService.updateGoodsReceiptReceiving(id!, items),
    onSuccess: () => {
      toast.success('Penerimaan tersimpan');
      queryClient.invalidateQueries({ queryKey: ['goods-receipt', id] });
      setCheckAll(false);
      setReceiving({});
    },
  });

  const orderedFor = (item: any): number | null => {
    if (!gr?.purchaseOrder?.items || !item.purchaseOrderItemId) return null;
    const poItem = gr.purchaseOrder.items.find((i: any) => i.id === item.purchaseOrderItemId);
    return poItem ? Number(poItem.quantityOrdered) : null;
  };

  const rowValue = (item: any) => {
    const over = receiving[item.id];
    const received = over ? over.received : Number(item.quantityReceived);
    const rejected = over ? over.rejected : Number(item.quantityRejected);
    const accepted = received - rejected;
    const ordered = orderedFor(item);
    const isMismatch = ordered !== null && received !== ordered;
    const variancePct = ordered && ordered > 0 ? Math.round(((received - ordered) / ordered) * 100) : 0;
    return { received, rejected, accepted, ordered, isMismatch, variancePct };
  };

  const handleCheckAll = (checked: boolean) => {
    setCheckAll(checked);
    if (!gr) return;
    const next: typeof receiving = {};
    (gr.items ?? []).forEach((item: any) => {
      const ordered = orderedFor(item);
      next[item.id] = {
        received: ordered ?? Number(item.quantityReceived),
        rejected: 0,
      };
    });
    setReceiving(next);
  };

  const handleSaveReceiving = () => {
    if (!gr) return;
    const items = (gr.items ?? []).map((item: any) => ({
      id: item.id,
      quantity_received: rowValue(item).received,
      quantity_rejected: rowValue(item).rejected,
    }));
    receivingMutation.mutate(items);
  };

  const canApprove = gr && ['draft', 'received', 'inspected'].includes(gr.status);
  const canReject =
    gr &&
    gr.status !== 'approved' &&
    gr.status !== 'rejected' &&
    gr.status !== 'cancelled' &&
    gr.status !== 'revisit';
  const canRevisit = gr && ['draft', 'received', 'inspected'].includes(gr.status);
  const canCancel =
    gr &&
    gr.status !== 'approved' &&
    gr.status !== 'rejected' &&
    gr.status !== 'cancelled' &&
    gr.status !== 'revisit';

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-16 h-16 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !gr) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <p className="text-destructive">Gagal memuat goods receipt</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader
        title={gr.grNumber}
        subtitle={
          gr.status === 'draft' ? 'Draft'
            : gr.status === 'received' ? 'Received'
            : gr.status === 'inspected' ? 'Inspected'
            : gr.status === 'revisit' ? <Badge variant="outline">Revisited — menunggu SODO</Badge>
            : gr.status === 'approved' ? 'Approved'
            : gr.status === 'rejected' ? 'Rejected'
            : gr.status === 'cancelled' ? 'Cancelled'
            : ''
        }
      >
        <div className="flex gap-2 flex-wrap">
          {canRevisit && (
            <Button variant="outline" onClick={() => setRevisitModalOpen(true)} disabled={revisitMutation.isPending}>
              <RotateCcw />
              Revisit
            </Button>
          )}
          {canApprove && (
            <Button variant="outline" onClick={() => setApproveModalOpen(true)} disabled={approveMutation.isPending}>
              <CheckCircle />
              Approve
            </Button>
          )}
          {canReject && (
            <Button variant="secondary" onClick={() => setRejectModalOpen(true)} disabled={rejectMutation.isPending}>
              <XCircle />
              Reject
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

      {gr.status === 'revisit' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <b>Revisit:</b> GR dikembalikan ke tim penerimaan (SODO). Periksa &amp; simpan ulang
          kuantitas penerimaan, lalu GR kembali ke status <b>Received</b> untuk approval.
          {gr.revisitReason && <div className="mt-1 text-amber-700">Alasan: “{gr.revisitReason}”</div>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Purchase Order</h3>
            {gr.purchaseOrder ? (
              <Link
                to={`/purchasing/po/${gr.purchaseOrderId}`}
                className="text-lg font-bold text-primary hover:underline"
              >
                {gr.purchaseOrder.poNumber}
              </Link>
            ) : (
              <p className="text-lg font-bold text-muted-foreground">-</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Tanggal Receipt</h3>
            <p className="text-lg font-bold">{formatDate(gr.receiptDate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Variance</h3>
            <p className="text-lg font-bold">
              {gr.variancePercent !== null && gr.variancePercent !== undefined
                ? `${gr.variancePercent.toFixed(2)}%`
                : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle>Items</CardTitle>
          {canEditReceiving && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={checkAll}
                  onCheckedChange={(v) => handleCheckAll(v === true)}
                />
                Check All (qty = yang dipesan)
              </label>
              <Button
                variant="outline"
                onClick={handleSaveReceiving}
                disabled={receivingMutation.isPending}
              >
                <CheckCheck />
                {receivingMutation.isPending ? 'Menyimpan…' : 'Simpan Penerimaan'}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Qty Dipesan</TableHead>
                <TableHead>Qty Diterima</TableHead>
                <TableHead>Qty Ditolak</TableHead>
                <TableHead>Qty Accepted</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gr.items?.map((item: any) => {
                const v = rowValue(item);
                return (
                  <TableRow key={item.id} className={v.isMismatch ? 'bg-amber-50/50' : ''}>
                    <TableCell>
                      <div className="font-semibold">{item.product?.name || 'N/A'}</div>
                      <div className="text-sm text-muted-foreground">{item.product?.sku}</div>
                    </TableCell>
                    <TableCell>{v.ordered ?? '-'}</TableCell>
                    <TableCell>
                      {canEditReceiving ? (
                        <Input
                          type="number"
                          min={0}
                          value={v.received}
                          onChange={(e) =>
                            setReceiving((prev) => ({
                              ...prev,
                              [item.id]: {
                                received: Math.max(0, Number(e.target.value)),
                                rejected: (prev[item.id]?.rejected ?? Number(item.quantityRejected)),
                              },
                            }))
                          }
                          className="w-24"
                        />
                      ) : (
                        <span>{v.received}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {canEditReceiving ? (
                        <Input
                          type="number"
                          min={0}
                          max={v.received}
                          value={v.rejected}
                          onChange={(e) =>
                            setReceiving((prev) => ({
                              ...prev,
                              [item.id]: {
                                received: prev[item.id]?.received ?? Number(item.quantityReceived),
                                rejected: Math.max(0, Math.min(Number(e.target.value), (prev[item.id]?.received ?? Number(item.quantityReceived)))),
                              },
                            }))
                          }
                          className="w-24"
                        />
                      ) : (
                        <span className="text-destructive font-semibold">{v.rejected}</span>
                      )}
                    </TableCell>
                    <TableCell><span className="text-green-600 font-semibold">{v.accepted}</span></TableCell>
                    <TableCell>
                      {v.ordered === null ? (
                        <span className="text-sm text-muted-foreground">-</span>
                      ) : v.isMismatch ? (
                        <Badge variant="outline">
                          {v.variancePct > 0 ? '+' : ''}
                          {v.variancePct}% · selisih
                        </Badge>
                      ) : (
                        <Badge>Sesuai (0%)</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {gr.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-muted-foreground">{gr.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* IGDERP-81: documents (invoice supplier / surat jalan) on GR */}
      <AttachmentPanel entityType="GOODS_RECEIPT" entityId={gr.id} title="Lampiran Dokumen Penerimaan" />

      {/* IGDERP-80: audit trail (append-only) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" />
            <CardTitle>Riwayat</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {gr.events && gr.events.length > 0 ? (
            <ul className="space-y-3">
              {gr.events.map((ev: any) => (
                <li key={ev.id} className="flex gap-3">
                  <div className="flex-none w-2 h-2 rounded-full bg-primary mt-2" />
                  <div>
                    <div className="text-sm font-semibold">
                      {ACTION_LABEL[ev.action] || ev.action} · {ev.actor?.fullName || ev.actor?.email || '-'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(ev.createdAt).toLocaleString('id-ID')}
                    </div>
                    {ev.note && <div className="text-sm text-muted-foreground mt-0.5">{ev.note}</div>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>
          )}
        </CardContent>
      </Card>

      {/* Approve modal */}
      <Modal open={approveModalOpen} onClose={() => setApproveModalOpen(false)}>
        <h2 className="text-xl font-bold mb-4">Approve Goods Receipt</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold">Catatan</label>
            <Textarea
              value={approveData.notes}
              onChange={(e) => setApproveData({ ...approveData, notes: e.target.value })}
              placeholder="Catatan tambahan (opsional)"
              className="mt-1"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Stok masuk ke <b>central-good</b>; qty ditolak otomatis ke <b>central-bad</b> (Gudang Pusat).
          </p>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setApproveModalOpen(false)}>
            Batal
          </Button>
          <Button
            onClick={() =>
              approveMutation.mutate({ notes: approveData.notes, inspection_status: 'passed' })
            }
            disabled={approveMutation.isPending}
          >
            Setujui &amp; Masukkan Stok
          </Button>
        </div>
      </Modal>

      {/* Revisit modal */}
      <Modal open={revisitModalOpen} onClose={() => setRevisitModalOpen(false)}>
        <h2 className="text-xl font-bold mb-4">Revisit — Kembalikan ke SODO</h2>
        <div className="space-y-3">
          <label className="text-sm font-semibold">Alasan</label>
          {REVISIT_REASONS.map((r) => (
            <label
              key={r}
              className="flex items-start gap-2 text-sm border rounded-lg p-2 cursor-pointer"
            >
              <input
                type="radio"
                name="revisit_reason"
                checked={revisitReason === r}
                onChange={() => setRevisitReason(r)}
                className="mt-0.5 accent-orange-500"
              />
              {r}
            </label>
          ))}
          <div>
            <label className="text-sm font-semibold">Catatan (wajib)</label>
            <Textarea
              value={revisitNote}
              onChange={(e) => setRevisitNote(e.target.value)}
              placeholder="Detail alasan…"
              className="mt-1"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            GR kembali ke status <b>Received</b> dan dapat diedit oleh SODO. Record inspeksi tetap tersimpan.
          </p>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setRevisitModalOpen(false)}>
            Batal
          </Button>
          <Button
            variant="secondary"
            onClick={() => revisitMutation.mutate(revisitNote || revisitReason)}
            disabled={revisitMutation.isPending || !revisitNote.trim()}
          >
            Kembalikan ke SODO
          </Button>
        </div>
      </Modal>

      {/* Reject modal */}
      <Modal open={rejectModalOpen} onClose={() => setRejectModalOpen(false)}>
        <h2 className="text-xl font-bold text-destructive mb-4">Reject Goods Receipt</h2>
        <div>
          <label className="text-sm font-semibold">Alasan penolakan (wajib)</label>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Alasan…"
            className="mt-1"
          />
        </div>
        <p className="text-sm text-muted-foreground mt-3">GR ditolak final — stok TIDAK akan masuk.</p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
            Batal
          </Button>
          <Button
            variant="secondary"
            onClick={() => rejectMutation.mutate(rejectReason)}
            disabled={rejectMutation.isPending || !rejectReason.trim()}
          >
            Reject
          </Button>
        </div>
      </Modal>

      {/* Cancel modal */}
      <Modal open={cancelModalOpen} onClose={() => setCancelModalOpen(false)}>
        <h2 className="text-xl font-bold text-destructive mb-4">Cancel Goods Receipt</h2>
        <div>
          <label className="text-sm font-semibold">Alasan (opsional)</label>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Alasan pembatalan…"
            className="mt-1"
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setCancelModalOpen(false)}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={() => cancelMutation.mutate(cancelReason)}
            disabled={cancelMutation.isPending}
          >
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
