import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowRightLeft, Settings2 } from "lucide-react";
import { rosterService, shiftsService, type RosterRow, type ShiftSetting } from "@/services/shifts.service";
import { divisionsService } from "@/services/divisions.service";
import { api } from "@/services/api";
import { BreadcrumbHeader, FilterToolbar, DataTable, StatusDot } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";

function nextMonthRange(): { start: string; end: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: fmt(first), end: fmt(last) };
}

function monthLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

interface Option {
  value: string;
  label: string;
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  disabled,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="h-9 px-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {label}
        {selected.length > 0 ? ` (${selected.length})` : ""}
      </button>
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-56 max-h-64 overflow-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2">
            {options.length === 0 && (
              <p className="text-sm text-muted-foreground px-2 py-1">Tidak ada pilihan</p>
            )}
            {options.map((o) => (
              <label
                key={o.value}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(o.value)}
                  onChange={() => toggle(o.value)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ShiftingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userRoles } = usePermissions();
  const canScopeAll = userRoles.includes("SUPERADMIN") || userRoles.includes("OWNER");
  const canManage = canScopeAll || userRoles.includes("HR") || userRoles.includes("SPV-HRD") || userRoles.includes("CHR");

  const [settingOpen, setSettingOpen] = useState(false);
  const [settingForm, setSettingForm] = useState({
    rosterOpenDay: "25",
    rosterCloseDay: "",
    employeeInputStartDay: "25",
  });

  const { data: setting } = useQuery({
    queryKey: ["shift-setting"],
    queryFn: () => shiftsService.getSetting(),
  });

  const settingMutation = useMutation({
    mutationFn: (payload: Partial<ShiftSetting>) => shiftsService.updateSetting(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-setting"] });
      toast.success("Pengaturan roster disimpan");
      setSettingOpen(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Gagal menyimpan pengaturan"),
  });

  const nm = useMemo(nextMonthRange, []);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [rangeFrom, setRangeFrom] = useState(nm.start);
  const [rangeTo, setRangeTo] = useState(nm.end);
  const [deptIds, setDeptIds] = useState<string[]>([]);
  const [divIds, setDivIds] = useState<string[]>([]);
  const limit = 20;

  const isNextMonth = rangeFrom === nm.start && rangeTo === nm.end;

  const { data: departments } = useQuery({
    queryKey: ["departments-options"],
    queryFn: async () => {
      const res = await api.get("/departments", { params: { limit: 200 } });
      const list = (res.data?.data ?? []) as { id: string; name: string }[];
      return list.map((d) => ({ value: d.id, label: d.name }));
    },
    enabled: canScopeAll,
  });

  const { data: divisions } = useQuery({
    queryKey: ["divisions-options"],
    queryFn: async () => {
      const res = await divisionsService.getAll({ limit: 200 });
      return (res.data ?? []) as { id: string; name: string; departmentId?: string | null }[];
    },
    enabled: canScopeAll,
  });

  const divisionOptions: Option[] = useMemo(() => {
    const list = divisions ?? [];
    const filtered = deptIds.length
      ? list.filter((d) => d.departmentId && deptIds.includes(d.departmentId))
      : list;
    return filtered.map((d) => ({ value: d.id, label: d.name }));
  }, [divisions, deptIds]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["shift-roster", rangeFrom, rangeTo, statusFilter, deptIds, divIds, searchTerm, page],
    queryFn: () =>
      rosterService.getRoster({
        start: rangeFrom,
        end: rangeTo,
        status: statusFilter,
        departmentIds: canScopeAll ? deptIds : undefined,
        divisionIds: canScopeAll ? divIds : undefined,
        search: searchTerm || undefined,
        page,
        limit,
      }),
  });

  const rows = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;
  const total = data?.meta?.total ?? 0;

  const goAssign = (row: RosterRow) =>
    navigate(`/hr/shifting/assign/${row.employee.id}?start=${rangeFrom}&end=${rangeTo}`);

  const columns: Column<RosterRow>[] = [
    {
      key: "employee",
      header: "Karyawan",
      cell: (row) => (
        <span>
          <span className="block font-medium">{row.employee.fullName || row.employee.employeeCode}</span>
          <span className="block text-xs text-muted-foreground font-mono">{row.employee.employeeCode}</span>
        </span>
      ),
    },
    {
      key: "org",
      header: "Department / Divisi",
      cell: (row) => (
        <span className="text-sm">
          {row.employee.department?.name || "-"}
          {row.employee.division ? ` / ${row.employee.division.name}` : ""}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) =>
        row.status === "TERJADWAL" ? (
          <StatusDot tone="ok">Terjadwal</StatusDot>
        ) : (
          <StatusDot tone="off">Belum terjadwal</StatusDot>
        ),
    },
    {
      key: "roster",
      header: "Roster (range)",
      cell: (row) =>
        row.status === "TERJADWAL" ? (
          <span className="text-sm font-mono">
            {row.dominantShift || "-"} · {row.plotted} hari · {row.libur} libur
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <BreadcrumbHeader title="Shifting" subtitle={`Roster bulan depan (${monthLabel(nm.start)})`}>
        {canManage && (
          <Button
            onClick={() => {
              const d = setting as ShiftSetting | undefined;
              setSettingForm({
                rosterOpenDay: String(d?.rosterOpenDay ?? 25),
                rosterCloseDay: d?.rosterCloseDay ? String(d.rosterCloseDay) : "",
                employeeInputStartDay: String(d?.employeeInputStartDay ?? 25),
              });
              setSettingOpen(true);
            }}
            className="flex items-center gap-2 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50"
          >
            <Settings2 className="w-4 h-4" />
            <span>Pengaturan</span>
          </Button>
        )}
      </BreadcrumbHeader>

      {!canScopeAll && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-sm rounded-lg px-4 py-2.5">
          Cakupan: bawahan Anda (divisi/departemen sendiri).
        </div>
      )}
      {!isNextMonth && (
        <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm rounded-lg px-4 py-2.5">
          Assign dan Edit aktif hanya untuk range bulan depan ({monthLabel(nm.start)}). Ubah range kembali
          untuk mengelola roster.
        </div>
      )}

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={(v) => {
          setSearchTerm(v);
          setPage(1);
        }}
        searchPlaceholder="Cari nama / kode karyawan..."
        fields={[
          {
            key: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "ALL", label: "Semua" },
              { value: "TERJADWAL", label: "Terjadwal" },
              { value: "BELUM", label: "Belum terjadwal" },
            ],
          },
          { key: "range", label: "Rentang tanggal", type: "date-range" },
        ]}
        values={{ status: statusFilter, rangeFrom, rangeTo }}
        onFieldChange={(key, v) => {
          if (key === "status") {
            setStatusFilter(v || "ALL");
            setPage(1);
          }
          if (key === "rangeFrom") {
            setRangeFrom(v);
            setPage(1);
          }
          if (key === "rangeTo") {
            setRangeTo(v);
            setPage(1);
          }
        }}
        onReset={() => {
          setStatusFilter("ALL");
          setSearchTerm("");
          setRangeFrom(nm.start);
          setRangeTo(nm.end);
          setDeptIds([]);
          setDivIds([]);
          setPage(1);
        }}
      >
        {canScopeAll && (
          <div className="flex items-center gap-2">
            <MultiSelect
              label="Department"
              options={departments ?? []}
              selected={deptIds}
              onChange={(next) => {
                setDeptIds(next);
                setDivIds((cur) => {
                  const allowed = new Set(
                    (divisions ?? [])
                      .filter((d) => d.departmentId && next.includes(d.departmentId))
                      .map((d) => d.id)
                  );
                  return cur.filter((id) => allowed.has(id));
                });
                setPage(1);
              }}
            />
            <MultiSelect
              label="Divisi"
              options={divisionOptions}
              selected={divIds}
              onChange={(next) => {
                setDivIds(next);
                setPage(1);
              }}
              disabled={deptIds.length === 0}
            />
          </div>
        )}
      </FilterToolbar>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-2.5">
          Gagal memuat roster.
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={(r: RosterRow) => r.employee.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada karyawan pada cakupan ini"
        emptyIcon={<ArrowRightLeft className="w-16 h-16" />}
        actions={(row: RosterRow) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={!isNextMonth}
              title={isNextMonth ? "Assign roster" : "Hanya untuk bulan depan"}
              onClick={() => goAssign(row)}
            >
              Assign
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!isNextMonth}
              title={isNextMonth ? "Edit roster" : "Hanya untuk bulan depan"}
              onClick={() => goAssign(row)}
            >
              Edit
            </Button>
          </div>
        )}
      />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="font-medium tabular-nums">
          Page {page} / {totalPages} · {total} karyawan
        </span>
        <span className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ‹
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            ›
          </Button>
        </span>
      </div>

      {/* IGDERP-265 v2: roster input window (release = roster submitted flag) */}
      <Dialog open={settingOpen} onOpenChange={setSettingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pengaturan jendela input roster</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              settingMutation.mutate({
                rosterOpenDay: Number(settingForm.rosterOpenDay) || 25,
                rosterCloseDay: settingForm.rosterCloseDay ? Number(settingForm.rosterCloseDay) : null,
                employeeInputStartDay: Number(settingForm.employeeInputStartDay) || 25,
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Roster dibuka (tgl)</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={settingForm.rosterOpenDay}
                  onChange={(e) => setSettingForm({ ...settingForm, rosterOpenDay: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">Default 25 — bulan sebelumnya.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Roster ditutup (tgl, kosong = akhir bulan)</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={settingForm.rosterCloseDay}
                  onChange={(e) => setSettingForm({ ...settingForm, rosterCloseDay: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                  placeholder="Akhir bulan"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Input karyawan mulai (tgl)</label>
              <input
                type="number"
                min={1}
                max={28}
                value={settingForm.employeeInputStartDay}
                onChange={(e) => setSettingForm({ ...settingForm, employeeInputStartDay: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Rilis roster mengikuti flag submitted per tanggal (roster-first); pengaturan ini hanya
              mengatur jendela tanggal input.
            </p>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setSettingOpen(false)}>
                Batal
              </Button>
              <Button type="submit" className="flex-1" disabled={settingMutation.isPending}>
                {settingMutation.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
