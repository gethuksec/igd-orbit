import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Save, Loader2, Gavel, AlertTriangle } from "lucide-react";
import { penaltyTypesService, type PenaltyType } from "@/services/penalty-types.service";
import { rolesService, type Role } from "@/services/roles.service";
import { api } from "@/services/api";
import { BreadcrumbHeader, StatCard, FilterToolbar, DataTable } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type StatusFilter = "all" | "active" | "inactive";

interface FormData {
  name: string;
  description: string;
  calculation: string;
  defaultAmount: string;
  priority: string;
  approverRole: string;
  isActive: boolean;
}

const defaultForm: FormData = {
  name: "",
  description: "",
  calculation: "fixed",
  defaultAmount: "",
  priority: "",
  approverRole: "HS",
  isActive: true,
};

const calcBadge = (c: string) =>
  c === "flexible"
    ? "bg-blue-100 text-blue-800 border-blue-200"
    : c === "percent-tier"
      ? "bg-purple-100 text-purple-800 border-purple-200"
      : "bg-gray-100 text-gray-800 border-gray-200";

const calcLabel = (c: string) =>
  c === "flexible" ? "flexible" : c === "percent-tier" ? "percent-tier" : "fixed";

export default function PenaltyTypeList() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const limit = 20;

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editing, setEditing] = useState<PenaltyType | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultForm);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data: rolesData } = useQuery({
    queryKey: ["roles-active"],
    queryFn: () => rolesService.getAll({ limit: 100, isActive: true }),
  });
  const roles: Role[] = rolesData?.data || [];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["penalty-types", page, searchTerm, statusFilter],
    queryFn: () =>
      penaltyTypesService.getAll({
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
  const activeCount = rows.filter((t: PenaltyType) => t.isActive).length;

  const toPayload = (f: FormData) => {
    if (!editing) {
      // Tambah: minimal — calculation defaults to flexible, priority 0, active
      return {
        name: f.name,
        description: f.description || undefined,
        calculation: "flexible",
        defaultAmount: f.defaultAmount === "" ? undefined : Number(f.defaultAmount),
        priority: 0,
        approverRole: f.approverRole || undefined,
      };
    }
    return {
      name: f.name,
      description: f.description || undefined,
      calculation: f.calculation,
      defaultAmount: f.defaultAmount === "" ? undefined : Number(f.defaultAmount),
      priority: f.priority === "" ? undefined : Number(f.priority),
      approverRole: f.approverRole || undefined,
      isActive: f.isActive,
    };
  };

  const saveMutation = useMutation({
    mutationFn: (payload: any) => {
      if (editing) return api.put(`/penalty-types/${editing.id}`, payload);
      const { isActive: _omit, ...createPayload } = payload;
      return api.post("/penalty-types", createPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["penalty-types"] });
      toast.success(editing ? "Denda berhasil diupdate" : "Denda berhasil ditambahkan");
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

  const openEditModal = (row: PenaltyType) => {
    setEditing(row);
    setFormData({
      name: row.name || "",
      description: row.description || "",
      calculation: row.calculation || "fixed",
      defaultAmount: row.defaultAmount?.toString() ?? "",
      priority: row.priority?.toString() ?? "",
      approverRole: row.approverRole || "HS",
      isActive: row.isActive ?? true,
    });
    setFormModalOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/penalty-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["penalty-types"] });
      toast.success("Denda berhasil dihapus");
      setDeleteModalOpen(false);
      setToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Gagal menghapus denda");
    },
  });

  const columns: Column<PenaltyType>[] = [
    {
      key: "name",
      header: "Nama",
      cell: (row) => (
        <div>
          <div className="text-base font-semibold text-foreground">{row.name}</div>
          {row.description && (
            <div className="text-xs text-muted-foreground mt-1 font-mono">{row.description}</div>
          )}
          <div className="text-xs text-muted-foreground mt-1 font-mono">{row.code || "-"}</div>
        </div>
      ),
    },
    {
      key: "calculation",
      header: "Perhitungan",
      cell: (row) => (
        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${calcBadge(row.calculation)}`}>
          {calcLabel(row.calculation)}
        </span>
      ),
    },
    {
      key: "defaultAmount",
      header: "Nominal Default",
      cell: (row) =>
        row.calculation === "flexible" ? (
          <span className="text-xs text-muted-foreground">— flexible —</span>
        ) : (
          <span>Rp {(row.defaultAmount ?? 0).toLocaleString("id-ID")}</span>
        ),
    },
    {
      key: "priority",
      header: "Prioritas",
      cell: (row) => (
        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border bg-amber-100 text-amber-800 border-amber-200">
          {row.priority ?? 0}
        </span>
      ),
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
      <BreadcrumbHeader title="Denda" subtitle="Kelola jenis denda & nominal">
        <Button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-white text-primary-600 border border-gray-200 hover:bg-primary-50"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Denda</span>
        </Button>
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || "Terjadi kesalahan"}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          icon={<Gavel className="w-6 h-6 text-white" />}
          iconBg="from-primary-500 to-primary-600"
          label="Total Denda"
          value={isLoading ? "-" : pagination.total}
          subtitle="Semua jenis denda terdaftar"
        />
        <StatCard
          icon={<Gavel className="w-6 h-6 text-white" />}
          iconBg="from-blue-500 to-blue-600"
          label="Ditampilkan"
          value={isLoading ? "-" : rows.length}
          subtitle="Denda pada halaman ini"
        />
        <StatCard
          icon={<Gavel className="w-6 h-6 text-white" />}
          iconBg="from-green-500 to-green-600"
          label="Denda Aktif"
          value={isLoading ? "-" : activeCount}
          badge={{ text: "Active", className: "bg-green-100 text-green-800" }}
        />
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama denda..."
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
        keyExtractor={(t: PenaltyType) => t.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada denda ditemukan"
        emptyIcon={<Gavel className="w-16 h-16" />}
        actions={(row: PenaltyType) => (
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
              <span className="font-bold text-foreground">{pagination.total}</span> denda
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
            <DialogTitle>{editing ? "Edit Denda" : "Tambah Denda"}</DialogTitle>
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
                Nama Denda <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="cth: Denda Terlambat"
              />
            </div>
            {editing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Perhitungan</label>
              <select
                value={formData.calculation}
                onChange={(e) => setFormData({ ...formData, calculation: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="fixed">fixed — nominal tetap</option>
                <option value="percent-tier">percent-tier — tier % nominal layer</option>
                <option value="flexible">flexible — nominal saat penindakan</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Pulang-cepat pakai percent-tier 25–100%.</p>
            </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nominal Default (Rp)</label>
              <input
                type="number"
                min={0}
                value={formData.defaultAmount}
                onChange={(e) => setFormData({ ...formData, defaultAmount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">0 = belum diset, HR isi nominalnya.</p>
            </div>
            {editing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioritas</label>
              <input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">Lebih tinggi menang saat bentrok (alpha 10 &gt; lebih-libur 4).</p>
            </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Approver</label>
              {roles.length > 0 ? (
                <select
                  value={formData.approverRole}
                  onChange={(e) => setFormData({ ...formData, approverRole: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.code}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formData.approverRole}
                  onChange={(e) => setFormData({ ...formData, approverRole: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              )}
            </div>
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
                  Apakah Anda yakin ingin menghapus denda <strong>{toDelete?.name}</strong>?
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
