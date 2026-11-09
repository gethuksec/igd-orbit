import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Save, Loader2, CalendarDays, AlertTriangle } from "lucide-react";
import { leaveTypesService, type LeaveType } from "@/services/leave-types.service";
import { api } from "@/services/api";
import { BreadcrumbHeader, StatCard, FilterToolbar, DataTable } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type StatusFilter = "all" | "active" | "inactive";

interface FormData {
  name: string;
  isPaid: boolean;
  quotaDays: string;
  maxApplyDelayDays: string;
  maxRequestsPerMonth: string;
  minTenureMonths: string;
  requiresAttachment: boolean;
  isActive: boolean;
}

const defaultForm: FormData = {
  name: "",
  isPaid: true,
  quotaDays: "12",
  maxApplyDelayDays: "",
  maxRequestsPerMonth: "",
  minTenureMonths: "",
  requiresAttachment: true,
  isActive: true,
};

const numOrUndefined = (v: string) => (v === "" ? undefined : Number(v));

export default function LeaveTypeList() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const limit = 20;

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultForm);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["leave-types", page, searchTerm, statusFilter],
    queryFn: () =>
      leaveTypesService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        status: statusFilter === "all" ? "all" : statusFilter === "active" ? "active" : "inactive",
      }),
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, refetch]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const rows = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };
  const activeCount = rows.filter((t: LeaveType) => t.isActive).length;

  const toPayload = (f: FormData) => ({
    name: f.name,
    isPaid: f.isPaid,
    quotaDays: numOrUndefined(f.quotaDays) ?? 12,
    maxApplyDelayDays: numOrUndefined(f.maxApplyDelayDays),
    maxRequestsPerMonth: numOrUndefined(f.maxRequestsPerMonth),
    minTenureMonths: numOrUndefined(f.minTenureMonths),
    requiresAttachment: f.requiresAttachment,
    isActive: f.isActive,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => {
      if (editing) return api.put(`/leave-types/${editing.id}`, payload);
      const { isActive: _omit, ...createPayload } = payload;
      return api.post("/leave-types", createPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      toast.success(editing ? "Tipe cuti berhasil diupdate" : "Tipe cuti berhasil ditambahkan");
      setFormModalOpen(false);
      setEditing(null);
      setFormData(defaultForm);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Terjadi kesalahan");
    },
  });

  const openCreateModal = () => {
    setEditing(null);
    setFormData(defaultForm);
    setFormModalOpen(true);
  };

  const openEditModal = (row: LeaveType) => {
    setEditing(row);
    setFormData({
      name: row.name || "",
      isPaid: row.isPaid ?? true,
      quotaDays: row.quotaDays?.toString() ?? "12",
      maxApplyDelayDays: row.maxApplyDelayDays?.toString() ?? "",
      maxRequestsPerMonth: row.maxRequestsPerMonth?.toString() ?? "",
      minTenureMonths: row.minTenureMonths?.toString() ?? "",
      requiresAttachment: row.requiresAttachment ?? false,
      isActive: row.isActive ?? true,
    });
    setFormModalOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leave-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      toast.success("Tipe cuti berhasil dihapus");
      setDeleteModalOpen(false);
      setToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Gagal menghapus tipe cuti");
    },
  });

  const columns: Column<LeaveType>[] = [
    {
      key: "name",
      header: "Nama",
      cell: (row) => (
        <div>
          <div className="text-base font-semibold text-foreground">{row.name}</div>
          <div className="text-xs text-muted-foreground mt-1 font-mono">{row.code || "-"}</div>
        </div>
      ),
    },
    {
      key: "isPaid",
      header: "Berbayar",
      cell: (row) => (
        <span
          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            row.isPaid
              ? "bg-green-100 text-green-800 border-green-200"
              : "bg-gray-100 text-gray-800 border-gray-200"
          }`}
        >
          {row.isPaid ? "Ya" : "Tidak"}
        </span>
      ),
    },
    {
      key: "quotaDays",
      header: "Kuota/thn",
      cell: (row) => (row.isPaid ? <span>{row.quotaDays} hari</span> : <span className="text-muted-foreground">—</span>),
    },
    {
      key: "maxApplyDelayDays",
      header: "Max H",
      cell: (row) =>
        row.maxApplyDelayDays === null || row.maxApplyDelayDays === undefined ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span>H+{row.maxApplyDelayDays}</span>
        ),
    },
    {
      key: "maxRequestsPerMonth",
      header: "Max/bln",
      cell: (row) =>
        row.maxRequestsPerMonth === null || row.maxRequestsPerMonth === undefined ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span>{row.maxRequestsPerMonth}x</span>
        ),
    },
    {
      key: "minTenureMonths",
      header: "Min. Kerja",
      cell: (row) =>
        row.minTenureMonths === null || row.minTenureMonths === undefined ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span>{row.minTenureMonths} bln</span>
        ),
    },
    {
      key: "requiresAttachment",
      header: "Lampiran",
      cell: (row) => (row.requiresAttachment ? <span>Wajib</span> : <span className="text-muted-foreground">Tidak</span>),
    },
    {
      key: "isActive",
      header: "Status",
      cell: (row) => (
        <span
          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            row.isActive
              ? "bg-green-100 text-green-800 border-green-200"
              : "bg-gray-100 text-gray-800 border-gray-200"
          }`}
        >
          {row.isActive ? "Aktif" : "Tidak Aktif"}
        </span>
      ),
    },
  ];

  const toggle = (on: boolean, onToggle: () => void) => (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? "bg-green-500" : "bg-gray-300"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
      </button>
      <span className="text-sm text-gray-600">{on ? "Ya" : "Tidak"}</span>
    </div>
  );

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Cuti" subtitle="Kelola tipe cuti, kuota & aturan pengajuan">
        <Button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-white text-primary-600 border border-gray-200 hover:bg-primary-50"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Cuti</span>
        </Button>
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || "Terjadi kesalahan"}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          icon={<CalendarDays className="w-6 h-6 text-white" />}
          iconBg="from-primary-500 to-primary-600"
          label="Total Tipe"
          value={isLoading ? "-" : pagination.total}
          subtitle="Semua tipe cuti terdaftar"
        />
        <StatCard
          icon={<CalendarDays className="w-6 h-6 text-white" />}
          iconBg="from-blue-500 to-blue-600"
          label="Ditampilkan"
          value={isLoading ? "-" : rows.length}
          subtitle="Tipe pada halaman ini"
        />
        <StatCard
          icon={<CalendarDays className="w-6 h-6 text-white" />}
          iconBg="from-green-500 to-green-600"
          label="Tipe Aktif"
          value={isLoading ? "-" : activeCount}
          badge={{ text: "Active", className: "bg-green-100 text-green-800" }}
        />
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama cuti..."
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
            setStatusFilter((v || "all") as StatusFilter);
            setPage(1);
          }
        }}
        onReset={() => {
          setStatusFilter("all");
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={(t: LeaveType) => t.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada tipe cuti ditemukan"
        emptyIcon={<CalendarDays className="w-16 h-16" />}
        actions={(row: LeaveType) => (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEditModal(row)} title="Edit">
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              title="Hapus"
              onClick={() => {
                setToDelete({ id: row.id, name: row.name });
                setDeleteModalOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      />

      {!isLoading && rows.length > 0 && (
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Menampilkan <span className="font-bold text-foreground">{rows.length}</span> dari{" "}
              <span className="font-bold text-foreground">{pagination.total}</span> tipe cuti
              <span className="ml-2 text-muted-foreground">
                (Halaman {pagination.page} dari {pagination.totalPages})
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= pagination.totalPages}
              >
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Cuti" : "Tambah Cuti"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(toPayload(formData));
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Tipe Cuti <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="cth: Cuti Melahirkan"
              />
            </div>
            {editing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Berbayar (paid leave)</label>
              {toggle(formData.isPaid, () => setFormData((p) => ({ ...p, isPaid: !p.isPaid })))}
            </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kuota per tahun (hari)</label>
              <input
                type="number"
                min={0}
                value={formData.quotaDays}
                onChange={(e) => setFormData({ ...formData, quotaDays: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="12"
              />
            </div>
            {editing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max pengajuan (hari setelah mulai)</label>
              <input
                type="number"
                min={0}
                value={formData.maxApplyDelayDays}
                onChange={(e) => setFormData({ ...formData, maxApplyDelayDays: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="kosong = wajib H-3"
              />
              <p className="text-xs text-gray-500 mt-1">0 = boleh diajukan di hari H (seperti Sakit).</p>
            </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max pengajuan per bulan (x)</label>
              <input
                type="number"
                min={1}
                value={formData.maxRequestsPerMonth}
                onChange={(e) => setFormData({ ...formData, maxRequestsPerMonth: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="kosong = tanpa batas"
              />
              <p className="text-xs text-gray-500 mt-1">1 = sebulan 1x (seperti Sakit).</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Masa kerja minimum (bulan)</label>
              <input
                type="number"
                min={0}
                value={formData.minTenureMonths}
                onChange={(e) => setFormData({ ...formData, minTenureMonths: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="kosong = tanpa syarat"
              />
              <p className="text-xs text-gray-500 mt-1">cth: 12 = baru boleh ambil setelah 1 tahun kerja.</p>
            </div>
            {editing && (
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={formData.requiresAttachment}
                  onChange={(e) => setFormData({ ...formData, requiresAttachment: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Wajib lampiran
              </label>
            </div>
            )}
            {editing && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isActive ? "bg-green-500" : "bg-gray-300"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isActive ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                  <span className="text-sm text-gray-600">{formData.isActive ? "Aktif" : "Tidak Aktif"}</span>
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setFormModalOpen(false);
                  setEditing(null);
                  setFormData(defaultForm);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                disabled={saveMutation.isPending}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Simpan
                  </>
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteModalOpen(false);
            setToDelete(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Hapus</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 p-2 bg-red-100 rounded-full">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-700 mb-2">
                  Apakah Anda yakin ingin menghapus tipe cuti <strong>{toDelete?.name}</strong>?
                </p>
                <p className="text-xs text-gray-500">
                  Tindakan ini akan melakukan soft delete. Data tidak akan muncul di daftar, tetapi masih
                  tersimpan di database.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setToDelete(null);
                }}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (toDelete) deleteMutation.mutate(toDelete.id);
                }}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Menghapus...
                  </>
                ) : (
                  "Hapus"
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
