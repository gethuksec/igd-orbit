import { useState, useEffect } from 'react';
import { BreadcrumbHeader, FilterToolbar } from '@/components/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Banknote, CheckCircle, XCircle, Clock, AlertCircle, DollarSign, Eye, CheckSquare } from 'lucide-react';
import { hrService, type Payroll } from '@/services/hr.service';
import { formatCurrency } from '@/utils/format';
import { toast } from 'sonner';

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function PayrollList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPayrolls, setSelectedPayrolls] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const currentUser = getCurrentUser();
  const userRoles: string[] = currentUser?.roles || (currentUser?.role?.code ? [currentUser.role.code] : []);

  const isCHR = userRoles.some((r) => r === 'CHR');
  const isCFO = userRoles.some((r) => r === 'CFO');

  const [periodMonth, setPeriodMonth] = useState<number | undefined>(() => {
    const month = searchParams.get('periodMonth');
    return month ? parseInt(month, 10) : undefined;
  });
  const [periodYear, setPeriodYear] = useState<number | undefined>(() => {
    const year = searchParams.get('periodYear');
    return year ? parseInt(year, 10) : undefined;
  });

  // Update URL when period changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (periodMonth) {
      params.set('periodMonth', periodMonth.toString());
    } else {
      params.delete('periodMonth');
    }
    if (periodYear) {
      params.set('periodYear', periodYear.toString());
    } else {
      params.delete('periodYear');
    }
    setSearchParams(params, { replace: true });
  }, [periodMonth, periodYear, searchParams, setSearchParams]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['payrolls', statusFilter, periodMonth, periodYear],
    queryFn: async () => {
      const params: any = {};

      // Only add period filters if they are set
      if (periodMonth) {
        params.periodMonth = periodMonth;
      }
      if (periodYear) {
        params.periodYear = periodYear;
      }

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const result = await hrService.getPayrolls(params);
      console.log('Payroll data fetched:', result, 'type:', typeof result, 'isArray:', Array.isArray(result), 'with params:', params);
      // Ensure result is always { data: [], total: number }
      if (Array.isArray(result)) {
        return { data: result, total: result.length };
      }
      return result;
    },
  });

  // Handle both response formats: { data: [], total: number } or array directly
  let payrolls: Payroll[] = [];
  let total = 0;

  if (Array.isArray(data)) {
    // Backend returned array directly
    payrolls = data;
    total = data.length;
  } else if (data && typeof data === 'object') {
    // Backend returned { data: [], total: number }
    payrolls = data.data || [];
    total = data.total || payrolls.length;
  }

  console.log('Payrolls in component:', payrolls.length, payrolls, 'data:', data);

  const filteredPayrolls = payrolls.filter((payroll: Payroll) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      payroll.payrollNumber.toLowerCase().includes(search) ||
      payroll.employee?.user?.fullName?.toLowerCase().includes(search) ||
      payroll.employee?.employeeCode?.toLowerCase().includes(search)
    );
  });

  // Get payrolls that can be bulk approved
  const getApprovablePayrolls = () => {
    if (isCHR) {
      return filteredPayrolls.filter((p) => p.status === 'draft' && !p.approvedBy);
    }
    if (isCFO) {
      return filteredPayrolls.filter((p) => p.status === 'draft' && p.approvedBy && !p.approvedBy2);
    }
    return [];
  };

  // CHR can approve drafts that haven't been approved yet
  const canCHRBulkApprove = isCHR && filteredPayrolls.some((p) => p.status === 'draft' && !p.approvedBy);
  // CFO can approve drafts that have been approved by CHR but not yet by CFO
  const canCFOBulkApprove = isCFO && filteredPayrolls.some((p) => p.status === 'draft' && p.approvedBy && !p.approvedBy2);
  const canBulkApprove = canCHRBulkApprove || canCFOBulkApprove;

  const bulkApproveMutation = useMutation({
    mutationFn: async (payrollIds: string[]) => {
      const results = await Promise.all(
        payrollIds.map((id) => hrService.approvePayroll(id))
      );
      return results;
    },
    onSuccess: () => {
      toast.success(`Berhasil approve ${selectedPayrolls.length} payroll`);
      setSelectedPayrolls([]);
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal approve payroll');
    },
  });

  const handleSelectAll = () => {
    const approvablePayrolls = getApprovablePayrolls();
    if (selectedPayrolls.length === approvablePayrolls.length) {
      setSelectedPayrolls([]);
    } else {
      setSelectedPayrolls(approvablePayrolls.map((p) => p.id));
    }
  };

  const handleSelectPayroll = (payrollId: string) => {
    if (selectedPayrolls.includes(payrollId)) {
      setSelectedPayrolls(selectedPayrolls.filter((id) => id !== payrollId));
    } else {
      setSelectedPayrolls([...selectedPayrolls, payrollId]);
    }
  };

  const handleBulkApprove = () => {
    if (selectedPayrolls.length === 0) {
      toast.error('Pilih payroll yang akan di-approve');
      return;
    }
    bulkApproveMutation.mutate(selectedPayrolls);
  };

  const getStatusBadge = (payroll: Payroll) => {
    // Check if waiting for CFO approval
    if (payroll.status === 'draft' && payroll.approvedBy && !payroll.approvedBy2) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200">
          <Clock className="w-3 h-3" />
          Waiting Approval CFO
        </span>
      );
    }

    switch (payroll.status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
            <Clock className="w-3 h-3" />
            Draft
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200">
            <DollarSign className="w-3 h-3" />
            Paid
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200">
            <XCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const totalPayroll = filteredPayrolls.reduce((sum, p) => sum + (p.nettSalary || 0), 0);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <BreadcrumbHeader title="Payroll" subtitle="Kelola penggajian karyawan">
        <div className="flex items-center gap-4">
            {canBulkApprove && selectedPayrolls.length > 0 && (
              <button
                onClick={handleBulkApprove}
                disabled={bulkApproveMutation.isPending}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <CheckSquare className="w-5 h-5" />
                {bulkApproveMutation.isPending ? 'Menyetujui...' : `Approve ${selectedPayrolls.length} Payroll`}
              </button>
            )}
            <Link
              to="/hr/payroll/calculate"
              className="px-6 py-3 bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 rounded-lg font-semibold hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors"
            >
              Hitung Payroll
            </Link>
          </div>
      </BreadcrumbHeader>

      {/* Toolbar: search inline + filter popup (IGDERP-110) */}
      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama karyawan, employee code, atau nomor payroll..."
        fields={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'draft', label: 'Draft' },
              { value: 'approved', label: 'Approved' },
              { value: 'paid', label: 'Paid' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
          {
            key: 'month',
            label: 'Bulan',
            type: 'select',
            options: Array.from({ length: 12 }, (_, i) => i + 1).map((month) => ({
              value: String(month),
              label: new Date(2000, month - 1).toLocaleString('id-ID', { month: 'long' }),
            })),
          },
          {
            key: 'year',
            label: 'Tahun',
            type: 'input',
            placeholder: 'Semua Tahun',
          },
        ]}
        values={{
          status: statusFilter === 'all' ? '' : statusFilter,
          month: periodMonth ? String(periodMonth) : '',
          year: periodYear ? String(periodYear) : '',
        }}
        onFieldChange={(key, v) => {
          if (key === 'status') {
            setStatusFilter(v || 'all');
          } else if (key === 'month') {
            setPeriodMonth(v ? parseInt(v, 10) : undefined);
          } else if (key === 'year') {
            setPeriodYear(v ? parseInt(v, 10) : undefined);
          }
        }}
        onReset={() => {
          setStatusFilter('all');
          setPeriodMonth(undefined);
          setPeriodYear(undefined);
        }}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Payroll</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{total}</p>
            </div>
            <div className="p-3 bg-primary-100 dark:bg-primary-950 rounded-lg">
              <Banknote className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Gaji</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totalPayroll)}</p>
            </div>
            <div className="p-3 bg-primary-100 dark:bg-primary-950 rounded-lg">
              <DollarSign className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Approved</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {filteredPayrolls.filter((p) => p.status === 'approved').length}
              </p>
            </div>
            <div className="p-3 bg-primary-100 dark:bg-primary-950 rounded-lg">
              <CheckCircle className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Paid</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {filteredPayrolls.filter((p) => p.status === 'paid').length}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-950 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat data...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400">Gagal memuat data payroll</p>
          </div>
        ) : filteredPayrolls.length === 0 ? (
          <div className="p-12 text-center">
            <Banknote className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-2">Tidak ada data payroll</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {periodMonth || periodYear
                ? `untuk periode ${periodMonth ? `Bulan ${periodMonth}` : ''} ${periodYear || ''}`
                : 'Silakan hitung payroll terlebih dahulu atau ubah filter periode'}
            </p>
            {!periodMonth && !periodYear && (
              <Link
                to="/hr/payroll/calculate"
                className="mt-4 inline-block px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                Hitung Payroll
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    {canBulkApprove && (
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-12">
                        <input
                          type="checkbox"
                          checked={selectedPayrolls.length === getApprovablePayrolls().length && getApprovablePayrolls().length > 0}
                          onChange={handleSelectAll}
                          className="w-4 h-4 text-primary-600 dark:text-primary-400 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
                        />
                      </th>
                    )}
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Nomor Payroll
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Karyawan
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Periode
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Total Earnings
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Total Deductions
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Nett Salary
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredPayrolls.map((payroll) => {
                    const canApproveThis = 
                      (isCHR && payroll.status === 'draft' && !payroll.approvedBy) ||
                      (isCFO && payroll.status === 'draft' && payroll.approvedBy && !payroll.approvedBy2);

                    return (
                    <tr key={payroll.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      {canBulkApprove && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          {canApproveThis && (
                            <input
                              type="checkbox"
                              checked={selectedPayrolls.includes(payroll.id)}
                              onChange={() => handleSelectPayroll(payroll.id)}
                              className="w-4 h-4 text-primary-600 dark:text-primary-400 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
                            />
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/hr/payroll/${payroll.id}`}
                          className="text-sm font-mono font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200 hover:underline"
                        >
                          {payroll.payrollNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {payroll.employee?.user?.fullName || payroll.employee?.employeeCode || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{payroll.employee?.employeeCode}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {new Date(2000, payroll.periodMonth - 1).toLocaleString('id-ID', { month: 'long' })}{' '}
                          {payroll.periodYear}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-primary-600 dark:text-primary-400">{formatCurrency(payroll.totalEarnings)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-red-600 dark:text-red-400">{formatCurrency(payroll.totalDeductions)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(payroll.nettSalary)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(payroll)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/hr/payroll/${payroll.id}`}
                          className="p-2 text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200 hover:bg-primary-50 dark:hover:bg-primary-950 rounded-lg transition-colors inline-flex items-center"
                          title="Detail"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
