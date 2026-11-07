import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { productsService } from '../../services/products.service';
import type {
  ProductDuplicateMode,
  ProductImportPreview,
  ProductImportResult,
} from '../../services/products.service';

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

const STEPS = ['Upload', 'Validasi', 'Import'];

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < step;
        const active = n === step;
        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && <div className={`h-px w-6 ${done || active ? 'bg-primary-500' : 'bg-gray-200'}`} />}
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                active
                  ? 'bg-primary-600 text-white'
                  : done
                    ? 'bg-primary-50 text-primary-700'
                    : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                  active ? 'bg-white text-primary-700' : done ? 'bg-primary-600 text-white' : 'bg-gray-300 text-white'
                }`}
              >
                {done ? '✓' : n}
              </span>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Import Excel produk — 3 langkah: Upload → Validasi → Import.
 * Template 29 kolom; preview read-only; confirm menulis.
 * Hanya baris error yang ditampilkan; Import diblokir selama ada error.
 */
export default function ProductImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<ProductDuplicateMode>('overwrite');
  const [preview, setPreview] = useState<ProductImportPreview | null>(null);
  const [result, setResult] = useState<ProductImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busyTemplate, setBusyTemplate] = useState(false);
  const [busyExport, setBusyExport] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(1);
    setFile(null);
    setDuplicateMode('overwrite');
    setPreview(null);
    setResult(null);
    setDragOver(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!/\.xlsx?$/i.test(f.name)) {
      toast.error('File harus .xlsx');
      return;
    }
    setFile(f);
  };

  const downloadTemplate = async () => {
    setBusyTemplate(true);
    try {
      const blob = await productsService.downloadProductImportTemplate();
      saveBlob(blob, 'template-produk.xlsx');
    } catch {
      toast.error('Gagal mengunduh template');
    } finally {
      setBusyTemplate(false);
    }
  };

  const exportCurrent = async () => {
    setBusyExport(true);
    try {
      const blob = await productsService.exportProductsXlsx();
      saveBlob(blob, `ekspor-produk-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch {
      toast.error('Gagal mengekspor data produk');
    } finally {
      setBusyExport(false);
    }
  };

  const previewMutation = useMutation({
    mutationFn: () => productsService.previewProductImport(file!),
    onSuccess: (data) => {
      setPreview(data);
      setStep(2);
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'File tidak valid — periksa format .xlsx');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => {
      const rows = (preview?.rows || [])
        .filter((r) => r.errors.length === 0)
        .filter((r) => (duplicateMode === 'skip' ? r.action !== 'update' : true));
      return productsService.confirmProductImport({
        fileName: file?.name || 'import.xlsx',
        rows,
        duplicateMode,
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setStep(3);
      onImported();
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Konfirmasi import gagal');
    },
  });

  const errorRows = (preview?.rows || []).filter((r) => r.errors.length > 0);
  const errorCount = preview?.errorCount ?? 0;
  const validCount = preview?.validCount ?? 0;
  const skippedDupes =
    duplicateMode === 'skip'
      ? (preview?.rows || []).filter((r) => r.errors.length === 0 && r.action === 'update').length
      : 0;
  const importableCount = validCount - skippedDupes;
  const importDisabled =
    !preview || errorCount > 0 || importableCount === 0 || confirmMutation.isPending;

  const handleImport = () => {
    if (importableCount === 0) {
      toast.error('Tidak ada baris valid untuk diimport');
      return;
    }
    confirmMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[75vw] max-w-[75vw] h-[80vh] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary-600" />
            Import Excel Produk
          </DialogTitle>
        </DialogHeader>

        <Stepper step={step} />

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {step === 1 && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={downloadTemplate} disabled={busyTemplate}>
                  {busyTemplate ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  Download Template Produk (.xlsx)
                </Button>
                <Button type="button" variant="secondary" onClick={exportCurrent} disabled={busyExport}>
                  {busyExport ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  ⬇ Export data saat ini (.xlsx)
                </Button>
              </div>

              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  pickFile(e.dataTransfer.files?.[0] || null);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors ${
                  dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-gray-50 hover:border-primary-400'
                }`}
              >
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-sm font-medium text-gray-900">
                  {file ? file.name : 'Seret file .xlsx ke sini atau klik untuk pilih'}
                </p>
                {file && (
                  <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(2)} KB</p>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0] || null)}
                />
              </div>

              <div>
                <p className="block text-sm font-medium text-gray-700 mb-2">Mode duplikat barcode</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDuplicateMode('overwrite')}
                    className={`rounded-lg border p-3 text-left text-sm ${duplicateMode === 'overwrite' ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600' : 'border-gray-300 bg-white'}`}
                  >
                    <span className="font-semibold text-gray-900">Overwrite</span>
                    <span className="block text-xs text-gray-500 mt-1">Update produk lama</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicateMode('skip')}
                    className={`rounded-lg border p-3 text-left text-sm ${duplicateMode === 'skip' ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600' : 'border-gray-300 bg-white'}`}
                  >
                    <span className="font-semibold text-gray-900">Skip</span>
                    <span className="block text-xs text-gray-500 mt-1">Lewati duplikat</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 2 && preview && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-green-100 text-green-800 px-3 py-1 font-medium">
                  Valid: {validCount}
                </span>
                {errorCount > 0 && (
                  <span className="rounded-full bg-red-100 text-red-800 px-3 py-1 font-medium">
                    Error: {errorCount}
                  </span>
                )}
                {skippedDupes > 0 && (
                  <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 font-medium">
                    Duplikat dilewati: {skippedDupes}
                  </span>
                )}
              </div>

              {errorCount > 0 && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-800">
                  Import diblokir — perbaiki {errorCount} error dulu
                </div>
              )}

              {errorRows.length > 0 ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Baris</th>
                        <th className="px-3 py-2">Barcode / Item</th>
                        <th className="px-3 py-2">Masalah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {errorRows.map((r, i) => (
                        <tr key={i} className="bg-red-50">
                          <td className="px-3 py-2 text-gray-500">{r.rowNumbers.join(', ')}</td>
                          <td className="px-3 py-2">
                            {r.barcode && <span className="block font-mono text-xs">{r.barcode}</span>}
                            <span className="text-gray-900">{r.name || '—'}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="flex items-start gap-1 text-xs text-red-700">
                              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                              <span>{r.errors.join('; ')}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
                  <p className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-5 h-5" />
                    Semua {validCount} baris valid — siap diimport
                    {duplicateMode === 'skip' && skippedDupes > 0 ? ` (${importableCount} baru, ${skippedDupes} duplikat dilewati)` : ''}.
                  </p>
                </div>
              )}
            </>
          )}

          {step === 3 && result && (
            <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm">
              <p className="font-semibold text-green-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Import selesai — {result.created} dibuat, {result.updated} diupdate
                {result.failed > 0 ? `, ${result.failed} gagal` : ''}
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs text-green-900">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>
                      Baris {e.row}: {e.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
                disabled={!file || previewMutation.isPending}
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
          {step === 2 && (
            <>
              <Button type="button" variant="outline" onClick={reset}>
                Upload ulang
              </Button>
              <Button type="button" onClick={handleImport} disabled={importDisabled}>
                {confirmMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Import
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
