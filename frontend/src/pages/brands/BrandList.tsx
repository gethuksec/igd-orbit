import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Tag, Eye, Edit, Trash2, Save, Loader2 } from "lucide-react";
import { brandsService } from "../../services/brands.service";
import { api } from "../../services/api";
import { PageHeader } from "@/components/shared";
import { StatCard } from "@/components/shared";
import { SearchFilter } from "@/components/shared";
import { DataTable } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";

export default function BrandList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", description: "", isActive: true });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["brands", page, searchTerm],
    queryFn: () =>
      brandsService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
      }),
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

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

  const openCreateModal = () => {
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
    (acc: number, b: any) => acc + (b.productCount || 0),
    0
  );

  const columns: Column<any>[] = [
    {
      key: "name",
      header: "Merk",
      cell: (brand) => (
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 h-14 w-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <Tag className="w-7 h-7" />
          </div>
          <div>
            <div className="text-base font-semibold text-foreground">
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
        <div className="text-sm font-semibold text-foreground">
          {brand.productCount || 0}
        </div>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      cell: (brand) => (
        <span
          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            brand.isActive
              ? "bg-green-100 text-green-800 border-green-200"
              : "bg-gray-100 text-gray-800 border-gray-200"
          }`}
        >
          {brand.isActive ? "Aktif" : "Tidak Aktif"}
        </span>
      ),
    },
  ];

  const activeCount = brands.filter((b: any) => b.isActive).length;

  return (
    <div className="w-full space-y-3">
      <PageHeader title="Manajemen Merk" subtitle="Kelola merk produk">
        <Button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-white text-primary-600 hover:bg-primary-50"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Merk</span>
        </Button>
      </PageHeader>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">
            {(error as Error).message || "Terjadi kesalahan"}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          icon={<Tag className="w-6 h-6 text-white" />}
          iconBg="from-primary-500 to-primary-600"
          label="Total Merk"
          value={isLoading ? "-" : pagination.total}
          subtitle="Semua merk terdaftar"
        />
        <StatCard
          icon={<Tag className="w-6 h-6 text-white" />}
          iconBg="from-blue-500 to-blue-600"
          label="Total Produk"
          value={isLoading ? "-" : totalProducts}
          subtitle="Dari semua merk"
        />
        <StatCard
          icon={<Tag className="w-6 h-6 text-white" />}
          iconBg="from-green-500 to-green-600"
          label="Merk Aktif"
          value={isLoading ? "-" : activeCount}
          badge={{ text: "Active", className: "bg-green-100 text-green-800" }}
        />
      </div>

      <SearchFilter
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama merk..."
      />

      <DataTable
        columns={columns}
        data={brands}
        keyExtractor={(b: any) => b.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada merk ditemukan"
        emptyIcon={<Tag className="w-16 h-16" />}
        actions={(brand: any) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/brands/${brand.id}`)}
              title="Lihat Detail"
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditModal(brand)}
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              title="Hapus"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      />

      {!isLoading && brands.length > 0 && (
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Menampilkan{" "}
              <span className="font-bold text-foreground">
                {brands.length}
              </span>{" "}
              dari{" "}
              <span className="font-bold text-foreground">
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
      <Modal
        open={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingBrand(null);
          setFormData({ name: "", description: "", isActive: true });
        }}
        title={editingBrand ? "Edit Merk" : "Tambah Merk"}
        size="md"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Merk <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Nama merk"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deskripsi
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Deskripsi merk (opsional)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.isActive ? "active" : "inactive"}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.value === "active" })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="active">Aktif</option>
              <option value="inactive">Tidak Aktif</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setFormModalOpen(false);
                setEditingBrand(null);
                setFormData({ name: "", description: "", isActive: true });
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
      </Modal>
    </div>
  );
}
