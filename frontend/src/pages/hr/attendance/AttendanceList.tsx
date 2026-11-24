import { useEffect, useState } from 'react';
import { BreadcrumbHeader, StatCard, FilterToolbar, DataTable, StatusDot } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Image as ImageIcon,
  MapPin,
  Palmtree,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { hrService, type RosterRow, type RosterDisplayStatus } from '@/services/hr.service';
import { reverseGeocodeStreet } from '@/utils/reverse-geocode';
import { useBranchFilter } from '@/components/branch/BranchFilter';
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

function initialsOf(row: RosterRow): string {
  return (row.employee?.user?.fullName || row.employee?.employeeCode || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function displayNameOf(row: RosterRow): string {
  return row.employee?.user?.fullName || row.employee?.employeeCode || 'N/A';
}

function ClockInCell({ row, onOpen }: { row: RosterRow; onOpen: (row: RosterRow) => void }) {
  const hide = row.displayStatus === 'cuti' || row.displayStatus === 'libur';
  const t = hm(row.clockIn);
  if (!t) {
    if (row.scheduleIn && !hide) {
      return (
        <div>
          <div className="text-sm text-muted-foreground">—</div>
          <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">{row.scheduleIn}</div>
        </div>
      );
    }
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  const bad = !!row.scheduleIn && t > row.scheduleIn;
  const hasGps = row.clockInLat != null && row.clockInLng != null;
  return (
    <button
      type="button"
      className="cursor-pointer rounded text-left hover:underline"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(row);
      }}
      title="Klik untuk lokasi"
    >
      <div className={`flex items-center gap-1 text-sm font-medium tabular-nums ${bad ? 'text-red-600 dark:text-red-400' : ''}`}>
        {t}
        {hasGps && <MapPin className="h-3 w-3 text-blue-600 dark:text-blue-400" />}
      </div>
      {row.scheduleIn && !hide && (
        <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">{row.scheduleIn}</div>
      )}
    </button>
  );
}

function ClockOutCell({ row, onOpen }: { row: RosterRow; onOpen: (row: RosterRow) => void }) {
  const hide = row.displayStatus === 'cuti' || row.displayStatus === 'libur';
  const t = hm(row.clockOut);
  if (!t) {
    if (row.scheduleOut && !hide) {
      return (
        <div>
          <div className="text-sm text-muted-foreground">—</div>
          <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">{row.scheduleOut}</div>
        </div>
      );
    }
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  const bad = !!row.scheduleOut && t < row.scheduleOut;
  const hasGps = row.clockOutLat != null && row.clockOutLng != null;
  return (
    <button
      type="button"
      className="cursor-pointer rounded text-left hover:underline"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(row);
      }}
      title="Klik untuk lokasi"
    >
      <div className={`flex items-center gap-1 text-sm font-medium tabular-nums ${bad ? 'text-red-600 dark:text-red-400' : ''}`}>
        {t}
        {hasGps && <MapPin className="h-3 w-3 text-blue-600 dark:text-blue-400" />}
      </div>
      {row.scheduleOut && !hide && (
        <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">{row.scheduleOut}</div>
      )}
    </button>
  );
}

/** OpenStreetMap embed centered on the clock coordinate. */
function osmEmbed(lat: number, lng: number): string {
  const d = 0.004;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function MapCard({ label, time, schedule, loc, lat, lng }: {
  label: string;
  time: string | null;
  schedule: string | null;
  loc?: string | null;
  lat?: number | null;
  lng?: number | null;
}) {
  const t = hm(time);
  const place = loc || (lat != null && lng != null ? `${lat}, ${lng}` : null);
  const [street, setStreet] = useState<string | null>(null);
  useEffect(() => {
    setStreet(null);
    if (lat == null || lng == null) return;
    let alive = true;
    reverseGeocodeStreet(lat, lng).then((s) => {
      if (alive && s) setStreet(s);
    });
    return () => {
      alive = false;
    };
  }, [lat, lng]);
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="px-3 pb-1 pt-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-mono text-lg font-bold tabular-nums">
          {t || '—'}{' '}
          {schedule && <span className="text-xs font-normal text-muted-foreground">· jadwal {schedule}</span>}
        </p>
      </div>
      {lat != null && lng != null ? (
        <>
          <iframe
            title={`Peta ${label}`}
            src={osmEmbed(lat, lng)}
            className="h-44 w-full border-y"
            loading="lazy"
          />
          <div className="px-3 py-2.5">
            {(street || place) && <p className="text-xs font-medium">{street || place}</p>}
            <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
              {lat}, {lng}
            </p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${lat}%2C${lng}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Buka di Maps →
            </a>
          </div>
        </>
      ) : (
        <div className="px-3 py-5 text-center">
          <MapPin className="mx-auto h-6 w-6 text-muted-foreground/40" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t ? 'Tidak ada lokasi tercatat.' : `Belum ada jam ${label.toLowerCase()}.`}
          </p>
        </div>
      )}
    </div>
  );
}

function PhotoCard({ label, time, photoUrl }: {
  label: string;
  time: string | null;
  photoUrl?: string | null;
}) {
  const t = hm(time);
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="px-3 pb-1 pt-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}{t ? ` · ${t}` : ''}
        </p>
      </div>
      {photoUrl ? (
        <>
          <img src={photoUrl} alt={`Foto ${label}`} className="max-h-64 w-full border-y object-cover" loading="lazy" />
          <div className="px-3 py-2.5">
            <a
              href={photoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Unduh asli →
            </a>
          </div>
        </>
      ) : (
        <div className="px-3 py-5 text-center">
          <ImageIcon className="mx-auto h-6 w-6 text-muted-foreground/40" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t ? 'Tidak ada foto terlampir.' : `Belum ada foto ${label.toLowerCase()}.`}
          </p>
        </div>
      )}
    </div>
  );
}

export default function AttendanceList() {
  const [date, setDate] = useState(todayLocal);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<RosterRow | null>(null);
  const [tab, setTab] = useState('peta');
  const { branchId, setBranchId } = useBranchFilter();
  const queryClient = useQueryClient();

  /** Popup selalu dibuka di tab Peta untuk jadwal yang sudah clock. */
  const openDetail = (row: RosterRow) => {
    setTab('peta');
    setSelected(row);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['roster', date, searchTerm, statusFilter, branchId],
    queryFn: () =>
      hrService.getRoster({
        date,
        search: searchTerm || undefined,
        status: statusFilter || undefined,
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
      toast.success('Kehadiran disetujui');
      setSelected(null);
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Gagal menyetujui kehadiran');
    },
  });
  const reject = useMutation({
    mutationFn: (id: string) => hrService.rejectAttendance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster'] });
      toast.success('Kehadiran ditolak');
      setSelected(null);
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Gagal menolak kehadiran');
    },
  });

  const columns: Column<RosterRow>[] = [
    {
      key: 'nama',
      header: 'Nama',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted text-sm font-medium text-muted-foreground">
            {initialsOf(row)}
          </div>
          <div>
            <div className="text-[15px] font-medium">{displayNameOf(row)}</div>
            <div className="text-xs text-muted-foreground">
              {row.employee?.employeeCode}
              {row.branch ? ` · ${row.branch.name}` : ''}
            </div>
          </div>
        </div>
      ),
    },
    { key: 'in', header: 'Clock in', cell: (row) => <ClockInCell row={row} onOpen={openDetail} /> },
    { key: 'out', header: 'Clock out', cell: (row) => <ClockOutCell row={row} onOpen={openDetail} /> },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => {
        const meta = STATUS_META[row.displayStatus] || STATUS_META.alpha;
        return (
          <div>
            <StatusDot tone={meta.tone}>{meta.label}</StatusDot>
            {row.needsApproval && (
              <div className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                Menunggu ACC atasan
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Absensi" subtitle="Kehadiran seluruh karyawan hari ini">
        <Link to="/hr/attendance/clock">
          <Button className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Clock In/Out</span>
          </Button>
        </Link>
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 dark:text-red-200 font-medium">Gagal memuat data absensi</p>
        </div>
      )}

      {/* Date strip: defaults today, arrows filter the day */}
      <div className="flex items-center gap-3 rounded-md border bg-card p-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setDate((d) => shiftDay(d, -1))}
          title="Hari sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm font-medium tabular-nums">
          {dayLabel(date)}
          <span className="block text-xs font-normal text-muted-foreground">
            Shift berlaku: Pagi 08:00–17:00 · Siang 13:00–21:00
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setDate((d) => shiftDay(d, 1))}
          title="Hari berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {rows.length} karyawan · {pendingCount} perlu persetujuan
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <StatCard icon={<CheckCircle className="h-5 w-5" />} label="Hadir" value={isLoading ? '-' : counts.hadir} />
        <StatCard icon={<Clock className="h-5 w-5" />} label="Terlambat" value={isLoading ? '-' : counts.terlambat} />
        <StatCard icon={<XCircle className="h-5 w-5" />} label="Alpha" value={isLoading ? '-' : counts.alpha} />
        <StatCard icon={<Calendar className="h-5 w-5" />} label="Cuti" value={isLoading ? '-' : counts.cuti} />
        <StatCard icon={<Palmtree className="h-5 w-5" />} label="Libur" value={isLoading ? '-' : counts.libur} />
      </div>

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama atau NIP"
        fields={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'hadir', label: 'Hadir' },
              { value: 'terlambat', label: 'Terlambat' },
              { value: 'alpha', label: 'Alpha' },
              { value: 'cuti', label: 'Cuti' },
              { value: 'libur', label: 'Libur' },
            ],
          },
          { key: 'date', label: 'Tanggal', type: 'date-range' },
        ]}
        values={{ status: statusFilter, dateFrom: date, dateTo: date }}
        onFieldChange={(key, v) => {
          if (key === 'status') setStatusFilter(v || '');
          else if (key === 'dateFrom' || key === 'dateTo') { if (v) setDate(v); }
        }}
        onReset={() => {
          setStatusFilter('');
          setDate(todayLocal());
        }}
        branchFilter={{ value: branchId, onChange: setBranchId, allowAll: true }}
      />

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={(r: RosterRow) => r.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada data absensi"
        emptyIcon={<Clock className="w-16 h-16" />}
        onRowClick={(row: RosterRow) => openDetail(row)}
        actions={(row: RosterRow) =>
          row.needsApproval && !String(row.id).startsWith('missing-') ? (
            <div className="flex items-center justify-end gap-1">
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  approve.mutate(row.id);
                }}
                disabled={approve.isPending || reject.isPending}
              >
                Setujui
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50"
                title="Tolak"
                onClick={(e) => {
                  e.stopPropagation();
                  reject.mutate(row.id);
                }}
                disabled={approve.isPending || reject.isPending}
              >
                Tolak
              </Button>
            </div>
          ) : undefined
        }
      />

      <p className="text-center text-xs text-muted-foreground">
        Klik baris atau jam untuk melihat peta & detail kehadiran · Setujui/Tolak hanya muncul untuk clock in/out di luar lokasi kerja
      </p>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{selected ? displayNameOf(selected) : ''}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border bg-muted text-sm font-medium text-muted-foreground">
                  {initialsOf(selected)}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {selected.employee?.employeeCode}
                    {selected.branch ? ` · ${selected.branch.name}` : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Shift{selected.shiftName ? ` · ${selected.shiftName}` : ''} · {formatDate(selected.date || date)}
                  </p>
                </div>
              </div>

              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="peta" className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    Peta
                    {(selected.clockInLat != null || selected.clockOutLat != null) && (
                      <span className="rounded-full bg-muted px-1.5 text-[11px]">
                        {(selected.clockInLat != null ? 1 : 0) + (selected.clockOutLat != null ? 1 : 0)}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="lampiran" className="flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Lampiran
                    {(selected.clockInPhotoUrl || selected.clockOutPhotoUrl) && (
                      <span className="rounded-full bg-muted px-1.5 text-[11px]">
                        {(selected.clockInPhotoUrl ? 1 : 0) + (selected.clockOutPhotoUrl ? 1 : 0)}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="peta">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <MapCard
                      label="Masuk"
                      time={selected.clockIn}
                      schedule={selected.scheduleIn}
                      loc={selected.clockInLocation}
                      lat={selected.clockInLat}
                      lng={selected.clockInLng}
                    />
                    <MapCard
                      label="Keluar"
                      time={selected.clockOut}
                      schedule={selected.scheduleOut}
                      loc={selected.clockOutLocation}
                      lat={selected.clockOutLat}
                      lng={selected.clockOutLng}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="lampiran">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <PhotoCard
                      label="Masuk"
                      time={selected.clockIn}
                      photoUrl={selected.clockInPhotoUrl}
                    />
                    <PhotoCard
                      label="Keluar"
                      time={selected.clockOut}
                      photoUrl={selected.clockOutPhotoUrl}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              {selected.isLate && selected.lateMinutes > 0 && (
                <div className="rounded-lg bg-red-50 p-2.5 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                  Terlambat {selected.lateMinutes} menit dari jadwal {selected.scheduleIn}
                </div>
              )}

              {selected.note && (
                <div className="bg-orange-50 dark:bg-orange-950 border-l-4 border-orange-500 rounded-lg p-4">
                  <p className="mb-0.5 text-xs font-medium">Note</p>
                  <p className="text-sm">{selected.note}</p>
                </div>
              )}

              {selected.needsApproval && !String(selected.id).startsWith('missing-') && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => approve.mutate(selected.id)}
                    disabled={approve.isPending || reject.isPending}
                  >
                    Setujui kehadiran
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-red-600 hover:bg-red-50"
                    onClick={() => reject.mutate(selected.id)}
                    disabled={approve.isPending || reject.isPending}
                  >
                    Tolak
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
