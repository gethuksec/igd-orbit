import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, MapPin, ArrowLeft, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { hrService } from '@/services/hr.service';
import { formatDateTime } from '@/utils/format';
import { toast } from 'sonner';
import { useBranchFilter } from '@/components/branch/BranchFilter';
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

export default function ClockInOut() {
  const queryClient = useQueryClient();
  const { availableBranches } = useBranchStore();
  const { branchId: selectedBranchId, setBranchId: setSelectedBranchId } = useBranchFilter();
  const currentUser = getCurrentUser();

  const [clockMethod, setClockMethod] = useState<'fingerprint' | 'manual'>('manual');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');

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

  // Get employee info
  const { data: employee } = useQuery({
    queryKey: ['employee-current'],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      const response = await api.get(`/users/${currentUser.id}`);
      return response.data.data || response.data;
    },
    enabled: !!currentUser?.id,
  });

  const clockInMutation = useMutation({
    mutationFn: () =>
      hrService.clockIn({
        branch_id: selectedBranchId,
        method: clockMethod,
        clock_in_location: location || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Clock in berhasil!');
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendances'] });
      refetchAttendance();
      setNotes('');
      setLocation('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal clock in');
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: () =>
      hrService.clockOut({
        branch_id: selectedBranchId,
        method: clockMethod,
        clock_out_location: location || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Clock out berhasil!');
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendances'] });
      refetchAttendance();
      setNotes('');
      setLocation('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal clock out');
    },
  });

  const canClockIn = !todayAttendance?.clockIn;
  const canClockOut = todayAttendance?.clockIn && !todayAttendance?.clockOut;


  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center gap-4">
          <Link
            to="/hr/attendance"
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <Clock className="w-10 h-10" />
              Clock In / Out
            </h1>
            <p className="text-blue-100 text-lg">
              {employee?.fullName || employee?.email || 'Karyawan'} - {formatDateTime(new Date())}
            </p>
          </div>
        </div>
      </div>

      {/* Today's Status */}
      {todayAttendance && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Status Hari Ini</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-gray-900">Clock In</h3>
              </div>
              {todayAttendance.clockIn ? (
                <div>
                  <p className="text-base font-semibold text-gray-900">
                    {formatDateTime(todayAttendance.clockIn)}
                  </p>
                  {todayAttendance.isLate && (
                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Terlambat {todayAttendance.lateMinutes} menit
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Belum clock in</p>
              )}
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="w-5 h-5 text-red-600" />
                <h3 className="font-semibold text-gray-900">Clock Out</h3>
              </div>
              {todayAttendance.clockOut ? (
                <div>
                  <p className="text-base font-semibold text-gray-900">
                    {formatDateTime(todayAttendance.clockOut)}
                  </p>
                  {todayAttendance.isEarlyLeave && (
                    <p className="text-sm text-orange-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Pulang cepat {todayAttendance.earlyLeaveMinutes} menit
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Belum clock out</p>
              )}
            </div>
          </div>

          {todayAttendance.totalHours && todayAttendance.totalHours > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Jam Kerja</p>
              <p className="text-2xl font-bold text-blue-600">{todayAttendance.totalHours} jam</p>
            </div>
          )}
        </div>
      )}

      {/* Clock In/Out Form */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          {canClockIn ? 'Clock In' : canClockOut ? 'Clock Out' : 'Sudah Clock In & Out'}
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canClockIn) {
              clockInMutation.mutate();
            } else if (canClockOut) {
              clockOutMutation.mutate();
            }
          }}
          className="space-y-6"
        >
          {/* Branch Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Cabang <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Pilih Cabang</option>
              {availableBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code})
                </option>
              ))}
            </select>
          </div>

          {/* Clock Method */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Metode <span className="text-red-500">*</span>
            </label>
            <select
              value={clockMethod}
              onChange={(e) => setClockMethod(e.target.value as 'fingerprint' | 'manual')}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="manual">Manual</option>
              <option value="fingerprint">Fingerprint</option>
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Lokasi (Opsional)
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Masukkan lokasi atau GPS"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {canClockIn ? 'Catatan Clock In' : 'Catatan Clock Out'} (Opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder={
                canClockIn
                  ? 'Contoh: Terlambat karena macet, izin ke dokter, dll...'
                  : 'Contoh: Pulang cepat karena ada keperluan, lembur sampai jam X, dll...'
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
            {canClockIn && (
              <p className="mt-1 text-xs text-gray-500">
                Jika terlambat, silakan jelaskan alasan di sini untuk keperluan absensi.
              </p>
            )}
            {canClockOut && (
              <p className="mt-1 text-xs text-gray-500">
                Jika pulang cepat atau ada keperluan, silakan jelaskan di sini.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Link
              to="/hr/attendance"
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 text-center"
            >
              Batal
            </Link>
            {canClockIn && (
              <button
                type="submit"
                disabled={clockInMutation.isPending || !selectedBranchId}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {clockInMutation.isPending ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Clocking In...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Clock In
                  </>
                )}
              </button>
            )}
            {canClockOut && (
              <button
                type="submit"
                disabled={clockOutMutation.isPending || !selectedBranchId}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {clockOutMutation.isPending ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Clocking Out...
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5" />
                    Clock Out
                  </>
                )}
              </button>
            )}
            {!canClockIn && !canClockOut && (
              <button
                disabled
                className="flex-1 px-6 py-3 bg-gray-400 text-white rounded-lg font-semibold cursor-not-allowed"
              >
                Sudah Clock In & Out
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

