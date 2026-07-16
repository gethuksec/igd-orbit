import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2, ArrowLeft } from "lucide-react";
import { paymentTermsService } from "../../services/payment-terms.service";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function PaymentTermForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    name: "",
    days: 0,
    isActive: true,
  });

  const { data: existingData, isLoading: loadingExisting } = useQuery({
    queryKey: ["payment-term", id],
    queryFn: () => paymentTermsService.getById(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingData) {
      setFormData({
        name: existingData.name || "",
        days: existingData.days ?? 0,
        isActive: existingData.isActive ?? true,
      });
    }
  }, [existingData]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (isEdit) {
        return paymentTermsService.update(id!, data);
      }
      return paymentTermsService.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-terms"] });
      toast.success(isEdit ? "Termin berhasil diupdate" : "Termin berhasil ditambahkan");
      navigate("/payment-terms");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Terjadi kesalahan");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  if (isEdit && loadingExisting) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <PageHeader
        title={isEdit ? "Edit Termin Pembayaran" : "Tambah Termin Pembayaran"}
        subtitle={isEdit ? "Ubah data termin pembayaran" : "Buat termin pembayaran baru"}
      >
        <Button
          variant="outline"
          onClick={() => navigate("/payment-terms")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </Button>
      </PageHeader>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Termin <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Contoh: Cash, 30 Hari, 60 Hari"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jangka Waktu (hari) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min={0}
              value={formData.days}
              onChange={(e) => setFormData(prev => ({ ...prev, days: parseInt(e.target.value) || 0 }))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="0 = Cash / COD"
            />
            <p className="text-xs text-gray-500 mt-1">
              Masukkan 0 untuk pembayaran tunai / COD
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm text-gray-600">{formData.isActive ? 'Aktif' : 'Tidak Aktif'}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/payment-terms")}
              disabled={saveMutation.isPending}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 flex items-center justify-center gap-2"
            >
              {saveMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
              ) : (
                <><Save className="w-4 h-4" /> Simpan</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
