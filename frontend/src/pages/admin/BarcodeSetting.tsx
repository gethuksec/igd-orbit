import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { LabelCard } from '@/components/purchasing/LabelCard';
import { labelPrintingService, type LabelSettings } from '@/services/labelPrinting.service';

const SAMPLE_LABEL = {
  barcode: '8991234567890',
  printedName: 'Contoh Nama Tercetak',
  sku: 'ACC-000',
  price: 125000,
};

export default function BarcodeSetting() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['label-settings'],
    queryFn: () => labelPrintingService.getSettings(),
  });

  const [form, setForm] = useState<LabelSettings | null>(null);
  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form) throw new Error('no form');
      const { id: _id, configured: _c, name: _n, ...payload } = form;
      return labelPrintingService.updateSettings(payload as Partial<LabelSettings>);
    },
    onSuccess: (saved) => {
      setForm(saved);
      toast.success('Pengaturan label disimpan');
    },
    onError: () => toast.error('Gagal menyimpan pengaturan'),
  });

  const update = (patch: Partial<LabelSettings>) =>
    setForm((f) => (f ? { ...f, ...patch } : f));

  if (isLoading || !form) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Memuat pengaturan...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader title="Barcode Setting" subtitle="Ukuran, simbol, media cetak & isi label barcode" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pengaturan Label &amp; Printer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="label-width">Lebar Label (mm)</Label>
                <Input
                  id="label-width"
                  type="number"
                  min={10}
                  max={300}
                  step={0.5}
                  value={form.labelWidthMm}
                  onChange={(e) => update({ labelWidthMm: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="label-height">Tinggi Label (mm)</Label>
                <Input
                  id="label-height"
                  type="number"
                  min={10}
                  max={300}
                  step={0.5}
                  value={form.labelHeightMm}
                  onChange={(e) => update({ labelHeightMm: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="label-columns">Kolom per Baris (A4)</Label>
                <Input
                  id="label-columns"
                  type="number"
                  min={1}
                  max={10}
                  value={form.columns}
                  onChange={(e) => update({ columns: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="label-symbology">Simbol</Label>
                <select
                  id="label-symbology"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.symbology}
                  onChange={(e) => update({ symbology: e.target.value })}
                >
                  <option value="BARCODE">Barcode (CODE128)</option>
                  <option value="QR">QR Code</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="label-paper">Media Cetak</Label>
              <select
                id="label-paper"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.paperType}
                onChange={(e) => update({ paperType: e.target.value })}
              >
                <option value="THERMAL">Thermal (1 label / halaman)</option>
                <option value="A4">A4 (grid kolom)</option>
              </select>
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Tampilkan Nama Tercetak</div>
                  <div className="text-xs text-muted-foreground">Nama di label (fallback ke nama produk)</div>
                </div>
                <Switch checked={form.showPrintedName} onCheckedChange={(v) => update({ showPrintedName: v })} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Tampilkan Harga</div>
                  <div className="text-xs text-muted-foreground">Harga jual produk di label</div>
                </div>
                <Switch checked={form.showPrice} onCheckedChange={(v) => update({ showPrice: v })} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Tampilkan SKU</div>
                  <div className="text-xs text-muted-foreground">Kode SKU produk di label</div>
                </div>
                <Switch checked={form.showSku} onCheckedChange={(v) => update({ showSku: v })} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Auto-print setelah approve</div>
                  <div className="text-xs text-muted-foreground">
                    Antrian selalu dibuat; auto-print aktif saat print agent tersambung
                  </div>
                </div>
                <Switch checked={form.autoPrint} onCheckedChange={(v) => update({ autoPrint: v })} />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Simpan Pengaturan
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview Label</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center py-4">
              <LabelCard data={SAMPLE_LABEL} settings={form} />
            </div>
            <p className="text-xs text-muted-foreground">
              Contoh tampilan. Format resmi menunggu contoh label dari klien — template default ini bisa diganti.
            </p>
            {!form.configured && (
              <p className="text-xs text-amber-600">
                Belum dikonfigurasi — memakai default (40×30mm, thermal).
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
