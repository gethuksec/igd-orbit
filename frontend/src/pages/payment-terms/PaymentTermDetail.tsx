import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit, Loader2, CreditCard, Calendar } from "lucide-react";
import { paymentTermsService } from "../../services/payment-terms.service";
import { Button } from "@/components/ui/button";

export default function PaymentTermDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  const { data: paymentTerm, isLoading, error } = useQuery({
    queryKey: ["payment-term", id],
    queryFn: () => paymentTermsService.getById(id!),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !paymentTerm) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-gray-500">Termin pembayaran tidak ditemukan</p>
        <Button variant="outline" onClick={() => navigate("/payment-terms")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
        </Button>
      </div>
    );
  }

  const getDaysLabel = (days: number): string => {
    if (days === 0) return "Cash / COD (0 hari)";
    if (days === 1) return `${days} Hari`;
    return `${days} Hari`;
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{paymentTerm.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Detail termin pembayaran</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate("/payment-terms")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali</span>
          </Button>
          <Button
            onClick={() => navigate(`/payment-terms/${id}/edit`)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700"
          >
            <Edit className="w-4 h-4" />
            <span>Edit</span>
          </Button>
        </div>
      </div>

      {/* Detail Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-primary-100 rounded-lg">
              <CreditCard className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Informasi Termin</h3>
              <p className="text-xs text-muted-foreground">Data utama termin pembayaran</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Kode</p>
              <p className="text-sm font-mono font-medium text-foreground mt-0.5">{paymentTerm.code || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Nama</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{paymentTerm.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Jangka Waktu</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold border mt-1 ${
                paymentTerm.days === 0
                  ? "bg-blue-100 text-blue-800 border-blue-200"
                  : "bg-amber-100 text-amber-800 border-amber-200"
              }`}>
                {getDaysLabel(paymentTerm.days)}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Status</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold border mt-1 ${
                paymentTerm.isActive
                  ? "bg-green-100 text-green-800 border-green-200"
                  : "bg-gray-100 text-gray-800 border-gray-200"
              }`}>
                {paymentTerm.isActive ? "Aktif" : "Tidak Aktif"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-amber-100 rounded-lg">
              <Calendar className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Informasi Waktu</h3>
              <p className="text-xs text-muted-foreground">Data waktu pembuatan & perubahan</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Dibuat Pada</p>
              <p className="text-sm font-medium text-foreground mt-0.5">
                {new Date(paymentTerm.createdAt).toLocaleDateString("id-ID", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Diperbarui Pada</p>
              <p className="text-sm font-medium text-foreground mt-0.5">
                {new Date(paymentTerm.updatedAt).toLocaleDateString("id-ID", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
