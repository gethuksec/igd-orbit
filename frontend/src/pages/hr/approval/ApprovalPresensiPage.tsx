import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlarmClock } from "lucide-react";
import { hrService, type OvertimeRequest } from "@/services/hr.service";
import { formatDate } from "@/utils/format";
import { BreadcrumbHeader, FilterToolbar, DataTable } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function statusPill(status: string) {
  if (status === "approved")
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        Disetujui
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
        Ditolak
      </span>
    );
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
      Menunggu
    </span>
  );
}

export default function ApprovalPresensiPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");

  const { data, isLoading, error } = useQuery({
    queryKey: ["approval-overtime", statusFilter],
    queryFn: () => hrService.getOvertimeRequests(statusFilter === "all" ? undefined : statusFilter),
  });

  const rows = (data ?? []).filter((r: OvertimeRequest) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      r.employee?.user?.fullName?.toLowerCase().includes(s) ||
      r.employee?.employeeCode?.toLowerCase().includes(s)
    );
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => hrService.approveOvertime(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval-overtime"] });
      toast.success("Lembur disetujui");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Gagal menyetujui lembur"),
  });

  const columns: Column<OvertimeRequest>[] = [
    {
      key: "employee",
      header: "Karyawan",
      cell: (r) => (
        <span>
          <span className="block font-medium">{r.employee?.user?.fullName || r.employee?.employeeCode}</span>
          <span className="block text-xs text-muted-foreground font-mono">{r.employee?.employeeCode}</span>
        </span>
      ),
    },
    {
      key: "date",
      header: "Tanggal",
      cell: (r) => <span className="text-sm font-mono">{formatDate(r.date)}</span>,
    },
    {
      key: "hours",
      header: "Jam",
      cell: (r) => <span className="text-sm font-mono">{r.hours} jam</span>,
    },
    {
      key: "reason",
      header: "Alasan",
      cell: (r) => <span className="text-sm">{r.reason}</span>,
    },
    { key: "status", header: "Status", cell: (r) => statusPill(r.status) },
  ];

  return (
    <div className="space-y-4">
      <BreadcrumbHeader title="Approval presensi" subtitle="Antrian persetujuan lembur karyawan" />

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama / kode karyawan..."
        fields={[
          {
            key: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "pending", label: "Menunggu" },
              { value: "approved", label: "Disetujui" },
              { value: "rejected", label: "Ditolak" },
              { value: "all", label: "Semua" },
            ],
          },
        ]}
        values={{ status: statusFilter }}
        onFieldChange={(key, v) => {
          if (key === "status") setStatusFilter(v || "pending");
        }}
        onReset={() => {
          setStatusFilter("pending");
          setSearchTerm("");
        }}
      />

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-2.5">
          Gagal memuat antrian lembur.
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={(r: OvertimeRequest) => r.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada pengajuan lembur pada filter ini"
        emptyIcon={<AlarmClock className="w-16 h-16" />}
        actions={(r: OvertimeRequest) =>
          r.status === "pending" ? (
            <div className="flex items-center justify-end gap-1">
              <Button
                size="sm"
                onClick={() => approveMutation.mutate(r.id)}
                disabled={approveMutation.isPending}
              >
                Setujui
              </Button>
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
