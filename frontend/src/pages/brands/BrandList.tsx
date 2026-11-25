import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {Plus, Tag, Eye, Edit, Trash2, Save, Loader2} from "lucide-react";
import { brandsService } from "../../services/brands.service";
import { BreadcrumbHeader, StatCard, FilterToolbar, DataTable, StatusDot } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDateTimeId } from "@/lib/utils";

type StatusFilter = "all" | "active" | "inactive";

export default function BrandList() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const limit = 20;

  // Modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", description: "", isActive: true });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [brandToDelete, setBrandToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["brands", page, searchTerm, statusFilter],
    queryFn: () =>
      brandsService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        ...(statusFilter !== "all" ? { 'filter[isActive]': statusFilter === "active" } : {}),
      }),
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const brands = data?.data || [];
  const pagination = data?.meta || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      const submitData = { ...data };
      if (editingBrand) {
        return brandsService.update(editingBrand.id, submitData);
      }
      return brandsService.create(submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success(editingBrand ? "Merk berhasil diupdate" : "Merk berhasil ditambahkan");
      setFormModalOpen(false);
      setEditingBrand(null);
      setFormData({ name: "", description: "", isActive: true });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Terjadi kesalahan");
    },
  });

  const openCreateModal= () => {
    setEditingBrand(null);
    setFormData({ name: "", description: "", isActive: true });
    setFormModalOpen(true);
  };

  const openEditModal = (brand: any) => {
    setEditingBrand(brand);
    setFormData({
      name: brand.name || "",
      description: brand.description || "",
      isActive: brand.isActive !== false,
    });
    setFormModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const totalProducts = brands.reduce(
    (acc: number

, b: any) => acc + (b.productCount || 0),
    0
  );


  const deleteMutation = useMutation({
    mutationFn: (id: string) => brandsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success('Merk berhasil dihapus');
      setDeleteModalOpen(false);
      setBrandToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus merk');
    },
  });
  const columns: Column<any>[] = [
    {
      key: "name",
      stickyLeft: true,
      header: "Merk",
      cell: (brand) => (
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[15px] font-medium text-foreground">
              {brand.name}
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">
              {brand.code || "-"}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "description",
      header: "Deskripsi",
      cell: (brand) => (
        <div className="text-sm text-muted-foreground max-w-md truncate">
          {brand.description || "-"}
        </div>
      ),
    },
    {
      key: "productCount",
      header: "Produk",
      cell: (brand) => (
        <div className="text-sm font-medium tabular-nums text-foreground">
          {brand.productCount || 0}
        </div>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      cell: (brand) => (
        <StatusDot tone={brand.isActive ? "ok" : "off"}>
          {brand.isActive ? "Aktif" : "Tidak Aktif"}
        </StatusDot>
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

  const activeCount = brands.filter((b: any) => b.isActive).length;

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Manajemen Merk" subtitle="Kelola merk produk">
        <Button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 border border-gray-200 dark:border-gray-700 hover:bg-primary-50 dark:hover:bg-primary-950"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Merk</span>
        </Button>
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 dark:text-red-200 font-medium">
            {(error as Error).message || "Terjadi kesalahan"}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          icon={<Tag className="h-5 w-5" />}
          label="Total Merk"
          value={isLoading ? "-" : pagination.total}
          subtitle="Semua merk terdaftar"
        />
        <StatCard
          icon={<Tag className="h-5 w-5" />}
          label="Total Produk"
          value={isLoading ? "-" : totalProducts}
          subtitle="Dari semua merk"
        />
        <StatCard
          icon={<Tag className="h-5 w-5" />}
          label="Merk Aktif"
          value={isLoading ? "-" : activeCount}
        />
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama merk..."
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
        actionsPosition="left"
        columns={columns}
        data={brands}
        keyExtractor={(b: any) => b.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada merk ditemukan"
        emptyIcon={<Tag className="w-16 h-16" />}
        actions={(brand: any) => (
          <div className="flex items-center justify-end gap-1">
            <Link
              to={`/brands/${brand.id}`}
              title="Lihat Detail"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Eye className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => openEditModal(brand)}
              title="Edit"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Hapus"
              onClick={() => {
                setBrandToDelete({ id: brand.id, name: brand.name });
                setDeleteModalOpen(true);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      />

      {!isLoading && brands.length > 0 && (
        <div className="border bg-muted px-4 py-3 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Menampilkan{" "}
              <span className="font-medium tabular-nums text-foreground">
                {brands.length}
              </span>{" "}
              dari{" "}
              <span className="font-medium tabular-nums text-foreground">
                {pagination.total}
              </span>{" "}
              merk
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
          if (!open) {
            setFormModalOpen(false);
            setEditingBrand(null);
            setFormData({ name: "", description: "", isActive: true });
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBrand ? "Edit Merk" : "Tambah Merk"}</DialogTitle>
          </DialogHeader>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nama Merk <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Nama merk"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Deskripsi
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Deskripsi merk (opsional)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
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
              onClick={() => {
                setFormModalOpen(false);
                setEditingBrand(null);
                setFormData({ name: "", description: "", isActive: true });
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          if (!open) { setDeleteModalOpen(false); setBrandToDelete(null); }
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
                  Apakah Anda yakin ingin menghapus merk <strong>{brandToDelete?.name}</strong>?
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tindakan ini akan melakukan soft delete. Data tidak akan muncul di daftar, tetapi masih tersimpan di database.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setDeleteModalOpen(false); setBrandToDelete(null); }}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
              >Batal</button>
              <button
                onClick={() => { if (brandToDelete) deleteMutation.mutate(brandToDelete.id); }}
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
