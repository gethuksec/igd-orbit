import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BreadcrumbHeader, FilterToolbar, StatusDot } from "@/components/shared";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Department {
  id: string;
  code: string;
  name: string;
  description?: string;
  level?: number;
  parentDepartmentId?: string | null;
  isActive: boolean;
  parentDepartment?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  _count?: { employees: number };
}

interface FormData {
  code: string;
  name: string;
  parentDepartmentId: string | undefined;
  isActive: boolean;
}

const defaultForm: FormData = {
  code: "",
  name: "",
  parentDepartmentId: "",
  isActive: true,
};

export default function DepartmentList() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["departments-list", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await api.get("/departments?" + params.toString());
      return res.data as {
        data: Department[];
        meta: { page: number; limit: number; total: number; totalPages: number };
      };
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.post("/departments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments-list"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Departemen berhasil dibuat");
      closeModal();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Gagal membuat departemen"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<FormData, 'parentDepartmentId'> & { parentDepartmentId?: string } }) => api.put("/departments/" + id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments-list"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Departemen berhasil diupdate");
      closeModal();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Gagal mengupdate departemen"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete("/departments/" + id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments-list"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Departemen berhasil dinonaktifkan");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Gagal menghapus departemen"),
  });

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(defaultForm);
  };

  const openCreate = () => {
    setForm(defaultForm);
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setForm({
      code: dept.code,
      name: dept.name,
      parentDepartmentId: dept.parentDepartment?.id || (dept as any).parentDepartmentId || '',
      isActive: dept.isActive,
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      code: form.code,
      name: form.name,
      parentDepartmentId: form.parentDepartmentId || undefined,
      isActive: form.isActive,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload as any);
    }
  };

  return (
    <div className="space-y-6">
      <BreadcrumbHeader title="Departemen" subtitle="Kelola departemen organisasi">
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Tambah Departemen
        </Button>
      </BreadcrumbHeader>

      {/* Toolbar: search inline + filter popup (IGDERP-110) */}
      <FilterToolbar
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Cari departemen..."
        fields={[]}
        values={{}}
        onFieldChange={() => {}}
        onReset={() => {}}
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Kode</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Nama</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Level</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Induk</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Cabang</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Jml Karyawan</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.data?.map((dept) => (
              <tr key={dept.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 text-sm font-mono text-gray-500">{dept.code}</td>
              <td className="px-6 py-4 text-sm font-medium text-gray-900">{dept.name}</td>
              <td className="px-6 py-4 text-sm text-center">
                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                  L{dept.level ?? 1}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">{dept.parentDepartment?.name || "—"}</td>
              <td className="px-6 py-4 text-sm text-gray-500">{dept.branch?.name || "-"}</td>
                  <td className="px-6 py-4 text-sm text-center text-gray-500">{dept._count?.employees || 0}</td>
                  <td className="px-6 py-4 text-center">
                    <StatusDot tone={dept.isActive ? "ok" : "off"}>
                      {dept.isActive ? "Aktif" : "Nonaktif"}
                    </StatusDot>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => openEdit(dept)} title="Edit" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (confirm("Nonaktifkan departemen ini?")) deleteMutation.mutate(dept.id); }}
                        title="Nonaktifkan"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!data?.data || data.data.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Belum ada data departemen
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <span className="px-4 py-2 text-sm text-gray-600">{data.meta.page} / {data.meta.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      <Dialog open={showModal} onOpenChange={(o) => { if (!o) closeModal(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Departemen" : "Tambah Departemen"}</DialogTitle>
          </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Kode Departemen *</label>
            <input
              type="text"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono"
              placeholder="Contoh: FIN, SALES, TECH"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nama Departemen *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Contoh: Sales & Marketing, Finance"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Induk (Opsional)</label>
            <select
              value={form.parentDepartmentId ?? ""}
              onChange={(e) => setForm({ ...form, parentDepartmentId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Tanpa induk (level 1)</option>
              {(data?.data || []).filter((d: Department) => !editing || d.id !== editing.id).map((d: Department) => (
                <option key={d.id} value={d.id}>{d.name} (L{d.level ?? 1})</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Level anak = induk + 1 (level 0 dicadangkan).</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded border-gray-300"
            />
            <label htmlFor="isActive" className="text-sm">Aktif</label>
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
    </div>
  );
}
