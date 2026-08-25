import { useState } from 'react';
import { BreadcrumbHeader, FilterToolbar } from '@/components/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Target, AlertCircle, TrendingUp, User, Eye } from 'lucide-react';
import { hrService, type KPIRecord } from '@/services/hr.service';
import { formatCurrency } from '@/utils/format';
import { api } from '@/services/api';

export default function KPIRecordsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [periodMonth, setPeriodMonth] = useState<number>(new Date().getMonth() + 1);
  const [periodYear, setPeriodYear] = useState<number>(new Date().getFullYear());

  // Fetch all employees first, then fetch their KPIs
  const { data: employees } = useQuery({
    queryKey: ['employees-for-kpi-list'],
    queryFn: async () => {
      const response = await api.get('/users', { 
        params: { 
          limit: 1000,
          includeEmployee: true,
        } 
      });
      const users = response.data.data || response.data || [];
      return users.filter((user: any) => user.employee);
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['kpi-records', periodMonth, periodYear, employees],
    queryFn: async () => {
      if (!employees || employees.length === 0) {
        return { data: [] as KPIRecord[], total: 0 };
      }

      // Fetch KPI records for all employees
      const kpiPromises = employees.map(async (emp: any) => {
        try {
          const kpiData = await hrService.getEmployeeKPIs(emp.id, {
            month: periodMonth,
            year: periodYear,
          });
          return kpiData.data || [];
        } catch {
          return [];
        }
      });

      const allKPIs = await Promise.all(kpiPromises);
      const flattened = allKPIs.flat();

      return { data: flattened, total: flattened.length };
    },
    enabled: !!employees && employees.length > 0,
  });

  const kpiRecords: KPIRecord[] = data?.data || [];

  const filteredRecords = kpiRecords.filter((record: KPIRecord) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      record.employee?.user?.fullName?.toLowerCase().includes(search) ||
      record.employee?.employeeCode?.toLowerCase().includes(search)
    );
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
          Excellent
        </span>
      );
    }
    if (score >= 60) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
          Good
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
        Needs Improvement
      </span>
    );
  };

  const averageScore =
    filteredRecords.length > 0
      ? filteredRecords.reduce((sum, r) => sum + r.overallScore, 0) / filteredRecords.length
      : 0;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <BreadcrumbHeader title="KPI Records" subtitle="Kelola KPI dan performa karyawan">
        <Link
            to="/hr/kpi/new"
            className="px-6 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
          >
            Record KPI
          </Link>
      </BreadcrumbHeader>

      {/* Toolbar: search inline + filter popup (IGDERP-110) */}
      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama karyawan atau employee code..."
        fields={[
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
            placeholder: 'Tahun',
          },
        ]}
        values={{
          month: String(periodMonth),
          year: String(periodYear),
        }}
        onFieldChange={(key, v) => {
          if (key === 'month') {
            setPeriodMonth(v ? parseInt(v, 10) : new Date().getMonth() + 1);
          } else if (key === 'year') {
            setPeriodYear(v ? parseInt(v, 10) : new Date().getFullYear());
          }
        }}
        onReset={() => {
          setPeriodMonth(new Date().getMonth() + 1);
          setPeriodYear(new Date().getFullYear());
        }}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Records</p>
              <p className="text-2xl font-bold text-gray-900">{filteredRecords.length}</p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <Target className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Average Score</p>
              <p className={`text-2xl font-bold ${getScoreColor(averageScore)}`}>
                {averageScore > 0 ? averageScore.toFixed(1) : '-'}
              </p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Bonus</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(
                  filteredRecords.reduce((sum, r) => sum + (r.calculatedBonus || 0), 0),
                )}
              </p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <p className="mt-4 text-gray-600">Memuat data...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">Gagal memuat data KPI</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center">
            <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Tidak ada data KPI</p>
            <p className="text-sm text-gray-500 mt-2">Klik "Record KPI" untuk menambahkan data KPI</p>
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
                      Periode
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Sales Target
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Service Quality
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Customer Satisfaction
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Attendance
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Overall Score
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Bonus
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary-100 rounded-lg">
                            <User className="w-4 h-4 text-primary-600" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {record.employee?.user?.fullName || record.employee?.employeeCode || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500">{record.employee?.employeeCode}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {new Date(2000, record.periodMonth - 1).toLocaleString('id-ID', { month: 'long' })}{' '}
                          {record.periodYear}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {record.salesTargetAchievement ? formatCurrency(record.salesTargetAchievement) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {record.serviceQualityScore ? record.serviceQualityScore.toFixed(1) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {record.customerSatisfaction ? record.customerSatisfaction.toFixed(1) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {record.attendanceScore ? record.attendanceScore.toFixed(1) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-bold ${getScoreColor(record.overallScore)}`}>
                          {record.overallScore.toFixed(1)}
                        </div>
                        {getScoreBadge(record.overallScore)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-green-600">
                          {record.calculatedBonus ? formatCurrency(record.calculatedBonus) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/hr/kpi/${record.id}`}
                          className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors inline-flex items-center"
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

