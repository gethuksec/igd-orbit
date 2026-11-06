import { useParams, Link } from 'react-router-dom';
import { BreadcrumbHeader } from '@/components/shared';
import { useQuery } from '@tanstack/react-query';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { hrService, type Attendance } from '@/services/hr.service';
import { formatDate, formatDateTime } from '@/utils/format';

export default function AttendanceDetail() {
  const { id } = useParams<{ id: string }>();

  // Note: Backend might need a getAttendanceById endpoint
  // For now, we'll fetch from list and filter
  const { data: attendance, isLoading, error } = useQuery({
    queryKey: ['attendance', id],
    queryFn: async () => {
      // This is a placeholder - actual implementation needs backend endpoint
      const response = await hrService.getAttendances({});
      return response.data.find((a: Attendance) => a.id === id);
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="w-full space-y-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (error || !attendance) {
    return (
      <div className="w-full space-y-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">Gagal memuat data absensi</p>
          <Link to="/hr/attendance" className="mt-4 text-blue-600 dark:text-blue-400 hover:underline">
            Kembali ke daftar
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200">
            <CheckCircle className="w-4 h-4" />
            Present
          </span>
        );
      case 'absent':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200">
            <XCircle className="w-4 h-4" />
            Absent
          </span>
        );
      case 'leave':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200">
            <Clock className="w-4 h-4" />
            Leave
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <BreadcrumbHeader title="Detail Absensi" subtitle={<>{attendance.employee?.user?.fullName || attendance.employee?.employeeCode || 'N/A'} -{' '} {formatDate(attendance.date)}</>} />

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Employee Info */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Informasi Karyawan</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Nama</p>
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {attendance.employee?.user?.fullName || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Employee Code</p>
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{attendance.employee?.employeeCode || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Cabang</p>
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{attendance.branch?.name || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Attendance Info */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Informasi Absensi</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Tanggal</p>
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{formatDate(attendance.date)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
              <div className="mt-1">{getStatusBadge(attendance.status)}</div>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Jam Kerja</p>
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {attendance.totalHours ? `${attendance.totalHours} jam` : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Clock In/Out Details */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Clock In / Out</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Clock In */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Clock In</h3>
            </div>
            {attendance.clockIn ? (
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Waktu</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{formatDateTime(attendance.clockIn)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Metode</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {attendance.clockInMethod === 'fingerprint' ? 'Fingerprint' : 'Manual'}
                  </p>
                </div>
                {attendance.clockInLocation && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Lokasi</p>
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{attendance.clockInLocation}</p>
                  </div>
                )}
                {attendance.isLate && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Terlambat {attendance.lateMinutes} menit
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">Belum clock in</p>
            )}
          </div>

          {/* Clock Out */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Clock Out</h3>
            </div>
            {attendance.clockOut ? (
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Waktu</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{formatDateTime(attendance.clockOut)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Metode</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {attendance.clockOutMethod === 'fingerprint' ? 'Fingerprint' : 'Manual'}
                  </p>
                </div>
                {attendance.clockOutLocation && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Lokasi</p>
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{attendance.clockOutLocation}</p>
                  </div>
                )}
                {attendance.isEarlyLeave && (
                  <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-950 rounded-lg">
                    <p className="text-sm text-orange-600 dark:text-orange-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Pulang cepat {attendance.earlyLeaveMinutes} menit
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">Belum clock out</p>
            )}
          </div>
        </div>
      </div>

      {/* Overtime & Notes */}
      {(attendance.overtimeHours || attendance.notes) && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Informasi Tambahan</h2>
          <div className="space-y-4">
            {attendance.overtimeHours && attendance.overtimeHours > 0 && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Overtime</p>
                <p className="text-base font-semibold text-blue-600 dark:text-blue-400">
                  {attendance.overtimeHours} jam
                  {attendance.overtimeApproved && (
                    <span className="ml-2 text-xs text-green-600 dark:text-green-400">(Approved)</span>
                  )}
                </p>
              </div>
            )}
            {attendance.notes && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Catatan</p>
                <p className="text-base text-gray-900 dark:text-gray-100">{attendance.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

