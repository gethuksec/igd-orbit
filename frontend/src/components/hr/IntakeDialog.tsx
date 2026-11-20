import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { contractsService, type ContractType } from "@/services/contracts.service";
import { workingLocationsService } from "@/services/working-locations.service";
import { gradesService } from "@/services/grades.service";
import SearchableSelect from "@/components/hr/SearchableSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type IntakeMode = "kontrak" | "karyawan";
export type EntryType = "new" | "update";

interface Props {
  open: boolean;
  mode: IntakeMode;
  onClose: () => void;
  onSuccess?: () => void;
  defaultEmployeeId?: string;
}

interface PositionOption {
  id: string;
  code: string;
  name: string;
  rank: number;
  gradeId: string | null;
  defaultRoleId: string | null;
  grade?: { id: string; code: string; name: string } | null;
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const emptyForm = {
  entryType: "new" as EntryType,
  contractNumber: "",
  fullName: "",
  email: "",
  password: "",
  employeeId: "",
  previousContractId: "",
  positionId: "",
  gradeId: "",
  type: "trial" as ContractType,
  startDate: "",
  endDate: "",
  workingLocationIds: [] as string[],
  basicSalary: "",
  branchIds: [] as string[],
  primaryBranchId: "",
  roleId: "",
  changeReason: "",
};

/**
 * Single HR intake dialog (IGDERP-270). Title follows the calling menu via
 * `mode`: Kontrak menu → "Kontrak Baru" (standalone row or chained update
 * for an existing employee), Karyawan menu → "Karyawan Baru" (user +
 * employee + first contract + branches + access in one transaction).
 *
 * Contract status is automatic: started (start ≤ today) → active,
 * otherwise draft. Staff titles (rank 6) expand per grade — picking a grade
 * remaps the position to the matching title + grade row.
 */
export default function IntakeDialog({ open, mode, onClose, onSuccess, defaultEmployeeId }: Props) {
  const [form, setForm] = useState({ ...emptyForm });
  const [roleTouched, setRoleTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...emptyForm, employeeId: defaultEmployeeId ?? "" });
      setRoleTouched(false);
      setSaving(false);
    }
  }, [open, mode, defaultEmployeeId]);

  const { data: positions = [] } = useQuery({
    queryKey: ["positions-options"],
    queryFn: async () => {
      const res = await api.get("/positions", { params: { limit: 300 } });
      return (res.data?.data ?? []) as PositionOption[];
    },
    enabled: open,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-options"],
    queryFn: async () => {
      const res = await api.get("/branches");
      const body = res.data;
      return ((body?.data ?? body ?? []) as { id: string; code: string; name: string }[]).filter(Boolean);
    },
    enabled: open,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles-options"],
    queryFn: async () => {
      const res = await api.get("/roles", { params: { limit: 100 } });
      const body = res.data;
      return ((body?.data ?? body ?? []) as { id: string; code: string; name: string }[]);
    },
    enabled: open,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["working-locations-options"],
    queryFn: async () => {
      const res = await workingLocationsService.getAll();
      return res.data;
    },
    enabled: open,
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["grades-options"],
    queryFn: async () => {
      const res = await gradesService.getAll({ limit: 100 });
      return res.data;
    },
    enabled: open,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-options"],
    queryFn: async () => {
      const res = await api.get("/users", { params: { limit: 100, includeEmployee: true } });
      const body = res.data;
      const rows = body?.data?.data ?? body?.data ?? body ?? [];
      return (Array.isArray(rows) ? rows : []).filter((u: any) => u.employee);
    },
    enabled: open && mode === "kontrak",
  });

  const { data: chain = [] } = useQuery({
    queryKey: ["contract-chain", form.employeeId],
    queryFn: async () => {
      const res = await contractsService.getChain(form.employeeId);
      return res.data;
    },
    enabled: open && mode === "kontrak" && !!form.employeeId,
  });

  const autoStatus = form.startDate && form.startDate <= todayISO() ? "active" : "draft";

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const familyOf = (code: string) => code.replace(/-\d$/, "");

  const onEmployeeChange = (employeeId: string) => {
    setForm((f) => ({ ...f, employeeId, previousContractId: "" }));
  };

  // Auto-select the latest contract once the chain loads (update entries).
  useEffect(() => {
    if (mode === "kontrak" && form.entryType === "update" && form.employeeId && chain.length > 0) {
      setForm((f) => (f.previousContractId ? f : { ...f, previousContractId: chain[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, mode, form.entryType, form.employeeId]);

  const onPositionChange = async (positionId: string) => {
    const pos = positions.find((p) => p.id === positionId) ?? null;
    // Staff rows carry their rung; non-staff titles keep the chosen grade.
    setForm((f) => ({
      ...f,
      positionId,
      gradeId: pos && pos.rank === 6 ? (pos.gradeId ?? f.gradeId) : f.gradeId,
    }));
    if (mode !== "karyawan" || roleTouched || !positionId) return;
    try {
      const res = await contractsService.suggestRole(positionId);
      if (res.suggestedRole) set("roleId", res.suggestedRole.id);
    } catch {
      /* suggestion is best-effort */
    }
  };

  const onGradeChange = (gradeId: string) => {
    const pos = positions.find((p) => p.id === form.positionId) ?? null;
    if (!pos || pos.rank !== 6) {
      // Non-staff titles: grade rides along as a snapshot, position untouched.
      set("gradeId", gradeId);
      return;
    }
    const family = familyOf(pos.code);
    const match = positions.find(
      (p) => p.id !== pos.id && familyOf(p.code) === family && p.gradeId === gradeId
    );
    if (match) {
      setForm((f) => ({ ...f, gradeId, positionId: match.id }));
    } else {
      set("gradeId", gradeId);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const norm = (v: string) => (v === "" ? undefined : v);
    setSaving(true);
    try {
      if (mode === "karyawan") {
        if (!form.fullName || !form.email || !form.password) {
          toast.error("Nama, email, dan password wajib diisi");
          return;
        }
        await contractsService.intake({
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          type: form.type,
          startDate: form.startDate,
          endDate: norm(form.endDate),
          workingLocationIds: form.workingLocationIds,
          basicSalary: form.basicSalary === "" ? undefined : Number(form.basicSalary),
          positionId: norm(form.positionId),
          gradeId: norm(form.gradeId),
          branchIds: form.branchIds,
          primaryBranchId: norm(form.primaryBranchId),
          roleId: norm(form.roleId),
          status: autoStatus,
        });
        toast.success("Karyawan berhasil ditambahkan");
      } else {
        if (!form.employeeId) {
          toast.error("Karyawan wajib dipilih");
          return;
        }
        if (form.entryType === "update" && !form.previousContractId) {
          toast.error("Kontrak sebelumnya wajib dipilih");
          return;
        }
        await contractsService.create({
          employeeId: form.employeeId,
          ...(form.entryType === "new"
            ? { contractNumber: norm(form.contractNumber) }
            : {
                previousContractId: form.previousContractId,
                changeReason: norm(form.changeReason),
              }),
          type: form.type,
          startDate: form.startDate,
          endDate: norm(form.endDate),
          workingLocationIds: form.workingLocationIds,
          basicSalary: form.basicSalary === "" ? undefined : Number(form.basicSalary),
          positionId: norm(form.positionId),
          gradeId: norm(form.gradeId),
          status: autoStatus as any,
          branchIds: form.branchIds,
          primaryBranchId: norm(form.primaryBranchId),
        });
        toast.success("Kontrak berhasil ditambahkan");
      }
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const title = mode === "kontrak" ? "Kontrak Baru" : "Karyawan Baru";

  const employeeOptions = employees.map((u: any) => ({
    value: u.employee.id as string,
    label: `${u.employee.employeeCode} — ${u.fullName || u.email}`,
  }));
  const positionOptions = positions.map((p) => ({
    value: p.id,
    label: p.name,
    sub: p.grade?.code ?? p.code,
  }));
  const branchOptions = branches.map((b) => ({ value: b.id, label: b.code, sub: b.name }));
  const locationOptions = locations.map((l) => ({ value: l.id, label: `${l.code} — ${l.name}` }));
  const roleOptions = roles.map((r) => ({ value: r.id, label: r.code, sub: r.name }));
  const gradeOptions = grades.map((g) => ({ value: g.id, label: g.code, sub: g.name }));
  const chainOptions = chain.map((c: any) => ({
    value: c.id,
    label: `${c.contractNumber} · ${c.type}`,
    sub: c.status,
  }));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mode === "kontrak" && (
            <div className="md:col-span-2 flex gap-2">
              {(["new", "update"] as EntryType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("entryType", t)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    form.entryType === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white text-gray-600 border-gray-300 hover:border-primary-400"
                  }`}
                >
                  {t === "new" ? "Kontrak baru" : "Update kontrak"}
                </button>
              ))}
            </div>
          )}

          <div className="md:col-span-2 pt-1 border-t border-gray-100">
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400">
              {mode === "karyawan" ? "Data karyawan" : "Karyawan"}
            </h4>
          </div>
          {mode === "karyawan" ? (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama lengkap</label>
                <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email login</label>
                <input value={form.email} onChange={(e) => set("email", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
                <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Role akses</label>
                <SearchableSelect
                  value={form.roleId}
                  onChange={(v) => { setRoleTouched(true); set("roleId", v); }}
                  options={roleOptions}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Karyawan</label>
                <SearchableSelect
                  value={form.employeeId}
                  onChange={onEmployeeChange}
                  options={employeeOptions}
                />
              </div>
              {form.entryType === "new" ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nomor kontrak</label>
                  <input value={form.contractNumber} onChange={(e) => set("contractNumber", e.target.value)}
                    placeholder="Otomatis bila kosong"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Kontrak sebelumnya</label>
                    <SearchableSelect
                      value={form.previousContractId}
                      onChange={(v) => set("previousContractId", v)}
                      options={chainOptions}
                      disabled={!form.employeeId}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Alasan</label>
                    <input value={form.changeReason} onChange={(e) => set("changeReason", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
                  </div>
                </>
              )}
            </>
          )}

          <div className="md:col-span-2 pt-1 border-t border-gray-100">
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400">Kontrak</h4>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Posisi</label>
            <SearchableSelect
              value={form.positionId}
              onChange={onPositionChange}
              options={positionOptions}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Grade</label>
            <SearchableSelect
              value={form.gradeId}
              onChange={onGradeChange}
              options={gradeOptions}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tipe kontrak</label>
            <select value={form.type} onChange={(e) => {
              const t = e.target.value as ContractType;
              setForm((f) => ({ ...f, type: t, endDate: t === "pkwtt" ? "" : f.endDate }));
            }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
              <option value="trial">Trial</option>
              <option value="probation">Probation</option>
              <option value="pkwt">PKWT</option>
              <option value="pkwtt">PKWTT</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tanggal mulai</label>
            <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
          </div>
          {form.type !== "pkwtt" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tanggal selesai</label>
              <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
            </div>
          )}
          <div className="md:col-span-2 pt-1 border-t border-gray-100">
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400">Penempatan</h4>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Working location</label>
            <SearchableSelect
              multiple
              value={form.workingLocationIds}
              onChange={(v) => set("workingLocationIds", v)}
              options={locationOptions}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Gaji pokok</label>
            <input value={form.basicSalary} onChange={(e) => set("basicSalary", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Branch penempatan</label>
            <SearchableSelect
              multiple
              value={form.branchIds}
              onChange={(v) => {
                const primaryBranchId = v.includes(form.primaryBranchId)
                  ? form.primaryBranchId
                  : (v[0] ?? "");
                setForm((f) => ({ ...f, branchIds: v, primaryBranchId }));
              }}
              options={branchOptions}
            />
          </div>
          {form.branchIds.length > 1 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Branch primer</label>
              <SearchableSelect
                value={form.primaryBranchId}
                onChange={(v) => set("primaryBranchId", v)}
                options={branchOptions.filter((b) => form.branchIds.includes(b.value))}
              />
            </div>
          )}

          <div className="md:col-span-2 flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
