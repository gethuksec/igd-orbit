import { useState } from 'react';
import { BreadcrumbHeader } from '@/components/shared';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Loader2,
  Download,
  ReceiptText,
  AlertCircle,
} from 'lucide-react';
import { financeService } from '../../../services/finance.service';

export default function FinancialReports() {
  const [reportType, setReportType] = useState<string>('trial-balance');
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: trialBalance, isLoading: loadingTrialBalance } = useQuery({
    queryKey: ['trial-balance', startDate, endDate],
    queryFn: () => financeService.getTrialBalance(startDate, endDate),
    enabled: reportType === 'trial-balance',
  });

  const { data: profitLoss, isLoading: loadingProfitLoss } = useQuery({
    queryKey: ['profit-loss', startDate, endDate],
    queryFn: () => financeService.getProfitLoss(startDate, endDate),
    enabled: reportType === 'profit-loss',
  });

  const { data: balanceSheet, isLoading: loadingBalanceSheet } = useQuery({
    queryKey: ['balance-sheet', asOfDate],
    queryFn: () => financeService.getBalanceSheet(asOfDate),
    enabled: reportType === 'balance-sheet',
  });

  const { data: cashFlow, isLoading: loadingCashFlow } = useQuery({
    queryKey: ['cash-flow', startDate, endDate],
    queryFn: () => financeService.getCashFlow(startDate, endDate),
    enabled: reportType === 'cash-flow',
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const isLoading =
    loadingTrialBalance || loadingProfitLoss || loadingBalanceSheet || loadingCashFlow;

  const renderReport = () => {
    if (isLoading) {
      return (
        <div className="px-4 py-16 text-center">
          <Loader2 className="w-16 h-16 text-primary-600 dark:text-primary-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-semibold text-lg">Memuat laporan...</p>
        </div>
      );
    }

    switch (reportType) {
      case 'trial-balance':
        const trialBalanceArray = Array.isArray(trialBalance) ? trialBalance : [];
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gradient-to-r from-gray-50 dark:from-gray-900 via-gray-50 dark:via-gray-900 to-gray-100 dark:to-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Account
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Debit
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Credit
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                {trialBalanceArray.length > 0 ? (
                  trialBalanceArray.map((item: any, index: number) => (
                    <tr
                      key={index}
                      className="hover:bg-gradient-to-r hover:from-gray-50 dark:hover:from-gray-900 hover:to-white dark:hover:to-gray-900 transition-all duration-200"
                    >
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm text-gray-600 dark:text-gray-400">{item.accountCode}</div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.accountName}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(item.debitBalance)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(item.creditBalance)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {formatCurrency(item.balanceNumber || 0)}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      Tidak ada data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );

      case 'profit-loss':
        const profitLossArray = Array.isArray(profitLoss) ? profitLoss : [];
        const totalRevenue = profitLossArray
          .filter((item: any) => item.isRevenue)
          .reduce((sum: number, item: any) => sum + item.amount, 0);
        const totalExpenses = profitLossArray
          .filter((item: any) => !item.isRevenue)
          .reduce((sum: number, item: any) => sum + item.amount, 0);
        const netIncome = totalRevenue - totalExpenses;

        return (
          <div className="space-y-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gradient-to-r from-gray-50 dark:from-gray-900 via-gray-50 dark:via-gray-900 to-gray-100 dark:to-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                      Account
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                  <tr className="bg-green-50 dark:bg-green-950">
                    <td colSpan={2} className="px-4 py-2 font-bold text-green-800 dark:text-green-200">
                      REVENUE
                    </td>
                  </tr>
                  {profitLossArray
                    .filter((item: any) => item.isRevenue)
                    .map((item: any, index: number) => (
                      <tr
                        key={index}
                        className="hover:bg-gradient-to-r hover:from-gray-50 dark:hover:from-gray-900 hover:to-white dark:hover:to-gray-900 transition-all duration-200"
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm text-gray-600 dark:text-gray-400">{item.accountCode}</div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.accountName}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                            {formatCurrency(item.amount)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  <tr className="bg-green-100 dark:bg-green-950 font-bold">
                    <td className="px-4 py-3">Total Revenue</td>
                    <td className="px-4 py-3 text-right text-green-700 dark:text-green-300">
                      {formatCurrency(totalRevenue)}
                    </td>
                  </tr>
                  <tr className="bg-red-50 dark:bg-red-950">
                    <td colSpan={2} className="px-4 py-2 font-bold text-red-800 dark:text-red-200">
                      EXPENSES
                    </td>
                  </tr>
                  {profitLossArray
                    .filter((item: any) => !item.isRevenue)
                    .map((item: any, index: number) => (
                      <tr
                        key={index}
                        className="hover:bg-gradient-to-r hover:from-gray-50 dark:hover:from-gray-900 hover:to-white dark:hover:to-gray-900 transition-all duration-200"
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm text-gray-600 dark:text-gray-400">{item.accountCode}</div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.accountName}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-sm font-semibold text-red-600 dark:text-red-400">
                            {formatCurrency(item.amount)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  <tr className="bg-red-100 dark:bg-red-950 font-bold">
                    <td className="px-4 py-3">Total Expenses</td>
                    <td className="px-4 py-3 text-right text-red-700 dark:text-red-300">
                      {formatCurrency(totalExpenses)}
                    </td>
                  </tr>
                  <tr className="bg-primary-50 dark:bg-primary-950 font-bold border-t-2 border-primary-200 dark:border-primary-800">
                    <td className="px-4 py-3 text-lg">Net Income</td>
                    <td
                      className={`px-4 py-3 text-right text-lg ${
                        netIncome >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                      }`}
                    >
                      {formatCurrency(netIncome)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'balance-sheet':
        const balanceSheetArray = Array.isArray(balanceSheet) ? balanceSheet : [];
        const assets = balanceSheetArray.filter((item: any) => item.accountType === 'ASSET');
        const liabilities = balanceSheetArray.filter(
          (item: any) => item.accountType === 'LIABILITY',
        );
        const equity = balanceSheetArray.filter((item: any) => item.accountType === 'EQUITY');
        const totalAssets = assets.reduce((sum: number, item: any) => sum + item.balance, 0);
        const totalLiabilities = liabilities.reduce((sum: number, item: any) => sum + item.balance, 0);
        const totalEquity = equity.reduce((sum: number, item: any) => sum + item.balance, 0);

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Assets */}
              <div className="overflow-x-auto">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                  ASSETS
                </h3>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gradient-to-r from-gray-50 dark:from-gray-900 via-gray-50 dark:via-gray-900 to-gray-100 dark:to-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                        Account
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                    {assets.map((item: any, index: number) => (
                      <tr
                        key={index}
                        className="hover:bg-gradient-to-r hover:from-gray-50 dark:hover:from-gray-900 hover:to-white dark:hover:to-gray-900 transition-all duration-200"
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm text-gray-600 dark:text-gray-400">{item.accountCode}</div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.accountName}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {formatCurrency(item.balance)}
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-green-100 dark:bg-green-950 font-bold">
                      <td className="px-4 py-3">Total Assets</td>
                      <td className="px-4 py-3 text-right text-green-700 dark:text-green-300">
                        {formatCurrency(totalAssets)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Liabilities & Equity */}
              <div className="overflow-x-auto">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                  LIABILITIES & EQUITY
                </h3>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gradient-to-r from-gray-50 dark:from-gray-900 via-gray-50 dark:via-gray-900 to-gray-100 dark:to-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                        Account
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                    <tr className="bg-red-50 dark:bg-red-950">
                      <td colSpan={2} className="px-4 py-2 font-bold text-red-800 dark:text-red-200">
                        LIABILITIES
                      </td>
                    </tr>
                    {liabilities.map((item: any, index: number) => (
                      <tr
                        key={index}
                        className="hover:bg-gradient-to-r hover:from-gray-50 dark:hover:from-gray-900 hover:to-white dark:hover:to-gray-900 transition-all duration-200"
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm text-gray-600 dark:text-gray-400">{item.accountCode}</div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.accountName}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {formatCurrency(item.balance)}
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-red-100 dark:bg-red-950 font-bold">
                      <td className="px-4 py-3">Total Liabilities</td>
                      <td className="px-4 py-3 text-right text-red-700 dark:text-red-300">
                        {formatCurrency(totalLiabilities)}
                      </td>
                    </tr>
                    <tr className="bg-blue-50 dark:bg-blue-950">
                      <td colSpan={2} className="px-4 py-2 font-bold text-blue-800 dark:text-blue-200">
                        EQUITY
                      </td>
                    </tr>
                    {equity.map((item: any, index: number) => (
                      <tr
                        key={index}
                        className="hover:bg-gradient-to-r hover:from-gray-50 dark:hover:from-gray-900 hover:to-white dark:hover:to-gray-900 transition-all duration-200"
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm text-gray-600 dark:text-gray-400">{item.accountCode}</div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.accountName}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {formatCurrency(item.balance)}
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-blue-100 dark:bg-blue-950 font-bold">
                      <td className="px-4 py-3">Total Equity</td>
                      <td className="px-4 py-3 text-right text-blue-700 dark:text-blue-300">
                        {formatCurrency(totalEquity)}
                      </td>
                    </tr>
                    <tr className="bg-primary-50 dark:bg-primary-950 font-bold border-t-2 border-primary-200 dark:border-primary-800">
                      <td className="px-4 py-3 text-lg">Total Liabilities & Equity</td>
                      <td className="px-4 py-3 text-right text-lg text-primary-700 dark:text-primary-300">
                        {formatCurrency(totalLiabilities + totalEquity)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-4 rounded-lg border-2">
              {Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 ? (
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <ReceiptText className="w-5 h-5" />
                  <span className="font-semibold">
                    Balance Sheet seimbang! Assets = Liabilities + Equity
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-semibold">
                    Balance Sheet tidak seimbang! Selisih:{' '}
                    {formatCurrency(Math.abs(totalAssets - (totalLiabilities + totalEquity)))}
                  </span>
                </div>
              )}
            </div>
          </div>
        );

      case 'cash-flow':
        const cashFlowArray = Array.isArray(cashFlow) ? cashFlow : [];
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gradient-to-r from-gray-50 dark:from-gray-900 via-gray-50 dark:via-gray-900 to-gray-100 dark:to-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                {cashFlowArray.length > 0 ? (
                  cashFlowArray.map((item: any, index: number) => (
                    <tr
                      key={index}
                      className="hover:bg-gradient-to-r hover:from-gray-50 dark:hover:from-gray-900 hover:to-white dark:hover:to-gray-900 transition-all duration-200"
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.category}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 dark:text-gray-100">{item.description}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div
                          className={`text-sm font-semibold ${
                            item.isInflow ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {item.isInflow ? '+' : '-'}
                          {formatCurrency(item.amount)}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      Tidak ada data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );

      default:
        return <div className="text-center py-8 text-gray-500 dark:text-gray-400">Pilih jenis laporan</div>;
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <BreadcrumbHeader title="Laporan Keuangan" subtitle="Laporan keuangan dan analisis" />

      {/* Report Selection */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Jenis Laporan <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="trial-balance">Trial Balance</option>
              <option value="profit-loss">Profit & Loss (Income Statement)</option>
              <option value="balance-sheet">Balance Sheet</option>
              <option value="cash-flow">Cash Flow Statement</option>
            </select>
          </div>
          {reportType === 'balance-sheet' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                As of Date <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Date <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Date <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            {reportType === 'trial-balance'
              ? 'Trial Balance'
              : reportType === 'profit-loss'
                ? 'Profit & Loss Statement'
                : reportType === 'balance-sheet'
                  ? 'Balance Sheet'
                  : 'Cash Flow Statement'}
          </h2>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
        {renderReport()}
      </div>
    </div>
  );
}

