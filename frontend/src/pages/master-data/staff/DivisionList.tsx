import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Building2, AlertTriangle } from "lucide-react";
import { divisionsService, type Division } from "@/services/divisions.service";
import { api } from "@/services/api";
import { BreadcrumbHeader, StatCard, FilterToolbar, DataTable, StatusDot } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type StatusFilter = "all" | "active" | "inactive";

interface FormData {
  name: string;
  departmentId: string;
  isActive: boolean;
}

const defaultForm: FormData = { name: "", departmentId: "", isActive: true };

export default function DivisionList() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const limit = 20;

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editing, setEditing] = useState<Division | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultForm);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data: departments } = useQuery({
    queryKey: ["departments-options"],
    queryFn: async () => {
      const res = await api.get("/departments");
      const body = res.data;
      return (body?.data ?? []) as { id: string; code: string; name: string }[];
    },
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["divisions", page, searchTerm, statusFilter],
    queryFn: () =>
      divisionsService.getAll({ page, limit, search: searchTerm || undefined }),
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

  const allRows = data?.data || [];
  const rows =
    statusFilter === "all"
      ? allRows
      : allRows.filter((d) => (statusFilter === "active" ? d.isActive : !d.isActive));
  const total = data?.meta?.total ?? data?.total ?? rows.length;
  const totalPages = data?.meta?.totalPages ?? 1;
  const curPage = data?.meta?.page ?? page;
  const activeCount = allRows.filter((d) => d.isActive).length;

  const saveMutation = useMutation({
    mutationFn: (payload: any) => {
      if (editing) return api.put(`/divisions/${editing.id}`, payload);
      return api.post("/divisions", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divisions"] });
      toast.success(editing ? "Divisi berhasil diupdate" : "Divisi berhasil ditambahkan");
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

  const openEditModal = (row: Division) => {
    setEditing(row);
    setFormData({
      name: row.name || "",
      departmentId: row.departmentId || "",
      isActive: row.isActive ?? true,
    });
    setFormModalOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/divisions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divisions"] });
      toast.success("Divisi berhasil dinonaktifkan");
      setDeleteModalOpen(false);
      setToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Gagal menonaktifkan divisi");
    },
  });

  const deptName = (id: string) => departments?.find((d) => d.id === id)?.name || "-";

  const columns: Column<Division>[] = [
    {
      key: "name",
      header: "Nama",
      cell: (row) => (
        <div>
          <div className="text-[15px] font-medium text-foreground">{row.name}</div>
          <div className="text-xs text-muted-foreground mt-1 font-mono">{row.code || "-"}</div>
        </div>
      ),
    },
    {
      key: "department",
      header: "Departemen",
      cell: (row) => <span>{row.department?.name || deptName(row.departmentId)}</span>,
    },
    {
      key: "employees",
      header: "Karyawan",
      cell: (row) => <span>{row._count?.employees ?? "-"}</span>,
    },
    {
      key: "positions",
      header: "Jabatan",
      cell: (row) => <span>{row._count?.positions ?? "-"}</span>,
    },
    {
      key: "isActive",
      header: "Status",
      cell: (row) => (
        <StatusDot tone={row.isActive ? "ok" : "off"}>
          {row.isActive ? "Aktif" : "Tidak Aktif"}
        </StatusDot>
      ),
    },
  ];

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Divisi" subtitle="Kelola divisi di bawah departemen">
        <Button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 border border-gray-200 dark:border-gray-700 hover:bg-primary-50 dark:hover:bg-primary-950"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Divisi</span>
        </Button>
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 dark:text-red-200 font-medium">{(error as Error).message || "Terjadi kesalahan"}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          icon={<Building2 className="h-5 w-5" />}
          label="Total Divisi"
          value={isLoading ? "-" : total}
          subtitle="Semua divisi terdaftar"
        />
        <StatCard
          icon={<Building2 className="h-5 w-5" />}
          label="Ditampilkan"
          value={isLoading ? "-" : rows.length}
          subtitle="Divisi pada halaman ini"
        />
        <StatCard
          icon={<Building2 className="h-5 w-5" />}
          label="Divisi Aktif"
          value={isLoading ? "-" : activeCount}
        />
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama divisi..."
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
        keyExtractor={(t: Division) => t.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada divisi ditemukan"
        emptyIcon={<Building2 className="w-16 h-16" />}
        actions={(row: Division) => (
          <div className="flex items-center justify-end gap-1">
            <button type="button" onClick={() => openEditModal(row)} title="Edit" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Edit className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Nonaktifkan"
              onClick={() => {
                setToDelete({ id: row.id, name: row.name });
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
              <span className="font-bold text-foreground">{total}</span> divisi
              <span className="ml-2 text-muted-foreground">
                (Halaman {curPage} dari {totalPages})
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
                disabled={page >= totalPages}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Divisi" : "Tambah Divisi"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!formData.departmentId) {
                toast.error("Departemen wajib dipilih");
                return;
              }
              saveMutation.mutate({ name: formData.name, departmentId: formData.departmentId });
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium mb-1">Nama Divisi</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="mis. Assistant Store Sales"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Departemen</label>
              <select
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                required
              >
                <option value="">— Pilih departemen —</option>
                {(departments || []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Struktur bisa diubah kapan saja — pindahkan divisi antar departemen lewat kolom ini.
              </p>
            </div>
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
            <DialogTitle>Nonaktifkan Divisi</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Divisi <b>{toDelete?.name}</b> akan dinonaktifkan. Divisi yang masih punya karyawan atau
              jabatan tidak bisa dinonaktifkan — pindahkan dulu.
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
