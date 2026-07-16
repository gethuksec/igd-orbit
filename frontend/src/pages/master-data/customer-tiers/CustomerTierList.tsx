import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Medal, Eye, Edit, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { customerTiersService } from "../../../services/customer-tiers.service";
import type { CustomerTier } from "../../../services/customer-tiers.service";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared";
import { StatCard } from "@/components/shared";
import { SearchFilter } from "@/components/shared";
import { DataTable } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type StatusFilter = "all" | "active" | "inactive";

interface FormData {
  name: string;
  description: string;
  discountPercentage: string;
  level: string;
  isActive: boolean;
}

const defaultForm: FormData = {
  name: "",
  description: "",
  discountPercentage: "0",
  level: "0",
  isActive: true,
};

export default function CustomerTierList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const limit = 20;
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CustomerTier | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tierToDelete, setTierToDelete] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["customer-tiers", page, searchTerm, statusFilter],
    queryFn: () =>
      customerTiersService.getAll({
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

  const createMutation = useMutation({
    mutationFn: (data: FormData) => customerTiersService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-tiers"] });
      toast.success("Tier berhasil dibuat");
      closeModal();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Gagal membuat tier"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) => customerTiersService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-tiers"] });
      toast.success("Tier berhasil diupdate");
      closeModal();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Gagal mengupdate tier"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customerTiersService.delete(id),
    onSuccess: () => {
      toast.success("Tier berhasil dihapus");
      setDeleteModalOpen(false);
      setTierToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["customer-tiers"] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Gagal menghapus tier"),
  });

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(defaultForm);
  };

  const openEdit = (tier: CustomerTier) => {
    setEditing(tier);
    setForm({
      name: tier.name,
      description: tier.description || "",
      discountPercentage: String(tier.discountPercentage),
      level: String(tier.level),
      isActive: tier.isActive,
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const tiers = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const activeCount = tiers.filter((t: CustomerTier) => t.isActive).length;
  const avgDiscount = tiers.length
    ? Math.round(tiers.reduce((sum: number, t: CustomerTier) => sum + t.discountPercentage, 0) / tiers.length)
    : 0;

  const statusBtns: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "Semua" },
    { key: "active", label: "Aktif" },
    { key: "inactive", label: "Tidak Aktif" },
  ];

  const columns: Column<CustomerTier>[] = [
    {
      key: "name",
      header: "Nama Tier",
      cell: (tier) => (
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 h-14 w-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <Medal className="w-7 h-7" />
          </div>
          <div>
            <div className="text-base font-semibold text-foreground">
              {tier.name}
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">
              {tier.code || "-"}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "level",
      header: "Level",
      cell: (tier) => (
        <div className="text-sm font-semibold text-foreground">{tier.level}</div>
      ),
    },
    {
      key: "discountPercentage",
      header: "Diskon",
      cell: (tier) => (
        <div className="text-sm font-semibold text-foreground">{tier.discountPercentage}%</div>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      cell: (tier) => (
        <span
          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            tier.isActive
              ? "bg-green-100 text-green-800 border-green-200"
              : "bg-gray-100 text-gray-800 border-gray-200"
          }`}
        >
          {tier.isActive ? "Aktif" : "Tidak Aktif"}
        </span>
      ),
    },
  ];

  return (
    <div className="w-full space-y-3">
      <PageHeader title="Manajemen Tier Pelanggan" subtitle="Kelola level tier pelanggan">
        <Button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-white text-primary-600 hover:bg-primary-50"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Tier</span>
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
          icon={<Medal className="w-6 h-6 text-white" />}
          iconBg="from-amber-500 to-orange-600"
          label="Total Tier Pelanggan"
          value={isLoading ? "-" : pagination.total}
          subtitle="Semua tier terdaftar"
        />
        <StatCard
          icon={<Medal className="w-6 h-6 text-white" />}
          iconBg="from-green-500 to-green-600"
          label="Rata-rata Diskon"
          value={isLoading ? "-" : `${avgDiscount}%`}
          subtitle="Dari semua tier"
        />
        <StatCard
          icon={<Medal className="w-6 h-6 text-white" />}
          iconBg="from-blue-500 to-blue-600"
          label="Tier Aktif"
          value={isLoading ? "-" : activeCount}
          badge={{ text: "Active", className: "bg-green-100 text-green-800" }}
        />
      </div>

      <SearchFilter
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama tier..."
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
        data={tiers}
        keyExtractor={(t: CustomerTier) => t.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada tier pelanggan ditemukan"
        emptyIcon={<Medal className="w-16 h-16" />}
        actions={(tier: CustomerTier) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/master-data/customer-tiers/${tier.id}`)}
              title="Lihat Detail"
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEdit(tier)}
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              title="Hapus"
              onClick={(e) => {
                e.stopPropagation();
                setTierToDelete({ id: tier.id, name: tier.name });
                setDeleteModalOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      />

      {!isLoading && tiers.length > 0 && (
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Menampilkan{" "}
              <span className="font-bold text-foreground">
                {tiers.length}
              </span>{" "}
              dari{" "}
              <span className="font-bold text-foreground">
                {pagination.total}
              </span>{" "}
              tier
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

      {/* Create/Edit Modal */}
      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Tier" : "Tambah Tier"}</DialogTitle>
          </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nama Tier *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Contoh: Silver, Gold, Platinum"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Deskripsi</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Level *</label>
              <input
                type="number"
                required
                min={0}
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Diskon (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.discountPercentage}
                onChange={(e) => setForm({ ...form, discountPercentage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, isActive: !prev.isActive }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm text-gray-600">{form.isActive ? 'Aktif' : 'Tidak Aktif'}</span>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={closeModal}>Batal</Button>
            <Button type="submit" className="flex-1" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Menyimpan..." : "Simpan"}
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
            setTierToDelete(null);
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
                Apakah Anda yakin ingin menghapus tier <strong>{tierToDelete?.name}</strong>?
              </p>
              <p className="text-xs text-gray-500">
                Tindakan ini akan menghapus tier pelanggan secara permanen.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setDeleteModalOpen(false);
                setTierToDelete(null);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              disabled={deleteMutation.isPending}
            >
              Batal
            </button>
            <button
              onClick={() => {
                if (tierToDelete) {
                  deleteMutation.mutate(tierToDelete.id);
                }
              }}
              disabled={deleteMutation.isPending}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menghapus...
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
