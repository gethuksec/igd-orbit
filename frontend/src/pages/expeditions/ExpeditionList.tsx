import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {Plus, Eye, Edit, Trash2, Save, Loader2, Truck, RefreshCw} from "lucide-react";
import { expeditionsService } from "../../services/expeditions.service";
import { api } from "../../services/api";
import { BreadcrumbHeader, StatCard, FilterToolbar, DataTable, StatusDot } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDate } from "@/utils/format";
import { generateCode10 } from "@/utils/generateCode";

type StatusFilter = "all" | "active" | "inactive";

const defaultFormData = { code: "", name: "", description: "", isActive: true };

// Headline order (IGDERP-312): Aksi, Kode, Nama, Keterangan, Status, Log
export default function ExpeditionList() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const limit = 20;

  // Modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingExpedition, setEditingExpedition] = useState<any>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [expeditionToDelete, setExpeditionToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["expeditions", page, searchTerm, statusFilter],
    queryFn: () =>
      expeditionsService.getAll({
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

  const expeditions = data?.data || [];
  const pagination = data?.meta || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };

  const closeFormModal = () => {
    setFormModalOpen(false);
    setEditingExpedition(null);
    setFormData(defaultFormData);
  };

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      const payload: any = {
        name: data.name,
        description: data.description?.trim() ? data.description.trim() : undefined,
        isActive: data.isActive,
      };
      // Kode only on create — auto 10-char, editable/regenerable; immutable after that
      if (!editingExpedition && data.code?.trim()) {
        payload.code = data.code.trim().toUpperCase();
      }
      if (editingExpedition) {
        return api.put(`/expeditions/${editingExpedition.id}`, payload);
      }
      return api.post("/expeditions", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expeditions"] });
      toast.success(editingExpedition ? "Ekspedisi berhasil diupdate" : "Ekspedisi berhasil ditambahkan");
      closeFormModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Terjadi kesalahan");
    },
  });

  const openCreateModal= () => {
    setEditingExpedition(null);
    setFormData({ ...defaultFormData, code: generateCode10() });
    setFormModalOpen(true);
  };

  const openEditModal = (expedition: any) => {
    setEditingExpedition(expedition);
    setFormData({
      code: expedition.code || "",
      name: expedition.name || "",
      description: expedition.description || "",
      isActive: expedition.isActive ?? true,
    });
    setFormModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const activeCount = expeditions.filter((e: any) => e.isActive).length;

  const rowActions = (expedition: any) => (
    <div className="flex items-center gap-1">
      <Link
        to={`/expeditions/${expedition.id}`}
        title="Lihat Detail"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Eye className="h-4 w-4" />
      </Link>
      <button
        type="button"
        onClick={() => openEditModal(expedition)}
        title="Edit"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Edit className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Hapus"
        onClick={() => {
          setExpeditionToDelete({ id: expedition.id, name: expedition.name });
          setDeleteModalOpen(true);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );


  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/expeditions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expeditions'] });
      toast.success('Ekspedisi berhasil dihapus');
      setDeleteModalOpen(false);
      setExpeditionToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus ekspedisi');
    },
  });
  const columns: Column<any>[] = [
    {
      key: "aksi",
      header: "Aksi",
      cell: (expedition) => rowActions(expedition),
    },
    {
      key: "code",
      header: "Kode",
      cell: (expedition) => (
        <div className="text-sm font-mono text-foreground whitespace-nowrap">
          {expedition.code || "-"}
        </div>
      ),
    },
    {
      key: "name",
      header: "Nama",
      cell: (expedition) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
            <Truck className="h-5 w-5" />
          </div>
          <div className="text-[15px] font-medium text-foreground whitespace-nowrap">
            {expedition.name}
          </div>
        </div>
      ),
    },
    {
      key: "description",
      header: "Keterangan",
      cell: (expedition) => (
        <div className="text-sm text-muted-foreground max-w-md truncate">
          {expedition.description || "-"}
        </div>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      cell: (expedition) => (
        <StatusDot tone={expedition.isActive ? "ok" : "off"}>
          {expedition.isActive ? "Aktif" : "Tidak Aktif"}
        </StatusDot>
      ),
    },
    {
      key: "log",
      header: "Log",
      cell: (expedition) => (
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          <div>
            {expedition.createdAt
              ? formatDate(expedition.createdAt, "dd MMM yyyy")
              : "-"}
          </div>
          {expedition.updatedAt && expedition.updatedAt !== expedition.createdAt && (
            <div className="text-xs">
              Ubah {formatDate(expedition.updatedAt, "dd MMM yyyy")}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Manajemen Ekspedisi" subtitle="Kelola ekspedisi pengiriman">
        <Button onClick={openCreateModal} className="flex items-center gap-2 bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 border border-gray-200 dark:border-gray-700 hover:bg-primary-50 dark:hover:bg-primary-950">
          <Plus className="w-5 h-5" />
          <span>Tambah Ekspedisi</span>
        </Button>
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 dark:text-red-200 font-medium">
            {(error as Error).message || "Terjadi kesalahan"}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <StatCard
          icon={<Truck className="h-5 w-5" />}
          label="Total Ekspedisi"
          value={isLoading ? "-" : pagination.total}
          subtitle="Semua ekspedisi terdaftar"
        />
        <StatCard
          icon={<Truck className="h-5 w-5" />}
          label="Ekspedisi Aktif"
          value={isLoading ? "-" : activeCount}
        />
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari kode, nama, keterangan ekspedisi..."
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
        data={expeditions}
        keyExtractor={(e: any) => e.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada ekspedisi ditemukan"
        emptyIcon={<Truck className="w-16 h-16" />}
      />

      {!isLoading && expeditions.length > 0 && (
        <div className="border bg-muted px-4 py-3 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Menampilkan{" "}
              <span className="font-medium tabular-nums text-foreground">
                {expeditions.length}
              </span>{" "}
              dari{" "}
              <span className="font-medium tabular-nums text-foreground">
                {pagination.total}
              </span>{" "}
              ekspedisi
              <span className="ml-2 text-muted-foreground">
                (Halaman {pagination.page} dari {pagination.totalPages})
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
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

      {/* Form Modal */}
      <Dialog
        open={formModalOpen}
        onOpenChange={(open) => {
          if (!open) { closeFormModal(); }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExpedition ? "Edit Ekspedisi" : "Tambah Ekspedisi"}</DialogTitle>
          </DialogHeader>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Kode Ekspedisi
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono disabled:bg-gray-50 dark:disabled:bg-gray-950 disabled:text-gray-500"
                placeholder="Auto 10 karakter"
                maxLength={10}
                disabled={!!editingExpedition}
              />
              {!editingExpedition && (
                <button
                  type="button"
                  title="Generate kode"
                  onClick={() => setFormData(prev => ({ ...prev, code: generateCode10() }))}
                  className="shrink-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {editingExpedition
                ? "Kode tidak dapat diubah setelah dibuat"
                : "10 karakter huruf + angka, dibuat otomatis"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nama Ekspedisi <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="text" required
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Nama ekspedisi"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Keterangan
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Keterangan ekspedisi (opsional)"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">{formData.isActive ? 'Aktif' : 'Tidak Aktif'}</span>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => { closeFormModal(); }}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
              disabled={saveMutation.isPending}
            >Batal</button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saveMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
              ) : (
                <><Save className="w-4 h-4" /> Simpan</>
              )}
            </button>
          </div>
        </form>
        </DialogContent>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          if (!open) { setDeleteModalOpen(false); setExpeditionToDelete(null); }
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
                  Apakah Anda yakin ingin menghapus ekspedisi <strong>{expeditionToDelete?.name}</strong>?
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tindakan ini akan melakukan soft delete. Data tidak akan muncul di daftar, tetapi masih tersimpan di database.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setDeleteModalOpen(false); setExpeditionToDelete(null); }}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
              >Batal</button>
              <button
                onClick={() => { if (expeditionToDelete) deleteMutation.mutate(expeditionToDelete.id); }}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleteMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Menghapus...</>
                ) : 'Hapus'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
</Dialog>
    </div>
  );
}
