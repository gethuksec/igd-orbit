import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { liburService, type LiburRequest } from "@/services/libur.service";
import { api } from "@/services/api";
import { formatDate } from "@/utils/format";
import { BreadcrumbHeader, FilterToolbar, DataTable, StatusDot } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthOptions(back: number, forward: number): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -back; i <= forward; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value: v, label: v });
  }
  return out.reverse();
}

function statusPill(status: string) {
  if (status === "approved") return <StatusDot tone="ok">Disetujui</StatusDot>;
  if (status === "rejected") return <StatusDot tone="bad">Ditolak</StatusDot>;
  if (status === "cancelled") return <StatusDot tone="off">Dibatalkan</StatusDot>;
  return <StatusDot tone="warn">Menunggu</StatusDot>;
}

interface EmployeeOption {
  id: string;
  employeeCode: string;
  user?: { fullName?: string };
}

export default function ApprovalLiburPage() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(currentPeriod());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [kindFilter, setKindFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [formEmployee, setFormEmployee] = useState("");
  const [formDate, setFormDate] = useState("");
  const [rejectTarget, setRejectTarget] = useState<LiburRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: employees } = useQuery({
    queryKey: ["employees-options"],
    queryFn: async () => {
      const res = await api.get("/employees", { params: { limit: 200 } });
      return (res.data?.data ?? []) as EmployeeOption[];
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["approval-libur", period, searchTerm, statusFilter, kindFilter],
    queryFn: () =>
      liburService.getRequests({
        period,
        limit: 100,
        search: searchTerm || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        kind: kindFilter === "all" ? undefined : kindFilter,
      }),
  });

  const rows = data?.data ?? [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["approval-libur"] });

  const createMutation = useMutation({
    mutationFn: () => liburService.createRequest({ employeeId: formEmployee, date: formDate }),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      setFormEmployee("");
      setFormDate("");
      toast.success("Pengajuan libur tercatat");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Gagal mencatat pengajuan"),
  });

  const decisionMutation = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "approve" | "reject"; reason?: string }) => {
      if (action === "approve") return liburService.approveRequest(id);
      return liburService.rejectRequest(id, reason);
    },
    onSuccess: (res: any) => {
      invalidate();
      if (res?.overQuota) {
        toast.warning("Disetujui — karyawan kini melebihi kuota (ter-flag untuk denda lebih-libur)");
      } else {
        toast.success("Keputusan disimpan");
      }
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Gagal menyimpan keputusan"),
  });

  const columns: Column<LiburRequest>[] = [
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
      header: "Tanggal libur",
      cell: (r) => <span className="text-sm font-mono">{formatDate(r.date)}</span>,
    },
    {
      key: "kind",
      header: "Jenis",
      cell: (r) => (
        <span className="text-sm">{r.kind === "advance" ? "Bulan depan" : "Bulan berjalan"}</span>
      ),
    },
    { key: "status", header: "Status", cell: (r) => statusPill(r.status) },
  ];

  return (
    <div className="space-y-4">
      <BreadcrumbHeader title="Approval pengajuan libur" subtitle={`Antrian persetujuan libur periode ${period}`}>
        <Button onClick={() => setCreateOpen(true)}>Buat pengajuan</Button>
      </BreadcrumbHeader>

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
              { value: "cancelled", label: "Dibatalkan" },
              { value: "all", label: "Semua" },
            ],
          },
          {
            key: "kind",
            label: "Jenis",
            type: "select",
            options: [
              { value: "all", label: "Semua" },
              { value: "current", label: "Bulan berjalan" },
              { value: "advance", label: "Bulan depan" },
            ],
          },
          { key: "period", label: "Periode", type: "select", options: monthOptions(3, 2) },
        ]}
        values={{ status: statusFilter, kind: kindFilter, period }}
        onFieldChange={(key, v) => {
          if (key === "status") setStatusFilter(v || "pending");
          if (key === "kind") setKindFilter(v || "all");
          if (key === "period") setPeriod(v || currentPeriod());
        }}
        onReset={() => {
          setStatusFilter("pending");
          setKindFilter("all");
          setSearchTerm("");
          setPeriod(currentPeriod());
        }}
      />

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-2.5">
          Gagal memuat antrian libur.
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={(r: LiburRequest) => r.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada pengajuan pada filter ini"
        emptyIcon={<CalendarDays className="w-16 h-16" />}
        actions={(r: LiburRequest) =>
          r.status === "pending" ? (
            <div className="flex items-center justify-end gap-1">
              <Button
                size="sm"
                onClick={() => decisionMutation.mutate({ id: r.id, action: "approve" })}
                disabled={decisionMutation.isPending}
              >
                Setujui
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRejectTarget(r)}>
                Tolak
              </Button>
            </div>
          ) : undefined
        }
      />

      <Dialog open={rejectTarget !== null} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak pengajuan libur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Alasan penolakan</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRejectTarget(null)}>
                Batal
              </Button>
              <Button
                className="flex-1"
                disabled={decisionMutation.isPending}
                onClick={() =>
                  rejectTarget &&
                  decisionMutation.mutate({ id: rejectTarget.id, action: "reject", reason: rejectReason })
                }
              >
                Tolak
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat pengajuan libur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Karyawan</label>
              <select
                value={formEmployee}
                onChange={(e) => setFormEmployee(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              >
                <option value="">Pilih karyawan</option>
                {(employees ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.user?.fullName || e.employeeCode} ({e.employeeCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tanggal libur</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              />
            </div>
            <Button
              className="w-full"
              disabled={!formEmployee || !formDate || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
