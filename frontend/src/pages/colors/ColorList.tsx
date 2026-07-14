import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Palette, Eye, Edit, Trash2 } from "lucide-react";
import { colorsService } from "../../services/colors.service";
import { PageHeader } from "@/components/shared";
import { StatCard } from "@/components/shared";
import { SearchFilter } from "@/components/shared";
import { DataTable } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";

export default function ColorList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["colors", page, searchTerm],
    queryFn: () =>
      colorsService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
      }),
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const colors = data?.data || [];
  const pagination = data?.meta || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };

  const columns: Column<any>[] = [
    {
      key: "name",
      header: "Warna",
      cell: (color) => (
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 h-14 w-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <Palette className="w-7 h-7" />
          </div>
          <div>
            <div className="text-base font-semibold text-foreground">
              {color.name}
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">
              {color.code || "-"}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "notes",
      header: "Catatan",
      cell: (color) => (
        <div className="text-sm text-muted-foreground max-w-md truncate">
          {color.notes || "-"}
        </div>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      cell: (color) => (
        <span
          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            color.isActive
              ? "bg-green-100 text-green-800 border-green-200"
              : "bg-gray-100 text-gray-800 border-gray-200"
          }`}
        >
          {color.isActive ? "Aktif" : "Tidak Aktif"}
        </span>
      ),
    },
  ];

  const activeCount = colors.filter((c: any) => c.isActive).length;

  return (
    <div className="w-full space-y-3">
      <PageHeader title="Manajemen Warna" subtitle="Kelola warna produk">
        <Link to="/colors/new">
          <Button className="flex items-center gap-2 bg-white text-primary-600 hover:bg-primary-50">
            <Plus className="w-5 h-5" />
            <span>Tambah Warna</span>
          </Button>
        </Link>
      </PageHeader>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">
            {(error as Error).message || "Terjadi kesalahan"}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          icon={<Palette className="w-6 h-6 text-white" />}
          iconBg="from-primary-500 to-primary-600"
          label="Total Warna"
          value={isLoading ? "-" : pagination.total}
          subtitle="Semua warna terdaftar"
        />
        <StatCard
          icon={<Palette className="w-6 h-6 text-white" />}
          iconBg="from-blue-500 to-blue-600"
          label="Total Terisi"
          value={isLoading ? "-" : colors.length}
          subtitle="Warna pada halaman ini"
        />
        <StatCard
          icon={<Palette className="w-6 h-6 text-white" />}
          iconBg="from-green-500 to-green-600"
          label="Warna Aktif"
          value={isLoading ? "-" : activeCount}
          badge={{ text: "Active", className: "bg-green-100 text-green-800" }}
        />
      </div>

      <SearchFilter
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama warna..."
      />

      <DataTable
        columns={columns}
        data={colors}
        keyExtractor={(c: any) => c.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada warna ditemukan"
        emptyIcon={<Palette className="w-16 h-16" />}
        actions={(color: any) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/colors/${color.id}`)}
              title="Lihat Detail"
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/colors/${color.id}/edit`)}
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              title="Hapus"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      />

      {!isLoading && colors.length > 0 && (
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Menampilkan{" "}
              <span className="font-bold text-foreground">
                {colors.length}
              </span>{" "}
              dari{" "}
              <span className="font-bold text-foreground">
                {pagination.total}
              </span>{" "}
              warna
              <span className="ml-2 text-muted-foreground">
                (Halaman {pagination.page} dari {pagination.totalPages})
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= pagination.totalPages}
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
