import { useState } from 'react';
import { BreadcrumbHeader, FilterToolbar } from '@/components/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Calendar, User, CheckCircle, XCircle, Clock, AlertCircle, Eye } from 'lucide-react';
import { hrService, type LeaveRequest } from '@/services/hr.service';
import { formatDate } from '@/utils/format';

export default function LeaveList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['leave-requests', statusFilter, startDate, endDate],
    queryFn: async () => {
      const params: any = {};

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      if (startDate) {
        params.startDate = startDate;
      }

      if (endDate) {
        params.endDate = endDate;
      }

      return hrService.getLeaveRequests(params);
    },
  });

  const leaveRequests = data?.data || [];
  const total = data?.total || 0;

  const filteredRequests = leaveRequests.filter((request: LeaveRequest) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      request.employee?.user?.fullName?.toLowerCase().includes(search) ||
      request.employee?.employeeCode?.toLowerCase().includes(search) ||
      request.leaveType.toLowerCase().includes(search) ||
      request.reason.toLowerCase().includes(search)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
            <XCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case 'annual':
        return 'Cuti Tahunan';
      case 'sick':
        return 'Sakit';
      case 'emergency':
        return 'Darurat';
      case 'unpaid':
        return 'Tanpa Gaji';
      default:
        return type;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <BreadcrumbHeader title="Cuti & Izin" subtitle="Kelola cuti dan izin karyawan">
        <Link
            to="/hr/leave/new"
            className="px-6 py-3 bg-white text-green-600 rounded-lg font-semibold hover:bg-green-50 transition-colors"
          >
            Ajukan Cuti
          </Link>
      </BreadcrumbHeader>

      {/* Toolbar: search inline + filter popup (IGDERP-110) */}
      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama karyawan atau employee code..."
        fields={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'cancelled', label: 'Cancelled' },
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
          } else if (key === 'dateFrom') {
            setStartDate(v);
          } else if (key === 'dateTo') {
            setEndDate(v);
          }
        }}
        onReset={() => {
          setStatusFilter('all');
          setStartDate('');
          setEndDate('');
        }}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">{total}</p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <Calendar className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">
                {filteredRequests.filter((r) => r.status === 'pending').length}
              </p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <Clock className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Approved</p>
              <p className="text-2xl font-bold text-green-600">
                {filteredRequests.filter((r) => r.status === 'approved').length}
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
              <p className="text-sm text-gray-600 mb-1">Rejected</p>
              <p className="text-2xl font-bold text-red-600">
                {filteredRequests.filter((r) => r.status === 'rejected').length}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            <p className="mt-4 text-gray-600">Memuat data...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">Gagal memuat data cuti</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Tidak ada data cuti</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Karyawan
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Tipe Cuti
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Periode
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Total Hari
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
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary-100 rounded-lg">
                            <User className="w-4 h-4 text-primary-600" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {request.employee?.user?.fullName || request.employee?.employeeCode || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500">{request.employee?.employeeCode}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{getLeaveTypeLabel(request.leaveType)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatDate(request.startDate)} - {formatDate(request.endDate)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{request.totalDays} hari</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(request.status)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/hr/leave/${request.id}`}
                          className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors inline-flex items-center"
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
          </>
        )}
      </div>
    </div>
  );
}
