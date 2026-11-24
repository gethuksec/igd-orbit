import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { contractsService, type Contract } from "@/services/contracts.service";
import { workingLocationsService } from "@/services/working-locations.service";
import { gradesService } from "@/services/grades.service";
import SearchableSelect from "@/components/hr/SearchableSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  contract: Contract | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface PositionOption {
  id: string;
  code: string;
  name: string;
  rank: number;
  gradeId: string | null;
}

const toDateInput = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");

/**
 * D2 (IGDERP-300): draft-only contract edit.
 * The row action is rendered only for status = draft; the dialog itself
 * also refuses non-draft rows and the BE rejects ref edits on non-drafts.
 * Field set mirrors the create form (position title + grade via the D4
 * matrix, dates, salary, placements).
 */
export default function ContractEditDialog({ contract, open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    endDate: "",
    probationEndDate: "",
    basicSalary: "",
    positionId: "",
    gradeId: "",
    workingLocationIds: [] as string[],
    branchIds: [] as string[],
    primaryBranchId: "",
  });
  const [saving, setSaving] = useState(false);
  const [matrix, setMatrix] = useState<{
    titleCode: string;
    grades: { id: string; code: string; name: string }[];
    positions: { id: string; code: string; gradeId: string | null }[];
  } | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const { data: positions = [] } = useQuery({
    queryKey: ["positions-options"],
    queryFn: async () => {
      const res = await api.get("/positions", { params: { limit: 300 } });
      return (res.data?.data ?? []) as PositionOption[];
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

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-options"],
    queryFn: async () => {
      const res = await api.get("/branches");
      const body = res.data;
      return ((body?.data ?? body ?? []) as { id: string; code: string; name: string }[]).filter(Boolean);
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

  // Prefill from the draft row when the dialog opens.
  useEffect(() => {
    if (!open || !contract) return;
    setSaving(false);
    setMatrix(null);
    let cancelled = false;
    (async () => {
      try {
        const full: any = await contractsService.getById(contract.id);
        if (cancelled) return;
        setForm({
          endDate: toDateInput(full.endDate),
          probationEndDate: toDateInput(full.probationEndDate),
          basicSalary: full.basicSalary === null || full.basicSalary === undefined ? "" : String(full.basicSalary),
          positionId: full.positionId ?? "",
          gradeId: full.gradeId ?? "",
          workingLocationIds: (full.contractWorkingLocations ?? []).map((c: any) => c.workingLocationId ?? c.workingLocation?.id).filter(Boolean),
          branchIds: (full.contractBranches ?? []).map((c: any) => c.branchId ?? c.branch?.id).filter(Boolean),
          primaryBranchId: (full.contractBranches ?? []).find((c: any) => c.isPrimary)?.branchId ?? full.primaryBranchId ?? "",
        });
        if (full.positionId) {
          try {
            setMatrixLoading(true);
            const res = await contractsService.getGradesByPosition(full.positionId);
            if (!cancelled) {
              setMatrix({ titleCode: res.titleCode, grades: res.grades ?? [], positions: res.positions ?? [] });
            }
          } catch {
            if (!cancelled) setMatrix(null);
          } finally {
            if (!cancelled) setMatrixLoading(false);
          }
        }
      } catch (e: any) {
        toast.error(e.response?.data?.message || "Gagal memuat kontrak");
        onClose();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contract?.id]);

  const familyOf = (code: string) => code.replace(/-\d$/, "");
  const titleLabelOf = (p: PositionOption) => (p.rank === 6 ? p.name.replace(/\s+\d$/, "") : p.name);

  const titleOptions = (() => {
    const seen = new Map<string, { value: string; label: string; sub: string }>();
    for (const p of positions) {
      const key = p.rank === 6 ? familyOf(p.code) : p.code;
      if (!seen.has(key)) {
        seen.set(key, {
          value: key,
          label: titleLabelOf(p),
          sub: p.rank === 6 ? "Staff · G1–G6" : `Level ${p.rank}`,
        });
      }
    }
    return [...seen.values()];
  })();

  const selectedTitle = (() => {
    const pos = positions.find((p) => p.id === form.positionId) ?? null;
    if (!pos) return "";
    return pos.rank === 6 ? familyOf(pos.code) : pos.code;
  })();

  const selectedIsStaff = (() => positions.find((p) => p.id === form.positionId)?.rank === 6)();

  const onTitleChange = async (titleCode: string) => {
    if (!titleCode) {
      setForm((f) => ({ ...f, positionId: "", gradeId: "" }));
      setMatrix(null);
      return;
    }
    const family = positions.filter((p) =>
      p.rank === 6 ? familyOf(p.code) === titleCode : p.code === titleCode,
    );
    if (family.length === 0) return;
    const isStaff = family[0].rank === 6;
    const targetGradeId = isStaff
      ? (family.some((p) => p.gradeId === form.gradeId) ? form.gradeId : (family[0].gradeId ?? ""))
      : "";
    const targetPos = isStaff ? (family.find((p) => p.gradeId === targetGradeId) ?? family[0]) : family[0];
    setForm((f) => ({ ...f, positionId: targetPos.id, gradeId: targetGradeId }));
    if (isStaff) {
      try {
        setMatrixLoading(true);
        const res = await contractsService.getGradesByPosition(targetPos.id);
        setMatrix({ titleCode: res.titleCode ?? titleCode, grades: res.grades ?? [], positions: res.positions ?? [] });
      } catch {
        setMatrix(null);
      } finally {
        setMatrixLoading(false);
      }
    } else {
      setMatrix({ titleCode, grades: [], positions: [] });
    }
  };

  const onGradeChange = (gradeId: string) => {
    const pos = positions.find((p) => p.id === form.positionId) ?? null;
    if (!pos || pos.rank !== 6) {
      set("gradeId", gradeId);
      return;
    }
    const family = familyOf(pos.code);
    const matrixRow =
      matrix && matrix.titleCode === family ? matrix.positions.find((r) => r.gradeId === gradeId) : null;
    const match = matrixRow
      ? positions.find((p) => p.id === matrixRow.id)
      : positions.find((p) => p.id !== pos.id && familyOf(p.code) === family && p.gradeId === gradeId);
    if (match) {
      setForm((f) => ({ ...f, gradeId, positionId: match.id }));
    } else {
      set("gradeId", gradeId);
    }
  };

  const matrixForTitle = matrix && matrix.titleCode === selectedTitle ? matrix : null;
  const gradeSource = matrixForTitle ? matrixForTitle.grades : grades;
  const gradeOptions = (gradeSource ?? []).map((g: any) => ({ value: g.id, label: g.code, sub: g.name }));
  const gradeDisabled = !selectedTitle || (!!form.positionId && !selectedIsStaff);
  const branchOptions = branches.map((b) => ({ value: b.id, label: b.code, sub: b.name }));
  const locationOptions = locations.map((l) => ({ value: l.id, label: `${l.code} — ${l.name}` }));

  const isDraft = (contract?.status ?? "draft") === "draft";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract) return;
    if (!isDraft) {
      toast.error("Hanya kontrak draft yang dapat diubah");
      return;
    }
    setSaving(true);
    try {
      await contractsService.update(contract.id, {
        endDate: form.endDate === "" ? null : form.endDate,
        probationEndDate: form.probationEndDate === "" ? null : form.probationEndDate,
        basicSalary: form.basicSalary === "" ? null : Number(form.basicSalary),
        positionId: form.positionId === "" ? null : form.positionId,
        gradeId: form.gradeId === "" ? null : form.gradeId,
        workingLocationIds: form.workingLocationIds,
        branchIds: form.branchIds,
        primaryBranchId: form.primaryBranchId === "" ? null : form.primaryBranchId,
      } as any);
      toast.success("Kontrak draft berhasil diubah");
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal menyimpan perubahan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Ubah Kontrak Draft{contract ? ` · ${contract.contractNumber}` : ""}
          </DialogTitle>
        </DialogHeader>
        {!isDraft && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Hanya kontrak berstatus draft yang dapat diubah. Kontrak {contract?.status} adalah arsip.
          </div>
        )}
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Posisi (jabatan)</label>
            <SearchableSelect value={selectedTitle} onChange={onTitleChange} options={titleOptions} disabled={!isDraft} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Grade{matrixLoading ? " (memuat…)" : ""}
            </label>
            <SearchableSelect
              value={form.gradeId}
              onChange={onGradeChange}
              options={gradeOptions}
              disabled={!isDraft || gradeDisabled}
              emptyText={!selectedTitle ? "Pilih posisi dulu" : "Jabatan ini tanpa grade"}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Tanggal selesai</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => set("endDate", e.target.value)}
              disabled={!isDraft}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Probation selesai</label>
            <input
              type="date"
              value={form.probationEndDate}
              onChange={(e) => set("probationEndDate", e.target.value)}
              disabled={!isDraft}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Gaji pokok</label>
            <input
              value={form.basicSalary}
              onChange={(e) => set("basicSalary", e.target.value)}
              disabled={!isDraft}
              inputMode="numeric"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Working location</label>
            <SearchableSelect
              multiple
              value={form.workingLocationIds}
              onChange={(v) => set("workingLocationIds", v)}
              options={locationOptions}
              disabled={!isDraft}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Branch penempatan</label>
            <SearchableSelect
              multiple
              value={form.branchIds}
              onChange={(v) => {
                const primaryBranchId = v.includes(form.primaryBranchId) ? form.primaryBranchId : (v[0] ?? "");
                setForm((f) => ({ ...f, branchIds: v, primaryBranchId }));
              }}
              options={branchOptions}
              disabled={!isDraft}
            />
          </div>
          {form.branchIds.length > 1 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Branch primer</label>
              <SearchableSelect
                value={form.primaryBranchId}
                onChange={(v) => set("primaryBranchId", v)}
                options={branchOptions.filter((b) => form.branchIds.includes(b.value))}
                disabled={!isDraft}
              />
            </div>
          )}
          <div className="md:col-span-2 flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={saving || !isDraft}>{saving ? "Menyimpan…" : "Simpan"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
