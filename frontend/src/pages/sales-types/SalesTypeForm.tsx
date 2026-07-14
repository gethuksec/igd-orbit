import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, X, Loader2, ArrowLeft, Tag } from "lucide-react";
import { api } from "../../services/api";
import { toast } from "sonner";

export default function SalesTypeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    name: "",
    isActive: true,
  });

  const { data: salesType, isLoading: loadingSalesType } = useQuery({
    queryKey: ["sales-type", id],
    queryFn: async () => {
      const res = await api.get(`/sales-types/${id}`);
      return res.data.data || res.data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (salesType) {
      setFormData({
        name: salesType.name || "",
        isActive: salesType.isActive !== false,
      });
    }
  }, [salesType]);

  const mutation = useMutation({
    mutationFn: (data: any) => {
      const submitData = { ...data };
      delete submitData.code;
      if (isEdit) {
        return api.put(`/sales-types/${id}`, submitData);
      }
      return api.post("/sales-types", submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-types"] });
      toast.success(isEdit ? "Tipe penjualan berhasil diupdate" : "Tipe penjualan berhasil ditambahkan");
      navigate("/sales-types");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Terjadi kesalahan");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (loadingSalesType) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/sales-types")}
              className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold mb-1">
                {isEdit ? "Edit Tipe Penjualan" : "Tambah Tipe Penjualan"}
              </h1>
              <p className="text-primary-100">
                {isEdit ? "Ubah informasi tipe penjualan" : "Tambahkan tipe penjualan baru"}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/sales-types")}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all"
          >
            <X className="w-4 h-4" />
            <span>Batal</span>
          </button>
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
              <Tag className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Informasi Tipe Penjualan</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Tipe Penjualan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Nama tipe penjualan"
              />
            </div>
            {isEdit && salesType?.code && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kode Tipe Penjualan
                </label>
                <input
                  type="text"
                  value={salesType.code}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  placeholder="Kode tipe penjualan (auto-generated)"
                />
                <p className="text-xs text-gray-500 mt-1">Kode tipe penjualan dibuat otomatis dan tidak dapat diubah</p>
              </div>
            )}
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
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/sales-types")}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-6 py-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg hover:from-primary-700 hover:to-primary-600 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            {mutation.isPending ? (
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
    </div>
  );
}
