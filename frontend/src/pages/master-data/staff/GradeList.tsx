import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Award, AlertTriangle } from "lucide-react";
import { gradesService, type Grade } from "@/services/grades.service";
import { api } from "@/services/api";
import { BreadcrumbHeader, StatCard, FilterToolbar, DataTable } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type StatusFilter = "all" | "active" | "inactive";

interface FormData {
  name: string;
  rank: string;
}

const defaultForm: FormData = { name: "", rank: "1" };

export default function GradeList() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const limit = 20;

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editing, setEditing] = useState<Grade | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultForm);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["grades", page, searchTerm, statusFilter],
    queryFn: () =>
      gradesService.getAll({ page, limit, search: searchTerm || undefined }),
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
      if (editing) return api.put(`/grades/${editing.id}`, payload);
      return api.post("/grades", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      toast.success(editing ? "Grade berhasil diupdate" : "Grade berhasil ditambahkan");
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

  const openEditModal = (row: Grade) => {
    setEditing(row);
    setFormData({ name: row.name || "", rank: String(row.rank ?? 1) });
    setFormModalOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/grades/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      toast.success("Grade berhasil dinonaktifkan");
      setDeleteModalOpen(false);
      setToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Gagal menonaktifkan grade");
    },
  });

  const columns: Column<Grade>[] = [
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
      key: "rank",
      header: "Tingkat",
      cell: (row) => (
        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border bg-blue-100 text-blue-800 border-blue-200">
          G{row.rank}
        </span>
      ),
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

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Grade" subtitle="Tangga tier 1–6 khusus jabatan staff">
        <Button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-white text-primary-600 border border-gray-200 hover:bg-primary-50"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Grade</span>
        </Button>
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || "Terjadi kesalahan"}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          icon={<Award className="w-6 h-6 text-white" />}
          iconBg="from-primary-500 to-primary-600"
          label="Total Grade"
          value={isLoading ? "-" : total}
          subtitle="Semua grade terdaftar"
        />
        <StatCard
          icon={<Award className="w-6 h-6 text-white" />}
          iconBg="from-blue-500 to-blue-600"
          label="Ditampilkan"
          value={isLoading ? "-" : rows.length}
          subtitle="Grade pada halaman ini"
        />
        <StatCard
          icon={<Award className="w-6 h-6 text-white" />}
          iconBg="from-green-500 to-green-600"
          label="Grade Aktif"
          value={isLoading ? "-" : activeCount}
          badge={{ text: "Active", className: "bg-green-100 text-green-800" }}
        />
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama grade..."
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
        keyExtractor={(t: Grade) => t.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada grade ditemukan"
        emptyIcon={<Award className="w-16 h-16" />}
        actions={(row: Grade) => (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEditModal(row)} title="Edit">
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              title="Nonaktifkan"
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
              <span className="font-bold text-foreground">{total}</span> grade
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
            <DialogTitle>{editing ? "Edit Grade" : "Tambah Grade"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate({ name: formData.name, rank: Number(formData.rank) });
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium mb-1">Nama Grade</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="mis. Grade 1"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tingkat (1–6)</label>
              <select
                value={formData.rank}
                onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
              >
                {[1, 2, 3, 4, 5, 6].map((r) => (
                  <option key={r} value={String(r)}>
                    {r}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Grade hanya untuk jabatan staff — tiap tingkat harus unik.
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
            <DialogTitle>Nonaktifkan Grade</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <p className="text-sm text-amber-800">
              Grade <b>{toDelete?.name}</b> akan dinonaktifkan. Grade yang masih dipakai jabatan tidak
              bisa dinonaktifkan — pindahkan dulu.
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
