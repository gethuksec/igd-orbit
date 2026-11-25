import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Clock, AlertTriangle } from "lucide-react";
import { shiftsService, type Shift } from "@/services/shifts.service";
import { BreadcrumbHeader, StatCard, FilterToolbar, DataTable, StatusDot } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDateTimeId } from "@/lib/utils";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

interface FormData {
  code: string;
  name: string;
  clockIn: string;
  clockOut: string;
  overnight: boolean;
  lateToleranceMin: string;
  breakHours: string;
  color: string;
  isActive: boolean;
}

const defaultForm: FormData = {
  code: "",
  name: "",
  clockIn: "08:00",
  clockOut: "17:00",
  overnight: false,
  lateToleranceMin: "15",
  breakHours: "1",
  color: "",
  isActive: true,
};

export default function ShiftMasterPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultForm);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const limit = 20;

  const { data, isLoading, error } = useQuery({
    queryKey: ["shifts", page, searchTerm, statusFilter],
    queryFn: () =>
      shiftsService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });

  const rows = data?.data || [];
  const total = data?.meta?.total ?? rows.length;
  const totalPages = data?.meta?.totalPages ?? 1;
  const assigned = rows.reduce((s, r) => s + (r.activeAssignmentsCount ?? 0), 0);
  const overnightCount = rows.filter((r) => r.overnight).length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["shifts"] });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => {
      if (editing) return shiftsService.update(editing.id, payload);
      return shiftsService.create(payload);
    },
    onSuccess: () => {
      invalidate();
      toast.success(editing ? "Shift berhasil diupdate" : "Shift berhasil ditambahkan");
      setFormModalOpen(false);
      setEditing(null);
      setFormData(defaultForm);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Terjadi kesalahan"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => shiftsService.delete(id),
    onSuccess: () => {
      invalidate();
      toast.success("Shift berhasil dinonaktifkan");
      setDeleteModalOpen(false);
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Gagal menonaktifkan shift"),
  });

  const openCreateModal = () => {
    setEditing(null);
    setFormData(defaultForm);
    setFormModalOpen(true);
  };

  const openEditModal = (row: Shift) => {
    setEditing(row);
    setFormData({
      code: row.code || "",
      name: row.name || "",
      clockIn: row.clockIn || "08:00",
      clockOut: row.clockOut || "17:00",
      overnight: !!row.overnight,
      lateToleranceMin: String(row.lateToleranceMin ?? 15),
      breakHours: row.breakHours != null ? String(row.breakHours) : "",
      color: row.color || "",
      isActive: row.isActive ?? true,
    });
    setFormModalOpen(true);
  };

  const columns: Column<Shift>[] = [
    {
      key: "code",
      stickyLeft: true,
      header: "Kode",
      cell: (row) => (
        <div>
          <div className="text-[15px] font-medium text-foreground font-mono">{row.code}</div>
          <div className="text-xs text-muted-foreground mt-1">{row.name}</div>
        </div>
      ),
    },
    {
      key: "hours",
      header: "Jam masuk – pulang",
      cell: (row) => (
        <span>
          {row.clockIn} – {row.clockOut}
          {row.overnight && (
            <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
              +1 hari
            </span>
          )}
        </span>
      ),
    },
    {
      key: "tolerance",
      header: "Toleransi",
      cell: (row) => <span>{row.lateToleranceMin} mnt</span>,
    },
    {
      key: "break",
      header: "Istirahat",
      cell: (row) => <span>{row.breakHours != null ? `${row.breakHours} jam` : "-"}</span>,
    },
    {
      key: "assigned",
      header: "Terpasang",
      cell: (row) => <span>{row.activeAssignmentsCount ?? "-"}</span>,
    },
    {
      key: "isActive",
      header: "Status",
      cell: (row) => (
        <StatusDot tone={row.isActive ? "ok" : "off"}>{row.isActive ? "Aktif" : "Tidak Aktif"}</StatusDot>
      ),
    },
    {
      key: "updatedAt",
      header: "Terakhir Diupdate",
      cell: (r: any) => (
        <div className="text-sm tabular-nums text-muted-foreground">
          {formatDateTimeId(r.updatedAt)}
        </div>
      ),
    },
  ];

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Shift kerja" subtitle="Jam kerja, toleransi telat dan penempatan karyawan">
        <Button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 border border-gray-200 dark:border-gray-700 hover:bg-primary-50 dark:hover:bg-primary-950"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Shift</span>
        </Button>
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 dark:text-red-200 font-medium">{(error as Error).message || "Terjadi kesalahan"}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard icon={<Clock className="h-5 w-5" />} label="Total Shift" value={isLoading ? "-" : total} />
        <StatCard icon={<Clock className="h-5 w-5" />} label="Karyawan terpasang" value={isLoading ? "-" : assigned} />
        <StatCard icon={<Clock className="h-5 w-5" />} label="Overnight" value={isLoading ? "-" : overnightCount} />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Ditampilkan"
          value={isLoading ? "-" : rows.length}
          subtitle="Shift pada halaman ini"
        />
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari kode / nama shift..."
        fields={[
          {
            key: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "active", label: "Aktif" },
              { value: "inactive", label: "Tidak Aktif" },
            ],
          },
        ]}
        values={{ status: statusFilter === "all" ? "" : statusFilter }}
        onFieldChange={(key, v) => {
          if (key === "status") {
            setStatusFilter(v || "all");
            setPage(1);
          }
        }}
        onReset={() => {
          setStatusFilter("all");
          setPage(1);
        }}
      />

      <DataTable
        actionsPosition="left"
        columns={columns}
        data={rows}
        keyExtractor={(t: Shift) => t.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada shift ditemukan"
        emptyIcon={<Clock className="w-16 h-16" />}
        actions={(row: Shift) => (
          <div className="flex items-center justify-end gap-1">
            <button type="button" onClick={() => openEditModal(row)} title="Edit" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Edit className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Nonaktifkan"
              onClick={() => {
                setToDelete({ id: row.id, name: `${row.code} · ${row.name}` });
                setDeleteModalOpen(true);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      />

      {!isLoading && rows.length > 0 && (
        <div className="bg-gradient-to-r from-gray-50 dark:from-gray-900 to-gray-100 dark:to-gray-800 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Menampilkan <span className="font-bold text-foreground">{rows.length}</span> dari{" "}
              <span className="font-bold text-foreground">{total}</span> shift
              <span className="ml-2 text-muted-foreground">
                (Halaman {page} dari {totalPages})
              </span>
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

      <Dialog
        open={formModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setFormModalOpen(false);
            setEditing(null);
            setFormData(defaultForm);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Shift" : "Tambah Shift"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!TIME_RE.test(formData.clockIn) || !TIME_RE.test(formData.clockOut)) {
                toast.error("Jam harus format HH:MM (mis. 08:00)");
                return;
              }
              saveMutation.mutate({
                code: formData.code || undefined,
                name: formData.name,
                clockIn: formData.clockIn,
                clockOut: formData.clockOut,
                overnight: formData.overnight,
                lateToleranceMin: Number(formData.lateToleranceMin),
                breakHours: formData.breakHours === "" ? undefined : Number(formData.breakHours),
                color: formData.color || undefined,
                isActive: formData.isActive,
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Kode (opsional)</label>
                <input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono"
                  placeholder="otomatis mis. SHF-AB12"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nama Shift</label>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                  placeholder="mis. Shift Pagi"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Jam Masuk (HH:MM)</label>
                <input
                  value={formData.clockIn}
                  onChange={(e) => setFormData({ ...formData, clockIn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono"
                  placeholder="08:00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Jam Pulang (HH:MM)</label>
                <input
                  value={formData.clockOut}
                  onChange={(e) => setFormData({ ...formData, clockOut: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono"
                  placeholder="17:00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Toleransi Telat (mnt)</label>
                <input
                  type="number"
                  min={0}
                  value={formData.lateToleranceMin}
                  onChange={(e) => setFormData({ ...formData, lateToleranceMin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Istirahat (jam)</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={formData.breakHours}
                  onChange={(e) => setFormData({ ...formData, breakHours: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.overnight}
                onChange={(e) => setFormData({ ...formData, overnight: e.target.checked })}
              />
              Pulang keesokan hari (overnight)
            </label>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setFormModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Menyimpan..." : editing ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nonaktifkan Shift</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Shift <b>{toDelete?.name}</b> akan dinonaktifkan. Shift yang masih punya penempatan aktif tidak bisa
              dinonaktifkan — akhiri penempatannya dulu.
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setDeleteModalOpen(false)}>
              Batal
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteMutation.isPending}
              onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
            >
              {deleteMutation.isPending ? "Memproses..." : "Nonaktifkan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
