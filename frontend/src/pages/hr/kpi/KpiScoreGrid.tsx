import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { hrService, type KpiGrid } from '@/services/hr.service';
import { usePermissions } from '@/hooks/usePermissions';

const fmt2 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtRp = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

function timeNow() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Scoring grid for one division + period (IGDERP-266).
 * mode=assign: draft autosave to localStorage, Simpan creates the shell.
 * mode=edit: Simpan nilai + Approve (HR), approved renders plain text.
 */
export function KpiScoreGrid({
  divisionId,
  periodMonth,
  periodYear,
  mode,
  onBack,
  onDone,
}: {
  divisionId: string;
  periodMonth: number;
  periodYear: number;
  mode: 'assign' | 'edit';
  onBack?: () => void;
  onDone?: () => void;
}) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canScore = hasPermission('hr.kpi.score');
  const canApprove = hasPermission('hr.kpi.lock');

  const [scores, setScores] = useState<Record<string, Record<string, string>>>({});
  const [kolektif, setKolektif] = useState<Record<string, string>>({});
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState('');
  const [draftAt, setDraftAt] = useState<string | null>(null);

  const gridKey = ['kpi-grid', divisionId, periodMonth, periodYear];
  const { data: grid, isLoading, error } = useQuery({
    queryKey: gridKey,
    queryFn: () => hrService.getKpiGrid(divisionId, periodMonth, periodYear),
    enabled: !!divisionId,
  });

  const draftKey = `kpi-draft:${divisionId}:${periodYear}-${periodMonth}`;

  useEffect(() => {
    if (!grid) return;
    const s: Record<string, Record<string, string>> = {};
    const k: Record<string, string> = {};
    const t: Record<string, string> = {};
    const n: Record<string, string> = {};
    for (const a of grid.aspekts) {
      if (a.isKolektif && grid.kolektif[a.id] !== undefined) k[a.id] = String(grid.kolektif[a.id]);
      if (a.targetType === 'PERIOD' && grid.targets[a.id] !== undefined && !Number.isNaN(grid.targets[a.id])) {
        t[a.id] = String(grid.targets[a.id]);
      }
    }
    for (const row of grid.employees) {
      if (row.excludedReason) continue;
      s[row.employee.id] = {};
      for (const [aspectId, v] of Object.entries(row.scores)) s[row.employee.id][aspectId] = String(v);
      if (row.note) n[row.employee.id] = row.note;
    }
    // Assign drafts kept locally until Simpan; server values win on load.
    if (mode === 'assign') {
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const d = JSON.parse(raw);
          Object.assign(s, d.scores || {});
          Object.assign(k, d.kolektif || {});
          Object.assign(t, d.targets || {});
          Object.assign(n, d.notes || {});
          if (d.draftAt) setDraftAt(d.draftAt);
        }
      } catch {
        /* corrupted draft — start fresh */
      }
    }
    setScores(s);
    setKolektif(k);
    setTargets(t);
    setNotes(n);
    setAmount(grid.config ? String(grid.config.defaultAmount) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid]);

  // Autosave draft (assign mode only).
  useEffect(() => {
    if (mode !== 'assign' || !grid) return;
    const t = setTimeout(() => {
      const at = timeNow();
      try {
        localStorage.setItem(draftKey, JSON.stringify({ scores, kolektif, targets, notes, draftAt: at }));
      } catch {
        /* storage full/blocked — draft stays in memory */
      }
      setDraftAt(at);
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, kolektif, targets, notes]);

  const approved = grid?.lock?.status === 'approved' || grid?.lock?.status === 'locked';
  const readOnly = approved || (mode === 'edit' && !canScore);

  const payload = () => ({
    period_month: periodMonth,
    period_year: periodYear,
    targets: Object.entries(targets)
      .filter(([, v]) => v !== '')
      .map(([aspectId, v]) => ({ aspectId, target: parseFloat(v) })),
    kolektif: Object.entries(kolektif)
      .filter(([, v]) => v !== '')
      .map(([aspectId, v]) => ({ aspectId, value: parseFloat(v) })),
    scores: Object.entries(scores).flatMap(([employeeId, byAspect]) =>
      Object.entries(byAspect)
        .filter(([, v]) => v !== '')
        .map(([aspectId, v]) => ({ employeeId, aspectId, value: parseFloat(v) })),
    ),
    notes: Object.entries(notes).map(([employeeId, v]) => ({ employeeId, notes: v || null })),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      mode === 'assign' ? hrService.assignKpiPeriod(divisionId, payload()) : hrService.saveKpiGrid(divisionId, payload()),
    onSuccess: (g: KpiGrid) => {
      toast.success(mode === 'assign' ? 'Periode dibuka' : 'Nilai tersimpan');
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* noop */
      }
      setDraftAt(null);
      queryClient.setQueryData(gridKey, g);
      queryClient.invalidateQueries({ queryKey: ['kpi-grid'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-divisions'] });
      if (onDone) onDone();
    },
    onError: (e: any) => {
      const data = e.response?.data;
      const msg = typeof data?.message === 'string' ? data.message : data?.message?.message;
      toast.error(msg || data?.message || 'Gagal menyimpan');
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => hrService.approveKpiPeriod(divisionId, periodMonth, periodYear),
    onSuccess: () => {
      toast.success('Approved by HR — payroll membaca Nilai');
      queryClient.invalidateQueries({ queryKey: gridKey });
      queryClient.invalidateQueries({ queryKey: ['kpi-divisions'] });
    },
    onError: (e: any) => {
      const data = e.response?.data;
      const gaps = data?.gaps || data?.message?.gaps;
      toast.error(
        Array.isArray(gaps) ? `Belum lengkap: ${gaps.slice(0, 3).join('; ')}` : data?.message || 'Gagal approve',
      );
    },
  });

  const amountMutation = useMutation({
    mutationFn: () => hrService.upsertKpiConfig(divisionId, { default_amount: parseFloat(amount || '0') }),
    onSuccess: () => {
      toast.success('Default insentif tersimpan');
      queryClient.invalidateQueries({ queryKey: gridKey });
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Gagal menyimpan default insentif');
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground px-5 py-8">Memuat grid...</p>;
  }
  if (error || !grid) {
    return <p className="text-sm text-destructive px-5 py-8">Gagal memuat grid penilaian</p>;
  }

  const individualAspects = grid.aspekts.filter((a) => !a.isKolektif);
  const kolektifAspects = grid.aspekts.filter((a) => a.isKolektif);
  const periodAspects = grid.aspekts.filter((a) => a.targetType === 'PERIOD' && !a.isKolektif);
  const inputCls = readOnly
    ? 'border-transparent bg-transparent px-1 text-muted-foreground'
    : 'font-mono tabular-nums text-right';

  return (
    <div>
      {mode === 'edit' && (
        <div className="flex items-center gap-3 px-5 py-3 text-[13px] text-muted-foreground border-b">
          {approved ? (
            <>
              <span className="inline-block font-medium text-primary border border-primary rounded-md px-2.5 py-0.5">
                Approved by HR{grid.lock?.lockedAt ? ` — ${new Date(grid.lock.lockedAt).toLocaleString('id-ID')}` : ''}
              </span>
              <span>Data tidak dapat diubah. Payroll membaca Nilai.</span>
            </>
          ) : (
            <>
              <span className="inline-block border border-muted-foreground/40 rounded-md px-2.5 py-0.5">Assigned</span>
              <span>Belum di-approve. Payroll membaca 0 sampai HR approve.</span>
            </>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-5 py-4 border-b">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Default insentif divisi (Rp)</p>
          <div className="flex gap-2">
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => amountMutation.mutate()}
              disabled={readOnly || !canScore}
              className="font-mono tabular-nums text-right"
            />
          </div>
          <p className="text-xs text-muted-foreground">Dibutuhkan &gt; 0 saat approve</p>
        </div>
        {periodAspects.map((a) => (
          <div key={a.id} className="space-y-2">
            <p className="text-xs text-muted-foreground">Target {a.code} (periode)</p>
            <Input
              value={targets[a.id] ?? ''}
              onChange={(e) => setTargets({ ...targets, [a.id]: e.target.value })}
              disabled={readOnly || !canScore}
              className="font-mono tabular-nums text-right"
            />
          </div>
        ))}
        {kolektifAspects.map((a) => (
          <div key={a.id} className="space-y-2">
            <p className="text-xs text-muted-foreground">{a.code} — aktual kolektif</p>
            <Input
              value={kolektif[a.id] ?? ''}
              onChange={(e) => setKolektif({ ...kolektif, [a.id]: e.target.value })}
              disabled={readOnly || !canScore}
              className="font-mono tabular-nums text-right"
            />
            <p className="text-xs text-muted-foreground">Dibagi ke semua baris</p>
          </div>
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Karyawan</TableHead>
            {individualAspects.map((a) => (
              <TableHead key={a.id} className="text-right">
                {a.code}
                <span className="block font-normal">
                  {a.intervalMin}–{a.intervalMax}
                </span>
              </TableHead>
            ))}
            <TableHead>Catatan</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Nilai</TableHead>
            <TableHead className="text-right">Bonus</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grid.employees.map((row) => (
            <TableRow key={row.employee.id}>
              <TableCell>
                <p className="font-medium">{row.employee?.user?.fullName || row.employee?.employeeCode}</p>
                <p className="font-mono text-xs text-muted-foreground">{row.employee?.employeeCode}</p>
                {row.excludedReason && <p className="text-xs text-amber-600 mt-1">{row.excludedReason}</p>}
              </TableCell>
              {individualAspects.map((a) => (
                <TableCell key={a.id} className="text-right">
                  <Input
                    value={scores[row.employee.id]?.[a.id] ?? ''}
                    onChange={(e) =>
                      setScores({
                        ...scores,
                        [row.employee.id]: { ...(scores[row.employee.id] || {}), [a.id]: e.target.value },
                      })
                    }
                    disabled={readOnly || !canScore || !!row.excludedReason}
                    className={`w-20 ml-auto ${inputCls}`}
                  />
                </TableCell>
              ))}
              <TableCell>
                <Input
                  value={notes[row.employee.id] ?? ''}
                  onChange={(e) => setNotes({ ...notes, [row.employee.id]: e.target.value })}
                  disabled={readOnly || !canScore || !!row.excludedReason}
                  placeholder="Catatan atasan..."
                  className={readOnly ? 'border-transparent bg-transparent px-1 text-muted-foreground' : ''}
                />
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-muted-foreground text-[13px]">
                {row.total !== null ? fmt2.format(row.total) : '—'}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums font-medium text-lg">
                {row.nilai !== null ? fmt2.format(row.nilai) : '—'}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {row.bonus !== null ? fmtRp.format(row.bonus) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-end gap-3 px-5 py-4">
        {mode === 'assign' && draftAt && (
          <span className="text-xs text-muted-foreground mr-auto">Draf tersimpan {draftAt}</span>
        )}
        {mode === 'assign' && onBack && (
          <Button variant="outline" onClick={onBack}>
            Kembali
          </Button>
        )}
        {((mode === 'assign' && canScore) || (mode === 'edit' && canScore && !approved)) && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Menyimpan...' : mode === 'assign' ? 'Simpan' : 'Simpan nilai'}
          </Button>
        )}
        {mode === 'edit' && canApprove && !approved && (
          <Button
            variant="outline"
            className="text-primary border-primary"
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
          >
            {approveMutation.isPending ? 'Memproses...' : 'Approve'}
          </Button>
        )}
      </div>
    </div>
  );
}
