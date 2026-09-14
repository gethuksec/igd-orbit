import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ArrowRightLeft, FileText, Printer, User } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { inventoryService } from '../../services/inventory.service';
import { toast } from 'sonner';

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-700',
    received: 'bg-emerald-100 text-emerald-700',
    sent: 'bg-blue-100 text-blue-700',
    pending: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = {
    completed: 'Selesai',
    received: 'Diterima',
    sent: 'Dikirim',
    pending: 'Menunggu',
    cancelled: 'Dibatalkan',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        styles[status] || 'bg-gray-100 text-gray-600'
      }`}
    >
      {labels[status] || status}
    </span>
  );
};

export default function StockTransferDetail({ backPath = '/inventory/transfer' }: { backPath?: string }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // IGDERP-173/174 dialog state
  const [sendOpen, setSendOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sentQty, setSentQty] = useState<Record<string, string>>({});
  const [recvQty, setRecvQty] = useState<Record<string, string>>({});
  const [dmgQty, setDmgQty] = useState<Record<string, string>>({});
  const [dmgPhoto, setDmgPhoto] = useState<Record<string, string>>({});
  const [dmgNotes, setDmgNotes] = useState<Record<string, string>>({});

  const { data: doc, isLoading, isError } = useQuery({
    queryKey: ['transfer-doc', id],
    queryFn: () => inventoryService.getTransferById(id!),
    enabled: !!id,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['transfer-doc', id] });
    queryClient.invalidateQueries({ queryKey: ['mutasi-docs'] });
    queryClient.invalidateQueries({ queryKey: ['transfer-docs'] });
  };

  const sendMutation = useMutation({
    mutationFn: (items: Array<{ itemId: string; quantitySent: number }>) =>
      inventoryService.sendMutasi(id!, { items }),
    onSuccess: () => {
      toast.success('Mutasi dikirim — stok sumber berkurang');
      setSendOpen(false);
      refresh();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Gagal mengirim mutasi'),
  });

  const receiveMutation = useMutation({
    mutationFn: (items: Array<{ itemId: string; quantityReceived: number; damageQuantity?: number; damagePhotoUrl?: string; damageNotes?: string }>) =>
      inventoryService.receiveMutasi(id!, { items }),
    onSuccess: () => {
      toast.success('Mutasi diterima — stok tujuan bertambah');
      setReceiveOpen(false);
      refresh();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Gagal menerima mutasi'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => inventoryService.cancelMutasi(id!),
    onSuccess: () => {
      toast.success('Mutasi dibatalkan');
      refresh();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Gagal membatalkan mutasi'),
  });

  if (isLoading) {
    return (
      <div className="w-full space-y-4">
        <BreadcrumbHeader title="Detail Transfer" subtitle="Memuat data transfer..." />
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-10 text-center text-gray-500">
          Memuat...
        </div>
      </div>
    );
  }

  if (isError || !doc) {
    return (
      <div className="w-full space-y-4">
        <BreadcrumbHeader title="Detail Transfer" subtitle="Dokumen tidak ditemukan">
          <Button variant="ghost" size="sm" onClick={() => navigate(backPath)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
        </BreadcrumbHeader>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-10 text-center text-gray-500">
          Dokumen transfer tidak ditemukan.
        </div>
      </div>
    );
  }

  const isCentralDest = !doc.toBranchId;
  const totalQty = doc.items.reduce((sum, item) => sum + Number(item.quantityRequested || 0), 0);
  const docTypeLabel = doc.transferType === 'mutasi' ? 'Mutasi' : 'Transfer Stok';
  // IGDERP-173: lifecycle actions only for mutasi docs (transfer stays immediate)
  const isMutasi = doc.transferType === 'mutasi';
  const canSend = isMutasi && doc.status === 'pending';
  const canReceive = isMutasi && doc.status === 'sent';
  const canCancel = isMutasi && (doc.status === 'pending' || doc.status === 'sent');
  const canPrint = isMutasi && (doc.status === 'pending' || doc.status === 'sent');

  const openSend = () => {
    const init: Record<string, string> = {};
    doc.items.forEach((i: any) => {
      init[i.id] = String(i.quantitySent ?? i.quantityRequested);
    });
    setSentQty(init);
    setSendOpen(true);
  };

  const openReceive = () => {
    const r: Record<string, string> = {};
    const d: Record<string, string> = {};
    doc.items.forEach((i: any) => {
      r[i.id] = String(i.quantitySent ?? i.quantityRequested);
      d[i.id] = '0';
    });
    setRecvQty(r);
    setDmgQty(d);
    setDmgPhoto({});
    setDmgNotes({});
    setReceiveOpen(true);
  };

  const submitSend = () => {
    sendMutation.mutate(
      doc.items.map((i: any) => ({
        itemId: i.id,
        quantitySent: Math.max(0, parseInt(sentQty[i.id] ?? String(i.quantityRequested), 10) || 0),
      })),
    );
  };

  const submitReceive = () => {
    receiveMutation.mutate(
      doc.items.map((i: any) => ({
        itemId: i.id,
        quantityReceived: Math.max(0, parseInt(recvQty[i.id] ?? '0', 10) || 0),
        damageQuantity: Math.max(0, parseInt(dmgQty[i.id] ?? '0', 10) || 0),
        damagePhotoUrl: dmgPhoto[i.id] || undefined,
        damageNotes: dmgNotes[i.id] || undefined,
      })),
    );
  };

  return (
    <div className="w-full space-y-4">
      <BreadcrumbHeader title="Detail Transfer" subtitle={`Dokumen ${doc.transferNumber}`}>
        <Button variant="ghost" size="sm" onClick={() => navigate(backPath)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali
        </Button>
        {/* IGDERP-173/174: lifecycle + checklist actions for mutasi docs */}
        {canSend && (
          <Button size="sm" onClick={openSend}>
            Kirim
          </Button>
        )}
        {canReceive && (
          <Button size="sm" onClick={openReceive}>
            Terima
          </Button>
        )}
        {canPrint && (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/inventory/mutasi/${doc.id}/checklist`}>
              <Printer className="w-4 h-4 mr-1" />
              Checklist
            </Link>
          </Button>
        )}
        {canCancel && (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50"
            disabled={cancelMutation.isPending}
            onClick={() => {
              if (
                window.confirm(
                  doc.status === 'sent'
                    ? 'Batalkan mutasi ini? Unit dalam perjalanan kembali ke gudang asal.'
                    : 'Batalkan mutasi ini?',
                )
              ) {
                cancelMutation.mutate();
              }
            }}
          >
            Batalkan
          </Button>
        )}
      </BreadcrumbHeader>

      {/* ── Document info ── */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            {doc.transferNumber}
          </h2>
          {statusBadge(doc.status)}
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
            {docTypeLabel}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-400 uppercase font-semibold">Tanggal</div>
            <div className="text-gray-800 font-medium mt-1">
              {new Date(doc.createdAt).toLocaleString('id-ID')}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase font-semibold flex items-center gap-1">
              <User className="w-3 h-3" /> Petugas
            </div>
            <div className="text-gray-800 font-medium mt-1">{doc.picName || '-'}</div>
          </div>
          {doc.notes && (
            <div className="md:col-span-3">
              <div className="text-xs text-gray-400 uppercase font-semibold">Catatan</div>
              <div className="text-gray-700 mt-1">{doc.notes}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Route ── */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-primary-600" />
          Rute Transfer
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
            <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Dari</div>
            <div className="font-semibold text-gray-900">{doc.fromWarehouse?.name || '-'}</div>
            <div className="text-sm text-gray-500">{doc.fromBranch?.name || '—'}</div>
          </div>
          <div className="flex justify-center">
            <ArrowRight className="w-6 h-6 text-primary-500" />
          </div>
          <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
            <div className="text-xs text-emerald-600 uppercase font-semibold mb-1">Ke</div>
            <div className="font-semibold text-gray-900">{doc.toWarehouse?.name || '-'}</div>
            <div className="text-sm text-gray-500">
              {isCentralDest ? 'Gudang pusat (sistem)' : doc.toBranch?.name || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Items ── */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Daftar Produk</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Produk</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">SKU</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Diminta</th>
                {(doc.status !== 'pending' || isMutasi) && (
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Dikirim</th>
                )}
                {(doc.status === 'received' || (isMutasi && doc.status === 'sent')) && (
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Diterima</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {doc.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">
                      {item.productName || item.product?.name || '-'}
                    </div>
                    {item.notes && <div className="text-xs text-gray-400">{item.notes}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {item.productSku || item.product?.sku || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                    {item.quantityRequested}
                  </td>
                  {(doc.status !== 'pending' || isMutasi) && (
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {item.quantitySent ?? '—'}
                    </td>
                  )}
                  {(doc.status === 'received' || (isMutasi && doc.status === 'sent')) && (
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {item.quantityReceived ?? '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <span className="text-gray-600">Total Barang:</span>
          <span className="text-lg font-bold text-gray-900">{totalQty}</span>
        </div>
      </div>

      {/* IGDERP-173: send dialog (qty adjust down allowed) */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Kirim Mutasi {doc.transferNumber}</DialogTitle>
            <DialogDescription>
              Stok sumber berkurang sekarang; tujuan bertambah saat diterima. Jumlah kirim boleh
              dikurangi dari yang diminta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {doc.items.map((i: any) => (
              <div key={i.id} className="flex items-center gap-3 text-sm">
                <div className="flex-1">
                  <div className="font-semibold">{i.productName || i.product?.name}</div>
                  <div className="text-xs text-gray-400">diminta {i.quantityRequested}</div>
                </div>
                <div className="w-28">
                  <Label className="text-xs">Dikirim</Label>
                  <Input
                    type="number"
                    min="0"
                    max={Number(i.quantityRequested)}
                    value={sentQty[i.id] ?? ''}
                    onChange={(e) => setSentQty((s) => ({ ...s, [i.id]: e.target.value }))}
                    className="h-9 text-right"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setSendOpen(false)}>
              Batal
            </Button>
            <Button size="sm" disabled={sendMutation.isPending} onClick={submitSend}>
              {sendMutation.isPending ? 'Mengirim…' : 'Kirim'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* IGDERP-173: receive dialog (received + damage must equal sent) */}
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Terima Mutasi {doc.transferNumber}</DialogTitle>
            <DialogDescription>
              Diterima + rusak harus pas sama dengan terkirim. Unit rusak dibukukan ke bad stock
              (mutasi otomatis) — sertakan foto (link WA) sebagai bukti.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {doc.items.map((i: any) => {
              const sent = Number(i.quantitySent ?? i.quantityRequested);
              const recv = parseInt(recvQty[i.id] ?? '0', 10) || 0;
              const dmg = parseInt(dmgQty[i.id] ?? '0', 10) || 0;
              const balanced = recv + dmg === sent;
              return (
                <div key={i.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="font-semibold text-sm">
                    {i.productName || i.product?.name}{' '}
                    <span className="font-normal text-gray-400">· terkirim {sent}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    <div>
                      <Label className="text-xs">Diterima baik</Label>
                      <Input
                        type="number"
                        min="0"
                        max={sent}
                        value={recvQty[i.id] ?? ''}
                        onChange={(e) => setRecvQty((s) => ({ ...s, [i.id]: e.target.value }))}
                        className="h-9 text-right"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Rusak</Label>
                      <Input
                        type="number"
                        min="0"
                        max={sent}
                        value={dmgQty[i.id] ?? ''}
                        onChange={(e) => setDmgQty((s) => ({ ...s, [i.id]: e.target.value }))}
                        className="h-9 text-right"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Foto bukti (link WA)</Label>
                      <Input
                        value={dmgPhoto[i.id] ?? ''}
                        onChange={(e) => setDmgPhoto((s) => ({ ...s, [i.id]: e.target.value }))}
                        placeholder="https://… (wajib jika ada rusak)"
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label className="text-xs">Catatan kerusakan (opsional)</Label>
                    <Input
                      value={dmgNotes[i.id] ?? ''}
                      onChange={(e) => setDmgNotes((s) => ({ ...s, [i.id]: e.target.value }))}
                      placeholder="cth: kardus basah"
                      className="h-9"
                    />
                  </div>
                  {!balanced && (
                    <div className="mt-1 text-xs font-semibold text-amber-600">
                      Diterima ({recv}) + rusak ({dmg}) harus = terkirim ({sent})
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setReceiveOpen(false)}>
              Batal
            </Button>
            <Button size="sm" disabled={receiveMutation.isPending} onClick={submitReceive}>
              {receiveMutation.isPending ? 'Menyimpan…' : 'Simpan penerimaan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
