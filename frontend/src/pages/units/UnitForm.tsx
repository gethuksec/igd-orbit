import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, X, Loader2, Ruler } from 'lucide-react';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';

export default function UnitForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    name: "",
    isActive: true,
  });

  const { data: unit, isLoading: loadingUnit } = useQuery({
    queryKey: ["unit", id],
    queryFn: async () => {
      const res = await api.get(`/units/${id}`);
      return res.data.data || res.data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (unit) {
      setFormData({
        name: unit.name || "",
        isActive: unit.isActive !== false,
      });
    }
  }, [unit]);

  const mutation = useMutation({
    mutationFn: (data: any) => {
      const submitData = { ...data };
      delete submitData.code;
      if (isEdit) {
        return api.put(`/units/${id}`, submitData);
      }
      return api.post("/units", submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      toast.success(isEdit ? "Satuan berhasil diupdate" : "Satuan berhasil ditambahkan");
      navigate("/units");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Terjadi kesalahan");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (loadingUnit) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <PageHeader
        title={isEdit ? 'Edit Satuan' : 'Tambah Satuan'}
        subtitle={isEdit ? 'Ubah informasi satuan' : 'Tambahkan satuan baru'}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/units')}
          className="text-white/80 hover:text-white hover:bg-white/20"
        >
          <X className="w-4 h-4 mr-2" />
          Batal
        </Button>
      </PageHeader>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
              <Ruler className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Informasi Satuan</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Satuan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Nama satuan"
              />
            </div>
            {isEdit && unit?.code && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kode Satuan
                </label>
                <input
                  type="text"
                  value={unit.code}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  placeholder="Kode satuan (auto-generated)"
                />
                <p className="text-xs text-gray-500 mt-1">Kode satuan dibuat otomatis dan tidak dapat diubah</p>
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
            onClick={() => navigate("/units")}
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
