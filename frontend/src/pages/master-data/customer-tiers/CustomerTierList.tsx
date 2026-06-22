import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Loader2, Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

interface CustomerTier {
  id: string;
  code: string;
  name: string;
  description?: string;
  discountPercentage: number;
  level: number;
  isActive: boolean;
  createdAt: string;
}

interface FormData {
  name: string;
  description: string;
  discountPercentage: number;
  level: number;
  isActive: boolean;
}

const defaultForm: FormData = {
  name: "",
  description: "",
  discountPercentage: 0,
  level: 0,
  isActive: true,
};

export default function CustomerTierList() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CustomerTier | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["customer-tiers", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await api.get("/customer-tiers?" + params.toString());
      return res.data as {
        data: CustomerTier[];
        meta: { page: number; limit: number; total: number; totalPages: number };
      };
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.post("/customer-tiers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-tiers"] });
      toast.success("Tier berhasil dibuat");
      closeModal();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Gagal membuat tier"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) => api.put("/customer-tiers/" + id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-tiers"] });
      toast.success("Tier berhasil diupdate");
      closeModal();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Gagal mengupdate tier"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete("/customer-tiers/" + id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-tiers"] });
      toast.success("Tier berhasil dihapus");
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
      discountPercentage: tier.discountPercentage,
      level: tier.level,
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

  const getStatusClass = (active: boolean) => {
    return active
      ? "bg-green-100 text-green-700"
      : "bg-red-100 text-red-700";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Tiers</h1>
          <p className="text-sm text-gray-500">Kelola level tier pelanggan</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Tambah Tier
        </Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Cari tier..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

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
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Level</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Diskon</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.data.map((tier) => (
                <tr key={tier.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono text-gray-500">{tier.code}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{tier.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{tier.level}</td>
                  <td className="px-6 py-4 text-sm text-right">{tier.discountPercentage}%</td>
                  <td className="px-6 py-4 text-center">
                    <span className={"inline-flex px-2 py-1 text-xs font-medium rounded-full " + getStatusClass(tier.isActive)}>
                      {tier.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(tier)} className="p-1 hover:bg-gray-100 rounded">
                        <Pencil className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => { if (confirm("Hapus tier ini?")) deleteMutation.mutate(tier.id); }}
                        className="p-1 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!data?.data || data.data.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Belum ada data tier
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="px-4 py-2 text-sm text-gray-600">
            {data.meta.page} / {data.meta.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      <Modal open={showModal} onClose={closeModal} title={editing ? "Edit Tier" : "Tambah Tier"} size="md">
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
                onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) || 0 })}
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
                onChange={(e) => setForm({ ...form, discountPercentage: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
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
      </Modal>
    </div>
  );
}
