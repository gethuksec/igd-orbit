import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit, Ruler, Loader2, Calendar } from "lucide-react";
import { PageHeader } from "@/components/shared";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { api } from "../../services/api";

export default function UnitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: unit, isLoading } = useQuery({
    queryKey: ["unit", id],
    queryFn: async () => {
      const res = await api.get(`/units/${id}`);
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

  if (!unit) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Satuan tidak ditemukan</p>
        <button
          onClick={() => navigate("/units")}
          className="mt-4 text-primary-600 hover:text-primary-700"
        >
          Kembali ke daftar satuan
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/units")}
          className="flex-shrink-0 p-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg shadow-lg hover:from-primary-500 hover:to-primary-400 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <PageHeader title={unit.name} subtitle="Detail Satuan">
            <Link
              to={`/units/${id}/edit`}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all"
            >
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </Link>
          </PageHeader>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Informasi Satuan */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Ruler className="w-5 h-5 text-primary-600" />
              <CardTitle>Informasi Satuan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Nama Satuan</p>
                <p className="text-sm font-semibold text-gray-900">{unit.name}</p>
              </div>

              {unit.code && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Kode Satuan</p>
                  <p className="text-sm font-semibold text-gray-900 font-mono">{unit.code}</p>
                </div>
              )}

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    unit.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {unit.isActive ? "Aktif" : "Tidak Aktif"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Informasi Tambahan */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              <CardTitle>Informasi Tambahan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Dibuat</span>
                <span className="font-semibold text-gray-900">
                  {new Date(unit.createdAt).toLocaleDateString("id-ID", {
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
                  {new Date(unit.updatedAt).toLocaleDateString("id-ID", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
