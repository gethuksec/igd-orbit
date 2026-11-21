import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { rosterService, shiftsService, type Shift } from "@/services/shifts.service";
import { BreadcrumbHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const DOW_LABELS = ["S", "S", "R", "K", "J", "S", "M"];

function nextMonthRange(): { start: string; end: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: fmt(first), end: fmt(last) };
}

function shiftTone(code: string | null): string {
  if (!code) return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  const c = code.toUpperCase();
  if (c.includes("PAGI")) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  if (c.includes("SIANG")) return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
  if (c.includes("MALAM")) return "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200";
  return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200";
}

export default function AssignShiftPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { employeeId } = useParams<{ employeeId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const nm = useMemo(nextMonthRange, []);

  // Month locked to next month — canonicalize the URL.
  const start = searchParams.get("start") || nm.start;
  const end = searchParams.get("end") || nm.end;
  useEffect(() => {
    if (start !== nm.start || end !== nm.end) {
      setSearchParams({ start: nm.start, end: nm.end }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: ctx, isLoading } = useQuery({
    queryKey: ["shift-roster-assign", employeeId, nm.start, nm.end],
    queryFn: () => rosterService.getAssignContext(employeeId!, nm.start, nm.end),
    enabled: !!employeeId,
  });

  const { data: shiftOptions } = useQuery({
    queryKey: ["shifts-options"],
    queryFn: async () => {
      const res = await shiftsService.getAll({ limit: 200, status: "active" });
      return (res.data ?? []) as Shift[];
    },
  });

  // date -> shiftId (string) | null (Libur). Absent = empty.
  const [picks, setPicks] = useState<Record<string, string | null>>({});
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (ctx && !hydrated) {
      const init: Record<string, string | null> = {};
      for (const en of ctx.entries) init[en.date] = en.shiftId;
      setPicks(init);
      setHydrated(true);
    }
  }, [ctx, hydrated]);

  const [popupDate, setPopupDate] = useState<string | null>(null);
  const [popupShift, setPopupShift] = useState<string>("LIBUR");

  // IGDERP-265 v2: suggest the resolved default shift when opening an empty day.
  const openDayPicker = (d: string, v: string | null | undefined) => {
    setPopupDate(d);
    if (v !== undefined) {
      setPopupShift(v === null ? "LIBUR" : v);
      return;
    }
    setPopupShift("LIBUR");
    if (!employeeId) return;
    shiftsService
      .resolveShift(employeeId, d)
      .then((res) => {
        if (res?.shift) {
          // only prefill if the user hasn't picked something meanwhile
          setPopupShift((cur) => (cur === "LIBUR" ? res.shift!.id : cur));
          const srcLabel =
            res.source === "title-default"
              ? "default jabatan"
              : res.source === "employee-default"
                ? "default karyawan"
                : res.source === "assignment"
                  ? "jadwal assignment"
                  : res.source;
          toast.success(`Saran shift dari ${srcLabel}: ${res.shift.code}`);
        }
      })
      .catch(() => {
        /* suggestion is best-effort */
      });
  };

  const days = useMemo(() => {
    const out: string[] = [];
    const cur = new Date(`${nm.start}T00:00:00`);
    const last = new Date(`${nm.end}T00:00:00`);
    while (cur <= last) {
      out.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [nm]);

  const y = Number(nm.start.slice(0, 4));
  const m = Number(nm.start.slice(5, 7));
  const firstGap = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const monthName = new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const codeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of shiftOptions ?? []) map.set(s.id, s.code);
    return map;
  }, [shiftOptions]);

  const overlayByDate = useMemo(() => {
    const map = new Map<string, { code: string; name: string }[]>();
    const emps = new Map((ctx?.overlay?.employees ?? []).map((e) => [e.id, e]));
    for (const en of ctx?.overlay?.entries ?? []) {
      if (en.employeeId === employeeId) continue;
      const e = emps.get(en.employeeId);
      if (!e) continue;
      const list = map.get(en.date) ?? [];
      list.push({ code: en.shiftCode ?? "LIBUR", name: e.fullName || e.employeeCode });
      map.set(en.date, list);
    }
    return map;
  }, [ctx, employeeId]);

  const plotted = days.filter((d) => picks[d] !== undefined && picks[d] !== null).length;
  const libur = days.filter((d) => picks[d] === null).length;
  const empty = days.filter((d) => picks[d] === undefined).length;

  const submitMutation = useMutation({
    mutationFn: () =>
      rosterService.submitRoster({
        employeeId: employeeId!,
        start: nm.start,
        end: nm.end,
        entries: days.map((date) => ({ date, shiftId: picks[date] ?? null })),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["shift-roster"] });
      queryClient.invalidateQueries({ queryKey: ["shift-roster-assign"] });
      toast.success(`Roster tersubmit (${res.submitted} hari)`);
      setHydrated(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Gagal submit roster"),
  });

  const applyBulk = (mode: "workdays" | "sundays-off") => {
    const fallback = shiftOptions?.[0]?.id;
    if (mode === "workdays" && !fallback) {
      toast.error("Belum ada shift aktif");
      return;
    }
    setPicks((p) => {
      const next = { ...p };
      for (const d of days) {
        const dow = new Date(`${d}T00:00:00`).getDay();
        if (mode === "sundays-off") {
          if (dow === 0) next[d] = null;
        } else if (next[d] === undefined && dow !== 0) {
          next[d] = fallback!;
        }
      }
      return next;
    });
  };

  const empName =
    (ctx?.employee as any)?.user?.fullName || (ctx?.employee as any)?.employeeCode || "—";
  const empCode = (ctx?.employee as any)?.employeeCode || "";

  return (
    <div className="space-y-4">
      <BreadcrumbHeader
        title={`Assign — ${empName}`}
        subtitle={`Roster ${monthName} (bulan depan, terkunci)`}
      >
        <Button variant="outline" onClick={() => navigate("/hr/shifting")}>
          Kembali ke roster
        </Button>
      </BreadcrumbHeader>

      {isLoading || !hydrated ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-8 text-center text-muted-foreground">
          Memuat kalender roster...
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px]">
            <div className="p-4 border-b lg:border-b-0 lg:border-r border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground font-mono">
                  {empCode} · {ctx?.employee && ((ctx.employee as any).division?.name || (ctx.employee as any).department?.name || "")}
                </span>
                <b className="capitalize">{monthName}</b>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {DOW_LABELS.map((lbl, i) => (
                  <div
                    key={i}
                    className="h-7 flex items-center justify-center text-xs font-semibold text-muted-foreground"
                  >
                    {lbl}
                  </div>
                ))}
                {Array<null>(firstGap)
                  .fill(null)
                  .map((_, i) => (
                    <div key={`e-${i}`} />
                  ))}
                {days.map((d) => {
                  const day = Number(d.slice(8, 10));
                  const v = picks[d];
                  const code = v === undefined ? null : v === null ? "LIBUR" : codeById.get(v) ?? "?";
                  const mates = overlayByDate.get(d) ?? [];
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => openDayPicker(d, v)}
                      className={`min-h-[76px] rounded-lg border p-1.5 text-left transition-colors hover:border-primary-400 ${
                        v === undefined
                          ? "border-dashed border-gray-300 dark:border-gray-700"
                          : "border-gray-200 dark:border-gray-700"
                      }`}
                      title="Ketuk untuk pilih shift"
                    >
                      <span className="text-xs font-medium tabular-nums">{day}</span>
                      {code && (
                        <span className={`block mt-1 rounded px-1 py-0.5 text-[11px] font-bold ${shiftTone(code)}`}>
                          {code}
                        </span>
                      )}
                      {mates.slice(0, 2).map((t, i) => (
                        <span key={i} className="block text-[10px] text-muted-foreground truncate">
                          {t.name.split(" ")[0]} · {t.code}
                        </span>
                      ))}
                      {mates.length > 2 && (
                        <span className="block text-[10px] text-muted-foreground">+{mates.length - 2} lain</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Ketuk tanggal untuk pilih shift. Baris kecil di bawah shift = rekan se-divisi (bantu putuskan
                konflik).
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-950">
              <h4 className="text-sm font-semibold mb-2">Shift se-divisi</h4>
              {(shiftOptions ?? []).map((s) => (
                <div
                  key={s.id}
                  className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg px-2.5 py-2 text-xs mb-1.5"
                >
                  <b className="font-mono">{s.code}</b>
                  <span className="block text-muted-foreground">
                    {s.clockIn}–{s.clockOut}
                  </span>
                </div>
              ))}
              <h4 className="text-sm font-semibold mt-4 mb-2">Isi cepat</h4>
              <div className="space-y-1.5">
                <Button variant="outline" size="sm" className="w-full" onClick={() => applyBulk("workdays")}>
                  Isi semua hari kerja
                </Button>
                <Button variant="outline" size="sm" className="w-full" onClick={() => applyBulk("sundays-off")}>
                  Tandai Minggu libur
                </Button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
            <span className="text-sm font-medium tabular-nums text-muted-foreground">
              {plotted} plotted · {libur} libur
              {empty > 0 && <b className="font-medium text-amber-700"> · {empty} tanggal kosong</b>}
              {empty === 0 && <span className="font-medium text-green-700"> · lengkap, siap submit</span>}
            </span>
            <Button disabled={empty > 0 || submitMutation.isPending} onClick={() => submitMutation.mutate()}>
              {submitMutation.isPending ? "Menyubmit..." : "Submit roster"}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={popupDate !== null} onOpenChange={(o) => !o && setPopupDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {popupDate
                ? new Date(`${popupDate}T00:00:00`).toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Shift</label>
              <select
                value={popupShift}
                onChange={(e) => setPopupShift(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
              >
                {(shiftOptions ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.clockIn}–{s.clockOut}
                  </option>
                ))}
                <option value="LIBUR">Libur</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPopupDate(null)}>
                Batal
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  if (popupDate) {
                    setPicks((p) => ({ ...p, [popupDate]: popupShift === "LIBUR" ? null : popupShift }));
                  }
                  setPopupDate(null);
                }}
              >
                Terapkan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
