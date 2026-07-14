import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Eye, Edit, Trash2, Save, Loader2, Ruler } from "lucide-react";
import { unitsService } from "../../services/units.service";
import { api } from "../../services/api";
import { PageHeader } from "@/components/shared";
import { StatCard } from "@/components/shared";
import { SearchFilter } from "@/components/shared";
import { DataTable } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";

type StatusFilter = "all" | "active" | "inactive";

export default function UnitList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const limit = 20;

  // Modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [formName, setFormName] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["units", page, searchTerm, statusFilter],
    queryFn: () =>
      unitsService.getAll({
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

  const units = data?.data || [];
  const pagination = data?.meta || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingUnit) {
        return api.put(`/units/${editingUnit.id}`, data);
      }
      return api.post("/units", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      toast.success(editingUnit ? "Satuan berhasil diupdate" : "Satuan berhasil ditambahkan");
      setFormModalOpen(false);
      setEditingUnit(null);
      setFormName("");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Terjadi kesalahan");
    },
  });

  const openCreateModal = () => {
    setEditingUnit(null);
    setFormName("");
    setFormModalOpen(true);
  };

  const openEditModal = (unit: any) => {
    setEditingUnit(unit);
    setFormName(unit.name || "");
    setFormModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ name: formName });
  };

  const activeCount = units.filter((u: any) => u.isActive).length;

  const columns: Column<any>[] = [
    {
      key: "name",
      header: "Satuan",
      cell: (unit) => (
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 h-14 w-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <Ruler className="w-7 h-7" />
          </div>
          <div>
            <div className="text-base font-semibold text-foreground">{unit.name}</div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">{unit.code || "-"}</div>
          </div>
        </div>
      ),
    },
    {
      key: "productCount",
      header: "Produk",
      cell: (unit) => (
        <div className="text-sm font-semibold text-foreground">{unit.productCount || 0}</div>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      cell: (unit) => (
        <span
          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            unit.isActive
              ? "bg-green-100 text-green-800 border-green-200"
              : "bg-gray-100 text-gray-800 border-gray-200"
          }`}
        >
          {unit.isActive ? "Aktif" : "Tidak Aktif"}
        </span>
      ),
    },
  ];

  const statusBtns: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "Semua" },
    { key: "active", label: "Aktif" },
    { key: "inactive", label: "Tidak Aktif" },
  ];

  return (
    <div className="w-full space-y-3">
      <PageHeader title="Manajemen Satuan" subtitle="Kelola satuan produk">
        <Button onClick={openCreateModal} className="flex items-center gap-2 bg-white text-primary-600 hover:bg-primary-50">
          <Plus className="w-5 h-5" />
          <span>Tambah Satuan</span>
        </Button>
      </PageHeader>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || "Terjadi kesalahan"}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard icon={<Ruler className="w-6 h-6 text-white" />} iconBg="from-blue-500 to-blue-600" label="Total Satuan" value={isLoading ? "-" : pagination.total} subtitle="Semua satuan terdaftar" />
        <StatCard icon={<Ruler className="w-6 h-6 text-white" />} iconBg="from-indigo-500 to-indigo-600" label="Total Terisi" value={isLoading ? "-" : units.length} subtitle="Satuan pada halaman ini" />
        <StatCard icon={<Ruler className="w-6 h-6 text-white" />} iconBg="from-green-500 to-green-600" label="Satuan Aktif" value={isLoading ? "-" : activeCount} badge={{ text: "Active", className: "bg-green-100 text-green-800" }} />
      </div>

      <SearchFilter searchValue={searchTerm} onSearchChange={setSearchTerm} searchPlaceholder="Cari nama satuan..." />

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
        data={units}
        keyExtractor={(u: any) => u.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada satuan ditemukan"
        emptyIcon={<Ruler className="w-16 h-16" />}
        actions={(unit: any) => (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/units/${unit.id}`)} title="Lihat Detail"><Eye className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => openEditModal(unit)} title="Edit"><Edit className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" title="Hapus"><Trash2 className="w-4 h-4" /></Button>
          </div>
        )}
      />

      {!isLoading && units.length > 0 && (
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Menampilkan <span className="font-bold text-foreground">{units.length}</span> dari <span className="font-bold text-foreground">{pagination.total}</span> satuan
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
      <Modal
        open={formModalOpen}
        onClose={() => { setFormModalOpen(false); setEditingUnit(null); setFormName(""); }}
        title={editingUnit ? "Edit Satuan" : "Tambah Satuan"}
        size="md"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Satuan <span className="text-red-500">*</span>
            </label>
            <input
              type="text" required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Nama satuan"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setFormModalOpen(false); setEditingUnit(null); setFormName(""); }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
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
      </Modal>
    </div>
  );
}
