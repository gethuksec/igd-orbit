import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Target, Search, AlertCircle, TrendingUp, User, Eye } from 'lucide-react';
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
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <Target className="w-10 h-10" />
              KPI Records
            </h1>
            <p className="text-purple-100 text-lg">Kelola KPI dan performa karyawan</p>
          </div>
          <Link
            to="/hr/kpi/new"
            className="px-6 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
          >
            Record KPI
          </Link>
        </div>
      </div>

      {/* Filters & Search - Enhanced */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Cari KPI</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama karyawan atau employee code..."
                className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base transition-all"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Bulan</label>
              <select
                value={periodMonth}
                onChange={(e) => setPeriodMonth(parseInt(e.target.value))}
                className="px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base transition-all bg-white min-w-[150px]"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <option key={month} value={month}>
                    {new Date(2000, month - 1).toLocaleString('id-ID', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tahun</label>
              <input
                type="number"
                value={periodYear}
                onChange={(e) => setPeriodYear(parseInt(e.target.value))}
                placeholder="Tahun"
                min="2020"
                max="2100"
                className="px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base transition-all bg-white min-w-[120px]"
              />
            </div>
          </div>
        </div>
      </div>

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

