import { useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Truck, Eye, Edit, Trash2, Loader2, RefreshCw } from "lucide-react";
import { suppliersService } from "../../services/suppliers.service";
import { BreadcrumbHeader, StatCard, FilterToolbar, DataTable, StatusDot } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCurrency, formatNumber, formatDate } from "@/utils/format";
import { generateCode10 } from "@/utils/generateCode";

type StatusFilter = "all" | "active" | "inactive";

interface SimpleFormData {
  customerCode: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
}

const defaultForm: SimpleFormData = {
  customerCode: "",
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
};

// Headline order (IGDERP-312): Aksi, Kode, Nama, Telepon, Alamat, Hutang, Piutang, Log
export default function SupplierList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const limit = 20;
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [form, setForm] = useState<SimpleFormData>(defaultForm);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["suppliers", page, searchTerm, statusFilter],
    queryFn: () =>
      suppliersService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
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

  const createMutation = useMutation({
    mutationFn: (data: any) => suppliersService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Pemasok berhasil ditambahkan");
      closeFormModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Gagal menambahkan pemasok");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => suppliersService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Pemasok berhasil diupdate");
      closeFormModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Gagal mengupdate pemasok");
    },
  });

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

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingSupplier(null);
    setForm(defaultForm);
  };

  const openCreateModal = () => {
    setEditingSupplier(null);
    setForm({ ...defaultForm, customerCode: generateCode10() });
    setShowFormModal(true);
  };

  const openEditModal = (supplier: any) => {
    setEditingSupplier(supplier);
    setForm({
      customerCode: supplier.customerCode || supplier.code || "",
      name: supplier.name || "",
      contactPerson: supplier.contactPerson || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
    });
    setShowFormModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData: any = {
      customerType: "wholesale",
      name: form.name,
      phone: form.phone,
      contactPerson: form.contactPerson || undefined,
      email: form.email || undefined,
    };
    // Kode only on create — auto 10-char, editable/regenerable; immutable after that
    if (!editingSupplier && form.customerCode.trim()) {
      submitData.customerCode = form.customerCode.trim().toUpperCase();
    }
    if (editingSupplier) {
      updateMutation.mutate({ id: editingSupplier.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const rowActions = (supplier: any) => (
    <div className="flex items-center gap-2">
      <Link
        to={`/suppliers/${supplier.id}`}
        title="Lihat Detail"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Eye className="h-4 w-4" />
      </Link>
      <button
        type="button"
        onClick={() => openEditModal(supplier)}
        title="Edit Cepat"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Edit className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          setSupplierToDelete({ id: supplier.id, name: supplier.name });
          setDeleteModalOpen(true);
        }}
        title="Hapus"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  const suppliers = data?.data || [];
  const pagination = data?.meta || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };

  const columns: Column<any>[] = [
    {
      key: "code",
      header: "Kode",
      cell: (supplier) => (
        <div className="text-sm font-mono text-foreground whitespace-nowrap">
          {supplier.customerCode || supplier.code || "-"}
        </div>
      ),
    },
    {
      key: "name",
      stickyLeft: true,
      header: "Nama",
      cell: (supplier) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[15px] font-medium text-foreground whitespace-nowrap">
              {supplier.name}
            </div>
            {supplier.contactPerson && (
              <div className="text-xs text-muted-foreground mt-1">
                {supplier.contactPerson}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Telepon",
      cell: (supplier) => (
        <div className="text-sm text-muted-foreground whitespace-nowrap">
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
      key: "hutang",
      header: "Hutang",
      cell: (supplier) => (
        <div className="text-sm font-medium tabular-nums text-foreground whitespace-nowrap">
          {formatCurrency(Number(supplier.totalHutang ?? 0))}
        </div>
      ),
    },
    {
      key: "piutang",
      header: "Piutang",
      cell: (supplier) => (
        <div className="text-sm font-medium tabular-nums text-foreground whitespace-nowrap">
          {formatCurrency(Number(supplier.totalPiutang ?? 0))}
        </div>
      ),
    },
    {
      key: "log",
      header: "Log",
      cell: (supplier) => (
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          <div>
            {supplier.createdAt
              ? formatDate(supplier.createdAt, "dd MMM yyyy")
              : "-"}
          </div>
          {supplier.updatedAt && supplier.updatedAt !== supplier.createdAt && (
            <div className="text-xs">
              Ubah {formatDate(supplier.updatedAt, "dd MMM yyyy")}
            </div>
          )}
        </div>
      ),
    },
  ];

  const totalHutangPage = suppliers.reduce(
    (sum: number, s: any) => sum + Number(s.totalHutang ?? 0),
    0
  );
  const totalStokTerhutangPage = suppliers.reduce(
    (sum: number, s: any) => sum + Number(s.stokTerhutang ?? 0),
    0
  );

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Manajemen Pemasok" subtitle="Kelola data pemasok dan vendor">
        <Button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 border border-gray-200 dark:border-gray-700 hover:bg-primary-50 dark:hover:bg-primary-950"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Pemasok</span>
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
          icon={<Truck className="h-5 w-5" />}
          label="Total Pemasok"
          value={isLoading ? "-" : pagination.total}
          subtitle="Semua pemasok terdaftar"
        />
        <StatCard
          icon={<Truck className="h-5 w-5" />}
          label="Total Hutang"
          value={isLoading ? "-" : formatCurrency(totalHutangPage)}
          subtitle="PO terbuka pada halaman ini"
        />
        <StatCard
          icon={<Truck className="h-5 w-5" />}
          label="Total Stok Terhutang"
          value={isLoading ? "-" : formatNumber(totalStokTerhutangPage)}
          subtitle="Qty belum diterima halaman ini"
        />
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari pemasok, kode, kontak, alamat..."
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
        actions={rowActions}
        columns={columns}
        data={suppliers}
        keyExtractor={(s: any) => s.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada pemasok ditemukan"
        emptyIcon={<Truck className="w-16 h-16" />}
      />

      {!isLoading && suppliers.length > 0 && (
        <div className="border bg-muted px-4 py-3 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Menampilkan{" "}
              <span className="font-medium tabular-nums text-foreground">
                {suppliers.length}
              </span>{" "}
              dari{" "}
              <span className="font-medium tabular-nums text-foreground">
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

      {/* Form Modal */}
      <Dialog
        open={showFormModal}
        onOpenChange={(open) => {
          if (!open) closeFormModal();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Edit Pemasok" : "Tambah Pemasok"}</DialogTitle>
          </DialogHeader>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Kode Pemasok
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={form.customerCode}
                onChange={(e) => setForm({ ...form, customerCode: e.target.value.toUpperCase() })}
                placeholder="Auto 10 karakter"
                className="font-mono"
                maxLength={10}
                disabled={!!editingSupplier}
              />
              {!editingSupplier && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Generate kode"
                  onClick={() => setForm({ ...form, customerCode: generateCode10() })}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {editingSupplier
                ? "Kode tidak dapat diubah setelah dibuat"
                : "10 karakter huruf + angka, dibuat otomatis"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Nama Pemasok <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <Input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Masukkan nama pemasok"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Contact Person
            </label>
            <Input
              type="text"
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              placeholder="Masukkan nama contact person"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Telepon <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <Input
              type="tel"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="08xx-xxxx-xxxx"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              <span className="inline-flex items-center gap-1.5">
                Status
                <StatusDot tone={editingSupplier ? (editingSupplier.isActive ? "ok" : "off") : "ok"} />
              </span>
            </label>
            <p className="text-xs text-muted-foreground">
              {editingSupplier
                ? (editingSupplier.isActive ? "Pemasok aktif" : "Pemasok tidak aktif")
                : "Pemasok baru selalu dibuat aktif"}
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeFormModal}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Menyimpan..."
                : "Simpan"}
            </Button>
          </div>
        </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteModalOpen(false);
            setSupplierToDelete(null);
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
