import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, AlertTriangle } from "lucide-react";
import { shiftsService, WEEKDAY_LABELS, type ShiftAssignment } from "@/services/shifts.service";
import { api } from "@/services/api";
import { BreadcrumbHeader, StatCard, FilterToolbar, DataTable, StatusDot } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface EmployeeOption {
  id: string;
  employeeCode: string;
  division?: { name?: string } | null;
  user?: { fullName?: string };
}

interface ShiftOption {
  id: string;
  code: string;
  name: string;
}

interface AssignForm {
  employeeId: string;
  shiftId: string;
  startDate: string;
  endDate: string;
  weekdays: number[];
  offDates: string[];
}

const defaultForm: AssignForm = {
  employeeId: "",
  shiftId: "",
  startDate: "",
  endDate: "",
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  offDates: [],
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function rangesOverlap(aStart: string, aEnd: string | null, bStart: string, bEnd: string | null): boolean {
  const aE = aEnd || "9999-12-31";
  const bE = bEnd || "9999-12-31";
  return aStart <= bE && bStart <= aE;
}

export default function ShiftingPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [shiftFilter, setShiftFilter] = useState("all");
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftAssignment | null>(null);
  const [formData, setFormData] = useState<AssignForm>(defaultForm);
  const [calMonth, setCalMonth] = useState(monthKey(new Date()));
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const limit = 20;

  const { data: employees } = useQuery({
    queryKey: ["employees-options"],
    queryFn: async () => {
      const res = await api.get("/employees", { params: { limit: 200 } });
      return ((res.data?.data ?? []) as EmployeeOption[]);
    },
  });

  const { data: shiftOptions } = useQuery({
    queryKey: ["shifts-options"],
    queryFn: async () => {
      const res = await api.get("/shifts", { params: { limit: 200, status: "active" } });
      return ((res.data?.data ?? []) as ShiftOption[]);
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["shift-assignments", page, searchTerm, shiftFilter],
    queryFn: () =>
      shiftsService.getAssignments({
        page,
        limit,
        search: searchTerm || undefined,
        shiftId: shiftFilter === "all" || shiftFilter === "none" ? undefined : shiftFilter,
      }),
  });

  const displayRows = data?.data || [];
  const total = data?.meta?.total ?? displayRows.length;
  const totalPages = data?.meta?.totalPages ?? 1;

  // Client-side overlap detection (mirror of the backend guard) for the warning banner
  const overlapIds = new Set<string>();
  for (let i = 0; i < displayRows.length; i++) {
    for (let j = i + 1; j < displayRows.length; j++) {
      const a = displayRows[i];
      const b = displayRows[j];
      if (
        a.employeeId === b.employeeId &&
        rangesOverlap(a.startDate, a.endDate ?? null, b.startDate, b.endDate ?? null) &&
        a.weekdays.some((d) => b.weekdays.includes(d))
      ) {
        overlapIds.add(a.id);
        overlapIds.add(b.id);
      }
    }
  }
  const overlapNames = displayRows
    .filter((r) => overlapIds.has(r.id))
    .map((r) => r.employee?.user?.fullName || r.employee?.employeeCode || "?");
  const uniqueOverlapNames = [...new Set(overlapNames)];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["shift-assignments"] });
    queryClient.invalidateQueries({ queryKey: ["shifts"] });
  };

  const saveMutation = useMutation({
    mutationFn: (payload: any) => {
      if (editing) return shiftsService.updateAssignment(editing.id, payload);
      return shiftsService.createAssignment(payload);
    },
    onSuccess: () => {
      invalidate();
      toast.success(editing ? "Penempatan berhasil diupdate" : "Penempatan berhasil ditambahkan");
      setFormModalOpen(false);
      setEditing(null);
      setFormData(defaultForm);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Terjadi kesalahan"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => shiftsService.deleteAssignment(id),
    onSuccess: () => {
      invalidate();
      toast.success("Penempatan berhasil dihapus");
      setDeleteModalOpen(false);
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Gagal menghapus penempatan"),
  });

  const openCreateModal = () => {
    setEditing(null);
    setFormData(defaultForm);
    setFormModalOpen(true);
  };

  const openEditModal = (row: ShiftAssignment) => {
    setEditing(row);
    const off = Array.isArray(row.offDates)
      ? row.offDates.map((d) => String(d).slice(0, 10)).sort()
      : [];
    setFormData({
      employeeId: row.employeeId,
      shiftId: row.shiftId,
      startDate: String(row.startDate).slice(0, 10),
      endDate: row.endDate ? String(row.endDate).slice(0, 10) : "",
      weekdays: row.weekdays,
      offDates: off,
    });
    setFormModalOpen(true);
  };

  const toggleDay = (d: number) => {
    setFormData((f) =>
      f.weekdays.includes(d)
        ? { ...f, weekdays: f.weekdays.filter((x) => x !== d) }
        : { ...f, weekdays: [...f.weekdays, d].sort() }
    );
  };

  // Calendar helpers: all work days by default, tap a date to mark libur.
  useEffect(() => {
    if (formModalOpen) {
      const base = formData.startDate || `${monthKey(new Date())}-01`;
      setCalMonth(base.slice(0, 7));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formModalOpen]);

  const toggleOffDate = (iso: string) => {
    setFormData((f) =>
      f.offDates.includes(iso)
        ? { ...f, offDates: f.offDates.filter((x) => x !== iso) }
        : { ...f, offDates: [...f.offDates, iso].sort() }
    );
  };

  const renderCalendar = () => {
    const y = Number(calMonth.slice(0, 4));
    const m = Number(calMonth.slice(5, 7));
    if (!y || !m) return null;
    const firstGap = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells: (number | null)[] = [
      ...Array<null>(firstGap).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    const shiftMonth = (dir: number) => {
      const d = new Date(y, m - 1 + dir, 1);
      setCalMonth(monthKey(d));
    };
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <Button type="button" variant="outline" size="sm" onClick={() => shiftMonth(-1)}>
            ‹
          </Button>
          <span className="text-sm font-semibold font-mono">{calMonth}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => shiftMonth(1)}>
            ›
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((lbl, i) => (
            <div key={i} className="h-7 flex items-center justify-center text-[11px] font-bold text-muted-foreground">
              {lbl}
            </div>
          ))}
          {cells.map((day, idx) => {
            if (day === null) return <div key={`e-${idx}`} />;
            const iso = `${calMonth}-${String(day).padStart(2, "0")}`;
            const dow = ((new Date(y, m - 1, day).getDay() + 6) % 7) + 1;
            const inRange =
              !!formData.startDate &&
              iso >= formData.startDate &&
              (!formData.endDate || iso <= formData.endDate);
            const workday = inRange && formData.weekdays.includes(dow);
            const off = formData.offDates.includes(iso);
            return (
              <button
                key={iso}
                type="button"
                disabled={!workday}
                onClick={() => toggleOffDate(iso)}
                title={off ? "Libur — klik untuk batalkan" : workday ? "Kerja — klik untuk tandai libur" : "Di luar rentang/pola"}
                className={`h-9 rounded-md text-xs font-semibold transition-colors ${
                  off
                    ? "bg-red-600 text-white"
                    : workday
                      ? "bg-white border hover:border-red-400"
                      : "text-gray-300"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Semua hari kerja aktif default — klik tanggal untuk tandai libur ({formData.offDates.length} hari).
        </p>
      </div>
    );
  };

  const columns: Column<ShiftAssignment>[] = [
    {
      key: "employee",
      header: "Karyawan",
      cell: (row) => (
        <div>
          <div className="text-[15px] font-medium text-foreground">
            {row.employee?.user?.fullName || "-"}
          </div>
          <div className="text-xs text-muted-foreground mt-1 font-mono">
            {row.employee?.employeeCode || row.employeeId}
          </div>
        </div>
      ),
    },
    {
      key: "division",
      header: "Divisi",
      cell: (row) => <span>{row.employee?.division?.name || "-"}</span>,
    },
    {
      key: "shift",
      header: "Shift aktif",
      cell: (row) => (
        <span>
          {row.shift ? `${row.shift.code} · ${row.shift.clockIn}–${row.shift.clockOut}` : "-"}
          {Array.isArray(row.offDates) && row.offDates.length > 0 && (
            <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
              {row.offDates.length} libur
            </span>
          )}
        </span>
      ),
    },
    {
      key: "weekdays",
      header: "Pola hari",
      cell: (row) => (
        <div className="flex gap-1">
          {WEEKDAY_LABELS.map((lbl, i) => (
            <span
              key={i}
              className={`w-6 h-6 rounded-md text-[11px] font-bold flex items-center justify-center ${
                row.weekdays.includes(i + 1) ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"
              }`}
            >
              {lbl}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "period",
      header: "Berlaku",
      cell: (row) => (
        <span>
          {String(row.startDate).slice(0, 10)} –{" "}
          {row.endDate ? String(row.endDate).slice(0, 10) : "…"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) =>
        overlapIds.has(row.id) ? (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            Overlap
          </span>
        ) : (
          <StatusDot tone="ok">Aktif</StatusDot>
        ),
    },
  ];

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Shifting" subtitle="Penempatan shift karyawan dan pola hari kerja">
        <Button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 border border-gray-200 dark:border-gray-700 hover:bg-primary-50 dark:hover:bg-primary-950"
        >
          <span>Assign karyawan</span>
        </Button>
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 dark:text-red-200 font-medium">{(error as Error).message || "Terjadi kesalahan"}</p>
        </div>
      )}

      {uniqueOverlapNames.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            {uniqueOverlapNames.length} penempatan tumpang tindih terdeteksi ({uniqueOverlapNames.join(", ")}) —
            perbaiki tanggal selesai.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard icon={<ArrowRightLeft className="h-5 w-5" />} label="Total penempatan" value={isLoading ? "-" : total} />
        <StatCard
          icon={<ArrowRightLeft className="h-5 w-5" />}
          label="Tumpang tindih"
          value={isLoading ? "-" : overlapIds.size}
        />
        <StatCard
          icon={<ArrowRightLeft className="h-5 w-5" />}
          label="Ditampilkan"
          value={isLoading ? "-" : displayRows.length}
          subtitle="Penempatan pada halaman ini"
        />
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama / kode karyawan..."
        fields={[
          {
            key: "shift",
            label: "Shift",
            type: "select",
            options: (shiftOptions || []).map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` })),
          },
        ]}
        values={{ shift: shiftFilter === "all" ? "" : shiftFilter }}
        onFieldChange={(key, v) => {
          if (key === "shift") {
            setShiftFilter(v || "all");
            setPage(1);
          }
        }}
        onReset={() => {
          setShiftFilter("all");
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={displayRows}
        keyExtractor={(r: ShiftAssignment) => r.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada penempatan shift"
        emptyIcon={<ArrowRightLeft className="w-16 h-16" />}
        actions={(row: ShiftAssignment) => (
          <div className="flex items-center justify-end gap-1">
            <Button variant="outline" size="sm" onClick={() => openEditModal(row)}>
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setToDelete({ id: row.id, name: row.employee?.user?.fullName || row.employeeId });
                setDeleteModalOpen(true);
              }}
            >
              Hapus
            </Button>
          </div>
        )}
      />

      {!isLoading && displayRows.length > 0 && (
        <div className="bg-gradient-to-r from-gray-50 dark:from-gray-900 to-gray-100 dark:to-gray-800 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Menampilkan <span className="font-bold text-foreground">{displayRows.length}</span> dari{" "}
              <span className="font-bold text-foreground">{total}</span> penempatan
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

      <Dialog
        open={formModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setFormModalOpen(false);
            setEditing(null);
            setFormData(defaultForm);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Penempatan" : "Assign Karyawan"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!formData.employeeId || !formData.shiftId || !formData.startDate) {
                toast.error("Karyawan, shift, dan tanggal mulai wajib diisi");
                return;
              }
              if (formData.weekdays.length === 0) {
                toast.error("Pilih minimal satu hari kerja");
                return;
              }
              saveMutation.mutate({
                employeeId: formData.employeeId,
                shiftId: formData.shiftId,
                startDate: formData.startDate,
                endDate: formData.endDate || undefined,
                weekdays: formData.weekdays,
                offDates: formData.offDates.filter(
                  (d) => d >= formData.startDate && (!formData.endDate || d <= formData.endDate)
                ),
              });
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium mb-1">Karyawan</label>
              <select
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                required
                disabled={!!editing}
              >
                <option value="">— Pilih karyawan —</option>
                {(employees || []).map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.user?.fullName || emp.employeeCode} · {emp.employeeCode}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Shift</label>
              <select
                value={formData.shiftId}
                onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                required
              >
                <option value="">— Pilih shift —</option>
                {(shiftOptions || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Tanggal mulai</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tanggal selesai (opsional)</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Pola hari (default semua hari kerja)</label>
              <div className="flex gap-1 mb-3">
                {WEEKDAY_LABELS.map((lbl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i + 1)}
                    className={`w-8 h-8 rounded-md text-xs font-bold ${
                      formData.weekdays.includes(i + 1)
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-400 border"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <label className="block text-sm font-medium mb-1">Hari libur (ketuk tanggal di kalender)</label>
              {renderCalendar()}
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setFormModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Menyimpan..." : editing ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Penempatan</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Penempatan shift <b>{toDelete?.name}</b> akan dihapus permanen.
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setDeleteModalOpen(false)}>
              Batal
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteMutation.isPending}
              onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
            >
              {deleteMutation.isPending ? "Memproses..." : "Hapus"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
