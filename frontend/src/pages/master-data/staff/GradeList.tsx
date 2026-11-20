import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Check, Plus } from "lucide-react";
import { gradesService } from "@/services/grades.service";
import { api } from "@/services/api";
import { BreadcrumbHeader, StatCard, FilterToolbar } from "@/components/shared";
import { toast } from "sonner";

interface StaffRow {
  id: string;
  code: string;
  name: string;
  rank: number;
  gradeId: string | null;
  isActive: boolean;
  divisionId: string | null;
  departmentId: string | null;
  defaultRoleId: string | null;
  minSalary: number | string | null;
}

const familyKeyOf = (code: string) => {
  const m = code.match(/^(.*)-\d$/);
  return m ? m[1] : code;
};

const familyLabelOf = (name: string) => name.replace(/\s\d$/, "");

/**
 * Grade master as title × grade assignment (IGDERP-270). Staff titles
 * (rank 6) expand to one row per rung; toggling a cell creates, removes
 * (soft-deactivates), or reactivates the matching position row.
 * Grade definitions (G1–G6) are fixed and shown read-only.
 */
export default function GradeList() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  const { data: grades = [], isLoading: gradesLoading } = useQuery({
    queryKey: ["grades-definitions"],
    queryFn: async () => {
      const res = await gradesService.getAll({ limit: 100 });
      return res.data;
    },
  });

  const {
    data: staffRows = [],
    isLoading: rowsLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["grade-matrix"],
    queryFn: async () => {
      const res = await api.get("/positions", {
        params: { limit: 500, rank: 6, includeInactive: true },
      });
      const body = res.data;
      const rows = body?.data?.data ?? body?.data ?? [];
      return (Array.isArray(rows) ? rows : []) as StaffRow[];
    },
  });

  const isLoading = gradesLoading || rowsLoading;

  const families = useMemo(() => {
    const map = new Map<string, { key: string; label: string; rows: StaffRow[] }>();
    for (const r of staffRows) {
      const key = familyKeyOf(r.code);
      if (!map.has(key)) map.set(key, { key, label: familyLabelOf(r.name), rows: [] });
      map.get(key)!.rows.push(r);
      // Prefer an active row's name for the family label.
      if (r.isActive) map.get(key)!.label = familyLabelOf(r.name);
    }
    const q = searchTerm.trim().toLowerCase();
    const all = [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
    if (!q) return all;
    return all.filter(
      (f) => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q)
    );
  }, [staffRows, searchTerm]);

  const activeRungs = staffRows.filter((r) => r.isActive).length;
  const busy = pending !== null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["positions-options"] });
    refetch();
  };

  const toggle = async (familyKey: string, gradeId: string, gradeRank: number) => {
    const fam = families.find((f) => f.key === familyKey);
    if (!fam) return;
    const row = fam.rows.find((r) => r.gradeId === gradeId);
    const cellKey = `${familyKey}:${gradeId}`;
    setPending(cellKey);
    try {
      if (row && row.isActive) {
        await api.delete(`/positions/${row.id}`);
        toast.success("Rung dinonaktifkan");
      } else if (row && !row.isActive) {
        await api.put(`/positions/${row.id}`, { isActive: true });
        toast.success("Rung diaktifkan");
      } else {
        const donor = fam.rows.find((r) => r.isActive) ?? fam.rows[0];
        await api.post("/positions", {
          code: `${familyKey}-${gradeRank}`,
          name: `${fam.label} ${gradeRank}`,
          rank: 6,
          gradeId,
          divisionId: donor?.divisionId ?? undefined,
          departmentId: donor?.departmentId ?? undefined,
          defaultRoleId: donor?.defaultRoleId ?? undefined,
          minSalary: donor?.minSalary !== null && donor?.minSalary !== undefined ? Number(donor.minSalary) : undefined,
        });
        toast.success("Rung ditambahkan");
      }
      refresh();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal mengubah rung");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Grade" subtitle="Penetapan grade per jabatan staff" />

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 dark:text-red-200 font-medium">{(error as Error).message || "Terjadi kesalahan"}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          icon={<Award className="w-6 h-6 text-white" />}
          iconBg="from-primary-500 to-primary-600"
          label="Jabatan Staff"
          value={isLoading ? "-" : families.length}
        />
        <StatCard
          icon={<Award className="w-6 h-6 text-white" />}
          iconBg="from-purple-500 to-purple-600"
          label="Total Rung"
          value={isLoading ? "-" : staffRows.length}
        />
        <StatCard
          icon={<Award className="w-6 h-6 text-white" />}
          iconBg="from-green-500 to-green-600"
          label="Rung Aktif"
          value={isLoading ? "-" : activeRungs}
          badge={{ text: "Active", className: "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200" }}
        />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 px-4 py-3 flex flex-wrap gap-2 items-center">
        {grades.map((g) => (
          <span
            key={g.id}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
          >
            {g.code} — {g.name}
          </span>
        ))}
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari jabatan staff..."
        fields={[]}
        values={{}}
        onFieldChange={() => {}}
        onReset={() => setSearchTerm("")}
      />

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
              <th className="px-4 py-3 font-bold">Jabatan</th>
              {grades.map((g) => (
                <th key={g.id} className="px-2 py-3 font-bold text-center w-16">
                  {g.code}
                </th>
              ))}
              <th className="px-4 py-3 font-bold text-center">Rung</th>
            </tr>
          </thead>
          <tbody>
            {families.map((f) => {
              const activeCount = f.rows.filter((r) => r.isActive).length;
              return (
                <tr key={f.key} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{f.label}</div>
                    <div className="text-xs text-muted-foreground font-mono">{f.key}</div>
                  </td>
                  {grades.map((g) => {
                    const row = f.rows.find((r) => r.gradeId === g.id);
                    return (
                      <td key={g.id} className="px-2 py-2.5 text-center">
                        {row && row.isActive ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => toggle(f.key, g.id, g.rank)}
                            title={`${row.code} — aktif, klik untuk nonaktifkan`}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition-colors disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        ) : row && !row.isActive ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => toggle(f.key, g.id, g.rank)}
                            title={`${row.code} — nonaktif, klik untuk aktifkan`}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-950 hover:text-green-700 dark:hover:text-green-300 hover:border-green-200 dark:hover:border-green-800 transition-colors disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => toggle(f.key, g.id, g.rank)}
                            title={`Tambah rung ${g.code}`}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-gray-300 dark:text-gray-600 hover:border-primary-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors disabled:opacity-50"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 text-center font-mono text-xs text-gray-500 dark:text-gray-400">
                    {activeCount}/{f.rows.length}
                  </td>
                </tr>
              );
            })}
            {!isLoading && families.length === 0 && (
              <tr>
                <td colSpan={grades.length + 2} className="px-4 py-8 text-center text-muted-foreground">
                  Tidak ada jabatan staff ditemukan
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={grades.length + 2} className="px-4 py-8 text-center text-muted-foreground">
                  Memuat…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
