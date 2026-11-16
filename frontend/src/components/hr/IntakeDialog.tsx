import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { contractsService, type ContractType } from "@/services/contracts.service";
import { workingLocationsService } from "@/services/working-locations.service";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type IntakeMode = "kontrak" | "karyawan";

interface Props {
  open: boolean;
  mode: IntakeMode;
  onClose: () => void;
  onSuccess?: () => void;
  defaultEmployeeId?: string;
}

const emptyForm = {
  fullName: "",
  email: "",
  password: "",
  employeeId: "",
  previousContractId: "",
  positionId: "",
  type: "trial" as ContractType,
  startDate: "",
  endDate: "",
  probationEndDate: "",
  workingLocationId: "",
  basicSalary: "",
  branchIds: [] as string[],
  primaryBranchId: "",
  roleId: "",
  changeReason: "initial",
  status: "draft",
};

/**
 * Single HR intake dialog (IGDERP-270). Title and action follow the calling
 * menu via `mode`: Kontrak menu → "Kontrak Baru" (new row for an existing
 * employee), Karyawan menu → "Karyawan Baru" (user + employee + first
 * contract + branches + access in one transaction).
 */
export default function IntakeDialog({ open, mode, onClose, onSuccess, defaultEmployeeId }: Props) {
  const [form, setForm] = useState({ ...emptyForm, status: mode === "karyawan" ? "active" : "draft" });
  const [roleTouched, setRoleTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...emptyForm, status: mode === "karyawan" ? "active" : "draft", employeeId: defaultEmployeeId ?? "" });
      setRoleTouched(false);
      setSaving(false);
    }
  }, [open, mode, defaultEmployeeId]);

  const { data: positions = [] } = useQuery({
    queryKey: ["positions-options"],
    queryFn: async () => {
      const res = await api.get("/positions", { params: { limit: 300 } });
      return (res.data?.data ?? []) as { id: string; name: string; defaultRoleId: string | null }[];
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

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-options"],
    queryFn: async () => {
      const res = await api.get("/users", { params: { limit: 200, includeEmployee: true } });
      const body = res.data;
      return ((body?.data ?? body ?? []) as any[]).filter((u) => u.employee);
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

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const toggleBranch = (id: string) => {
    setForm((f) => {
      const has = f.branchIds.includes(id);
      const branchIds = has ? f.branchIds.filter((b) => b !== id) : [...f.branchIds, id];
      const primaryBranchId = branchIds.includes(f.primaryBranchId)
        ? f.primaryBranchId
        : (branchIds[0] ?? "");
      return { ...f, branchIds, primaryBranchId };
    });
  };

  const onPositionChange = async (positionId: string) => {
    set("positionId", positionId);
    if (mode !== "karyawan" || roleTouched || !positionId) return;
    try {
      const res = await contractsService.suggestRole(positionId);
      if (res.suggestedRole) set("roleId", res.suggestedRole.id);
    } catch {
      /* suggestion is best-effort */
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
          probationEndDate: norm(form.probationEndDate),
          workingLocationId: norm(form.workingLocationId),
          basicSalary: form.basicSalary === "" ? undefined : Number(form.basicSalary),
          positionId: norm(form.positionId),
          branchIds: form.branchIds,
          primaryBranchId: norm(form.primaryBranchId),
          roleId: norm(form.roleId),
        });
        toast.success("Karyawan berhasil ditambahkan");
      } else {
        if (!form.employeeId) {
          toast.error("Karyawan wajib dipilih");
          return;
        }
        await contractsService.create({
          employeeId: form.employeeId,
          type: form.type,
          startDate: form.startDate,
          endDate: norm(form.endDate),
          probationEndDate: norm(form.probationEndDate),
          workingLocationId: norm(form.workingLocationId),
          basicSalary: form.basicSalary === "" ? undefined : Number(form.basicSalary),
          positionId: norm(form.positionId),
          changeReason: form.changeReason,
          status: form.status as any,
          previousContractId: norm(form.previousContractId),
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

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <select value={form.roleId} onChange={(e) => { setRoleTouched(true); set("roleId", e.target.value); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
                  <option value="">— Pilih —</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.code} — {r.name}</option>)}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Karyawan</label>
                <select value={form.employeeId} onChange={(e) => { set("employeeId", e.target.value); set("previousContractId", ""); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
                  <option value="">— Pilih —</option>
                  {employees.map((u: any) => (
                    <option key={u.employee.id} value={u.employee.id}>
                      {u.employee.employeeCode} — {u.fullName || u.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Kontrak sebelumnya</label>
                <select value={form.previousContractId} onChange={(e) => set("previousContractId", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
                  <option value="">— Kontrak awal —</option>
                  {chain.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.contractNumber} · {c.type} · {c.status}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Alasan</label>
                <select value={form.changeReason} onChange={(e) => set("changeReason", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
                  <option value="initial">Awal</option>
                  <option value="renewal">Perpanjangan</option>
                  <option value="promotion">Promosi</option>
                  <option value="demotion">Demosi</option>
                  <option value="rotation">Rotasi</option>
                  <option value="adjustment">Penyesuaian</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={(e) => set("status", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
                  <option value="draft">Draft</option>
                  <option value="active">Aktif</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Posisi</label>
            <select value={form.positionId} onChange={(e) => onPositionChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
              <option value="">— Pilih —</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Stage kontrak</label>
            <select value={form.type} onChange={(e) => set("type", e.target.value as ContractType)}
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
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tanggal selesai</label>
            <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
          </div>
          {(form.type === "trial" || form.type === "probation") && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Akhir probation</label>
              <input type="date" value={form.probationEndDate} onChange={(e) => set("probationEndDate", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Working location</label>
            <select value={form.workingLocationId} onChange={(e) => set("workingLocationId", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
              <option value="">— Pilih —</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Gaji pokok</label>
            <input value={form.basicSalary} onChange={(e) => set("basicSalary", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Branch penempatan</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {branches.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm border border-gray-200 rounded-lg px-3 py-2 cursor-pointer">
                  <input type="checkbox" checked={form.branchIds.includes(b.id)} onChange={() => toggleBranch(b.id)} />
                  <span>{b.code}</span>
                  {form.primaryBranchId === b.id && (
                    <span className="ml-auto text-xs font-semibold text-green-700">primer</span>
                  )}
                </label>
              ))}
            </div>
          </div>
          {form.branchIds.length > 1 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Branch primer</label>
              <select value={form.primaryBranchId} onChange={(e) => set("primaryBranchId", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
                {form.branchIds.map((id) => {
                  const b = branches.find((x) => x.id === id);
                  return <option key={id} value={id}>{b?.code ?? id}</option>;
                })}
              </select>
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
