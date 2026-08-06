import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Warehouse as WarehouseIcon, MapPin, Save, Loader2, AlertTriangle, Edit, Trash2, Building2 } from "lucide-react";
import { warehousesService } from "../../services/warehouses.service";
import { branchesService } from "../../services/branches.service";
import { PageHeader, StatCard, SearchFilter, DataTable } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type StatusFilter = "all" | "active" | "inactive";

interface WarehouseFormData {
  name: string;
  code: string;
  outletId: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  contactPerson: string;
  mobilePhone: string;
  isActive: boolean;
}

const defaultForm: WarehouseFormData = {
  name: "",
  code: "",
  outletId: "",
  city: "",
  address: "",
  phone: "",
  email: "",
  contactPerson: "",
  mobilePhone: "",
  isActive: true,
};

export default function WarehouseList() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const limit = 20;

  // Modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<any>(null);
  const [formData, setFormData] = useState<WarehouseFormData>({ ...defaultForm });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [warehouseToDelete, setWarehouseToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["warehouses", page, searchTerm, statusFilter],
    queryFn: () =>
      warehousesService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      }),
  });

  // Active outlets (branches) for the dropdown
  const { data: outletsData } = useQuery({
    queryKey: ["branches-active"],
    queryFn: () => branchesService.getAll({ status: "active", limit: 100 }),
  });
  const outlets = outletsData?.data || [];

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

  const warehouses = data?.data || [];
  const pagination = data?.meta || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      const submitData = { ...data };
      if (submitData.code === "") delete submitData.code; // auto-generate
      if (editingWarehouse) {
        return warehousesService.update(editingWarehouse.id, submitData);
      }
      return warehousesService.create(submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["pos-warehouses"] });
      toast.success(editingWarehouse ? "Gudang berhasil diupdate" : "Gudang berhasil ditambahkan");
      closeFormModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Terjadi kesalahan");
    },
  });

  const closeFormModal = () => {
    setFormModalOpen(false);
    setEditingWarehouse(null);
    setFormData({ ...defaultForm });
  };

  const openCreateModal = () => {
    setFormData({ ...defaultForm });
    // Default outlet = first active branch
    if (outlets.length === 1) {
      setFormData((prev) => ({ ...prev, outletId: outlets[0].id }));
    }
    setEditingWarehouse(null);
    setFormModalOpen(true);
  };

  const openEditModal = (warehouse: any) => {
    setEditingWarehouse(warehouse);
    setFormData({
      name: warehouse.name || "",
      code: warehouse.code || "",
      outletId: warehouse.outletId || "",
      city: warehouse.city || "",
      address: warehouse.address || "",
      phone: warehouse.phone || "",
      email: warehouse.email || "",
      contactPerson: warehouse.contactPerson || "",
      mobilePhone: warehouse.mobilePhone || "",
      isActive: warehouse.isActive !== false,
    });
    setFormModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => warehousesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["pos-warehouses"] });
      toast.success("Gudang berhasil dihapus");
      setDeleteModalOpen(false);
      setWarehouseToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Gagal menghapus gudang");
    },
  });

  const columns: Column<any>[] = [
    {
      key: "name",
      header: "Gudang",
      cell: (wh) => (
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 h-14 w-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <WarehouseIcon className="w-7 h-7" />
          </div>
          <div>
            <div className="text-base font-semibold text-foreground">
              {wh.name}
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">
              {wh.code || "-"}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "outlet",
      header: "Outlet",
      cell: (wh) => (
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <span>{wh.outlet?.name || "-"}</span>
          {wh.outlet?.code && (
            <span className="text-xs text-muted-foreground font-mono">({wh.outlet.code})</span>
          )}
        </div>
      ),
    },
    {
      key: "city",
      header: "Kota",
      cell: (wh) => (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4" />
          {wh.city || "-"}
        </div>
      ),
    },
    {
      key: "contactPerson",
      header: "Contact Person",
      cell: (wh) => (
        <div className="text-sm text-foreground">
          <div>{wh.contactPerson || "-"}</div>
          {wh.mobilePhone && (
            <div className="text-xs text-muted-foreground mt-0.5">{wh.mobilePhone}</div>
          )}
        </div>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      cell: (wh) => (
        <span
          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            wh.isActive
              ? "bg-green-100 text-green-800 border-green-200"
              : "bg-gray-100 text-gray-800 border-gray-200"
          }`}
        >
          {wh.isActive ? "Aktif" : "Tidak Aktif"}
        </span>
      ),
    },
  ];

  const activeCount = warehouses.filter((w: any) => w.isActive).length;
  const outletCount = new Set(warehouses.map((w: any) => w.outletId)).size;

  const statusBtns: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "Semua" },
    { key: "active", label: "Aktif" },
    { key: "inactive", label: "Tidak Aktif" },
  ];

  const inputCls =
    "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent";

  return (
    <div className="w-full space-y-3">
      <PageHeader title="Manajemen Gudang" subtitle="Kelola gudang per outlet">
        <Button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-white text-primary-600 hover:bg-primary-50"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Gudang</span>
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
          icon={<WarehouseIcon className="w-6 h-6 text-white" />}
          iconBg="from-primary-500 to-primary-600"
          label="Total Gudang"
          value={isLoading ? "-" : pagination.total}
          subtitle="Semua gudang terdaftar"
        />
        <StatCard
          icon={<Building2 className="w-6 h-6 text-white" />}
          iconBg="from-blue-500 to-blue-600"
          label="Total Outlet"
          value={isLoading ? "-" : outletCount}
          subtitle="Outlet pemilik gudang"
        />
        <StatCard
          icon={<WarehouseIcon className="w-6 h-6 text-white" />}
          iconBg="from-green-500 to-green-600"
          label="Gudang Aktif"
          value={isLoading ? "-" : activeCount}
          badge={{ text: "Active", className: "bg-green-100 text-green-800" }}
        />
      </div>

      <SearchFilter
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama gudang, kode, kota..."
      />

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">Status:</span>
        <div className="flex gap-1">
          {statusBtns.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setStatusFilter(btn.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === btn.key
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={warehouses}
        keyExtractor={(w: any) => w.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada gudang ditemukan"
        emptyIcon={<WarehouseIcon className="w-16 h-16" />}
        actions={(wh: any) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditModal(wh)}
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              title="Hapus"
              onClick={() => {
                setWarehouseToDelete({ id: wh.id, name: wh.name });
                setDeleteModalOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      />

      {!isLoading && warehouses.length > 0 && (
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Menampilkan{" "}
              <span className="font-bold text-foreground">
                {warehouses.length}
              </span>{" "}
              dari{" "}
              <span className="font-bold text-foreground">
                {pagination.total}
              </span>{" "}
              gudang
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
          if (!open) closeFormModal();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingWarehouse ? "Edit Gudang" : "Tambah Gudang"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Gudang <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputCls}
                placeholder="Nama gudang"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kode
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className={inputCls}
                placeholder="Kosongkan untuk otomatis (WH-XXXXXXXX)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Outlet <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.outletId}
                onChange={(e) => setFormData({ ...formData, outletId: e.target.value })}
                className={inputCls}
              >
                <option value="">Pilih outlet...</option>
                {outlets.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kota</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className={inputCls}
                  placeholder="Kota"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telepon</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={inputCls}
                  placeholder="Telepon"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                className={inputCls}
                placeholder="Alamat gudang (opsional)"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={inputCls}
                  placeholder="Email (opsional)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className={inputCls}
                  placeholder="Nama contact person"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No. HP</label>
              <input
                type="text"
                value={formData.mobilePhone}
                onChange={(e) => setFormData({ ...formData, mobilePhone: e.target.value })}
                className={inputCls}
                placeholder="No. HP contact person"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.isActive ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-600">
                  {formData.isActive ? "Aktif" : "Tidak Aktif"}
                </span>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeFormModal}
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteModalOpen(false);
            setWarehouseToDelete(null);
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
                  Apakah Anda yakin ingin menghapus gudang <strong>{warehouseToDelete?.name}</strong>?
                </p>
                <p className="text-xs text-gray-500">
                  Tindakan ini akan melakukan soft delete. Data tidak akan muncul di daftar, tetapi masih tersimpan di database.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setWarehouseToDelete(null);
                }}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (warehouseToDelete) deleteMutation.mutate(warehouseToDelete.id);
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
