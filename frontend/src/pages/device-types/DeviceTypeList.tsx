import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Loader2, Smartphone, AlertTriangle, ListOrdered } from "lucide-react";
import { deviceTypesService } from "../../services/device-types.service";
import { BreadcrumbHeader, StatCard, FilterToolbar, DataTable } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";

type StatusFilter = "all" | "active" | "inactive";

// IGDERP-169: device type master — strict source for Smart Repair intake (no free "lainnya").
export default function DeviceTypeList() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const limit = 20;

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", isActive: true, sortOrder: 0 });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["device-types", page, searchTerm, statusFilter],
    queryFn: () =>
      deviceTypesService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        status: statusFilter,
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

  const items = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingItem) {
        return deviceTypesService.update(editingItem.id, data);
      }
      return deviceTypesService.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-types"] });
      toast.success(editingItem ? "Tipe perangkat berhasil diupdate" : "Tipe perangkat berhasil ditambahkan");
      setFormModalOpen(false);
      setEditingItem(null);
      setFormData({ name: "", isActive: true, sortOrder: 0 });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deviceTypesService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-types"] });
      toast.success("Tipe perangkat berhasil dihapus");
      setDeleteModalOpen(false);
      setItemToDelete(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Gagal menghapus tipe perangkat");
    },
  });

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({ name: "", isActive: true, sortOrder: 0 });
    setFormModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormData({
      name: item.name || "",
      isActive: item.isActive !== false,
      sortOrder: item.sortOrder || 0,
    });
    setFormModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      name: formData.name,
      isActive: formData.isActive,
      sortOrder: formData.sortOrder > 0 ? formData.sortOrder : undefined,
    });
  };

  const activeCount = items.filter((i: any) => i.isActive).length;
  const inactiveCount = items.filter((i: any) => !i.isActive).length;

  const columns: Column<any>[] = [
    {
      key: "name",
      header: "Tipe Perangkat",
      cell: (item) => (
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center text-white shadow-sm">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{item.name}</div>
            <div className="text-xs text-muted-foreground font-mono">{item.code}</div>
          </div>
        </div>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      cell: (item) => (
        <span
          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            item.isActive
              ? "bg-green-100 text-green-800 border-green-200"
              : "bg-gray-100 text-gray-800 border-gray-200"
          }`}
        >
          {item.isActive ? "Aktif" : "Tidak Aktif"}
        </span>
      ),
    },
    {
      key: "sortOrder",
      header: "Urutan",
      cell: (item) => (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ListOrdered className="w-4 h-4" />
          <span className="font-mono">{item.sortOrder}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Tipe Perangkat" subtitle="Master tipe perangkat untuk form Smart Repair">
        {hasPermission('service.checkpoint.create') && (
          <Button onClick={openCreateModal} className="flex items-center gap-2 bg-white text-primary-600 border border-gray-200 hover:bg-primary-50">
            <Plus className="w-5 h-5" />
            <span>Tambah Tipe</span>
          </Button>
        )}
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || "Terjadi kesalahan"}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard icon={<Smartphone className="w-6 h-6 text-white" />} iconBg="from-primary-500 to-primary-600" label="Total Tipe" value={isLoading ? "-" : pagination.total} subtitle="Semua tipe terdaftar" />
        <StatCard icon={<Smartphone className="w-6 h-6 text-white" />} iconBg="from-green-500 to-green-600" label="Tipe Aktif" value={isLoading ? "-" : activeCount} badge={{ text: "Active", className: "bg-green-100 text-green-800" }} />
        <StatCard icon={<Smartphone className="w-6 h-6 text-white" />} iconBg="from-gray-500 to-gray-600" label="Tipe Non-Aktif" value={isLoading ? "-" : inactiveCount} />
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari tipe perangkat..."
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
        data={items}
        keyExtractor={(i: any) => i.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada tipe perangkat ditemukan"
        emptyIcon={<Smartphone className="w-16 h-16" />}
        actions={(item: any) => (
          <div className="flex items-center justify-end gap-1">
            {hasPermission('service.checkpoint.edit') && (
              <Button variant="ghost" size="sm" onClick={() => openEditModal(item)} title="Edit">
                <Edit className="w-4 h-4" />
              </Button>
            )}
            {hasPermission('service.checkpoint.delete') && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50"
                title="Hapus"
                onClick={() => {
                  setItemToDelete({ id: item.id, name: item.name });
                  setDeleteModalOpen(true);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      />

      {!isLoading && items.length > 0 && (
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Menampilkan <span className="font-bold text-foreground">{items.length}</span> dari <span className="font-bold text-foreground">{pagination.total}</span> tipe
              <span className="ml-2 text-muted-foreground">(Halaman {pagination.page} dari {pagination.totalPages})</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>Sebelumnya</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= pagination.totalPages}>Selanjutnya</Button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      <Dialog
        open={formModalOpen}
        onOpenChange={(open) => {
          if (!open) { setFormModalOpen(false); setEditingItem(null); setFormData({ name: "", isActive: true, sortOrder: 0 }); }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Tipe Perangkat" : "Tambah Tipe Perangkat"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Tipe <span className="text-red-500">*</span>
              </label>
              <input
                type="text" required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Contoh: Smartwatch, Desktop..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Urutan</label>
              <input
                type="number" min="0"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0 (otomatis = urutan terakhir)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm text-gray-600">{formData.isActive ? 'Aktif' : 'Tidak Aktif'}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormModalOpen(false)}>Batal</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Simpan
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus Tipe Perangkat</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600">
              Hapus <b>{itemToDelete?.name}</b>? Tipe yang dipakai service order tidak bisa dihapus — nonaktifkan saja.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteModalOpen(false)}>Batal</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => itemToDelete && deleteMutation.mutate(itemToDelete.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Hapus
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
