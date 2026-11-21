import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Users } from "lucide-react";
import { liburService, type LiburQuotaRow } from "@/services/libur.service";
import { BreadcrumbHeader, StatCard, FilterToolbar, DataTable, StatusDot } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type QuotaFilter = "all" | "aman" | "lebih" | "menunggu";

export default function LiburQuotaPage() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(currentPeriod());
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [quotaFilter, setQuotaFilter] = useState<QuotaFilter>("all");
  const [globalOpen, setGlobalOpen] = useState(false);
  const [globalDays, setGlobalDays] = useState("4");
  const [overrideTarget, setOverrideTarget] = useState<LiburQuotaRow | null>(null);
  const [overrideDays, setOverrideDays] = useState("");
  const limit = 20;

  const { data, isLoading, error } = useQuery({
    queryKey: ["libur-quotas", period, page, searchTerm],
    queryFn: () =>
      liburService.getQuotas({ period, page, limit, search: searchTerm || undefined }),
  });

  const allRows = data?.data || [];
  const rows =
    quotaFilter === "all"
      ? allRows
      : allRows.filter((r) =>
          quotaFilter === "lebih"
            ? r.isOverQuota
            : quotaFilter === "menunggu"
              ? !r.isOverQuota && r.pending > 0
              : !r.isOverQuota
        );
  const total = data?.meta?.total ?? rows.length;
  const totalPages = data?.meta?.totalPages ?? 1;
  const overCount = allRows.filter((r) => r.isOverQuota).length;
  const pendingCount = allRows.filter((r) => !r.isOverQuota && r.pending > 0).length;
  const avgUsed = allRows.length
    ? (allRows.reduce((s, r) => s + r.used, 0) / allRows.length).toFixed(1).replace(".", ",")
    : "0";

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["libur-quotas"] });

  const globalMutation = useMutation({
    mutationFn: (days: number) => liburService.setGlobalQuota(days),
    onSuccess: () => {
      invalidate();
      toast.success("Jatah global berhasil diupdate");
      setGlobalOpen(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Gagal menyimpan jatah global"),
  });

  const overrideMutation = useMutation({
    mutationFn: ({ id, days }: { id: string; days: number | null }) =>
      liburService.setEmployeeQuota(id, days),
    onSuccess: () => {
      invalidate();
      toast.success("Jatah khusus berhasil disimpan");
      setOverrideTarget(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Gagal menyimpan jatah khusus"),
  });

  const columns: Column<LiburQuotaRow>[] = [
    {
      key: "employee",
      header: "Karyawan",
      cell: (row) => (
        <div>
          <div className="text-[15px] font-medium text-foreground">{row.fullName}</div>
          <div className="text-xs text-muted-foreground mt-1 font-mono">{row.employeeCode}</div>
        </div>
      ),
    },
    {
      key: "quota",
      header: "Jatah",
      cell: (row) => (
        <span>
          {row.quotaDays} hari{" "}
          {row.quotaSource === "khusus" && (
            <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
              khusus
            </span>
          )}
        </span>
      ),
    },
    { key: "used", header: "Terpakai", cell: (row) => <span>{row.used} hari</span> },
    {
      key: "remaining",
      header: "Sisa",
      cell: (row) => (
        <span className={row.remaining < 0 ? "font-bold text-red-600" : ""}>
          {row.remaining} hari
        </span>
      ),
    },
    {
      key: "usage",
      header: "Penggunaan",
      cell: (row) => {
        const pct = row.quotaDays > 0 ? Math.min(100, Math.round((row.used / row.quotaDays) * 100)) : 0;
        return (
          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 min-w-24">
            <div
              className={`h-full rounded-full ${row.isOverQuota ? "bg-red-600" : "bg-gray-400"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (row) =>
        row.isOverQuota ? (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            Lebih {row.overQuotaDays} hari
          </span>
        ) : row.pending > 0 ? (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            {row.pending} menunggu SPV
          </span>
        ) : row.remaining === 0 ? (
          <StatusDot tone="off">Pas</StatusDot>
        ) : (
          <StatusDot tone="ok">Aman</StatusDot>
        ),
    },
  ];

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Libur karyawan" subtitle="Jatah hari tidak masuk per bulan · basis 30 hari kerja">
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setGlobalDays(String(data?.globalQuotaDays ?? 4));
              setGlobalOpen(true);
            }}
            className="flex items-center gap-2 bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 border border-gray-200 dark:border-gray-700 hover:bg-primary-50"
          >
            <span>Ubah jatah global</span>
          </Button>
        </div>
      </BreadcrumbHeader>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-2 text-sm">
        <CalendarDays className="w-4 h-4 text-muted-foreground" />
        <span>
          Jatah global bulan berjalan <b>{data?.globalQuotaDays ?? "-" } hari</b> per karyawan
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
          {period}
        </span>
        <span className="text-muted-foreground">· dapat diubah per karyawan</span>
        <span className="ml-auto" />
        <select
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
        >
          {[0, 1, 2].map((back) => {
            const d = new Date();
            d.setMonth(d.getMonth() - back);
            const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            return (
              <option key={v} value={v}>
                {v}
              </option>
            );
          })}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 dark:text-red-200 font-medium">{(error as Error).message || "Terjadi kesalahan"}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard icon={<Users className="h-5 w-5" />} label="Karyawan terpantau" value={isLoading ? "-" : total} />
        <StatCard icon={<CalendarDays className="h-5 w-5" />} label="Rata-rata terpakai" value={isLoading ? "-" : `${avgUsed} hari`} />
        <StatCard icon={<CalendarDays className="h-5 w-5" />} label="Menunggu persetujuan" value={isLoading ? "-" : pendingCount} />
        <StatCard icon={<CalendarDays className="h-5 w-5" />} label="Melebihi kuota" value={isLoading ? "-" : overCount} />
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama / kode karyawan..."
        fields={[
          {
            key: "quota",
            label: "Status",
            type: "select",
            options: [
              { value: "aman", label: "Aman" },
              { value: "lebih", label: "Melebihi kuota" },
              { value: "menunggu", label: "Menunggu SPV" },
            ],
          },
        ]}
        values={{ quota: quotaFilter === "all" ? "" : quotaFilter }}
        onFieldChange={(key, v) => {
          if (key === "quota") {
            setQuotaFilter((v || "all") as QuotaFilter);
            setPage(1);
          }
        }}
        onReset={() => {
          setQuotaFilter("all");
          setSearchTerm("");
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={(r: LiburQuotaRow) => r.employeeId}
        isLoading={isLoading}
        emptyMessage="Tidak ada data kuota libur"
        emptyIcon={<CalendarDays className="w-16 h-16" />}
        actions={(row: LiburQuotaRow) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOverrideTarget(row);
                setOverrideDays(String(row.quotaDays));
              }}
            >
              Jatah khusus
            </Button>
          </div>
        )}
      />

      {!isLoading && rows.length > 0 && (
        <div className="bg-gradient-to-r from-gray-50 dark:from-gray-900 to-gray-100 dark:to-gray-800 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Menampilkan <span className="font-bold text-foreground">{rows.length}</span> dari{" "}
              <span className="font-bold text-foreground">{total}</span> karyawan
              <span className="ml-2 text-muted-foreground">(Halaman {page} dari {totalPages})</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
                Sebelumnya
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
                Selanjutnya
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={globalOpen} onOpenChange={setGlobalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah jatah global</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Hari libur per bulan</label>
              <input
                type="number"
                min={0}
                max={31}
                value={globalDays}
                onChange={(e) => setGlobalDays(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Berlaku untuk semua karyawan yang tidak punya jatah khusus.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setGlobalOpen(false)}>
                Batal
              </Button>
              <Button
                className="flex-1"
                disabled={globalMutation.isPending}
                onClick={() => globalMutation.mutate(Number(globalDays))}
              >
                {globalMutation.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!overrideTarget} onOpenChange={(o) => !o && setOverrideTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Jatah khusus — {overrideTarget?.fullName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Hari libur per bulan</label>
              <input
                type="number"
                min={0}
                max={31}
                value={overrideDays}
                onChange={(e) => setOverrideDays(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOverrideTarget(null)}>
                Batal
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={overrideMutation.isPending}
                onClick={() => overrideTarget && overrideMutation.mutate({ id: overrideTarget.employeeId, days: null })}
              >
                Kembali ke global
              </Button>
              <Button
                className="flex-1"
                disabled={overrideMutation.isPending}
                onClick={() =>
                  overrideTarget && overrideMutation.mutate({ id: overrideTarget.employeeId, days: Number(overrideDays) })
                }
              >
                {overrideMutation.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
