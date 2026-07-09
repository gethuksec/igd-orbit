import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit, Truck, Loader2, Calendar } from "lucide-react";
import { api } from "../../services/api";

export default function ExpeditionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: expedition, isLoading } = useQuery({
    queryKey: ["expedition", id],
    queryFn: async () => {
      const res = await api.get(`/expeditions/${id}`);
      return res.data.data || res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!expedition) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Ekspedisi tidak ditemukan</p>
        <button
          onClick={() => navigate("/expeditions")}
          className="mt-4 text-primary-600 hover:text-primary-700"
        >
          Kembali ke daftar ekspedisi
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/expeditions")}
              className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold mb-1">{expedition.name}</h1>
              <p className="text-primary-100">Detail Ekspedisi</p>
            </div>
          </div>
          <Link
            to={`/expeditions/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all"
          >
            <Edit className="w-4 h-4" />
            <span>Edit</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Informasi Ekspedisi */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary-600" />
              Informasi Ekspedisi
            </h2>
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Nama Ekspedisi</p>
                <p className="text-sm font-semibold text-gray-900">{expedition.name}</p>
              </div>

              {expedition.code && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Kode Ekspedisi</p>
                  <p className="text-sm font-semibold text-gray-900 font-mono">{expedition.code}</p>
                </div>
              )}

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    expedition.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {expedition.isActive ? "Aktif" : "Tidak Aktif"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Info */}
        <div className="space-y-4">
          {/* Timestamps */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              Informasi Tambahan
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Dibuat</span>
                <span className="font-semibold text-gray-900">
                  {new Date(expedition.createdAt).toLocaleDateString("id-ID", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Diupdate</span>
                <span className="font-semibold text-gray-900">
                  {new Date(expedition.updatedAt).toLocaleDateString("id-ID", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
