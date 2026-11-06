import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
  ChevronsUpDown,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { toast } from 'sonner';
import { inventoryService } from '../../services/inventory.service';
import type {
  StockImportPreview,
  StockImportPreviewRow,
} from '../../services/inventory.service';
import { api } from '../../services/api';

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface PickerItem {
  id: string;
  label: string;
}

/** Searchable single-select (same Popover+Command pattern as Mutasi/Transfer). */
function SearchPicker({
  items,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  open,
  onOpenChange,
}: {
  items: PickerItem[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const selected = items.find((i) => i.id === value);
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="flex h-10 w-full items-center justify-between rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={selected ? 'truncate text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((i) => (
                <CommandItem
                  key={i.id}
                  value={i.label}
                  onSelect={() => {
                    onChange(i.id);
                    onOpenChange(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${value === i.id ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {i.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Stock In / Stock Out Excel import (IGDERP-97).
 * Template === export columns (round-trip). Flow: target + mode + file →
 * server preview (no writes) → confirm popup → result + per-product
 * skip report. Files are never stored server-side.
 */
export default function StockImportModal({
  open,
  onClose,
  kind,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  kind: 'in' | 'out';
  onImported: () => void;
}) {
  const queryClient = useQueryClient();
  const title = kind === 'in' ? 'Stok Masuk' : 'Stok Keluar';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [outletId, setOutletId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [mode, setMode] = useState<'TAMBAH' | 'REPLACE'>('TAMBAH');
  const [reason, setReason] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StockImportPreview | null>(null);
  const [confirmBox, setConfirmBox] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [busyFile, setBusyFile] = useState(false);
  const [outletOpen, setOutletOpen] = useState(false);
  const [whOpen, setWhOpen] = useState(false);

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches');
      return res.data.data || res.data;
    },
    enabled: open,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: [kind === 'in' ? 'stock-in-warehouses' : 'stock-out-warehouses', outletId],
    queryFn: () =>
      kind === 'in'
        ? inventoryService.getStockInWarehouses(outletId || undefined)
        : inventoryService.getStockOutWarehouses(outletId || undefined),
    enabled: open && !!outletId,
  });

  const reset = () => {
    setStep(1);
    setOutletId('');
    setWarehouseId('');
    setMode('TAMBAH');
    setReason('');
    setPoNumber('');
    setFile(null);
    setPreview(null);
    setConfirmBox(false);
    setResult(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const downloadTemplate = async () => {
    setBusyFile(true);
    try {
      const blob = await inventoryService.downloadImportTemplate(kind);
      saveBlob(blob, kind === 'in' ? 'template-stok-masuk.xlsx' : 'template-stok-keluar.xlsx');
    } catch {
      toast.error('Gagal mengunduh template');
    } finally {
      setBusyFile(false);
    }
  };

  const previewMutation = useMutation({
    mutationFn: () => inventoryService.previewStockImport(kind, file!, kind === 'out' ? warehouseId : undefined),
    onSuccess: (data) => {
      setPreview(data);
      setStep(2);
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'File tidak valid — periksa kolom SKU/Barcode dan Qty');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => {
      const rows = (preview?.rows || [])
        .filter((r: StockImportPreviewRow) => r.errors.length === 0 && r.productId && r.quantity !== null)
        .filter((r: StockImportPreviewRow) => (kind === 'out' ? !r.overQty : true))
        .map((r: StockImportPreviewRow) => ({
          productId: r.productId as string,
          quantity: r.quantity as number,
          stockValue: r.stockValue,
          notes: r.notes,
        }));
      return inventoryService.confirmStockImport(kind, {
        outletId: outletId || undefined,
        warehouseId,
        mode,
        fileName: file?.name || 'import.xlsx',
        reason: reason || undefined,
        poNumber: kind === 'in' ? poNumber.trim() || undefined : undefined,
        rows,
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setStep(3);
      setConfirmBox(false);
      queryClient.invalidateQueries({ queryKey: [kind === 'in' ? 'stock-in-docs' : 'stock-out-docs'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      onImported();
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Konfirmasi import gagal');
    },
  });

  const validRows = (preview?.rows || []).filter(
    (r) => r.errors.length === 0 && (kind === 'out' ? !r.overQty : true),
  );
  const skipped = result?.skipped || [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[75vw] max-w-[75vw] h-[80vh] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            Import Excel {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {step === 1 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Outlet <span className="text-red-500 dark:text-red-400">*</span>
                  </Label>
                  <SearchPicker
                    items={(branches as any[]).map((b: any) => ({ id: b.id, label: `${b.name} (${b.code})` }))}
                    value={outletId}
                    onChange={(id) => {
                      setOutletId(id);
                      setWarehouseId('');
                    }}
                    placeholder="Pilih Outlet"
                    searchPlaceholder="Cari outlet (nama / kode)…"
                    emptyText="Outlet tidak ditemukan."
                    open={outletOpen}
                    onOpenChange={setOutletOpen}
                  />
                </div>
                <div>
                  <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Gudang <span className="text-red-500 dark:text-red-400">*</span>
                  </Label>
                  <SearchPicker
                    items={(warehouses as any[]).map((w: any) => ({ id: w.id, label: `${w.name} (${w.code})` }))}
                    value={warehouseId}
                    onChange={setWarehouseId}
                    placeholder="Pilih Gudang"
                    searchPlaceholder="Cari gudang (nama / kode)…"
                    emptyText="Gudang tidak ditemukan."
                    disabled={!outletId}
                    open={whOpen}
                    onOpenChange={setWhOpen}
                  />
                </div>
              </div>

              <div>
                <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mode import <span className="text-red-500 dark:text-red-400">*</span>
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('TAMBAH')}
                    className={`rounded-lg border p-3 text-left text-sm ${mode === 'TAMBAH' ? 'border-primary-600 bg-primary-50 dark:bg-primary-950 ring-1 ring-primary-600' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'}`}
                  >
                    <span className="font-semibold text-gray-900 dark:text-gray-100">TAMBAH</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Menambah ke stok saat ini (aman untuk stok berjalan).
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('REPLACE')}
                    className={`rounded-lg border p-3 text-left text-sm ${mode === 'REPLACE' ? 'border-primary-600 bg-primary-50 dark:bg-primary-950 ring-1 ring-primary-600' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'}`}
                  >
                    <span className="font-semibold text-gray-900 dark:text-gray-100">REPLACE</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {kind === 'in'
                        ? 'Menyetel SKU di file ke qty file (hanya SKU tersebut).'
                        : 'Mengurangi setiap SKU ke qty file (selisihnya saja).'}
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Alasan / catatan dokumen (opsional)
                </Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="cth. Stok awal migrasi spreadsheet"
                />
              </div>

              {kind === 'in' && (
                <div>
                  <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    No. PO / Invoice Supplier (opsional)
                  </Label>
                  <Input
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="cth. PO-2026-0091"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={downloadTemplate} disabled={busyFile}>
                  {busyFile ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  Unduh Template
                </Button>
                <label className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:border-primary-500">
                  <Upload className="w-4 h-4" />
                  {file ? file.name : 'Pilih file .xlsx'}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Template dan hasil export memakai kolom yang sama — file export bisa langsung diimport kembali.
                File tidak disimpan di server, hanya datanya yang diproses.
              </p>
            </>
          )}

          {step === 2 && preview && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 px-3 py-1 font-medium">
                  Valid: {preview.validCount}
                </span>
                {preview.errorCount > 0 && (
                  <span className="rounded-full bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 px-3 py-1 font-medium">
                    Error: {preview.errorCount}
                  </span>
                )}
                {(preview.overQtyCount || 0) > 0 && (
                  <span className="rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 px-3 py-1 font-medium">
                    Melebihi stok: {preview.overQtyCount} (dilewati saat konfirmasi)
                  </span>
                )}
                {(preview.mergedCount || 0) > 0 && (
                  <span className="rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 px-3 py-1 font-medium">
                    Digabung: {preview.mergedCount} (SKU ganda dijumlah)
                  </span>
                )}
              </div>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-950 text-left text-xs text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="px-3 py-2">Baris</th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Produk</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      {kind === 'out' && <th className="px-3 py-2 text-right">Tersedia</th>}
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {preview.rows.map((r, i) => {
                      const bad = r.errors.length > 0;
                      const warn = !bad && r.overQty;
                      return (
                        <tr key={i} className={bad ? 'bg-red-50 dark:bg-red-950' : warn ? 'bg-amber-50 dark:bg-amber-950' : ''}>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.rowNumbers.join(', ')}</td>
                          <td className="px-3 py-2 font-mono text-xs">{r.sku || r.barcode || '—'}</td>
                          <td className="px-3 py-2">
                            {r.productName || '—'}
                            {r.merged && <span className="ml-2 text-[11px] text-blue-600 dark:text-blue-400">(gabungan)</span>}
                          </td>
                          <td className="px-3 py-2 text-right">{r.quantity ?? '—'}</td>
                          {kind === 'out' && <td className="px-3 py-2 text-right">{r.available ?? '—'}</td>}
                          <td className="px-3 py-2">
                            {bad ? (
                              <span className="flex items-start gap-1 text-xs text-red-700 dark:text-red-300">
                                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{r.errors.join('; ')}</span>
                              </span>
                            ) : warn ? (
                              <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                                <AlertTriangle className="w-4 h-4" /> Melebihi stok — dilewati
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-green-700 dark:text-green-300">
                                <CheckCircle2 className="w-4 h-4" /> Valid
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {confirmBox && (
                <div className="rounded-lg border border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950 p-4 text-sm">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    Konfirmasi import {mode} — {validRows.length} baris valid
                    {kind === 'out' && (preview.overQtyCount || 0) > 0
                      ? `, ${preview.overQtyCount} baris dilewati (melebihi stok)`
                      : ''}
                    ?
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {mode === 'TAMBAH'
                      ? 'Stok bertambah sesuai qty file.'
                      : kind === 'in'
                        ? 'Stok setiap SKU di file DISETEL ke qty file.'
                        : 'Stok setiap SKU di file DIKURANGI ke qty file.'}{' '}
                    Tercatat di log import + riwayat per barang.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button type="button" variant="outline" onClick={() => setConfirmBox(false)}>
                      Batal
                    </Button>
                    <Button
                      type="button"
                      onClick={() => confirmMutation.mutate()}
                      disabled={confirmMutation.isPending}
                    >
                      {confirmMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Ya, Import Sekarang
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 3 && result && (
            <>
              <div className="rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950 p-4 text-sm">
                <p className="font-semibold text-green-900 dark:text-green-100 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Import selesai — dokumen {(result.doc as any)?.documentNumber || ''}
                </p>
                <p className="text-xs text-green-800 dark:text-green-200 mt-1">
                  Tercatat di log import. Riwayat per barang masuk ke pergerakan stok.
                </p>
              </div>
              {skipped.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    {skipped.length} baris dilewati (melebihi stok)
                  </p>
                  <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-amber-50 dark:bg-amber-950 text-left text-xs text-amber-800 dark:text-amber-200">
                        <tr>
                          <th className="px-3 py-2">Produk</th>
                          <th className="px-3 py-2 text-right">Minta</th>
                          <th className="px-3 py-2 text-right">Tersedia</th>
                          <th className="px-3 py-2">Alasan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100">
                        {skipped.map((s: any, i: number) => {
                          const src = (preview?.rows || []).find((r) => r.productId === s.productId);
                          return (
                            <tr key={i} className="bg-amber-50/50 dark:bg-amber-950/50">
                              <td className="px-3 py-2 text-xs">
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {src?.productName || s.productId}
                                </span>
                                <span className="block font-mono text-gray-500 dark:text-gray-400">
                                  {src?.sku || src?.barcode || ''}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right">{s.requested}</td>
                              <td className="px-3 py-2 text-right">{s.available}</td>
                              <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{s.reason}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          {step === 1 && (
            <>
              <Button type="button" variant="outline" onClick={close}>
                Batal
              </Button>
              <Button
                type="button"
                onClick={() => previewMutation.mutate()}
                disabled={!outletId || !warehouseId || !file || previewMutation.isPending}
              >
                {previewMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Preview
              </Button>
            </>
          )}
          {step === 2 && !confirmBox && (
            <>
              <Button type="button" variant="outline" onClick={() => { setStep(1); setPreview(null); }}>
                Kembali
              </Button>
              <Button type="button" onClick={() => setConfirmBox(true)} disabled={validRows.length === 0}>
                Konfirmasi Import ({validRows.length})
              </Button>
            </>
          )}
          {step === 3 && (
            <Button type="button" onClick={close}>
              Tutup
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
