import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ClipboardList, Loader2, MapPin, Wallet } from 'lucide-react';
import { branchesService } from '../../services/branches.service';
import { hrService } from '../../services/hr.service';
import { shiftsService } from '../../services/shifts.service';
import { useMe } from './MobileShell';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h >= 4 && h < 11) return 'Selamat pagi';
  if (h >= 11 && h < 15) return 'Selamat siang';
  if (h >= 15 && h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

function haversineM(a: number, o: number, b: number, e: number) {
  const R = 6371000;
  const dLa = ((b - a) * Math.PI) / 180;
  const dLo = ((e - o) * Math.PI) / 180;
  const s =
    Math.sin(dLa / 2) ** 2 +
    Math.cos((a * Math.PI) / 180) * Math.cos((b * Math.PI) / 180) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** IGDERP-276d: mockup-faithful beranda — red banner (greeting, name,
 *  position/outlet, avatar, shift pill, radius status), check-in card,
 *  2-col quick menu (Absensi / Request / Payroll). All data real. */
export default function MHome() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const today = todayStr();

  const { data: assignments } = useQuery({
    queryKey: ['m-my-shift', me?.id, today],
    queryFn: () =>
      shiftsService.getAssignments({ employeeId: me?.id, activeOn: today, limit: 5 }),
    enabled: !!me?.id,
    staleTime: 300_000,
    retry: false,
  });
  const { data: att, isLoading } = useQuery({
    queryKey: ['m-today', today],
    queryFn: () => hrService.getAttendances({ startDate: today, endDate: today }),
    staleTime: 30_000,
  });
  const branchId = me?.userBranches?.[0]?.branchId;
  const { data: branch } = useQuery({
    queryKey: ['m-branch', branchId],
    queryFn: () => branchesService.getById(branchId as string),
    enabled: !!branchId,
    staleTime: 300_000,
    retry: false,
  });

  // Live radius status: branch GPS (if exposed) vs device GPS.
  const [radiusOk, setRadiusOk] = useState<boolean | null>(null);
  useEffect(() => {
    const lat = (branch as any)?.latitude ?? (branch as any)?.lat;
    const lng = (branch as any)?.longitude ?? (branch as any)?.lng;
    if (lat == null || lng == null || !navigator.geolocation) {
      setRadiusOk(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const radiusM = (branch as any)?.radiusM ?? (branch as any)?.attendanceRadius ?? 100;
        setRadiusOk(haversineM(lat, lng, pos.coords.latitude, pos.coords.longitude) <= radiusM);
      },
      () => setRadiusOk(null),
      { timeout: 8000 }
    );
  }, [branch]);

  const rec = (att as any)?.data?.[0];
  const clockedIn = !!rec?.clockIn;

  const name = me?.employee?.fullName || me?.fullName || me?.email || 'Karyawan';
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase();
  const outlet = me?.userBranches?.[0]?.branch?.name || (branch as any)?.name || '';
  const position = me?.employee?.position || '';

  const myShift = (assignments as any)?.data?.[0];
  const shiftLabel = myShift?.shift
    ? `${myShift.shift.name} · ${String(myShift.shift.clockIn).slice(0, 5)}–${String(myShift.shift.clockOut).slice(0, 5)}`
    : null;

  const dateTitle = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="-mx-4 -mt-3">
      {/* Red banner */}
      <div className="bg-[#F04438] text-white px-5 pt-12 pb-4 rounded-b-3xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">{greeting()};</p>
            <h1 className="text-xl font-bold leading-tight">{name}</h1>
            <p className="text-xs opacity-90 mt-0.5">
              {[position, outlet].filter(Boolean).join(' · ') || me?.email}
            </p>
          </div>
          <div className="w-11 h-11 rounded-full bg-pink-200 text-red-700 font-bold flex items-center justify-center shrink-0">
            {initials}
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          {shiftLabel ? (
            <span className="inline-flex items-center gap-1.5 bg-white/95 text-gray-800 text-xs font-semibold rounded-full pl-2 pr-3 py-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {shiftLabel}
            </span>
          ) : (
            <span />
          )}
          <span className="inline-flex items-center gap-1 text-xs">
            <MapPin className="w-3.5 h-3.5" />
            {radiusOk === true
              ? 'Dalam radius outlet'
              : radiusOk === false
                ? 'Di luar radius'
                : outlet || ''}
          </span>
        </div>
      </div>

      <div className="px-4 mt-3 space-y-3">
        {/* Check-in status card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="font-bold text-gray-900">
              {clockedIn ? `Check-in ${String(rec.clockIn).slice(11, 16)}` : 'Belum check-in hari ini'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{dateTitle}</p>
          </div>
          <button
            onClick={() => navigate('/m/absen')}
            className="px-5 py-2 bg-[#F04438] text-white rounded-full text-sm font-bold"
          >
            Check-in
          </button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        )}

        {/* Quick menu */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/m/absen')}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center gap-1.5"
          >
            <MapPin className="w-7 h-7 text-red-500" />
            <span className="font-bold text-gray-900">Absensi</span>
            <span className="text-xs text-gray-500">clock-in & riwayat</span>
          </button>
          <button
            onClick={() => navigate('/m/request')}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center gap-1.5"
          >
            <ClipboardList className="w-7 h-7 text-blue-500" />
            <span className="font-bold text-gray-900">Request</span>
            <span className="text-xs text-gray-500">cuti · shift · lembur</span>
          </button>
          <button
            onClick={() => navigate('/m/slip')}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center gap-1.5"
          >
            <Wallet className="w-7 h-7 text-yellow-500" />
            <span className="font-bold text-gray-900">Payroll</span>
            <span className="text-xs text-gray-500">
              {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
