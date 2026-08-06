import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Edit,
  Warehouse as WarehouseIcon,
  Building2,
  MapPin,
  Phone,
  Mail,
  User,
  Smartphone,
  Loader2,
} from "lucide-react";
import { warehousesService } from "../../services/warehouses.service";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function WarehouseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: warehouse, isLoading, error } = useQuery({
    queryKey: ["warehouse", id],
    queryFn: () => warehousesService.getById(id!),
  });

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error || !warehouse) {
    return (
      <div className="w-full space-y-3">
        <PageHeader title="Detail Gudang" subtitle="Gudang tidak ditemukan">
          <Button variant="outline" onClick={() => navigate("/warehouses")}>
            <ArrowLeft className="w-4 h-4" /> Kembali
          </Button>
        </PageHeader>
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">
            {(error as Error)?.message || "Gudang tidak ditemukan"}
          </p>
        </div>
      </div>
    );
  }

  const wh = warehouse;

  const infoRow = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-start gap-3">
      <div className="flex-shrink-0 p-1.5 bg-white rounded-lg border border-gray-200 text-primary-600">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <div className="text-sm font-semibold text-gray-900 break-words">{value}</div>
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-3">
      <PageHeader title={wh.name} subtitle={`Kode: ${wh.code || "-"}`}>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate("/warehouses")}
            className="flex items-center gap-2 bg-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali</span>
          </Button>
          <Button
            onClick={() => navigate(`/warehouses/${wh.id}/edit`)}
            className="flex items-center gap-2 bg-white text-primary-600 hover:bg-primary-50"
          >
            <Edit className="w-4 h-4" />
            <span>Edit</span>
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Informasi Gudang */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WarehouseIcon className="w-5 h-5 text-primary-600" />
              Informasi Gudang
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {infoRow(<WarehouseIcon className="w-4 h-4" />, "Nama Gudang", wh.name)}
            {infoRow(<WarehouseIcon className="w-4 h-4" />, "Kode", <span className="font-mono">{wh.code || "-"}</span>)}
            {infoRow(
              <Building2 className="w-4 h-4" />,
              "Outlet",
              <Link to={`/branches/${wh.outlet?.id || ""}`} className="text-primary-600 hover:text-primary-700">
                {wh.outlet?.name || "-"}
                {wh.outlet?.code ? ` (${wh.outlet.code})` : ""}
              </Link>
            )}
            {infoRow(<MapPin className="w-4 h-4" />, "Kota", wh.city || "-")}
            {infoRow(<MapPin className="w-4 h-4" />, "Alamat", wh.address || "-")}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-start gap-3">
              <div className="flex-shrink-0 p-1.5 bg-white rounded-lg border border-gray-200 text-primary-600">
                <WarehouseIcon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Status</p>
                <span
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    wh.isActive
                      ? "bg-green-100 text-green-800 border-green-200"
                      : "bg-gray-100 text-gray-800 border-gray-200"
                  }`}
                >
                  {wh.isActive ? "Aktif" : "Tidak Aktif"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Kontak & Informasi Tambahan */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-primary-600" />
                Kontak
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {infoRow(<Phone className="w-4 h-4" />, "Telepon", wh.phone || "-")}
              {infoRow(<Mail className="w-4 h-4" />, "Email", wh.email || "-")}
              {infoRow(<User className="w-4 h-4" />, "Contact Person", wh.contactPerson || "-")}
              {infoRow(<Smartphone className="w-4 h-4" />, "No. HP", wh.mobilePhone || "-")}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WarehouseIcon className="w-5 h-5 text-primary-600" />
                Informasi Tambahan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {infoRow(
                <WarehouseIcon className="w-4 h-4" />,
                "Dibuat",
                new Date(wh.createdAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })
              )}
              {infoRow(
                <WarehouseIcon className="w-4 h-4" />,
                "Diupdate",
                new Date(wh.updatedAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
