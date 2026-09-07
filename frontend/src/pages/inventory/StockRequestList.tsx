import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { BreadcrumbHeader } from '@/components/shared';
import { usePermissions } from '@/hooks/usePermissions';
import { api } from '@/services/api';
import {
  stockRequestsService,
  SR_NEXT,
  SR_STATUS_LABEL,
  type StockRequest,
} from '@/services/stock-requests.service';

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  APPROVED: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  WAITING_FOR_PO: 'bg-violet-100 text-violet-800 hover:bg-violet-100',
  CHECKOUT: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100',
  KEEP_RESERVED: 'bg-teal-100 text-teal-800 hover:bg-teal-100',
  IN_TRANSIT: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
  RECEIVED: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
  REJECTED: 'bg-red-100 text-red-700 hover:bg-red-100',
  CANCELLED: 'bg-gray-100 text-gray-600 hover:bg-gray-100',
};

export const statusBadge = (status: string) => (
  <Badge className={STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'}>
    {SR_STATUS_LABEL[status] || status}
  </Badge>
);

const TERMINAL = new Set(['RECEIVED', 'REJECTED', 'CANCELLED']);
const ADVANCE_FROM = new Set([
  'APPROVED',
  'WAITING_FOR_PO',
  'CHECKOUT',
  'KEEP_RESERVED',
  'IN_TRANSIT',
]);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

function DetailDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canApprove = hasPermission('inventory.request.approve');
  const [reasonMode, setReasonMode] = useState(false);
  const [reason, setReason] = useState('');
  const [poNumber, setPoNumber] = useState('');

  const detail = useQuery({
    queryKey: ['stock-request', id],
    queryFn: () => stockRequestsService.getById(id!),
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['stock-requests'] });
    queryClient.invalidateQueries({ queryKey: ['stock-request-stats'] });
    queryClient.invalidateQueries({ queryKey: ['stock-request', id] });
  };

  const mutate = useMutation({
    mutationFn: (payload: { status: string; reason?: string; poNumber?: string }) =>
      stockRequestsService.updateStatus(id!, payload),
    onSuccess: (res: any) => {
      invalidate();
      setReasonMode(false);
      setReason('');
      toast.success(`Request → ${SR_STATUS_LABEL[res.status] || res.status}`);
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg || 'Gagal memproses.');
    },
  });

  const approveMut = useMutation({
    mutationFn: () => stockRequestsService.approve(id!),
    onSuccess: () => {
      invalidate();
      toast.success('Request disetujui.');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Gagal menyetujui.'),
  });

  const savePo = async () => {
    if (!poNumber.trim()) {
      toast.error('Isi nomor PO dulu.');
      return;
    }
    mutate.mutate({ status: detail.data!.status, poNumber: poNumber.trim() });
  };

  const doc = detail.data;
  const showPo = !!doc && ['APPROVED', 'WAITING_FOR_PO', 'CHECKOUT', 'KEEP_RESERVED', 'IN_TRANSIT'].includes(doc.status);

  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[560px] max-w-[94vw] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{doc?.requestNumber || '…'}</SheetTitle>
          {doc && (
            <p className="text-sm text-gray-500">
              {fmtDate(doc.createdAt)} • {doc.outlet ? `${doc.outlet.name} (${doc.outlet.code})` : '-'}
            </p>
          )}
        </SheetHeader>

        {detail.isLoading && <p className="text-sm text-gray-500 mt-6">Memuat detail…</p>}
        {detail.isError && <p className="text-sm text-red-600 mt-6">Gagal memuat detail.</p>}

        {doc && (
          <div className="mt-4 space-y-5 pb-6">
            <div>{statusBadge(doc.status)}</div>

            <div>
              <h4 className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2">Pengaju</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Nama</span><b>{doc.staffName}</b></div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tipe customer</span>
                  <b>{doc.customerType === 'MEMBER' ? `Member${doc.memberRef ? ` (${doc.memberRef})` : ''}` : 'User'}</b>
                </div>
                {doc.poNumber && (
                  <div className="flex justify-between"><span className="text-gray-500">No. PO</span><b>{doc.poNumber}</b></div>
                )}
                {doc.cancelReason && (
                  <div className="flex justify-between gap-4"><span className="text-gray-500 shrink-0">Alasan</span><b className="text-right">{doc.cancelReason}</b></div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2">
                Barang ({doc.items?.length || 0} jenis)
              </h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Barcode</TableHead>
                      <TableHead>Produk</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(doc.items || []).map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="text-[13px]">{it.barcode || '-'}</TableCell>
                        <TableCell>
                          {it.productName}
                          {it.listing === 'NEW' && (
                            <Badge className="ml-2 bg-amber-100 text-amber-800 hover:bg-amber-100 text-[11px]">Baru</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-[13px]">{it.categoryName}</TableCell>
                        <TableCell className="text-right font-bold">×{it.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {showPo && canApprove && (
              <div>
                <Label className="text-sm font-semibold">
                  Nomor PO <span className="font-normal text-gray-500">(dibuat manual di Purchasing)</span>
                </Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    placeholder="cth: PO-2026-09-0118"
                    value={poNumber || doc.poNumber || ''}
                    onChange={(e) => setPoNumber(e.target.value)}
                  />
                  <Button variant="outline" onClick={savePo} disabled={mutate.isPending}>
                    Simpan
                  </Button>
                </div>
              </div>
            )}

            {canApprove && doc.status === 'SUBMITTED' && !reasonMode && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => setReasonMode(true)}
                >
                  Tolak
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={() => approveMut.mutate()}
                  disabled={approveMut.isPending}
                >
                  {approveMut.isPending ? '…' : 'Setujui'}
                </Button>
              </div>
            )}

            {canApprove && ADVANCE_FROM.has(doc.status) && !reasonMode && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => setReasonMode(true)}
                >
                  Batalkan
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={() => {
                    const next = SR_NEXT[doc.status];
                    if ((doc.status === 'WAITING_FOR_PO' || doc.status === 'APPROVED') && !(poNumber.trim() || doc.poNumber)) {
                      toast.error('Isi nomor PO dulu sebelum lanjut.');
                      return;
                    }
                    mutate.mutate({
                      status: next,
                      ...(poNumber.trim() ? { poNumber: poNumber.trim() } : {}),
                    });
                  }}
                  disabled={mutate.isPending}
                >
                  → {SR_STATUS_LABEL[SR_NEXT[doc.status]]}
                </Button>
              </div>
            )}

            {canApprove && reasonMode && !TERMINAL.has(doc.status) && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Alasan {doc.status === 'SUBMITTED' ? 'penolakan' : 'pembatalan'} <span className="text-red-600">*</span>
                </Label>
                <Textarea
                  placeholder="Wajib diisi…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setReasonMode(false); setReason(''); }}>
                    Batal
                  </Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    disabled={mutate.isPending}
                    onClick={() => {
                      if (!reason.trim()) {
                        toast.error('Alasan wajib diisi.');
                        return;
                      }
                      mutate.mutate({
                        status: doc.status === 'SUBMITTED' ? 'REJECTED' : 'CANCELLED',
                        reason: reason.trim(),
                      });
                    }}
                  >
                    {mutate.isPending ? '…' : doc.status === 'SUBMITTED' ? 'Kirim penolakan' : 'Batalkan request'}
                  </Button>
                </div>
              </div>
            )}

            {TERMINAL.has(doc.status) && (
              <p className="text-[13px] text-gray-500 text-center">
                Request {SR_STATUS_LABEL[doc.status]?.toLowerCase()} — tidak ada aksi tersisa.
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function StockRequestList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [branchId, setBranchId] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const stats = useQuery({
    queryKey: ['stock-request-stats'],
    queryFn: () => stockRequestsService.stats(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches');
      return res.data.data || res.data;
    },
  });

  const list = useQuery({
    queryKey: ['stock-requests', page, search, status, branchId],
    queryFn: () =>
      stockRequestsService.list({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        status: status || undefined,
        branchId: branchId || undefined,
      }),
  });

  const docs: StockRequest[] = list.data?.data || [];
  const meta = list.data?.meta;

  return (
    <div className="w-full space-y-4">
      <BreadcrumbHeader
        title="Request Stok"
        subtitle="Periksa & setujui permintaan stok dari outlet — PO dibuat manual di Purchasing"
      />

      <div className="flex gap-3">
        <Card className="min-w-[150px] border-red-100">
          <CardContent className="p-4">
            <div className="text-2xl font-extrabold text-red-600">{stats.data?.waiting ?? '…'}</div>
            <div className="text-xs text-gray-500">Menunggu diperiksa</div>
          </CardContent>
        </Card>
        <Card className="min-w-[150px]">
          <CardContent className="p-4">
            <div className="text-2xl font-extrabold">{stats.data?.inProgress ?? '…'}</div>
            <div className="text-xs text-gray-500">Dalam proses</div>
          </CardContent>
        </Card>
        <Card className="min-w-[150px]">
          <CardContent className="p-4">
            <div className="text-2xl font-extrabold">{stats.data?.receivedThisMonth ?? '…'}</div>
            <div className="text-xs text-gray-500">Diterima bulan ini</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2.5">
        <Input
          className="flex-1 min-h-[42px]"
          placeholder="Cari no. request, pengaju, atau PO…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="min-h-[42px] px-3 border border-gray-300 rounded-md bg-white text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Semua status</option>
          {Object.entries(SR_STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          className="min-h-[42px] px-3 border border-gray-300 rounded-md bg-white text-sm"
          value={branchId}
          onChange={(e) => {
            setBranchId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Semua outlet</option>
          {(branches as any[]).map((b: any) => (
            <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        {list.isLoading ? (
          <p className="text-sm text-gray-500">Memuat request…</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada request stok.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Request</TableHead>
                  <TableHead>Outlet / Pengaju</TableHead>
                  <TableHead>Jumlah Produk</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={d.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setOpenId(d.id)}>
                    <TableCell>
                      <span className="font-bold whitespace-nowrap">{d.requestNumber}</span>
                      <div className="text-xs text-gray-500">{fmtDate(d.createdAt)}</div>
                    </TableCell>
                    <TableCell>
                      {d.outlet ? `${d.outlet.name} (${d.outlet.code})` : '-'}
                      <div className="text-xs text-gray-500">{d.staffName} • {d.customerType === 'MEMBER' ? 'Member' : 'User'}</div>
                    </TableCell>
                    <TableCell>{d.itemCount ?? d.items?.length ?? '-'}</TableCell>
                    <TableCell>
                      {statusBadge(d.status)}
                      {d.poNumber && <div className="text-xs text-gray-500 mt-1">{d.poNumber}</div>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setOpenId(d.id); }}>
                        Lihat
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">
                  Hal {meta.page} dari {meta.totalPages} ({meta.total} request)
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Sebelumnya
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                    Berikutnya
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <DetailDrawer id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
