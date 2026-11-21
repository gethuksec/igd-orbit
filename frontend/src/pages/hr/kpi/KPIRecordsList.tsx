import { useState, useEffect } from 'react';
import { BreadcrumbHeader } from '@/components/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Lock, Save, Plus, Pencil, AlertCircle, Eye } from 'lucide-react';
import { hrService, type KpiGrid } from '@/services/hr.service';
import { formatCurrency } from '@/utils/format';
import { toast } from 'sonner';
import { AspectFields, type AspectFormValue } from './KPIRecordForm';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const monthName = (m: number) => new Date(2000, m - 1).toLocaleString('id-ID', { month: 'long' });

export default function KPIRecordsList() {
  const queryClient = useQueryClient();
  const [divisionId, setDivisionId] = useState('');
  const [periodMonth, setPeriodMonth] = useState<number>(new Date().getMonth() + 1);
  const [periodYear, setPeriodYear] = useState<number>(new Date().getFullYear());
  const [tab, setTab] = useState<'nilai' | 'aspek'>('nilai');
  const [editingAspect, setEditingAspect] = useState<any | null>(null);

  // Local grid edits
  const [scores, setScores] = useState<Record<string, Record<string, string>>>({});
  const [kolektif, setKolektif] = useState<Record<string, string>>({});
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState('');

  const { data: divisions } = useQuery({
    queryKey: ['divisions-for-kpi'],
    queryFn: () => hrService.listDivisions(),
  });
  const divisionList: any[] = Array.isArray(divisions) ? divisions : divisions?.data || [];

  const activeDivisionId = divisionId || divisionList[0]?.id || '';
  const gridKey = ['kpi-grid', activeDivisionId, periodMonth, periodYear];

  const { data: grid, isLoading, error } = useQuery({
    queryKey: gridKey,
    queryFn: () => hrService.getKpiGrid(activeDivisionId, periodMonth, periodYear),
    enabled: !!activeDivisionId,
  });

  const seedFromGrid = (g: KpiGrid) => {
    const s: Record<string, Record<string, string>> = {};
    const k: Record<string, string> = {};
    const t: Record<string, string> = {};
    const n: Record<string, string> = {};
    for (const a of g.aspekts) {
      if (a.isKolektif && g.kolektif[a.id] !== undefined) k[a.id] = String(g.kolektif[a.id]);
      if (a.targetType === 'PERIOD' && g.targets[a.id] !== undefined && !Number.isNaN(g.targets[a.id])) {
        t[a.id] = String(g.targets[a.id]);
      }
    }
    for (const row of g.employees) {
      if (row.excludedReason) continue;
      s[row.employee.id] = {};
      for (const [aspectId, v] of Object.entries(row.scores)) s[row.employee.id][aspectId] = String(v);
      if (row.note) n[row.employee.id] = row.note;
    }
    setScores(s);
    setKolektif(k);
    setTargets(t);
    setNotes(n);
    setAmount(g.config ? String(g.config.defaultAmount) : '');
  };

  const locked = grid?.lock?.status === 'locked';

  useEffect(() => {
    if (grid) seedFromGrid(grid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid]);

  const saveMutation = useMutation({
    mutationFn: () =>
      hrService.saveKpiGrid(activeDivisionId, {
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
      }),
    onSuccess: (g) => {
      toast.success('Nilai KPI tersimpan');
      queryClient.setQueryData(gridKey, g);
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Gagal menyimpan nilai KPI');
    },
  });

  const lockMutation = useMutation({
    mutationFn: () => hrService.lockKpiPeriod(activeDivisionId, periodMonth, periodYear),
    onSuccess: () => {
      toast.success('Periode dikunci HR — payroll dapat membaca NILAI');
      queryClient.invalidateQueries({ queryKey: gridKey });
    },
    onError: (e: any) => {
      const msg = e.response?.data?.message;
      const gaps = e.response?.data?.gaps || msg?.gaps;
      toast.error(Array.isArray(gaps) ? `Belum lengkap: ${gaps.slice(0, 3).join('; ')}` : msg?.message || msg || 'Gagal mengunci periode');
    },
  });

  const amountMutation = useMutation({
    mutationFn: () => hrService.upsertKpiConfig(activeDivisionId, { default_amount: parseFloat(amount || '0') }),
    onSuccess: () => {
      toast.success('Default insentif divisi tersimpan');
      queryClient.invalidateQueries({ queryKey: gridKey });
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Gagal menyimpan default insentif');
    },
  });

  const individualAspects = grid?.aspekts?.filter((a) => !a.isKolektif) || [];
  const kolektifAspects = grid?.aspekts?.filter((a) => a.isKolektif) || [];
  const periodAspects = grid?.aspekts?.filter((a) => a.targetType === 'PERIOD' && !a.isKolektif) || [];

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader title="KPI Divisi" subtitle="Master aspek + penilaian bulanan per divisi">
        <Link
          to={`/hr/kpi/new?division=${activeDivisionId}`}
          className="px-6 py-3 bg-white dark:bg-gray-900 text-purple-600 dark:text-purple-400 rounded-lg font-semibold hover:bg-purple-50 dark:hover:bg-purple-950 transition-colors inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Tambah Aspek
        </Link>
      </BreadcrumbHeader>

      {/* Division + period picker */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Divisi</label>
          <select
            value={activeDivisionId}
            onChange={(e) => setDivisionId(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            {divisionList.map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Bulan</label>
          <select
            value={periodMonth}
            onChange={(e) => setPeriodMonth(parseInt(e.target.value, 10))}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tahun</label>
          <input
            type="number"
            value={periodYear}
            onChange={(e) => setPeriodYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 w-28"
          />
        </div>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => setTab('nilai')}
            className={`px-4 py-2 rounded-lg font-semibold ${tab === 'nilai' ? 'bg-purple-600 text-white' : 'border border-gray-300 dark:border-gray-600'}`}
          >
            Penilaian
          </button>
          <button
            onClick={() => setTab('aspek')}
            className={`px-4 py-2 rounded-lg font-semibold ${tab === 'aspek' ? 'bg-purple-600 text-white' : 'border border-gray-300 dark:border-gray-600'}`}
          >
            Aspek
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-xl">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat data...</p>
        </div>
      ) : error || !grid ? (
        <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-xl">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">Gagal memuat grid KPI — pilih divisi dahulu</p>
        </div>
      ) : tab === 'aspek' ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              Aspek {grid.division?.code} — bobot aktif total {Number(grid.weightsSum).toFixed(2)} (harus 1.00 saat kunci)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  {['Kode', 'Nama', 'Bobot', 'Target', 'Kolektif', 'Aksi'].map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {grid.aspekts.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 font-semibold text-sm">{a.code}</td>
                    <td className="px-6 py-4 text-sm">{a.name}</td>
                    <td className="px-6 py-4 text-sm">{Number(a.weight).toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm">{a.targetType === 'FIXED' ? `Tetap ${a.fixedTarget}` : 'Per periode'}</td>
                    <td className="px-6 py-4 text-sm">{a.isKolektif ? 'Ya' : '—'}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setEditingAspect(a)}
                        className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950 rounded-lg"
                        title="Ubah aspek"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {locked && (
            <div className="px-6 py-4 rounded-xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 font-semibold flex items-center gap-2">
              <Lock className="w-4 h-4" /> Periode ini dikunci HR — nilai tidak dapat diubah, payroll membaca NILAI.
            </div>
          )}
          {/* Targets + kolektif + amount */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Default insentif divisi (Rp)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={locked}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                    placeholder="mis. 700000"
                  />
                  <button
                    onClick={() => amountMutation.mutate()}
                    disabled={locked || amountMutation.isPending}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold disabled:opacity-50"
                  >
                    Simpan
                  </button>
                </div>
              </div>
              {periodAspects.map((a) => (
                <div key={a.id}>
                  <label className="block text-sm font-semibold mb-2">Target {a.code} (periode)</label>
                  <input
                    type="number"
                    value={targets[a.id] ?? ''}
                    onChange={(e) => setTargets({ ...targets, [a.id]: e.target.value })}
                    disabled={locked}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  />
                </div>
              ))}
              {kolektifAspects.map((a) => (
                <div key={a.id}>
                  <label className="block text-sm font-semibold mb-2">
                    {a.code} — aktual kolektif (sekali untuk semua)
                  </label>
                  <input
                    type="number"
                    value={kolektif[a.id] ?? ''}
                    onChange={(e) => setKolektif({ ...kolektif, [a.id]: e.target.value })}
                    disabled={locked}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Scoring grid */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase">Karyawan</th>
                    {individualAspects.map((a) => (
                      <th key={a.id} className="px-4 py-4 text-left text-xs font-semibold uppercase">
                        {a.code} <span className="font-normal">({a.intervalMin}–{a.intervalMax})</span>
                      </th>
                    ))}
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase">Catatan</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase">Total</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase">Nilai</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase">Bonus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {grid.employees.map((row) => (
                    <tr key={row.employee.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold">{row.employee?.user?.fullName || row.employee?.employeeCode}</div>
                        <div className="text-xs text-gray-500">{row.employee?.employeeCode}</div>
                        {row.excludedReason && <div className="text-xs text-yellow-600 mt-1">{row.excludedReason}</div>}
                      </td>
                      {individualAspects.map((a) => (
                        <td key={a.id} className="px-2 py-4">
                          <input
                            type="number"
                            value={scores[row.employee.id]?.[a.id] ?? ''}
                            onChange={(e) =>
                              setScores({
                                ...scores,
                                [row.employee.id]: { ...(scores[row.employee.id] || {}), [a.id]: e.target.value },
                              })
                            }
                            disabled={locked || !!row.excludedReason}
                            min={Number(a.intervalMin)}
                            max={Number(a.intervalMax)}
                            className="w-24 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-4">
                        <input
                          value={notes[row.employee.id] ?? ''}
                          onChange={(e) => setNotes({ ...notes, [row.employee.id]: e.target.value })}
                          disabled={locked || !!row.excludedReason}
                          placeholder="Catatan atasan..."
                          className="w-48 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                        />
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold">{row.total !== null ? row.total.toFixed(2) : '—'}</td>
                      <td className="px-4 py-4 text-sm font-bold text-purple-600">{row.nilai !== null ? row.nilai.toFixed(1) : '—'}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-green-600">
                        {row.bonus !== null ? formatCurrency(row.bonus) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
              <Link
                to={`/hr/kpi/${grid.employees[0]?.employee?.userId || ''}`}
                className="px-6 py-3 border rounded-lg font-semibold inline-flex items-center gap-2"
              >
                <Eye className="w-4 h-4" /> Lihat ala staff
              </Link>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={locked || saveMutation.isPending}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold disabled:opacity-50 inline-flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> {saveMutation.isPending ? 'Menyimpan...' : 'Simpan Nilai'}
              </button>
              <button
                onClick={() => lockMutation.mutate()}
                disabled={locked || lockMutation.isPending}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold disabled:opacity-50 inline-flex items-center gap-2"
              >
                <Lock className="w-4 h-4" /> {lockMutation.isPending ? 'Mengunci...' : 'Kunci Periode (HR)'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Edit aspect modal (shared fields with /hr/kpi/new) */}
      {editingAspect && (
        <AspectModal
          initial={editingAspect}
          onClose={() => setEditingAspect(null)}
          onSaved={() => {
            setEditingAspect(null);
            queryClient.invalidateQueries({ queryKey: gridKey });
          }}
        />
      )}
    </div>
  );
}

function AspectModal({ initial, onClose, onSaved }: { initial: any; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState<AspectFormValue>({
    code: initial.code,
    name: initial.name,
    description: initial.description || '',
    weight: String(initial.weight),
    target_type: initial.targetType,
    fixed_target: initial.fixedTarget != null ? String(initial.fixedTarget) : '',
    is_kolektif: !!initial.isKolektif,
    sort_order: String(initial.sortOrder ?? 0),
    is_active: initial.isActive !== false,
  });
  const mutation = useMutation({
    mutationFn: () =>
      hrService.updateKpiAspect(initial.id, {
        code: value.code,
        name: value.name,
        description: value.description || null,
        weight: parseFloat(value.weight),
        target_type: value.target_type,
        fixed_target: value.fixed_target === '' ? null : parseFloat(value.fixed_target),
        is_kolektif: value.is_kolektif,
        sort_order: parseInt(value.sort_order || '0', 10),
        is_active: value.is_active,
      }),
    onSuccess: () => {
      toast.success('Aspek diperbarui');
      onSaved();
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Gagal memperbarui aspek');
    },
  });
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-lg">Ubah Aspek {initial.code}</h3>
        <AspectFields value={value} onChange={setValue} />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg font-semibold">
            Batal
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {mutation.isPending ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
