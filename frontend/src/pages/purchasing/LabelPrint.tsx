import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Printer, Save, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LabelCard } from '@/components/purchasing/LabelCard';
import { labelPrintingService, type LabelSettings } from '@/services/labelPrinting.service';
import { formatDate } from '@/utils/format';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-50 border-amber-300 text-amber-700' },
  printed: { label: 'Sudah Cetak', className: 'bg-green-50 border-green-300 text-green-700' },
};

const SAMPLE = { barcode: '8991234567890', printedName: 'Contoh Nama Tercetak', sku: 'ACC-000', price: 125000 };

/**
 * S5 (fc7b9d65): label print queue + printer/label settings.
 * Queue is filled automatically when a Goods Receipt is approved (copies = accepted qty).
 * Client label format still pending — the template below is the default scaffold.
 */
export default function LabelPrint() {
  const [tab, setTab] = useState<'queue' | 'settings'>('queue');

  return (
    <div className="space-y-6">
      <BreadcrumbHeader title="Cetak Label" subtitle="Antrian label barcode dari penerimaan barang + pengaturan label">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('queue')}
            className={`px-4 py-2 rounded-md text-sm font-medium border ${
              tab === 'queue' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300'
            }`}
          >
            <Printer className="w-4 h-4 inline mr-2" />
            Antrian Label
          </button>
          <button
            onClick={() => setTab('settings')}
            className={`px-4 py-2 rounded-md text-sm font-medium border ${
              tab === 'settings' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300'
            }`}
          >
            <Settings2 className="w-4 h-4 inline mr-2" />
            Pengaturan
          </button>
        </div>
      </BreadcrumbHeader>

      {tab === 'queue' ? <QueueTab /> : <SettingsTab />}
    </div>
  );
}

// ================================================================ Queue

function QueueTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'pending' | 'printed' | 'all'>('pending');
  const [search, setSearch] = useState('');

  const { data: resp, isLoading } = useQuery({
    queryKey: ['label-jobs', statusFilter],
    queryFn: () =>
      labelPrintingService.getJobs(statusFilter === 'all' ? undefined : { status: statusFilter }),
  });

  const jobs = useMemo(() => {
    const list = resp?.data || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (j) =>
        j.jobNumber.toLowerCase().includes(q) ||
        (j.product?.name || '').toLowerCase().includes(q) ||
        (j.goodsReceipt?.grNumber || '').toLowerCase().includes(q),
    );
  }, [resp, search]);

  const pendingCount = resp?.pendingCount ?? 0;

  const printAllPending = async () => {
    const all = await queryClient.fetchQuery({
      queryKey: ['label-jobs', 'print-all-pending'],
      queryFn: () => labelPrintingService.getJobs({ status: 'pending' }),
    });
    const ids = (all?.data || []).map((j) => j.id);
    if (!ids.length) {
      toast.info('Tidak ada label pending');
      return;
    }
    navigate(`/purchasing/label-print/sheet?ids=${ids.join(',')}`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Antrian Label</CardTitle>
        <div className="flex items-center gap-3">
          <Input
            placeholder="Cari no. job / produk / no. GR…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Button onClick={printAllPending} disabled={pendingCount === 0}>
            <Printer className="w-4 h-4 mr-2" />
            Cetak Label Pending ({pendingCount})
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          {(
            [
              ['pending', `Pending (${pendingCount})`],
              ['printed', 'Sudah Cetak'],
              ['all', 'Semua'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                statusFilter === key
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Printer className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            Belum ada label di antrian. Label dibuat otomatis saat Goods Receipt di-approve.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Job</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>No. GR</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dicetak Oleh</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const badge = STATUS_BADGE[job.status] || STATUS_BADGE.pending;
                return (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.jobNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium">{job.product?.name || job.payload?.name}</div>
                      <div className="text-xs text-gray-500">{job.product?.sku}</div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{job.copies}</TableCell>
                    <TableCell>{job.goodsReceipt?.grNumber || '—'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.className}`}>
                        {badge.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {job.printedByUser?.fullName || '—'}
                      {job.printedAt ? ` · ${formatDate(job.printedAt)}` : ''}
                    </TableCell>
                    <TableCell className="text-right">
                      {job.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/purchasing/label-print/sheet?ids=${job.id}`)}
                        >
                          <Printer className="w-3.5 h-3.5 mr-1.5" />
                          Cetak
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ================================================================ Settings

function SettingsTab() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['label-settings'],
    queryFn: () => labelPrintingService.getSettings(),
  });

  const [form, setForm] = useState<Partial<LabelSettings>>({});

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      labelPrintingService.updateSettings({
        labelWidthMm: Number(form.labelWidthMm),
        labelHeightMm: Number(form.labelHeightMm),
        columns: Number(form.columns),
        symbology: form.symbology,
        paperType: form.paperType,
        showPrintedName: !!form.showPrintedName,
        showPrice: !!form.showPrice,
        showSku: !!form.showSku,
        autoPrint: !!form.autoPrint,
      }),
    onSuccess: (updated) => {
      toast.success('Pengaturan label disimpan');
      setForm(updated);
      queryClient.invalidateQueries({ queryKey: ['label-settings'] });
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg || 'Gagal menyimpan pengaturan');
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const preview: any = {
    labelWidthMm: Number(form.labelWidthMm) || 40,
    labelHeightMm: Number(form.labelHeightMm) || 30,
    columns: Number(form.columns) || 3,
    symbology: form.symbology || 'BARCODE',
    paperType: form.paperType || 'THERMAL',
    showPrintedName: !!form.showPrintedName,
    showPrice: !!form.showPrice,
    showSku: !!form.showSku,
    autoPrint: !!form.autoPrint,
    name: form.name || 'Default',
    id: form.id ?? null,
    configured: form.configured ?? false,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Pengaturan Label & Printer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Lebar Label (mm)</Label>
              <Input
                type="number"
                min={10}
                max={300}
                value={form.labelWidthMm ?? ''}
                onChange={(e) => setForm({ ...form, labelWidthMm: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tinggi Label (mm)</Label>
              <Input
                type="number"
                min={10}
                max={300}
                value={form.labelHeightMm ?? ''}
                onChange={(e) => setForm({ ...form, labelHeightMm: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Kolom per Baris (A4)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={form.columns ?? ''}
                onChange={(e) => setForm({ ...form, columns: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Simbol</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.symbology || 'BARCODE'}
                onChange={(e) => setForm({ ...form, symbology: e.target.value })}
              >
                <option value="BARCODE">Barcode (CODE128)</option>
                <option value="QR">QR Code</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Media Cetak</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.paperType || 'THERMAL'}
                onChange={(e) => setForm({ ...form, paperType: e.target.value })}
              >
                <option value="THERMAL">Thermal (1 label / halaman)</option>
                <option value="A4">A4 (banyak label / lembar)</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Tampilkan Nama Tercetak</div>
                <div className="text-xs text-gray-500">Nama di label (fallback ke nama produk)</div>
              </div>
              <Switch
                checked={!!form.showPrintedName}
                onCheckedChange={(v) => setForm({ ...form, showPrintedName: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Tampilkan Harga</div>
                <div className="text-xs text-gray-500">Harga jual produk di label</div>
              </div>
              <Switch checked={!!form.showPrice} onCheckedChange={(v) => setForm({ ...form, showPrice: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Tampilkan SKU</div>
                <div className="text-xs text-gray-500">Kode SKU produk di label</div>
              </div>
              <Switch checked={!!form.showSku} onCheckedChange={(v) => setForm({ ...form, showSku: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Auto-print setelah approve</div>
                <div className="text-xs text-gray-500">
                  Antrian selalu dibuat; auto-print aktif saat print agent tersambung (scaffold)
                </div>
              </div>
              <Switch checked={!!form.autoPrint} onCheckedChange={(v) => setForm({ ...form, autoPrint: v })} />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Simpan Pengaturan
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview Label</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <LabelCard data={SAMPLE} settings={preview} />
          <p className="text-xs text-gray-500 text-center">
            Contoh tampilan. Format resmi menunggu contoh label dari klien — template default ini bisa diganti.
          </p>
          {!preview.configured && (
            <p className="text-xs text-amber-600 text-center">
              Belum dikonfigurasi — memakai default (40×30mm, thermal).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
