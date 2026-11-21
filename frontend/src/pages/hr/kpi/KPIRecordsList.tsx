import { useState } from 'react';
import { BreadcrumbHeader, FilterToolbar, StatusDot, StatCard } from '@/components/shared';
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
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) {
      return <StatusDot tone="ok">Excellent</StatusDot>;
    }
    if (score >= 60) {
      return <StatusDot tone="warn">Good</StatusDot>;
    }
    return <StatusDot tone="bad">Needs Improvement</StatusDot>;
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
            className="px-6 py-3 bg-white dark:bg-gray-900 text-purple-600 dark:text-purple-400 rounded-lg font-semibold hover:bg-purple-50 dark:hover:bg-purple-950 transition-colors"
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard icon={<Target className="h-5 w-5" />} label="Total Records" value={filteredRecords.length} />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Average Score"
          value={averageScore > 0 ? averageScore.toFixed(1) : '-'}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Total Bonus"
          value={formatCurrency(filteredRecords.reduce((sum, r) => sum + (r.calculatedBonus || 0), 0))}
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat data...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400">Gagal memuat data KPI</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center">
            <Target className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Tidak ada data KPI</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Klik "Record KPI" untuk menambahkan data KPI</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Karyawan
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Periode
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Sales Target
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Service Quality
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Customer Satisfaction
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Attendance
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Overall Score
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Bonus
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                            <User className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
                              {record.employee?.user?.fullName || record.employee?.employeeCode || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{record.employee?.employeeCode}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
                          {new Date(2000, record.periodMonth - 1).toLocaleString('id-ID', { month: 'long' })}{' '}
                          {record.periodYear}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                          {record.salesTargetAchievement ? formatCurrency(record.salesTargetAchievement) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                          {record.serviceQualityScore ? record.serviceQualityScore.toFixed(1) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                          {record.customerSatisfaction ? record.customerSatisfaction.toFixed(1) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                          {record.attendanceScore ? record.attendanceScore.toFixed(1) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium tabular-nums ${getScoreColor(record.overallScore)}`}>
                          {record.overallScore.toFixed(1)}
                        </div>
                        {getScoreBadge(record.overallScore)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium tabular-nums text-green-600 dark:text-green-400">
                          {record.calculatedBonus ? formatCurrency(record.calculatedBonus) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/hr/kpi/${record.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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

