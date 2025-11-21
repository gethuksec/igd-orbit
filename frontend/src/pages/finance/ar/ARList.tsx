import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Eye,
  Loader2,
  Calendar,
  Receipt,
  DollarSign,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { financeService, type ARAgingReport } from '../../../services/finance.service';

export default function ARList() {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: agingReport, isLoading } = useQuery({
    queryKey: ['ar-aging-report', asOfDate],
    queryFn: () => financeService.getARAgingReport(asOfDate),
  });

  const agingReportArray = Array.isArray(agingReport) ? agingReport : [];

  const filteredReport = agingReportArray.filter((item: ARAgingReport) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return item.customerName.toLowerCase().includes(search);
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const totalOutstanding = agingReportArray.reduce((sum, item) => sum + item.totalOutstanding, 0);
  const totalCurrent = agingReportArray.reduce((sum, item) => sum + item.current, 0);
  const totalDays30 = agingReportArray.reduce((sum, item) => sum + item.days30, 0);
  const totalDays60 = agingReportArray.reduce((sum, item) => sum + item.days60, 0);
  const totalDays90Plus = agingReportArray.reduce((sum, item) => sum + item.days90Plus, 0);

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Accounts Receivable</h1>
            <p className="text-primary-100 text-lg">Laporan aging piutang usaha</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-primary-600" />
            <span className="text-sm font-medium text-gray-600">Total Outstanding</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {isLoading ? '-' : formatCurrency(totalOutstanding)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-600">Current</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {isLoading ? '-' : formatCurrency(totalCurrent)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <span className="text-sm font-medium text-gray-600">30 Days</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {isLoading ? '-' : formatCurrency(totalDays30)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-medium text-gray-600">60 Days</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {isLoading ? '-' : formatCurrency(totalDays60)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-gray-600">90+ Days</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {isLoading ? '-' : formatCurrency(totalDays90Plus)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari customer..."
              className="block w-full pl-12 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="block w-full pl-12 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
            />
          </div>
        </div>
      </div>

      {/* Aging Report Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 via-gray-50 to-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Customer
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Total Outstanding
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Current
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  30 Days
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  60 Days
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  90+ Days
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
                      <p className="text-gray-600 font-semibold text-lg">Memuat aging report...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredReport.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Receipt className="w-16 h-16 text-gray-400" />
                      <p className="text-gray-600 font-semibold text-lg">
                        Tidak ada piutang ditemukan
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredReport.map((item: ARAgingReport) => (
                  <tr
                    key={item.customerId}
                    className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 border-b border-gray-100"
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-gray-900">{item.customerName}</div>
                      <div className="text-xs text-gray-500">
                        {item.items.length} invoice{item.items.length > 1 ? 's' : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-sm font-bold text-gray-900">
                        {formatCurrency(item.totalOutstanding)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-green-600">
                        {formatCurrency(item.current)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-yellow-600">
                        {formatCurrency(item.days30)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-orange-600">
                        {formatCurrency(item.days60)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-red-600">
                        {formatCurrency(item.days90Plus)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <Link
                        to={`/finance/ar/${item.customerId}`}
                        className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 hover:underline"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Detail</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!isLoading && filteredReport.length > 0 && (
              <tfoot className="bg-gradient-to-r from-gray-50 to-gray-100 font-bold">
                <tr>
                  <td className="px-4 py-3 text-left">
                    <span className="text-gray-900">Total:</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-gray-900">{formatCurrency(totalOutstanding)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-green-600">{formatCurrency(totalCurrent)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-yellow-600">{formatCurrency(totalDays30)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-orange-600">{formatCurrency(totalDays60)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-red-600">{formatCurrency(totalDays90Plus)}</span>
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

