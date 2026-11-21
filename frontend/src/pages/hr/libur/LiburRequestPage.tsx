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
  const [bulkRejectMode, setBulkRejectMode] = useState(false);
  const [ticked, setTicked] = useState<string[]>([]);
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
    mutationFn: ({ id, action, reason }: { id: string; action: "approve" | "reject" | "cancel" | "atasan-approve" | "atasan-reject"; reason?: string }) => {
      if (action === "approve") return liburService.approveRequest(id);
      if (action === "atasan-approve") return liburService.atasanApprove(id);
      if (action === "atasan-reject") return liburService.atasanReject(id, reason);
      if (action === "reject") return liburService.rejectRequest(id, reason);
      return liburService.cancelRequest(id);
    },
    onSuccess: (res: any) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["libur-quotas"] });
      const warn: string[] | undefined = res?.consecutiveWarning;
      if (res?.overQuota) {
        toast.warning("Disetujui — karyawan kini melebihi kuota (ter-flag untuk denda lebih-libur)");
      } else if (warn && warn.length > 0) {
        toast.warning(`Disetujui — berurutan dengan libur lain (${warn.length} hari). Minta request ulang bila perlu.`);
      } else {
        toast.success("Keputusan berhasil disimpan");
      }
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Gagal menyimpan keputusan"),
  });

  // Q5 tick-to-bulk (HR final step, partial-fail safe)
  const bulkMutation = useMutation({
    mutationFn: ({ action, reason }: { action: "approve" | "reject"; reason?: string }) => {
      if (action === "approve") return liburService.bulkApprove(ticked);
      return liburService.bulkReject(ticked, reason);
    },
    onSuccess: (res: any) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["libur-quotas"] });
      const okCount = (res?.approved ?? res?.rejected ?? []).length;
      const failCount = (res?.failed ?? []).length;
      if (failCount > 0) {
        toast.warning(`${okCount} diproses, ${failCount} gagal (mis. belum ACC atasan) — lihat pesan error tiap baris di server log`);
      } else {
        toast.success(`${okCount} pengajuan diproses`);
      }
      setTicked([]);
      setBulkRejectMode(false);
      setRejectReason("");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Gagal memproses bulk"),
  });

  const toggleTick = (id: string) =>
    setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  const tickableRows = rows.filter((r) => r.status === "pending");

  const statusBadge = (row: LiburRequest) => {
    switch (row.status) {
      case "pending":
        return (
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              Menunggu
            </span>
            {row.atasanStatus === "approved" ? (
              <span className="text-[11px] text-emerald-700">ACC atasan ✓ — giliran HR</span>
            ) : row.atasanStatus === "rejected" ? (
              <span className="text-[11px] text-red-600">Ditolak atasan</span>
            ) : (
              <span className="text-[11px] text-muted-foreground">Belum ACC atasan</span>
            )}
          </div>
        );
      case "approved":
        return <StatusDot tone="ok">Disetujui</StatusDot>;
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
      key: "tick",
      header: "",
      cell: (row) =>
        row.status === "pending" ? (
          <input
            type="checkbox"
            checked={ticked.includes(row.id)}
            onChange={() => toggleTick(row.id)}
            className="h-4 w-4 accent-primary-600"
            title="Pilih untuk bulk"
          />
        ) : null,
    },
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
      <BreadcrumbHeader title="Pengajuan libur" subtitle="Diajukan di bulan berjalan atau direncanakan sejak bulan sebelumnya — ACC atasan lalu finalisasi HR">
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
            key: "period",
            label: "Periode",
            type: "select",
            options: monthOptions(3, 2),
          },
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
              { value: "pending", label: "Menunggu" },
              { value: "approved", label: "Disetujui" },
              { value: "rejected", label: "Ditolak" },
              { value: "cancelled", label: "Dibatalkan" },
            ],
          },
        ]}
        values={{
          period,
          kind: kindFilter === "all" ? "" : kindFilter,
          status: statusFilter === "all" ? "" : statusFilter,
        }}
        onFieldChange={(key, v) => {
          if (key === "period" && v) {
            setPeriod(v);
            setPage(1);
          }
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

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={(r: LiburRequest) => r.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada pengajuan libur"
        emptyIcon={<CalendarDays className="w-16 h-16" />}
        actions={(row: LiburRequest) => {
          if (row.status !== "pending") return undefined;
          const needAtasan = row.atasanStatus !== "approved";
          return (
            <div className="flex items-center justify-end gap-1">
              {needAtasan ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => decisionMutation.mutate({ id: row.id, action: "atasan-approve" })}
                  >
                    ACC Atasan
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setRejectTarget({ ...row, _atasan: true } as any)}>
                    Tolak
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => decisionMutation.mutate({ id: row.id, action: "approve" })}
                  >
                    Setujui (HR)
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setRejectTarget(row)}>
                    Tolak
                  </Button>
                </>
              )}
            </div>
          );
        }}
      />

      {ticked.length > 0 && (
        <div className="flex items-center gap-2 bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800 rounded-lg px-4 py-3">
          <input
            type="checkbox"
            checked={tickableRows.length > 0 && tickableRows.every((r) => ticked.includes(r.id))}
            onChange={() =>
              setTicked((t) =>
                tickableRows.every((r) => t.includes(r.id)) ? [] : tickableRows.map((r) => r.id)
              )
            }
            className="h-4 w-4 accent-primary-600"
            title="Pilih semua di halaman"
          />
          <span className="text-sm font-medium">{ticked.length} dipilih</span>
          <div className="flex-1" />
          <Button
            size="sm"
            disabled={bulkMutation.isPending}
            onClick={() => bulkMutation.mutate({ action: "approve" })}
          >
            {bulkMutation.isPending ? "Memproses..." : `Setujui terpilih (${ticked.length})`}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBulkRejectMode(true)}>
            Tolak terpilih
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTicked([])}>
            Batal pilih
          </Button>
        </div>
      )}

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

      <Dialog
        open={!!rejectTarget || bulkRejectMode}
        onOpenChange={(o) => {
          if (!o) {
            setRejectTarget(null);
            setBulkRejectMode(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkRejectMode ? `Tolak ${ticked.length} pengajuan terpilih` : (rejectTarget as any)?._atasan ? "Tolak pengajuan (atasan)" : "Tolak pengajuan"}
            </DialogTitle>
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
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setRejectTarget(null);
                  setBulkRejectMode(false);
                }}
              >
                Batal
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={decisionMutation.isPending || bulkMutation.isPending}
                onClick={() => {
                  if (bulkRejectMode) {
                    bulkMutation.mutate({ action: "reject", reason: rejectReason });
                  } else if (rejectTarget) {
                    const action = (rejectTarget as any)._atasan ? "atasan-reject" : "reject";
                    decisionMutation.mutate({ id: rejectTarget.id, action, reason: rejectReason });
                  }
                }}
              >
                {decisionMutation.isPending || bulkMutation.isPending ? "Memproses..." : "Tolak"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
