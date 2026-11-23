import { useQuery } from "@tanstack/react-query";
import { Loader2, FileText } from "lucide-react";
import { contractsService } from "@/services/contracts.service";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusDot } from "@/components/shared";

const STATUS_TONE: Record<string, "ok" | "warn" | "off" | "bad"> = {
  active: "ok",
  draft: "off",
  expired: "bad",
  renewed: "warn",
  terminated: "bad",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  draft: "Draft",
  expired: "Expired",
  renewed: "Renewed",
  terminated: "Terminated",
};

const STAGE_LABEL: Record<string, string> = {
  trial: "Trial",
  probation: "Probation",
  pkwt: "PKWT",
  pkwtt: "PKWTT",
};

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtRp(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return "Rp " + Number(v).toLocaleString("id-ID");
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0 w-32">{label}</span>
      <span className="text-sm text-right flex-1">{children}</span>
    </div>
  );
}

export default function ContractDetailDialog({
  contractId,
  onClose,
}: {
  contractId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => contractsService.getById(contractId!),
    enabled: !!contractId,
  });

  return (
    <Dialog open={!!contractId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Detail Kontrak
          </DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-base font-medium">{data.contractNumber}</span>
              <StatusDot tone={STATUS_TONE[data.status] ?? "off"}>
                {STATUS_LABEL[data.status] ?? data.status}
              </StatusDot>
            </div>
            <div>
              <Row label="Karyawan">{data.employee?.employeeCode ?? "—"}</Row>
              <Row label="Stage">{STAGE_LABEL[data.type] ?? data.type}</Row>
              <Row label="Periode">
                {fmtDate(data.startDate)} – {data.endDate ? fmtDate(data.endDate) : "tetap"}
              </Row>
              {(data.type === "trial" || data.type === "probation") && (
                <Row label="Akhir probation">{fmtDate((data as any).probationEndDate)}</Row>
              )}
              <Row label="Posisi">{data.position?.name ?? "—"}</Row>
              {data.grade && <Row label="Grade">{data.grade.name} ({data.grade.code})</Row>}
              {data.division && <Row label="Divisi">{data.division.name}</Row>}
              {data.department && <Row label="Departemen">{data.department.name}</Row>}
              <Row label="Lokasi kerja">
                {(data.contractWorkingLocations ?? []).map((c) => c.workingLocation.name).join(", ") || "—"}
              </Row>
              <Row label="Penempatan">
                {(data.contractBranches ?? []).map((c) =>
                  `${c.branch.name}${c.isPrimary ? " ★" : ""}`).join(", ") || "—"}
              </Row>
              <Row label="Gaji pokok">{fmtRp(data.basicSalary)}</Row>
              {data.changeReason && data.changeReason !== "initial" && (
                <Row label="Alasan">{data.changeReason}</Row>
              )}
              {(data as any).previousContract && (
                <Row label="Kontrak sebelum">
                  <span className="font-mono text-xs">{(data as any).previousContract.contractNumber}</span>
                </Row>
              )}
              {(data as any).nextContracts?.length > 0 && (
                <Row label="Kontrak lanjut">
                  {(data as any).nextContracts.map((n: any) => n.contractNumber).join(", ")}
                </Row>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
