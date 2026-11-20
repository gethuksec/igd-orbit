import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, MapPin, AlertTriangle } from "lucide-react";
import { workingLocationsService, type WorkingLocation } from "@/services/working-locations.service";
import { api } from "@/services/api";
import { BreadcrumbHeader, StatCard, FilterToolbar, DataTable, StatusDot } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type StatusFilter = "all" | "active" | "inactive";

interface FormData {
  code: string;
  name: string;
  address: string;
  branchId: string;
  latitude: string;
  longitude: string;
  radiusM: string;
  isActive: boolean;
}

const defaultForm: FormData = {
  code: "",
  name: "",
  address: "",
  branchId: "",
  latitude: "",
  longitude: "",
  radiusM: "100",
  isActive: true,
};

export default function WorkingLocationList() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const limit = 20;

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkingLocation | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultForm);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data: branches } = useQuery({
    queryKey: ["branches-options"],
    queryFn: async () => {
      const res = await api.get("/branches");
      const body = res.data;
      return ((body?.data ?? body ?? []) as { id: string; code: string; name: string }[]);
    },
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["working-locations", page, searchTerm, statusFilter],
    queryFn: () => workingLocationsService.getAll({ page, limit, search: searchTerm || undefined }),
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

  const allRows = data?.data || [];
  const rows =
    statusFilter === "all"
      ? allRows
      : allRows.filter((d) => (statusFilter === "active" ? d.isActive : !d.isActive));
  const total = data?.meta?.total ?? data?.total ?? rows.length;
  const activeCount = allRows.filter((d) => d.isActive).length;
  const linkedCount = allRows.filter((d) => d.branchId).length;

  const saveMutation = useMutation({
    mutationFn: (payload: any) => {
      if (editing) return api.put(`/working-locations/${editing.id}`, payload);
      return api.post("/working-locations", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["working-locations"] });
      toast.success(editing ? "Lokasi berhasil diupdate" : "Lokasi berhasil ditambahkan");
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

  const openEditModal = (row: WorkingLocation) => {
    setEditing(row);
    setFormData({
      code: row.code || "",
      name: row.name || "",
      address: row.address || "",
      branchId: row.branchId || "",
      latitude: row.latitude?.toString() ?? "",
      longitude: row.longitude?.toString() ?? "",
      radiusM: row.radiusM?.toString() ?? "100",
      isActive: row.isActive ?? true,
    });
    setFormModalOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/working-locations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["working-locations"] });
      toast.success("Lokasi berhasil dinonaktifkan");
      setDeleteModalOpen(false);
      setToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Gagal menonaktifkan lokasi");
    },
  });

  const columns: Column<WorkingLocation>[] = [
    {
      key: "code",
      header: "Kode",
      cell: (row) => <div className="text-sm font-medium tabular-nums font-mono">{row.code}</div>,
    },
    {
      key: "name",
      header: "Nama",
      cell: (row) => (
        <div>
          <div className="text-sm font-semibold">{row.name}</div>
          <div className="text-xs text-muted-foreground mt-1">{row.address || "-"}</div>
        </div>
      ),
    },
    {
      key: "branch",
      header: "Link Branch",
      cell: (row) => <span className="text-sm font-mono">{row.branch?.code || "-"}</span>,
    },
    {
      key: "coords",
      header: "Koordinat / Radius",
      cell: (row) => (
        <div className="text-xs font-mono">
          {row.latitude ?? "-"}, {row.longitude ?? "-"} · r={row.radiusM} m
        </div>
      ),
    },
    {
      key: "contracts",
      header: "Kontrak",
      cell: (row) => <span>{row._count?.contracts ?? "-"}</span>,
    },
    {
      key: "isActive",
      header: "Status",
      cell: (row) => (
        <StatusDot tone={row.isActive ? "ok" : "off"}>
          {row.isActive ? "Aktif" : "Tidak Aktif"}
        </StatusDot>
      ),
    },
  ];

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Working Location" subtitle="Lokasi kerja — kantor HQ dan situs non-outlet">
        <Button onClick={openCreateModal} className="flex items-center gap-2 bg-white text-primary-600 border border-gray-200 hover:bg-primary-50">
          <Plus className="w-5 h-5" />
          <span>Tambah Lokasi</span>
        </Button>
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || "Terjadi kesalahan"}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          icon={<MapPin className="h-5 w-5" />}
          label="Total Lokasi"
          value={isLoading ? "-" : total}
        />
        <StatCard
          icon={<MapPin className="h-5 w-5" />}
          label="Aktif"
          value={isLoading ? "-" : activeCount}
        />
        <StatCard
          icon={<MapPin className="h-5 w-5" />}
          label="Terhubung Outlet"
          value={isLoading ? "-" : linkedCount}
        />
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari kode / nama lokasi..."
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
          if (key === "status") setStatusFilter((v || "all") as StatusFilter);
          setPage(1);
        }}
        onReset={() => {
          setStatusFilter("all");
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={(t: WorkingLocation) => t.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada lokasi ditemukan"
        emptyIcon={<MapPin className="w-16 h-16" />}
        actions={(row: WorkingLocation) => (
          <div className="flex items-center justify-end gap-1">
            <button type="button" onClick={() => openEditModal(row)} title="Edit" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Edit className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Nonaktifkan"
              onClick={() => {
                setToDelete({ id: row.id, name: row.name });
                setDeleteModalOpen(true);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      />

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Lokasi" : "Tambah Lokasi"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!formData.name) {
                toast.error("Nama wajib diisi");
                return;
              }
              saveMutation.mutate({
                ...(editing ? {} : formData.code ? { code: formData.code } : {}),
                name: formData.name,
                address: formData.address || undefined,
                branchId: formData.branchId || undefined,
                latitude: formData.latitude === "" ? undefined : Number(formData.latitude),
                longitude: formData.longitude === "" ? undefined : Number(formData.longitude),
                radiusM: formData.radiusM === "" ? undefined : Number(formData.radiusM),
                isActive: formData.isActive,
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Kode</label>
                <input
                  value={formData.code}
                  disabled={!!editing}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Otomatis bila kosong"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama</label>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Alamat</label>
              <input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Link Branch</label>
              <select
                value={formData.branchId}
                onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
              >
                <option value="">— Tidak ada —</option>
                {(branches || []).map((b) => (
                  <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Latitude</label>
                <input
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Longitude</label>
                <input
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Radius (m)</label>
                <input
                  value={formData.radiusM}
                  onChange={(e) => setFormData({ ...formData, radiusM: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saveMutation.isPending} className="flex-1">
                {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => setFormModalOpen(false)}>
                Batal
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nonaktifkan Lokasi</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Nonaktifkan <b>{toDelete?.name}</b>? Riwayat kontrak yang menunjuk lokasi ini tetap tersimpan.
            </p>
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
              onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
            >
              {deleteMutation.isPending ? "Memproses..." : "Nonaktifkan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
