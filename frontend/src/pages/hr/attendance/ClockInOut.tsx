import { useRef, useState } from 'react';
import { BreadcrumbHeader } from '@/components/shared';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, CheckCircle, XCircle, AlertCircle, Camera, Navigation, Loader2 } from 'lucide-react';
import { hrService } from '@/services/hr.service';
import { formatDateTime } from '@/utils/format';
import { toast } from 'sonner';
import { useBranchStore } from '@/stores/branchStore';
import { api } from '@/services/api';

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** Downscale a photo to max 1280px JPEG so uploads stay under the 2MB cap. */
function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 1280;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas tidak didukung'));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Kompresi foto gagal'))),
        'image/jpeg',
        0.82,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Foto tidak terbaca'));
    };
    img.src = url;
  });
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS tidak didukung perangkat ini'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

export default function ClockInOut() {
  const queryClient = useQueryClient();
  const currentUser = getCurrentUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const { availableBranches } = useBranchStore();

  const [branchId, setBranchId] = useState('');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [outsideMsg, setOutsideMsg] = useState<string | null>(null);
  // IGDERP-297: non-radius failures (e.g. 400 validation) previously only
  // fired a toast that is easy to miss on the PWA — keep them visible inline.
  const [submitError, setSubmitError] = useState<string | null>(null);

  /** Backend may return message as string or string[] — always flatten. */
  const extractErrorMsg = (error: any): string => {
    const raw = error?.response?.data?.message;
    if (Array.isArray(raw)) return raw.join(', ') || 'Gagal clock';
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (typeof error?.message === 'string' && error.message.trim()) return error.message;
    return 'Gagal clock';
  };

  // Get today's attendance
  const today = new Date().toISOString().split('T')[0];
  const { data: todayAttendance, refetch: refetchAttendance } = useQuery({
    queryKey: ['attendance-today', today],
    queryFn: async () => {
      const response = await hrService.getAttendances({
        startDate: today,
        endDate: today,
      });
      return response.data?.[0] || null;
    },
  });

  // Get employee info (defaults the branch)
  const { data: employee } = useQuery({
    queryKey: ['employee-current'],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      const response = await api.get(`/users/${currentUser.id}`);
      return response.data.data || response.data;
    },
    enabled: !!currentUser?.id,
  });

  const employeeBranchId = employee?.employee?.branchId || employee?.branchId || '';
  const effectiveBranchId = branchId || employeeBranchId;

  const canClockIn = !todayAttendance?.clockIn;
  const canClockOut = todayAttendance?.clockIn && !todayAttendance?.clockOut;

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const blob = await compressImage(f);
      setPhotoFile(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }));
      setPhotoPreview(URL.createObjectURL(blob));
      setOutsideMsg(null);
      setSubmitError(null);
    } catch (err: any) {
      toast.error(err.message || 'Foto tidak terbaca');
    }
  };

  const handleLocate = async () => {
    setLocating(true);
    try {
      const pos = await getPosition();
      setCoords({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
      setOutsideMsg(null);
      setSubmitError(null);
    } catch {
      toast.error('Gagal mengambil lokasi GPS. Nyalakan GPS & izinkan akses lokasi.');
    } finally {
      setLocating(false);
    }
  };

  const readyToSubmit = !!photoFile && !!coords && !!effectiveBranchId;

  const submitMutation = useMutation({
    mutationFn: async () => {
      setSubmitError(null);
      if (!photoFile || !coords) throw new Error('Foto & GPS wajib');
      const { url } = await hrService.uploadSelfie(photoFile);
      const payload = {
        branch_id: effectiveBranchId,
        method: 'mobile' as const,
        latitude: coords.lat,
        longitude: coords.lng,
        photoUrl: url,
        notes: notes || undefined,
      };
      return canClockIn ? hrService.clockIn(payload) : hrService.clockOut(payload);
    },
    onSuccess: (res: any) => {
      if (res?.approvalStatus === 'pending') {
        toast.success('Absen di luar lokasi tercatat — menunggu persetujuan atasan');
      } else {
        toast.success(canClockIn ? 'Clock in berhasil!' : 'Clock out berhasil!');
      }
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendances'] });
      refetchAttendance();
      setNotes('');
      setPhotoFile(null);
      setPhotoPreview(null);
      setCoords(null);
      setOutsideMsg(null);
      setSubmitError(null);
    },
    onError: (error: any) => {
      const msg = extractErrorMsg(error);
      if (/luar lokasi/i.test(msg)) {
        setSubmitError(null);
        setOutsideMsg(msg); // "di luar lokasi" popup (meeting 16 Nov)
      } else {
        setOutsideMsg(null);
        setSubmitError(msg);
        toast.error(msg);
      }
    },
  });

  return (
    <div className="w-full space-y-4 md:space-y-6">
      {/* Header */}
      <BreadcrumbHeader title="Absen" subtitle={<>{employee?.fullName || employee?.email || 'Karyawan'} - {formatDateTime(new Date())}</>} />

      {/* Di-luar-lokasi popup */}
      {outsideMsg && (
        <div className="bg-red-50 dark:bg-red-950 border-2 border-red-500 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-red-800 dark:text-red-200">Di luar lokasi</p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{outsideMsg}</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              Isi alasan/catatan lalu kirim ulang — absen di luar lokasi menunggu persetujuan atasan.
            </p>
          </div>
          <button onClick={() => setOutsideMsg(null)} className="text-red-500 p-1" aria-label="Tutup">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Submit error (IGDERP-297: validation/network failures stay visible) */}
      {submitError && (
        <div className="bg-red-50 dark:bg-red-950 border-2 border-red-500 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-red-800 dark:text-red-200">Gagal absen</p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{submitError}</p>
          </div>
          <button onClick={() => setSubmitError(null)} className="text-red-500 p-1" aria-label="Tutup">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Today's Status */}
      {todayAttendance && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-4 md:p-6">
          <h2 className="text-base md:text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">Status Hari Ini</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Masuk</h3>
              </div>
              {todayAttendance.clockIn ? (
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatDateTime(todayAttendance.clockIn)}
                </p>
              ) : (
                <p className="text-sm text-gray-400">Belum absen</p>
              )}
              {todayAttendance.isLate && (
                <p className="text-xs text-red-600 mt-1">Terlambat {todayAttendance.lateMinutes} mnt</p>
              )}
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Pulang</h3>
              </div>
              {todayAttendance.clockOut ? (
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatDateTime(todayAttendance.clockOut)}
                </p>
              ) : (
                <p className="text-sm text-gray-400">Belum absen</p>
              )}
            </div>
          </div>
          {!!todayAttendance.totalHours && todayAttendance.totalHours > 0 && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400">Total Jam Kerja</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{todayAttendance.totalHours} jam</p>
            </div>
          )}
        </div>
      )}

      {/* Clock Form */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-4 md:p-6">
        <h2 className="text-base md:text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          {canClockIn ? 'Absen Masuk' : canClockOut ? 'Absen Pulang' : 'Absen Hari Ini Selesai'}
        </h2>

        {(canClockIn || canClockOut) ? (
          <div className="space-y-4">
            {/* Branch */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Cabang <span className="text-red-500">*</span>
              </label>
              <select
                value={effectiveBranchId}
                onChange={(e) => { setBranchId(e.target.value); setSubmitError(null); setOutsideMsg(null); }}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Pilih Cabang</option>
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
                {employeeBranchId && !availableBranches.some((b) => b.id === employeeBranchId) && (
                  <option value={employeeBranchId}>Cabang saya</option>
                )}
              </select>
            </div>

            {/* Selfie */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Foto Selfie <span className="text-red-500">*</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handlePhoto}
              />
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="Selfie" className="w-full max-h-72 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="absolute bottom-3 right-3 px-4 py-2 bg-black/70 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" /> Foto ulang
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 flex flex-col items-center gap-2 active:bg-gray-50 dark:active:bg-gray-800"
                >
                  <Camera className="w-10 h-10" />
                  <span className="font-semibold">Ketuk untuk foto selfie</span>
                  <span className="text-xs">Kamera depan terbuka otomatis</span>
                </button>
              )}
            </div>

            {/* GPS */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Lokasi GPS <span className="text-red-500">*</span>
              </label>
              {coords ? (
                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                  <MapPin className="w-6 h-6 text-green-600 shrink-0" />
                  <div className="flex-1 text-sm">
                    <p className="font-semibold text-green-800 dark:text-green-200">Lokasi terkunci</p>
                    <p className="text-green-700 dark:text-green-300 text-xs">
                      {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                      {coords.accuracy != null && ` (±${Math.round(coords.accuracy)}m)`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLocate}
                    disabled={locating}
                    className="px-3 py-2 text-sm font-semibold text-green-700 dark:text-green-300 underline"
                  >
                    Perbarui
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleLocate}
                  disabled={locating}
                  className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 font-semibold flex items-center justify-center gap-2 active:bg-gray-50 dark:active:bg-gray-800 disabled:opacity-50"
                >
                  {locating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Navigation className="w-6 h-6" />}
                  {locating ? 'Mengambil lokasi...' : 'Ketuk untuk kunci lokasi GPS'}
                </button>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Catatan / Alasan
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Keterangan tambahan... (wajib diisi bila absen di luar lokasi kerja)"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-base resize-none"
              />
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2 sticky bottom-0 bg-white dark:bg-gray-900 pb-1">
              <Link
                to="/hr/attendance"
                className="px-6 py-4 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-gray-700 dark:text-gray-300 text-center"
              >
                Batal
              </Link>
              <button
                type="button"
                onClick={() => submitMutation.mutate()}
                disabled={!readyToSubmit || submitMutation.isPending}
                className={`flex-1 px-6 py-4 rounded-lg font-bold text-white text-base flex items-center justify-center gap-2 disabled:opacity-50 ${
                  canClockIn ? 'bg-green-600 active:bg-green-700' : 'bg-red-600 active:bg-red-700'
                }`}
              >
                {submitMutation.isPending ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Mengirim...</>
                ) : canClockIn ? (
                  <><CheckCircle className="w-5 h-5" /> Absen Masuk</>
                ) : (
                  <><XCircle className="w-5 h-5" /> Absen Pulang</>
                )}
              </button>
            </div>
            {!readyToSubmit && (
              <p className="text-xs text-gray-500 text-center">
                {!effectiveBranchId ? 'Pilih cabang, ' : ''}{!photoFile ? 'ambil foto selfie, ' : ''}{!coords ? 'kunci lokasi GPS' : ''} untuk absen
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-gray-900 dark:text-gray-100">Absen hari ini selesai</p>
            <Link to="/hr/attendance" className="mt-3 inline-block text-primary-600 font-semibold">
              Lihat riwayat absensi
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
