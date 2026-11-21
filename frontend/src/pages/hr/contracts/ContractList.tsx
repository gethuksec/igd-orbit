import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, FileText, CheckCircle, Clock, Award } from "lucide-react";
import { contractsService, type Contract } from "@/services/contracts.service";
import { BreadcrumbHeader, StatCard, FilterToolbar, DataTable, StatusDot } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import IntakeDialog from "@/components/hr/IntakeDialog";
import { ContractImportButton } from "./ContractImportDialog";

const STAGE_LABEL: Record<string, string> = {
  trial: "Trial",
  probation: "Probation",
  pkwt: "PKWT",
  pkwtt: "PKWTT",
};

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

function fmtDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtRp(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return "Rp " + Number(v).toLocaleString("id-ID");
}

export default function ContractList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [intakeOpen, setIntakeOpen] = useState(false);
  const limit = 20;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["contracts", page, searchTerm, typeFilter, statusFilter],
    queryFn: () =>
      contractsService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, refetch]);

  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? rows.length;
  const activeCount = rows.filter((r) => r.status === "active").length;
  const expiringCount = rows.filter((r) => {
    if (r.status !== "active" || !r.endDate) return false;
    const days = (new Date(r.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
  }).length;
  const pkwttCount = rows.filter((r) => r.type === "pkwtt").length;

  const columns: Column<Contract>[] = [
    {
      key: "contractNumber",
      header: "Nomor",
      cell: (row) => (
        <div>
          <div className="font-mono text-[15px] font-medium">{row.contractNumber}</div>
          {row.changeReason && row.changeReason !== "initial" && (
            <div className="text-xs text-muted-foreground mt-1">{row.changeReason}</div>
          )}
        </div>
      ),
    },
    {
      key: "employee",
      header: "Karyawan",
      cell: (row) => (
        <div className="font-mono text-[15px] font-medium">{row.employee?.employeeCode ?? "-"}</div>
      ),
    },
    {
      key: "type",
      header: "Stage",
      cell: (row) => (
        <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">
          {STAGE_LABEL[row.type] ?? row.type}
        </span>
      ),
    },
    {
      key: "period",
      header: "Periode",
      cell: (row) => (
        <div className="text-sm">
          {fmtDate(row.startDate)} – {row.endDate ? fmtDate(row.endDate) : "tetap"}
          <div className="text-xs text-muted-foreground mt-1">{fmtRp(row.basicSalary)}</div>
        </div>
      ),
    },
    {
      key: "position",
      header: "Posisi",
      cell: (row) => (
        <div>
          <span className="text-sm">{row.position?.name ?? "-"}</span>
          {row.grade && (
            <span className="ml-2 font-mono text-xs text-muted-foreground">{row.grade.code}</span>
          )}
        </div>
      ),
    },
    {
      key: "location",
      header: "Lokasi",
      cell: (row) => (
        <span className="text-sm">
          {(row.contractWorkingLocations ?? []).map((c) => c.workingLocation.name).join(", ") || "-"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <StatusDot tone={STATUS_TONE[row.status] ?? "off"}>{STATUS_LABEL[row.status] ?? row.status}</StatusDot>
      ),
    },
  ];

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Kontrak Karyawan" subtitle="Kontrak kerja — trial, probation, PKWT, PKWTT">
        <div className="flex items-center gap-2">
          <ContractImportButton onImported={() => queryClient.invalidateQueries({ queryKey: ["contracts"] })} />
          <Button onClick={() => setIntakeOpen(true)} className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            <span>Kontrak Baru</span>
          </Button>
        </div>
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 dark:text-red-200 font-medium">{(error as Error).message || "Terjadi kesalahan"}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard icon={<FileText className="h-5 w-5" />} label="Total Kontrak" value={isLoading ? "-" : total} />
        <StatCard icon={<CheckCircle className="h-5 w-5" />} label="Aktif" value={isLoading ? "-" : activeCount} />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Berakhir ≤ 30 hari"
          value={isLoading ? "-" : expiringCount}
        />
        <StatCard icon={<Award className="h-5 w-5" />} label="PKWTT (tetap)" value={isLoading ? "-" : pkwttCount} />
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nomor kontrak..."
        fields={[
          {
            key: "type",
            label: "Stage",
            type: "select",
            options: [
              { value: "trial", label: "Trial" },
              { value: "probation", label: "Probation" },
              { value: "pkwt", label: "PKWT" },
              { value: "pkwtt", label: "PKWTT" },
            ],
          },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "active", label: "Aktif" },
              { value: "draft", label: "Draft" },
              { value: "expired", label: "Expired" },
              { value: "renewed", label: "Renewed" },
              { value: "terminated", label: "Terminated" },
            ],
          },
        ]}
        values={{ type: typeFilter, status: statusFilter }}
        onFieldChange={(key, v) => {
          if (key === "type") setTypeFilter(v || "");
          if (key === "status") setStatusFilter(v || "");
          setPage(1);
        }}
        onReset={() => {
          setTypeFilter("");
          setStatusFilter("");
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={(t: Contract) => t.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada kontrak ditemukan"
        emptyIcon={<FileText className="w-16 h-16" />}
        actions={(row: Contract) => (
          <div className="flex items-center justify-end gap-1">
            {row.employee?.userId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/hr/employees/${row.employee!.userId}`)}
                title="Timeline"
              >
                Timeline
              </Button>
            )}
          </div>
        )}
      />

      <IntakeDialog
        open={intakeOpen}
        mode="kontrak"
        onClose={() => setIntakeOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["contracts"] })}
      />
    </div>
  );
}
