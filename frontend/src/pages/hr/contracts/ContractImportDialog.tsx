import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ImportDialog,
  ImportDropzone,
  ImportFooter,
  ImportNotice,
  saveBlob,
} from "@/components/shared";
import {
  contractsService,
  type ContractImportCommit,
  type ContractImportDryRun,
} from "@/services/contracts.service";

/**
 * HR contract bulk import (IGDERP-271): payroll sheet in, drafts out.
 * Flow: file → dry-run (server validates, zero writes) → confirm →
 * commit (valid rows become drafts). Caps are NOT enforced at import —
 * HR completes + activates each draft in the app.
 */
export default function ContractImportDialog({
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
  const [dryRun, setDryRun] = useState<ContractImportDryRun | null>(null);
  const [result, setResult] = useState<ContractImportCommit | null>(null);
  const [confirmBox, setConfirmBox] = useState(false);
  const [busyTemplate, setBusyTemplate] = useState(false);

  const reset = () => {
    setStep(1);
    setFile(null);
    setDryRun(null);
    setResult(null);
    setConfirmBox(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const dryRunMutation = useMutation({
    mutationFn: () => contractsService.dryRunImport(file!),
    onSuccess: (data) => {
      setDryRun(data);
      setStep(2);
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || "File tidak valid — periksa kolom NAMA / NIP");
    },
  });

  const commitMutation = useMutation({
    mutationFn: () => contractsService.commitImport(file!),
    onSuccess: (data) => {
      setResult(data);
      setStep(3);
      setConfirmBox(false);
      onImported();
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || "Commit import gagal");
    },
  });

  const validRows = (dryRun?.rows || []).filter((r) => r.status === "ok");
  const created = result?.created || [];
  const skipped = result?.skipped || [];

  return (
    <ImportDialog
      open={open}
      onClose={close}
      title="Import Kontrak dari Payroll"
      step={step}
      headerActions={
        <div className="flex justify-end">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Sumber: sheet Payroll (NAMA, NIP, LEVEL, JENIS KONTRAK, WAKTU KONTRAK, SECTOR, TANGGAL MASUK,
            AREA, GAJI POKOK)
          </span>
        </div>
      }
      footer={
        step === 1 ? (
          <ImportFooter
            onCancel={close}
            onPrimary={() => dryRunMutation.mutate()}
            primaryLabel="Validasi"
            primaryDisabled={!file || dryRunMutation.isPending}
            primaryBusy={dryRunMutation.isPending}
            cancelLabel="Batal"
          />
        ) : step === 2 && !confirmBox ? (
          <ImportFooter
            onCancel={() => {
              setStep(1);
              setDryRun(null);
            }}
            onPrimary={() => setConfirmBox(true)}
            primaryLabel={`Import ${validRows.length} Draft`}
            primaryDisabled={validRows.length === 0}
            cancelLabel="Kembali"
          />
        ) : step === 3 ? (
          <div className="flex justify-end">
            <Button type="button" onClick={close}>
              Tutup
            </Button>
          </div>
        ) : undefined
      }
    >
      {step === 1 && (
        <>
          <ImportDropzone file={file} onFile={setFile} hint="Seret file payroll .xlsx ke sini atau klik untuk pilih" />
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={busyTemplate}
              onClick={async () => {
                setBusyTemplate(true);
                try {
                  const blob = await contractsService.downloadImportTemplate();
                  saveBlob(blob, "template-import-kontrak.xlsx");
                } catch {
                  toast.error("Gagal mengunduh template");
                } finally {
                  setBusyTemplate(false);
                }
              }}
            >
              {busyTemplate ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Unduh Template
            </Button>
          </div>
          <ImportNotice>
            Hasil import selalu <strong>draft</strong> — caps diberlakukan saat aktivasi. Baris tanpa NIP
            yang cocok ditolak; nilai master yang tidak dikenal dikosongkan dan ditandai untuk dilengkapi HR.
          </ImportNotice>
        </>
      )}

      {step === 2 && dryRun && (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-xs font-medium text-muted-foreground">
              Valid: {dryRun.valid}
            </span>
            {dryRun.invalid > 0 && (
              <span className="text-xs font-medium text-muted-foreground">
                Error: {dryRun.invalid}
              </span>
            )}
            {dryRun.multiRowEmployees.length > 0 && (
              <span className="text-xs font-medium text-muted-foreground">
                {dryRun.multiRowEmployees.length} NIP multi-baris — aktifkan dari yang tertua
              </span>
            )}
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-950 text-left text-xs text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-2">Baris</th>
                  <th className="px-3 py-2">NIP / Nama</th>
                  <th className="px-3 py-2">Tipe · Periode</th>
                  <th className="px-3 py-2">Posisi</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {dryRun.rows.map((r, i) => {
                  const bad = r.status === "error";
                  return (
                    <tr key={i} className={bad ? "bg-red-50 dark:bg-red-950" : ""}>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.rowNumber}</td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs font-medium">{r.nip ?? "—"}</span>
                        <span className="block text-xs text-gray-600 dark:text-gray-400">{r.name ?? "—"}</span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.preview.type ?? "—"} · {r.preview.startDate ?? "—"} –{" "}
                        {r.preview.endDate ?? "tetap"}
                        {r.preview.basicSalary != null && (
                          <span className="block text-gray-500 dark:text-gray-400">
                            Rp {Number(r.preview.basicSalary).toLocaleString("id-ID")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.preview.positionCode ?? "—"}
                        {r.preview.gradeCode && (
                          <span className="ml-1 text-purple-700 dark:text-purple-300 font-medium">{r.preview.gradeCode}</span>
                        )}
                        {r.preview.divisionCode && (
                          <span className="block text-gray-500 dark:text-gray-400">{r.preview.divisionCode}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {bad ? (
                          <span className="flex items-start gap-1 text-xs text-red-700 dark:text-red-300">
                            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{r.errors.join("; ")}</span>
                          </span>
                        ) : (
                          <span className="flex flex-col gap-1">
                            <span className="flex items-center gap-1 text-xs text-green-700 dark:text-green-300">
                              <CheckCircle2 className="w-4 h-4" /> Draft siap
                            </span>
                            {r.incomplete.length > 0 && (
                              <span className="flex items-start gap-1 text-xs text-amber-700 dark:text-amber-300">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>Lengkapi: {r.incomplete.join(", ")}</span>
                              </span>
                            )}
                            {r.notes.length > 0 && (
                              <span className="text-[11px] text-gray-500 dark:text-gray-400">{r.notes.join("; ")}</span>
                            )}
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
              <p className="font-medium text-gray-900 dark:text-gray-100">
                Import {validRows.length} baris sebagai draft?
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Nomor kontrak dibuat otomatis (CTR-YYYYMM-XXXXXX). Baris error dilewati. Caps + kelengkapan
                diperiksa saat aktivasi per kontrak.
              </p>
              <div className="flex gap-2 mt-3">
                <Button type="button" variant="outline" onClick={() => setConfirmBox(false)}>
                  Batal
                </Button>
                <Button type="button" onClick={() => commitMutation.mutate()} disabled={commitMutation.isPending}>
                  {commitMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
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
            <p className="font-medium text-green-900 dark:text-green-100 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Import selesai — {created.length} draft dibuat
            </p>
            <p className="text-xs text-green-800 dark:text-green-200 mt-1">
              Lengkapi working location, posisi, gaji, dan penempatan lalu aktifkan per kontrak.
            </p>
          </div>
          {created.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-950 text-left text-xs text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2">Baris</th>
                    <th className="px-3 py-2">Nomor</th>
                    <th className="px-3 py-2">NIP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {created.map((c, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{c.rowNumber}</td>
                      <td className="px-3 py-2 font-mono text-xs font-medium">{c.contractNumber}</td>
                      <td className="px-3 py-2 font-mono text-xs">{c.nip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {skipped.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                {skipped.length} baris dilewati
              </p>
              <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-amber-50 dark:bg-amber-950 text-left text-xs text-amber-800 dark:text-amber-200">
                    <tr>
                      <th className="px-3 py-2">Baris</th>
                      <th className="px-3 py-2">NIP</th>
                      <th className="px-3 py-2">Alasan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 dark:divide-amber-800">
                    {skipped.map((s, i) => (
                      <tr key={i} className="bg-amber-50/50 dark:bg-amber-950/50">
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{s.rowNumber}</td>
                        <td className="px-3 py-2 font-mono text-xs">{s.nip ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{s.errors.join("; ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </ImportDialog>
  );
}

export function ContractImportButton({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="flex items-center gap-2">
        <Upload className="w-4 h-4" />
        <span>Import</span>
      </Button>
      <ContractImportDialog
        open={open}
        onClose={() => setOpen(false)}
        onImported={() => {
          setOpen(false);
          onImported();
        }}
      />
    </>
  );
}
