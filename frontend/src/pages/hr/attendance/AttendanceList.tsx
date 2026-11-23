import { useState } from 'react';
import { BreadcrumbHeader, StatCard, StatusDot } from '@/components/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Palmtree,
  X,
  XCircle,
} from 'lucide-react';
import { hrService, type RosterRow, type RosterDisplayStatus } from '@/services/hr.service';
import { BranchFilterSelect, useBranchFilter } from '@/components/branch/BranchFilter';
import { formatDate } from '@/utils/format';

// Default date filter: today (local) — Presensi opens on today's roster.
function todayLocal(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function dayLabel(iso: string): string {
  const p = iso.split('-');
  if (p.length !== 3) return iso;
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function shiftDay(iso: string, delta: number): string {
  const p = iso.split('-');
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + delta);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** HH:MM (local) from ISO datetime, '' when empty. */
function hm(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const STATUS_META: Record<RosterDisplayStatus, { label: string; tone: 'ok' | 'warn' | 'off' | 'bad' }> = {
  hadir: { label: 'Hadir', tone: 'ok' },
  terlambat: { label: 'Terlambat', tone: 'warn' },
  alpha: { label: 'Alpha', tone: 'bad' },
  cuti: { label: 'Cuti', tone: 'warn' },
  libur: { label: 'Libur', tone: 'off' },
};

function ClockInCell({ row }: { row: RosterRow }) {
  const hide = row.displayStatus === 'cuti' || row.displayStatus === 'libur';
  const t = hm(row.clockIn);
  if (!t) {
    if (row.scheduleIn && !hide) {
      return (
        <div>
          <div className="text-sm text-gray-400 dark:text-gray-500">—</div>
          <div className="mt-0.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">{row.scheduleIn}</div>
        </div>
      );
    }
    return <span className="text-sm text-gray-400 dark:text-gray-500">—</span>;
  }
  const bad = !!row.scheduleIn && t > row.scheduleIn;
  return (
    <div>
      <div className={`text-sm font-medium tabular-nums ${bad ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>{t}</div>
      {row.scheduleIn && !hide && (
        <div className="mt-0.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">{row.scheduleIn}</div>
      )}
    </div>
  );
}

function ClockOutCell({ row }: { row: RosterRow }) {
  const hide = row.displayStatus === 'cuti' || row.displayStatus === 'libur';
  const t = hm(row.clockOut);
  if (!t) {
    if (row.scheduleOut && !hide) {
      return (
        <div>
          <div className="text-sm text-gray-400 dark:text-gray-500">—</div>
          <div className="mt-0.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">{row.scheduleOut}</div>
        </div>
      );
    }
    return <span className="text-sm text-gray-400 dark:text-gray-500">—</span>;
  }
  const bad = !!row.scheduleOut && t < row.scheduleOut;
  return (
    <div>
      <div className={`text-sm font-medium tabular-nums ${bad ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>{t}</div>
      {row.scheduleOut && !hide && (
        <div className="mt-0.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">{row.scheduleOut}</div>
      )}
    </div>
  );
}

function LocationBlock({ label, time, schedule, loc, lat, lng }: {
  label: string;
  time: string | null;
  schedule: string | null;
  loc?: string | null;
  lat?: number | null;
  lng?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const t = hm(time);
  const place = loc || (lat != null && lng != null ? `${lat}, ${lng}` : 'Lokasi tidak tercatat');
  return (
    <div
      className="cursor-pointer rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
      onClick={() => setOpen((v) => !v)}
      title="Klik untuk lokasi"
    >
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 font-mono text-xl font-medium tabular-nums ${t ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
        {t || '—'}
      </p>
      {schedule && <p className="mt-0.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">{schedule}</p>}
      {open && (
        <div className="mt-2 border-t border-dashed border-gray-200 pt-2 dark:border-gray-700">
          <p className="text-xs text-gray-600 dark:text-gray-300">{place}</p>
          {lat != null && lng != null && (
            <p className="mt-0.5 font-mono text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
              {lat}, {lng}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AttendanceList() {
  const [date, setDate] = useState(todayLocal);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<RosterRow | null>(null);
  const { branchId, setBranchId } = useBranchFilter();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['roster', date, searchTerm, statusFilter, branchId],
    queryFn: () =>
      hrService.getRoster({
        date,
        search: searchTerm || undefined,
        status: statusFilter,
        branchId: branchId || undefined,
      }),
  });

  const rows = data?.data || [];
  const counts = data?.counts || { hadir: 0, terlambat: 0, alpha: 0, cuti: 0, libur: 0 };
  const pendingCount = rows.filter((r) => r.needsApproval).length;

  const approve = useMutation({
    mutationFn: (id: string) => hrService.approveAttendance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster'] });
      setSelected(null);
    },
  });
  const reject = useMutation({
    mutationFn: (id: string) => hrService.rejectAttendance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster'] });
      setSelected(null);
    },
  });

  return (
    <div className="w-full space-y-4">
      <BreadcrumbHeader title="Absensi" subtitle="Kehadiran seluruh karyawan hari ini">
        <Link
          to="/hr/attendance/clock"
          className="rounded-lg bg-white px-6 py-3 font-semibold text-primary-600 transition-colors hover:bg-primary-50 dark:bg-gray-900 dark:text-primary-400 dark:hover:bg-primary-950"
        >
          Clock In/Out
        </Link>
      </BreadcrumbHeader>

      {/* Date strip: defaults today, arrows + picker filter the day */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-md dark:border-gray-800 dark:bg-gray-900">
        <button
          onClick={() => setDate((d) => shiftDay(d, -1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          title="Hari sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
          {dayLabel(date)}
          <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
            Shift berlaku: Pagi 08:00–17:00 · Siang 13:00–21:00
          </span>
        </div>
        <button
          onClick={() => setDate((d) => shiftDay(d, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          title="Hari berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="ml-auto text-xs tabular-nums text-gray-500 dark:text-gray-400">
          {rows.length} karyawan · {pendingCount} perlu persetujuan
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={<CheckCircle className="h-5 w-5" />} label="Hadir" value={counts.hadir} />
        <StatCard icon={<Clock className="h-5 w-5" />} label="Terlambat" value={counts.terlambat} />
        <StatCard icon={<XCircle className="h-5 w-5" />} label="Alpha" value={counts.alpha} />
        <StatCard icon={<Calendar className="h-5 w-5" />} label="Cuti" value={counts.cuti} />
        <StatCard icon={<Palmtree className="h-5 w-5" />} label="Libur" value={counts.libur} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari nama atau NIP"
          className="h-9 min-w-52 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-primary-500"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm tabular-nums focus:ring-2 focus:ring-primary-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">Semua status</option>
          <option value="hadir">Hadir</option>
          <option value="terlambat">Terlambat</option>
          <option value="alpha">Alpha</option>
          <option value="cuti">Cuti</option>
          <option value="libur">Libur</option>
        </select>
        <BranchFilterSelect value={branchId} onChange={setBranchId} allowAll />
        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
          Menampilkan {rows.length} dari {rows.length} karyawan
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat data...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500 dark:text-red-400" />
            <p className="text-red-600 dark:text-red-400">Gagal memuat data absensi</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-500" />
            <p className="text-gray-600 dark:text-gray-400">Tidak ada data absensi</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-950">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Nama</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Clock in</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Clock out</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                {rows.map((row) => {
                  const meta = STATUS_META[row.displayStatus] || STATUS_META.alpha;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelected(row)}
                      className={`cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                        row.needsApproval ? 'bg-orange-50 dark:bg-orange-950/30' : ''
                      }`}
                    >
                      <td className="whitespace-nowrap px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted text-sm font-medium text-muted-foreground">
                            {(row.employee?.user?.fullName || row.employee?.employeeCode || '?')
                              .split(' ')
                              .map((w) => w[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <div>
                            <div className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
                              {row.employee?.user?.fullName || row.employee?.employeeCode || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {row.employee?.employeeCode}
                              {row.branch ? ` · ${row.branch.name}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3">
                        <ClockInCell row={row} />
                      </td>
                      <td className="whitespace-nowrap px-6 py-3">
                        <ClockOutCell row={row} />
                      </td>
                      <td className="whitespace-nowrap px-6 py-3">
                        <StatusDot tone={meta.tone}>{meta.label}</StatusDot>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3" onClick={(e) => e.stopPropagation()}>
                        {row.needsApproval && !String(row.id).startsWith('missing-') ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => approve.mutate(row.id)}
                              disabled={approve.isPending || reject.isPending}
                              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                            >
                              Setujui
                            </button>
                            <button
                              onClick={() => reject.mutate(row.id)}
                              disabled={approve.isPending || reject.isPending}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                            >
                              Tolak
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Klik baris untuk melihat detail kehadiran · Setujui/Tolak hanya muncul untuk clock in/out di luar lokasi kerja
      </p>

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[calc(100vh-3rem)] w-full max-w-lg overflow-auto rounded-2xl border bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-gray-200 p-5 pb-4 dark:border-gray-700">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border bg-muted text-sm font-medium text-muted-foreground">
                {(selected.employee?.user?.fullName || selected.employee?.employeeCode || '?')
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div>
                <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                  {selected.employee?.user?.fullName || selected.employee?.employeeCode}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selected.employee?.employeeCode}
                  {selected.branch ? ` · ${selected.branch.name}` : ''}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                title="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 text-sm dark:bg-gray-950">
                <span className="text-gray-500 dark:text-gray-400">
                  Shift{selected.shiftName ? ` · ${selected.shiftName}` : ''}
                </span>
                <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">
                  {formatDate(selected.date || date)}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <LocationBlock
                  label="Masuk"
                  time={selected.clockIn}
                  schedule={selected.scheduleIn}
                  loc={selected.clockInLocation}
                  lat={selected.clockInLat}
                  lng={selected.clockInLng}
                />
                <LocationBlock
                  label="Keluar"
                  time={selected.clockOut}
                  schedule={selected.scheduleOut}
                  loc={selected.clockOutLocation}
                  lat={selected.clockOutLat}
                  lng={selected.clockOutLng}
                />
              </div>

              {selected.note && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200">
                  <p className="mb-0.5 text-xs font-medium">Note</p>
                  {selected.note}
                </div>
              )}

              {selected.needsApproval && !String(selected.id).startsWith('missing-') && (
                <div className="flex gap-2">
                  <button
                    onClick={() => approve.mutate(selected.id)}
                    disabled={approve.isPending || reject.isPending}
                    className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                  >
                    Setujui kehadiran
                  </button>
                  <button
                    onClick={() => reject.mutate(selected.id)}
                    disabled={approve.isPending || reject.isPending}
                    className="flex-1 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    Tolak
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
