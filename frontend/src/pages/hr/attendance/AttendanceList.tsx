import { useState } from 'react';
import { BreadcrumbHeader, FilterToolbar, StatusDot, StatCard } from '@/components/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, Calendar, User, CheckCircle, XCircle, AlertCircle, Eye } from 'lucide-react';
import { hrService, type Attendance } from '@/services/hr.service';
import { formatDate, formatDateTime } from '@/utils/format';
import { useBranchFilter } from '@/components/branch/BranchFilter';

// Default date filter: today (local) — Presensi opens on today's records.
function todayLocal(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function AttendanceList() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState(todayLocal);
  const [endDate, setEndDate] = useState(todayLocal);
  const { branchId, setBranchId } = useBranchFilter();
  const limit = 20;

  const { data, isLoading, error } = useQuery({
    queryKey: ['attendances', page, searchTerm, statusFilter, startDate, endDate, branchId],
    queryFn: async () => {
      const params: any = {};

      if (searchTerm) {
        params.search = searchTerm;
      }

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      if (startDate) {
        params.startDate = startDate;
      }

      if (endDate) {
        params.endDate = endDate;
      }

      if (branchId) {
        params.branchId = branchId;
      }

      return hrService.getAttendances(params);
    },
  });

  const attendances = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const getStatusBadge = (attendance: Attendance) => {
    switch (attendance.status) {
      case 'present':
        return <StatusDot tone="ok">Present</StatusDot>;
      case 'absent':
        return <StatusDot tone="bad">Absent</StatusDot>;
      case 'leave':
        return <StatusDot tone="warn">Leave</StatusDot>;
      case 'holiday':
        return <StatusDot tone="off">Holiday</StatusDot>;
      case 'not-clocked':
        return <StatusDot tone="off">Belum presensi</StatusDot>;
      default:
        return null;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <BreadcrumbHeader title="Absensi" subtitle="Kelola absensi karyawan">
        <Link
            to="/hr/attendance/clock"
            className="px-6 py-3 bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 rounded-lg font-semibold hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors"
          >
            Clock In/Out
          </Link>
      </BreadcrumbHeader>

      {/* Toolbar: search inline + branch inline + filter popup (IGDERP-110) */}
      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama karyawan atau employee code..."
        branchFilter={{ value: branchId, onChange: setBranchId, allowAll: true }}
        fields={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'present', label: 'Present' },
              { value: 'absent', label: 'Absent' },
              { value: 'leave', label: 'Leave' },
              { value: 'holiday', label: 'Holiday' },
              { value: 'not-clocked', label: 'Belum presensi' },
            ],
          },
          {
            key: 'date',
            label: 'Tanggal',
            type: 'date-range',
          },
        ]}
        values={{
          status: statusFilter === 'all' ? '' : statusFilter,
          dateFrom: startDate,
          dateTo: endDate,
        }}
        onFieldChange={(key, v) => {
          if (key === 'status') {
            setStatusFilter(v || 'all');
            setPage(1);
          } else if (key === 'dateFrom') {
            setStartDate(v);
            setPage(1);
          } else if (key === 'dateTo') {
            setEndDate(v);
            setPage(1);
          }
        }}
        onReset={() => {
          setStatusFilter('all');
          setStartDate(todayLocal());
          setEndDate(todayLocal());
          setPage(1);
        }}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Clock className="h-5 w-5" />} label="Total Records" value={total} />
        <StatCard
          icon={<CheckCircle className="h-5 w-5" />}
          label="Present"
          value={attendances.filter((a) => a.status === 'present').length}
        />
        <StatCard
          icon={<XCircle className="h-5 w-5" />}
          label="Absent"
          value={attendances.filter((a) => a.status === 'absent').length}
        />
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          label="On Leave"
          value={attendances.filter((a) => a.status === 'leave').length}
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat data...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400">Gagal memuat data absensi</p>
          </div>
        ) : attendances.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Tidak ada data absensi</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Tanggal
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Karyawan
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Clock In
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Clock Out
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Total Hours
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {attendances.map((attendance) => (
                    <tr key={attendance.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-[15px] font-medium text-gray-900 dark:text-gray-100">{formatDate(attendance.date)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                            <User className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
                              {attendance.employee?.user?.fullName || attendance.employee?.employeeCode || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{attendance.employee?.employeeCode}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {attendance.clockIn ? (
                          <div>
                            <div className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                              {formatDateTime(attendance.clockIn)}
                            </div>
                            {attendance.isLate && (
                              <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-1">
                                <AlertCircle className="w-3 h-3" />
                                Terlambat {attendance.lateMinutes} menit
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {attendance.clockOut ? (
                          <div>
                            <div className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                              {formatDateTime(attendance.clockOut)}
                            </div>
                            {attendance.isEarlyLeave && (
                              <div className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1 mt-1">
                                <AlertCircle className="w-3 h-3" />
                                Pulang cepat {attendance.earlyLeaveMinutes} menit
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {attendance.totalHours ? (
                          <div className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">{attendance.totalHours} jam</div>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                        )}
                        {attendance.overtimeHours && attendance.overtimeHours > 0 && (
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">+{attendance.overtimeHours} OT</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(attendance)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {!String(attendance.id).startsWith("missing-") && (
                          <Link
                            to={`/hr/attendance/${attendance.id}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="text-sm tabular-nums text-gray-600 dark:text-gray-400">
                  Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, total)} dari {total}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

