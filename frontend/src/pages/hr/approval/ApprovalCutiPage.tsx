import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Stamp } from "lucide-react";
import { hrService, type LeaveRequest } from "@/services/hr.service";
import { leaveTypesService } from "@/services/leave-types.service";
import { formatDate } from "@/utils/format";
import { BreadcrumbHeader, FilterToolbar, DataTable, StatusDot } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

function typeLabel(t: unknown): string {
  if (t && typeof t === "object" && "name" in (t as any)) return (t as any).name;
  switch (t) {
    case "annual":
      return "Cuti tahunan";
    case "sick":
      return "Sakit";
    case "emergency":
      return "Darurat";
    case "unpaid":
      return "Tanpa gaji";
    default:
      return String(t ?? "-");
  }
}

function statusPill(status: string) {
  if (status === "approved") return <StatusDot tone="ok">Disetujui</StatusDot>;
  if (status === "rejected") return <StatusDot tone="bad">Ditolak</StatusDot>;
  if (status === "cancelled") return <StatusDot tone="off">Dibatalkan</StatusDot>;
  return <StatusDot tone="warn">Menunggu</StatusDot>;
}

export default function ApprovalCutiPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detail, setDetail] = useState<LeaveRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [fType, setFType] = useState("");
  const [fStart, setFStart] = useState("");
  const [fEnd, setFEnd] = useState("");
  const [fReason, setFReason] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["approval-cuti", statusFilter, dateFrom, dateTo],
    queryFn: () =>
      hrService.getLeaveRequests({
        status: statusFilter === "all" ? undefined : statusFilter,
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
      }),
  });

  const { data: leaveTypes } = useQuery({
    queryKey: ["leave-types-options"],
    queryFn: () => leaveTypesService.getAll({ limit: 200 }),
  });

  const rows = (data?.data ?? []).filter((r: LeaveRequest) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      r.employee?.user?.fullName?.toLowerCase().includes(s) ||
      r.employee?.employeeCode?.toLowerCase().includes(s) ||
      String(r.leaveType).toLowerCase().includes(s)
    );
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["approval-cuti"] });

  const approveMutation = useMutation({
    mutationFn: (id: string) => hrService.approveLeave(id, {}),
    onSuccess: () => {
      invalidate();
      setDetail(null);
      toast.success("Cuti disetujui");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Gagal menyetujui"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      hrService.rejectLeave(id, { reason }),
    onSuccess: () => {
      invalidate();
      setRejectTarget(null);
      setRejectReason("");
      setDetail(null);
      toast.success("Cuti ditolak");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Gagal menolak"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      hrService.requestLeave({ leave_type: fType, start_date: fStart, end_date: fEnd, reason: fReason }),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      setFType("");
      setFStart("");
      setFEnd("");
      setFReason("");
      toast.success("Pengajuan cuti tercatat");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Gagal mengajukan cuti"),
  });

  const columns: Column<LeaveRequest>[] = [
    {
      key: "employee",
      header: "Karyawan",
      cell: (r) => (
        <span>
          <span className="block font-medium">{r.employee?.user?.fullName || r.employee?.employeeCode || "-"}</span>
          <span className="block text-xs text-muted-foreground font-mono">{r.employee?.employeeCode}</span>
        </span>
      ),
    },
    { key: "type", header: "Tipe", cell: (r) => <span className="text-sm">{typeLabel(r.leaveType)}</span> },
    {
      key: "period",
      header: "Periode",
      cell: (r) => (
        <span className="text-sm font-mono">
          {formatDate(r.startDate)} – {formatDate(r.endDate)} · {r.totalDays} hari
        </span>
      ),
    },
    { key: "status", header: "Status", cell: (r) => statusPill(r.status) },
  ];

  return (
    <div className="space-y-4">
      <BreadcrumbHeader title="Approval cuti" subtitle="Antrian persetujuan cuti karyawan">
        <Button onClick={() => setCreateOpen(true)}>Ajukan cuti</Button>
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
          { key: "date", label: "Tanggal", type: "date-range" },
        ]}
        values={{ status: statusFilter, dateFrom, dateTo }}
        onFieldChange={(key, v) => {
          if (key === "status") setStatusFilter(v || "pending");
          if (key === "dateFrom") setDateFrom(v);
          if (key === "dateTo") setDateTo(v);
        }}
        onReset={() => {
          setStatusFilter("pending");
          setSearchTerm("");
          setDateFrom("");
          setDateTo("");
        }}
      />

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-2.5">
          Gagal memuat antrian cuti.
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={(r: LeaveRequest) => r.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada pengajuan pada filter ini"
        emptyIcon={<Stamp className="w-16 h-16" />}
        actions={(r: LeaveRequest) => (
          <div className="flex items-center justify-end gap-1">
            {r.status === "pending" ? (
              <>
                <Button size="sm" onClick={() => approveMutation.mutate(r.id)} disabled={approveMutation.isPending}>
                  Setujui
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRejectTarget(r)}>
                  Tolak
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setDetail(r)}>
                Detail
              </Button>
            )}
          </div>
        )}
      />

      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {detail?.employee?.user?.fullName} · {detail && typeLabel(detail.leaveType)}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Periode:</span> {formatDate(detail.startDate)} –{" "}
                {formatDate(detail.endDate)} ({detail.totalDays} hari)
              </p>
              <p>
                <span className="text-muted-foreground">Alasan:</span> {detail.reason}
              </p>
              <p>
                <span className="text-muted-foreground">Status:</span> {statusPill(detail.status)}
              </p>
              {detail.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" onClick={() => approveMutation.mutate(detail.id)}>
                    Setujui
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setRejectTarget(detail)}>
                    Tolak
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rejectTarget !== null} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak pengajuan</DialogTitle>
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
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                onClick={() =>
                  rejectTarget && rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason })
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
            <DialogTitle>Ajukan cuti</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tipe cuti</label>
              <select
                value={fType}
                onChange={(e) => setFType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              >
                <option value="">Pilih tipe</option>
                {(leaveTypes?.data ?? []).map((t: any) => (
                  <option key={t.id} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1">Mulai</label>
                <input
                  type="date"
                  value={fStart}
                  onChange={(e) => setFStart(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Selesai</label>
                <input
                  type="date"
                  value={fEnd}
                  onChange={(e) => setFEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Alasan</label>
              <textarea
                value={fReason}
                onChange={(e) => setFReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              />
            </div>
            <Button
              className="w-full"
              disabled={!fType || !fStart || !fEnd || !fReason.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Menyimpan..." : "Ajukan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
