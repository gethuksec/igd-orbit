import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Save, Loader2, Wallet } from "lucide-react";
import { payrollComponentsService, type PayrollComponent } from "@/services/payroll-components.service";
import { api } from "@/services/api";
import { BreadcrumbHeader, StatCard, FilterToolbar, DataTable, StatusDot } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type StatusFilter = "all" | "active" | "inactive";
type CategoryFilter = "all" | "earning" | "deduction";

interface FormData {
  code: string;
  name: string;
  description: string;
  category: string;
  source: string;
  defaultAmount: string;
  tiers: string;
  sortOrder: string;
  isActive: boolean;
}

const defaultForm: FormData = {
  code: "",
  name: "",
  description: "",
  category: "earning",
  source: "manual",
  defaultAmount: "",
  tiers: "",
  sortOrder: "0",
  isActive: true,
};

const catBadge = (c: string) =>
  c === "earning"
    ? "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800"
    : "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800";

const srcBadge = (s: string) =>
  s === "grade"
    ? "bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800"
    : s === "computed"
      ? "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800"
      : s === "fixed"
        ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800"
        : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700";

const formatRp = (v: number | null | undefined) =>
  v === null || v === undefined ? "-" : `Rp ${Number(v).toLocaleString("id-ID")}`;

export default function PayrollComponentList() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const limit = 20;

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editing, setEditing] = useState<PayrollComponent | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultForm);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["payroll-components", page, searchTerm, statusFilter, categoryFilter],
    queryFn: () =>
      payrollComponentsService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        status: statusFilter,
        category: categoryFilter === "all" ? undefined : categoryFilter,
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
  }, [statusFilter, categoryFilter]);

  const rows = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };
  const activeCount = rows.filter((t: PayrollComponent) => t.isActive).length;

  const toPayload = (f: FormData) => {
    let tiers: any = undefined;
    if (f.tiers.trim() !== "") {
      try {
        tiers = JSON.parse(f.tiers);
      } catch {
        throw new Error("Tiers bukan JSON valid — contoh: {\"G1\": 700000}");
      }
    }
    const base: any = {
      name: f.name,
      description: f.description || undefined,
      category: f.category,
      source: f.source,
      defaultAmount: f.defaultAmount === "" ? undefined : Number(f.defaultAmount),
      tiers,
      sortOrder: f.sortOrder === "" ? undefined : Number(f.sortOrder),
    };
    if (f.code.trim() !== "") base.code = f.code.trim();
    if (editing) base.isActive = f.isActive;
    return base;
  };

  const saveMutation = useMutation({
    mutationFn: (payload: any) => {
      if (editing) return api.put(`/payroll-components/${editing.id}`, payload);
      const { isActive: _omit, ...createPayload } = payload;
      return api.post("/payroll-components", createPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-components"] });
      toast.success(editing ? "Komponen berhasil diupdate" : "Komponen berhasil ditambahkan");
      setFormModalOpen(false);
      setEditing(null);
      setFormData(defaultForm);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || "Terjadi kesalahan");
    },
  });

  const openCreateModal = () => {
    setEditing(null);
    setFormData(defaultForm);
    setFormModalOpen(true);
  };

  const openEditModal = (row: PayrollComponent) => {
    setEditing(row);
    setFormData({
      code: row.code || "",
      name: row.name || "",
      description: row.description || "",
      category: row.category || "earning",
      source: row.source || "manual",
      defaultAmount: row.defaultAmount?.toString() ?? "",
      tiers: row.tiers ? JSON.stringify(row.tiers) : "",
      sortOrder: row.sortOrder?.toString() ?? "0",
      isActive: row.isActive ?? true,
    });
    setFormModalOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/payroll-components/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-components"] });
      toast.success("Komponen berhasil dihapus");
      setDeleteModalOpen(false);
      setToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Gagal menghapus komponen");
    },
  });

  const columns: Column<PayrollComponent>[] = [
    {
      key: "name",
      header: "Komponen",
      cell: (row) => (
        <div>
          <div className="text-[15px] font-medium text-foreground">{row.name}</div>
          {row.description && (
            <div className="text-xs text-muted-foreground mt-1">{row.description}</div>
          )}
          <div className="text-xs text-muted-foreground mt-1 font-mono">{row.code || "-"}</div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Kategori",
      cell: (row) => (
        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${catBadge(row.category)}`}>
          {row.category === "earning" ? "Pemasukan" : "Potongan"}
        </span>
      ),
    },
    {
      key: "source",
      header: "Sumber",
      cell: (row) => (
        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${srcBadge(row.source)}`}>
          {row.source}
        </span>
      ),
    },
    {
      key: "defaultAmount",
      header: "Nominal Default",
      cell: (row) => <span>{formatRp(row.defaultAmount)}</span>,
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
      <BreadcrumbHeader title="Komponen Payroll" subtitle="Kelola pemasukan & potongan payroll">
        <Button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 border border-gray-200 dark:border-gray-700 hover:bg-primary-50 dark:hover:bg-primary-950"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Komponen</span>
        </Button>
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 dark:text-red-200 font-medium">{(error as Error).message || "Terjadi kesalahan"}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Total Komponen"
          value={isLoading ? "-" : pagination.total}
          subtitle="Semua komponen terdaftar"
        />
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Ditampilkan"
          value={isLoading ? "-" : rows.length}
          subtitle="Komponen pada halaman ini"
        />
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Komponen Aktif"
          value={isLoading ? "-" : activeCount}
        />
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama komponen..."
        fields={[
          {
            key: "category",
            label: "Kategori",
            type: "select",
            options: [
              { value: "earning", label: "Pemasukan" },
              { value: "deduction", label: "Potongan" },
            ],
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
        values={{
          category: categoryFilter === "all" ? "" : categoryFilter,
          status: statusFilter === "all" ? "" : statusFilter,
        }}
        onFieldChange={(key, v) => {
          if (key === "category") {
            setCategoryFilter((v || "all") as CategoryFilter);
            setPage(1);
          }
          if (key === "status") {
            setStatusFilter((v || "all") as StatusFilter);
            setPage(1);
          }
        }}
        onReset={() => {
          setCategoryFilter("all");
          setStatusFilter("all");
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={(t: PayrollComponent) => t.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada komponen ditemukan"
        emptyIcon={<Wallet className="w-16 h-16" />}
        actions={(row: PayrollComponent) => (
          <div className="flex items-center justify-end gap-1">
            <button type="button" onClick={() => openEditModal(row)} title="Edit" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Edit className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Hapus"
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
        <div className="border bg-muted px-4 py-3 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Menampilkan <span className="font-medium tabular-nums text-foreground">{rows.length}</span> dari{" "}
              <span className="font-medium tabular-nums text-foreground">{pagination.total}</span> komponen
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
            <DialogTitle>{editing ? "Edit Komponen" : "Tambah Komponen"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                saveMutation.mutate(toPayload(formData));
              } catch (err: any) {
                toast.error(err.message || "Form tidak valid");
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nama Komponen <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="cth: Tunjangan Jabatan"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategori</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="earning">Pemasukan</option>
                  <option value="deduction">Potongan</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sumber</label>
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="manual">manual — HR isi</option>
                  <option value="fixed">fixed — nominal tetap</option>
                  <option value="grade">grade — prefill master grade</option>
                  <option value="computed">computed — BE hitung</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kode (opsional — auto bila kosong)</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono"
                placeholder="cth: TUNJ-JABATAN"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deskripsi / Aturan</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="cth: Jam x 15.000"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nominal Default (Rp)</label>
                <input
                  type="number"
                  min={0}
                  value={formData.defaultAmount}
                  onChange={(e) => setFormData({ ...formData, defaultAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Urutan</label>
                <input
                  type="number"
                  min={0}
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
            </div>
            {formData.source === "grade" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tiers Grade (JSON)</label>
                <textarea
                  value={formData.tiers}
                  onChange={(e) => setFormData({ ...formData, tiers: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                  placeholder='{"G1": 700000, "G2": 400000}'
                />
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
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
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
              <div className="flex-1">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Apakah Anda yakin ingin menghapus komponen <strong>{toDelete?.name}</strong>?
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
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
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
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
