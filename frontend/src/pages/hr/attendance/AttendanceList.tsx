import { useState } from 'react';
import { BreadcrumbHeader, FilterToolbar } from '@/components/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, Calendar, User, CheckCircle, XCircle, AlertCircle, Eye } from 'lucide-react';
import { hrService, type Attendance } from '@/services/hr.service';
import { formatDate, formatDateTime } from '@/utils/format';
import { useBranchFilter } from '@/components/branch/BranchFilter';

export default function AttendanceList() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
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
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" />
            Present
          </span>
        );
      case 'absent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            <XCircle className="w-3 h-3" />
            Absent
          </span>
        );
      case 'leave':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <Calendar className="w-3 h-3" />
            Leave
          </span>
        );
      case 'holiday':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
            <Calendar className="w-3 h-3" />
            Holiday
          </span>
        );
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
            className="px-6 py-3 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
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
          setStartDate('');
          setEndDate('');
          setPage(1);
        }}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Records</p>
              <p className="text-2xl font-bold text-gray-900">{total}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Present</p>
              <p className="text-2xl font-bold text-green-600">
                {attendances.filter((a) => a.status === 'present').length}
              </p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Absent</p>
              <p className="text-2xl font-bold text-red-600">
                {attendances.filter((a) => a.status === 'absent').length}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">On Leave</p>
              <p className="text-2xl font-bold text-blue-600">
                {attendances.filter((a) => a.status === 'leave').length}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Memuat data...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">Gagal memuat data absensi</p>
          </div>
        ) : attendances.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Tidak ada data absensi</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Tanggal
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Karyawan
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Clock In
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Clock Out
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Total Hours
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendances.map((attendance) => (
                    <tr key={attendance.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{formatDate(attendance.date)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {attendance.employee?.user?.fullName || attendance.employee?.employeeCode || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500">{attendance.employee?.employeeCode}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {attendance.clockIn ? (
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {formatDateTime(attendance.clockIn)}
                            </div>
                            {attendance.isLate && (
                              <div className="text-xs text-red-600 flex items-center gap-1 mt-1">
                                <AlertCircle className="w-3 h-3" />
                                Terlambat {attendance.lateMinutes} menit
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {attendance.clockOut ? (
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {formatDateTime(attendance.clockOut)}
                            </div>
                            {attendance.isEarlyLeave && (
                              <div className="text-xs text-orange-600 flex items-center gap-1 mt-1">
                                <AlertCircle className="w-3 h-3" />
                                Pulang cepat {attendance.earlyLeaveMinutes} menit
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {attendance.totalHours ? (
                          <div className="text-sm font-semibold text-gray-900">{attendance.totalHours} jam</div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                        {attendance.overtimeHours && attendance.overtimeHours > 0 && (
                          <div className="text-xs text-blue-600 mt-1">+{attendance.overtimeHours} OT</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(attendance)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/hr/attendance/${attendance.id}`}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center"
                          title="Detail"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, total)} dari {total}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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

