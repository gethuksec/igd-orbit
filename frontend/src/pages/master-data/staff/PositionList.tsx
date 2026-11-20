import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Briefcase, AlertTriangle } from "lucide-react";
import { positionsService, type Position } from "@/services/positions.service";
import { api } from "@/services/api";
import { BreadcrumbHeader, StatCard, FilterToolbar, DataTable, StatusDot } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type StatusFilter = "all" | "active" | "inactive";

interface FormData {
  name: string;
  rank: string;
  divisionId: string;
  departmentId: string;
  gradeId: string;
  minSalary: string;
  defaultRoleId: string;
  isActive: boolean;
}

const defaultForm: FormData = {
  name: "",
  rank: "6",
  divisionId: "",
  departmentId: "",
  gradeId: "",
  minSalary: "",
  defaultRoleId: "",
  isActive: true,
};

const formatRp = (v: number | null | undefined) =>
  v === null || v === undefined
    ? "—"
    : "Rp " + Number(v).toLocaleString("id-ID");

export default function PositionList() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [rankFilter, setRankFilter] = useState("");
  const limit = 20;

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultForm);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data: divisions } = useQuery({
    queryKey: ["divisions-options"],
    queryFn: async () => {
      const res = await api.get("/divisions");
      return ((res.data?.data ?? []) as { id: string; name: string }[]);
    },
  });
  const { data: departments } = useQuery({
    queryKey: ["departments-options"],
    queryFn: async () => {
      const res = await api.get("/departments");
      return ((res.data?.data ?? []) as { id: string; name: string }[]);
    },
  });
  const { data: grades } = useQuery({
    queryKey: ["grades-options"],
    queryFn: async () => {
      const res = await api.get("/grades");
      return ((res.data?.data ?? []) as { id: string; code: string; name: string; rank: number }[]);
    },
  });
  const { data: roles } = useQuery({
    queryKey: ["roles-options"],
    queryFn: async () => {
      const res = await api.get("/roles", { params: { limit: 100 } });
      const body = res.data;
      return ((body?.data ?? body ?? []) as { id: string; code: string; name: string }[]);
    },
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["positions", page, searchTerm, statusFilter, rankFilter],
    queryFn: () =>
      positionsService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        rank: rankFilter ? Number(rankFilter) : undefined,
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
  }, [statusFilter, rankFilter]);

  const allRows = data?.data || [];
  const rows =
    statusFilter === "all"
      ? allRows
      : allRows.filter((d) => (statusFilter === "active" ? d.isActive : !d.isActive));
  const total = data?.meta?.total ?? data?.total ?? rows.length;
  const totalPages = data?.meta?.totalPages ?? 1;
  const curPage = data?.meta?.page ?? page;
  const activeCount = allRows.filter((d) => d.isActive).length;
  const staffCount = allRows.filter((d) => d.rank === 6).length;

  const saveMutation = useMutation({
    mutationFn: (payload: any) => {
      if (editing) return api.put(`/positions/${editing.id}`, payload);
      return api.post("/positions", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      toast.success(editing ? "Jabatan berhasil diupdate" : "Jabatan berhasil ditambahkan");
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

  const openEditModal = (row: Position) => {
    setEditing(row);
    setFormData({
      name: row.name || "",
      rank: String(row.rank ?? 6),
      divisionId: row.divisionId || "",
      departmentId: row.departmentId || "",
      gradeId: row.gradeId || "",
      minSalary: row.minSalary?.toString() ?? "",
      defaultRoleId: row.defaultRoleId || "",
      isActive: row.isActive ?? true,
    });
    setFormModalOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/positions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      toast.success("Jabatan berhasil dinonaktifkan");
      setDeleteModalOpen(false);
      setToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Gagal menonaktifkan jabatan");
    },
  });

  const isStaffRank = Number(formData.rank) === 6;

  const columns: Column<Position>[] = [
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
      key: "rank",
      header: "Level",
      cell: (row) => (
        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border bg-purple-100 text-purple-800 border-purple-200">
          L{row.rank}
        </span>
      ),
    },
    {
      key: "grade",
      header: "Grade",
      cell: (row) =>
        row.grade ? (
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border bg-blue-100 text-blue-800 border-blue-200">
            G{row.grade.rank}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "division",
      header: "Divisi",
      cell: (row) => <span>{row.division?.name || "-"}</span>,
    },
    {
      key: "minSalary",
      header: "Min. Gaji",
      cell: (row) => <span>{formatRp(row.minSalary)}</span>,
    },
    {
      key: "employees",
      header: "Karyawan",
      cell: (row) => <span>{row._count?.employees ?? "-"}</span>,
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
      <BreadcrumbHeader title="Jabatan" subtitle="Master jabatan — pengganti position teks bebas">
        <Button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-white text-primary-600 border border-gray-200 hover:bg-primary-50"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Jabatan</span>
        </Button>
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || "Terjadi kesalahan"}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          icon={<Briefcase className="h-5 w-5" />}
          label="Total Jabatan"
          value={isLoading ? "-" : total}
          subtitle="Semua jabatan terdaftar"
        />
        <StatCard
          icon={<Briefcase className="h-5 w-5" />}
          label="Jabatan Staff"
          value={isLoading ? "-" : staffCount}
          subtitle="Level 6 — bergelar G1–G6"
        />
        <StatCard
          icon={<Briefcase className="h-5 w-5" />}
          label="Jabatan Aktif"
          value={isLoading ? "-" : activeCount}
        />
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama jabatan..."
        fields={[
          {
            key: "rank",
            label: "Level",
            type: "select",
            options: [0, 1, 2, 3, 4, 5, 6].map((r) => ({ value: String(r), label: `L${r}` })),
          },
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
        values={{ rank: rankFilter, status: statusFilter === "all" ? "" : statusFilter }}
        onFieldChange={(key, v) => {
          if (key === "status") setStatusFilter((v || "all") as StatusFilter);
          if (key === "rank") setRankFilter(v || "");
          setPage(1);
        }}
        onReset={() => {
          setStatusFilter("all");
          setRankFilter("");
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={(t: Position) => t.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada jabatan ditemukan"
        emptyIcon={<Briefcase className="w-16 h-16" />}
        actions={(row: Position) => (
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      />

      {!isLoading && rows.length > 0 && (
        <div className="border bg-muted px-4 py-3 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Menampilkan <span className="font-medium tabular-nums text-foreground">{rows.length}</span> dari{" "}
              <span className="font-medium tabular-nums text-foreground">{total}</span> jabatan
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
            <DialogTitle>{editing ? "Edit Jabatan" : "Tambah Jabatan"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (Number(formData.rank) === 6 && !formData.gradeId) {
                toast.error("Jabatan staff (L6) wajib punya grade");
                return;
              }
              saveMutation.mutate({
                name: formData.name,
                rank: Number(formData.rank),
                divisionId: formData.divisionId || undefined,
                departmentId: formData.departmentId || undefined,
                gradeId: formData.gradeId || undefined,
                minSalary: formData.minSalary ? Number(formData.minSalary) : undefined,
                defaultRoleId: formData.defaultRoleId || undefined,
              });
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium mb-1">Nama Jabatan</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="mis. STAFF CASHIER 1"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Level (L0–L6)</label>
                <select
                  value={formData.rank}
                  onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((r) => (
                    <option key={r} value={String(r)}>
                      L{r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Grade {isStaffRank ? "(wajib)" : ""}</label>
                <select
                  value={formData.gradeId}
                  onChange={(e) => setFormData({ ...formData, gradeId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm disabled:bg-gray-100"
                  disabled={!isStaffRank}
                  required={isStaffRank}
                >
                  <option value="">— Pilih grade —</option>
                  {(grades || []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} (G{g.rank})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Divisi</label>
                <select
                  value={formData.divisionId}
                  onChange={(e) => setFormData({ ...formData, divisionId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  <option value="">— Tanpa divisi —</option>
                  {(divisions || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Departemen</label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  <option value="">— Tanpa departemen —</option>
                  {(departments || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Min. Gaji (Rp)</label>
                <input
                  type="number"
                  min={0}
                  value={formData.minSalary}
                  onChange={(e) => setFormData({ ...formData, minSalary: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="mis. 3000000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Batas bawah saja — tidak ada batas atas.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role Default</label>
                <select
                  value={formData.defaultRoleId}
                  onChange={(e) => setFormData({ ...formData, defaultRoleId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  <option value="">— Tanpa role —</option>
                  {(roles || []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} — {r.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Saran role saat intake kontrak (bisa dioverride).
                </p>
              </div>
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
            <DialogTitle>Nonaktifkan Jabatan</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <p className="text-sm text-amber-800">
              Jabatan <b>{toDelete?.name}</b> akan dinonaktifkan. Jabatan yang masih dipakai karyawan
              tidak bisa dinonaktifkan — pindahkan dulu.
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
