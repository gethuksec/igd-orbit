import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { liburService, type LiburRequest } from "@/services/libur.service";
import { api } from "@/services/api";
import { BreadcrumbHeader, FilterToolbar, DataTable, StatusDot } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface EmployeeOption {
  id: string;
  employeeCode: string;
  user?: { fullName?: string };
}

export default function LiburRequestPage() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(currentPeriod());
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [formEmployee, setFormEmployee] = useState("");
  const [formDate, setFormDate] = useState("");
  const [rejectTarget, setRejectTarget] = useState<LiburRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const limit = 20;

  const { data: employees } = useQuery({
    queryKey: ["employees-options"],
    queryFn: async () => {
      const res = await api.get("/employees", { params: { limit: 200 } });
      const body = res.data;
      return (body?.data ?? []) as EmployeeOption[];
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["libur-requests", period, page, searchTerm, statusFilter, kindFilter],
    queryFn: () =>
      liburService.getRequests({
        period,
        page,
        limit,
        search: searchTerm || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        kind: kindFilter === "all" ? undefined : kindFilter,
      }),
  });

  const rows = data?.data || [];
  const total = data?.meta?.total ?? rows.length;
  const totalPages = data?.meta?.totalPages ?? 1;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["libur-requests"] });

  const createMutation = useMutation({
    mutationFn: () => liburService.createRequest({ employeeId: formEmployee, date: formDate }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["libur-quotas"] });
      toast.success("Pengajuan libur berhasil dicatat");
      setCreateOpen(false);
      setFormEmployee("");
      setFormDate("");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Gagal mencatat pengajuan"),
  });

  const decisionMutation = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "approve" | "reject" | "cancel"; reason?: string }) => {
      if (action === "approve") return liburService.approveRequest(id);
      if (action === "reject") return liburService.rejectRequest(id, reason);
      return liburService.cancelRequest(id);
    },
    onSuccess: (res: any) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["libur-quotas"] });
      if (res?.overQuota) {
        toast.warning("Disetujui — karyawan kini melebihi kuota (ter-flag untuk denda lebih-libur)");
      } else {
        toast.success("Keputusan berhasil disimpan");
      }
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Gagal menyimpan keputusan"),
  });

  const statusBadge = (row: LiburRequest) => {
    switch (row.status) {
      case "pending":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            Menunggu SPV
          </span>
        );
      case "approved":
        return <StatusDot tone="ok">Disetujui SPV</StatusDot>;
      case "rejected":
        return <StatusDot tone="bad">Ditolak</StatusDot>;
      case "cancelled":
        return <StatusDot tone="off">Dibatalkan</StatusDot>;
      default:
        return <span>{row.status}</span>;
    }
  };

  const columns: Column<LiburRequest>[] = [
    {
      key: "employee",
      header: "Karyawan",
      cell: (row) => (
        <div>
          <div className="text-[15px] font-medium text-foreground">
            {row.employee?.user?.fullName || "-"}
          </div>
          <div className="text-xs text-muted-foreground mt-1 font-mono">
            {row.employee?.employeeCode || row.employeeId}
          </div>
        </div>
      ),
    },
    { key: "date", header: "Tanggal libur", cell: (row) => <span>{String(row.date).slice(0, 10)}</span> },
    { key: "period", header: "Untuk bulan", cell: (row) => <span>{row.targetPeriod}</span> },
    {
      key: "kind",
      header: "Jenis",
      cell: (row) =>
        row.kind === "advance" ? (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            Rencana bulan depan
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
            Bulan berjalan
          </span>
        ),
    },
    { key: "status", header: "Status", cell: (row) => statusBadge(row) },
  ];

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Pengajuan libur" subtitle="Diajukan di bulan berjalan atau direncanakan sejak bulan sebelumnya — persetujuan SPV">
        <Button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 border border-gray-200 dark:border-gray-700 hover:bg-primary-50"
        >
          <span>Catat pengajuan</span>
        </Button>
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 dark:text-red-200 font-medium">{(error as Error).message || "Terjadi kesalahan"}</p>
        </div>
      )}

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama / kode karyawan..."
        fields={[
          {
            key: "kind",
            label: "Jenis",
            type: "select",
            options: [
              { value: "current", label: "Bulan berjalan" },
              { value: "advance", label: "Rencana bulan depan" },
            ],
          },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "pending", label: "Menunggu SPV" },
              { value: "approved", label: "Disetujui SPV" },
              { value: "rejected", label: "Ditolak" },
              { value: "cancelled", label: "Dibatalkan" },
            ],
          },
        ]}
        values={{
          kind: kindFilter === "all" ? "" : kindFilter,
          status: statusFilter === "all" ? "" : statusFilter,
        }}
        onFieldChange={(key, v) => {
          if (key === "kind") setKindFilter(v || "all");
          if (key === "status") setStatusFilter(v || "all");
          setPage(1);
        }}
        onReset={() => {
          setKindFilter("all");
          setStatusFilter("all");
          setSearchTerm("");
          setPage(1);
        }}
      />

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-2 text-sm">
        <CalendarDays className="w-4 h-4 text-muted-foreground" />
        <span>Periode</span>
        <select
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
        >
          {[-1, 0, 1].map((off) => {
            const d = new Date();
            d.setMonth(d.getMonth() + off);
            const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            return (
              <option key={v} value={v}>
                {v}
              </option>
            );
          })}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={(r: LiburRequest) => r.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada pengajuan libur"
        emptyIcon={<CalendarDays className="w-16 h-16" />}
        actions={(row: LiburRequest) =>
          row.status === "pending" ? (
            <div className="flex items-center justify-end gap-1">
              <Button variant="outline" size="sm" onClick={() => decisionMutation.mutate({ id: row.id, action: "approve" })}>
                Setujui
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRejectTarget(row)}>
                Tolak
              </Button>
            </div>
          ) : undefined
        }
      />

      {!isLoading && rows.length > 0 && (
        <div className="bg-gradient-to-r from-gray-50 dark:from-gray-900 to-gray-100 dark:to-gray-800 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Menampilkan <span className="font-bold text-foreground">{rows.length}</span> dari{" "}
              <span className="font-bold text-foreground">{total}</span> pengajuan
              <span className="ml-2 text-muted-foreground">(Halaman {page} dari {totalPages})</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
                Sebelumnya
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
                Selanjutnya
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catat pengajuan libur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Karyawan</label>
              <select
                value={formEmployee}
                onChange={(e) => setFormEmployee(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                required
              >
                <option value="">— Pilih karyawan —</option>
                {(employees || []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.user?.fullName || e.employeeCode} · {e.employeeCode}
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
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Hanya bulan berjalan atau bulan depan. Tanggal bulan depan tercatat sebagai rencana (SPV).
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>
                Batal
              </Button>
              <Button
                className="flex-1"
                disabled={createMutation.isPending || !formEmployee || !formDate}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak pengajuan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Alasan penolakan</label>
              <input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                placeholder="mis. kebutuhan shift penuh"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setRejectTarget(null)}>
                Batal
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={decisionMutation.isPending}
                onClick={() =>
                  rejectTarget &&
                  decisionMutation.mutate({ id: rejectTarget.id, action: "reject", reason: rejectReason })
                }
              >
                {decisionMutation.isPending ? "Memproses..." : "Tolak"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
