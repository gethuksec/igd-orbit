import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Truck, Eye, Edit, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { suppliersService } from "../../services/suppliers.service";
import { PageHeader } from "@/components/shared";
import { StatCard } from "@/components/shared";
import { SearchFilter } from "@/components/shared";
import { DataTable } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Modal } from "../../components/ui/modal";
import { toast } from "sonner";

export default function SupplierList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["suppliers", page, searchTerm],
    queryFn: () =>
      suppliersService.getAll({
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => suppliersService.delete(id),
    onSuccess: () => {
      toast.success("Pemasok berhasil dihapus");
      setDeleteModalOpen(false);
      setSupplierToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Gagal menghapus pemasok");
    },
  });

  const suppliers = data?.data || [];
  const pagination = data?.meta || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };

  const columns: Column<any>[] = [
    {
      key: "name",
      header: "Kode & Nama",
      cell: (supplier) => (
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 h-14 w-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <Truck className="w-7 h-7" />
          </div>
          <div>
            <div className="text-base font-semibold text-foreground">
              {supplier.name}
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">
              {supplier.customerCode || supplier.code || "-"}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Kontak",
      cell: (supplier) => (
        <div className="text-sm text-muted-foreground max-w-md truncate">
          {supplier.phone || "-"}
          {supplier.email && <div className="text-xs">{supplier.email}</div>}
        </div>
      ),
    },
    {
      key: "address",
      header: "Alamat",
      cell: (supplier) => (
        <div className="text-sm text-muted-foreground max-w-md truncate">
          {supplier.address || "-"}
          {(supplier.city || supplier.province) && (
            <div className="text-xs text-muted-foreground mt-1">
              {[supplier.city, supplier.province].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      cell: (supplier) => (
        <span
          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            supplier.isActive
              ? "bg-green-100 text-green-800 border-green-200"
              : "bg-gray-100 text-gray-800 border-gray-200"
          }`}
        >
          {supplier.isActive ? "Aktif" : "Tidak Aktif"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Tanggal Dibuat",
      cell: (supplier) => (
        <div className="text-sm text-muted-foreground">
          {supplier.createdAt
            ? new Date(supplier.createdAt).toLocaleDateString("id-ID", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "-"}
        </div>
      ),
    },
  ];

  const activeCount = suppliers.filter((s: any) => s.isActive).length;

  return (
    <div className="w-full space-y-3">
      <PageHeader title="Manajemen Pemasok" subtitle="Kelola data pemasok dan vendor">
        <Link to="/suppliers/new">
          <Button className="flex items-center gap-2 bg-white text-primary-600 hover:bg-primary-50">
            <Plus className="w-5 h-5" />
            <span>Tambah Pemasok</span>
          </Button>
        </Link>
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
          icon={<Truck className="w-6 h-6 text-white" />}
          iconBg="from-primary-500 to-primary-600"
          label="Total Pemasok"
          value={isLoading ? "-" : pagination.total}
          subtitle="Semua pemasok terdaftar"
        />
        <StatCard
          icon={<Truck className="w-6 h-6 text-white" />}
          iconBg="from-blue-500 to-blue-600"
          label="Total Terisi"
          value={isLoading ? "-" : suppliers.length}
          subtitle="Pemasok pada halaman ini"
        />
        <StatCard
          icon={<Truck className="w-6 h-6 text-white" />}
          iconBg="from-green-500 to-green-600"
          label="Pemasok Aktif"
          value={isLoading ? "-" : activeCount}
          badge={{ text: "Active", className: "bg-green-100 text-green-800" }}
        />
      </div>

      <SearchFilter
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama pemasok, kontak, atau alamat..."
      />

      <DataTable
        columns={columns}
        data={suppliers}
        keyExtractor={(s: any) => s.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada pemasok ditemukan"
        emptyIcon={<Truck className="w-16 h-16" />}
        actions={(supplier: any) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/suppliers/${supplier.id}`)}
              title="Lihat Detail"
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/suppliers/${supplier.id}/edit`)}
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              onClick={() => {
                setSupplierToDelete({ id: supplier.id, name: supplier.name });
                setDeleteModalOpen(true);
              }}
              title="Hapus"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      />

      {!isLoading && suppliers.length > 0 && (
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Menampilkan{" "}
              <span className="font-bold text-foreground">
                {suppliers.length}
              </span>{" "}
              dari{" "}
              <span className="font-bold text-foreground">
                {pagination.total}
              </span>{" "}
              pemasok
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

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSupplierToDelete(null);
        }}
        title="Konfirmasi Hapus"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-red-100 rounded-full">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-2">
                Apakah Anda yakin ingin menghapus pemasok{" "}
                <strong>{supplierToDelete?.name}</strong>?
              </p>
              <p className="text-xs text-muted-foreground">
                Tindakan ini akan melakukan soft delete. Data pemasok tidak akan
                muncul di daftar, tetapi masih tersimpan di database.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModalOpen(false);
                setSupplierToDelete(null);
              }}
              disabled={deleteMutation.isPending}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              variant="default"
              onClick={() => {
                if (supplierToDelete) {
                  deleteMutation.mutate(supplierToDelete.id);
                }
              }}
              disabled={deleteMutation.isPending}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                "Hapus"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
