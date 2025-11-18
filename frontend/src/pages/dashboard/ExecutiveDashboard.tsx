import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign,
  ShoppingCart,
  Wrench,
  Package,
} from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { KPICard } from '../../components/dashboard/KPICard';
import { ChartCard } from '../../components/dashboard/ChartCard';
import { DateRangePicker } from '../../components/dashboard/DateRangePicker';
import { RefreshButton } from '../../components/dashboard/RefreshButton';
import { TableEmptyState } from '../../components/dashboard/EmptyState';
import { dashboardService } from '../../services/dashboard.service';
import { formatCurrency, formatNumber } from '../../utils/format';
import { io } from 'socket.io-client';
import { useBranchStore } from '@/stores/branchStore';

const API_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:3000';

export function ExecutiveDashboard() {
  const { t } = useTranslation();
  const { currentBranchId } = useBranchStore();
  const [dateRange, setDateRange] = useState<{ startDate: Date; endDate: Date }>({
    startDate: new Date(),
    endDate: new Date(),
  });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const queryClient = useQueryClient();
  
  // WebSocket connection for real-time updates (with error handling)
  useEffect(() => {
    let newSocket: ReturnType<typeof io> | null = null;
    
    try {
      newSocket = io(API_URL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 5000,
      });

      newSocket.on('connect', () => {
        console.log('Socket connected');
      });

      newSocket.on('connect_error', (error) => {
        // Silently handle connection errors - backend might not be running
        console.warn('Socket connection error (backend may not be running):', error.message);
      });

      newSocket.on('dashboard:updated', () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        setLastUpdated(new Date());
      });

      newSocket.on('transaction:created', () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'kpis'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'recent-transactions'] });
        setLastUpdated(new Date());
      });

      newSocket.on('service:completed', () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'kpis'] });
        setLastUpdated(new Date());
      });
    } catch (error) {
      // Silently handle initialization errors
      console.warn('Socket initialization error:', error);
    }

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [queryClient]);

  // Fetch KPIs
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['dashboard', 'kpis', dateRange, currentBranchId],
    queryFn: () =>
      dashboardService.getKPIs({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        branchId: currentBranchId || undefined,
      }),
  });

  // Fetch revenue trend
  const { data: revenueTrend } = useQuery({
    queryKey: ['dashboard', 'revenue-trend', currentBranchId],
    queryFn: () => dashboardService.getRevenueTrend(30, currentBranchId || undefined),
  });

  // Fetch sales by category
  const { data: salesByCategory } = useQuery({
    queryKey: ['dashboard', 'sales-by-category', dateRange, currentBranchId],
    queryFn: () =>
      dashboardService.getSalesByCategory({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        branchId: currentBranchId || undefined,
      }),
  });

  // Fetch top products
  const { data: topProducts } = useQuery({
    queryKey: ['dashboard', 'top-products', currentBranchId],
    queryFn: () => dashboardService.getTopProducts(30, 10, currentBranchId || undefined),
  });

  // Fetch branch performance
  const { data: branchPerformance } = useQuery({
    queryKey: ['dashboard', 'branch-performance', dateRange, currentBranchId],
    queryFn: () =>
      dashboardService.getBranchPerformance({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        branchId: currentBranchId || undefined,
      }),
  });

  // Fetch recent transactions
  const { data: recentTransactions } = useQuery({
    queryKey: ['dashboard', 'recent-transactions', currentBranchId],
    queryFn: () => dashboardService.getRecentTransactions(10, currentBranchId || undefined),
  });

  // Fetch pending approvals
  const { data: pendingApprovals } = useQuery({
    queryKey: ['dashboard', 'pending-approvals'],
    queryFn: () => dashboardService.getPendingApprovals(),
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    setLastUpdated(new Date());
  };

  // Calculate revenue change
  const revenueChange =
    kpis && kpis.yesterdayRevenue > 0
      ? ((kpis.todayRevenue - kpis.yesterdayRevenue) / kpis.yesterdayRevenue) * 100
      : 0;

  // Calculate transaction change
  const transactionChange =
    kpis && kpis.yesterdayTransactions > 0
      ? ((kpis.totalTransactions - kpis.yesterdayTransactions) / kpis.yesterdayTransactions) * 100
      : 0;

  // Generate sparkline data (last 7 days)
  const sparklineData = revenueTrend
    ?.slice(-7)
    .map((item) => ({ date: item.date, value: item.total })) || [];

  const COLORS = ['#dc2626', '#fca5a5', '#fee2e2', '#fef2f2', '#f3f4f6'];

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-indonesia-red-700">
          {t('dashboard.executive.title')}
        </h1>
        <div className="flex items-center gap-4">
          <DateRangePicker onRangeChange={setDateRange} />
          <RefreshButton
            onRefresh={handleRefresh}
            autoRefreshInterval={60}
            lastUpdated={lastUpdated}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title={t('dashboard.executive.todayRevenue')}
          value={formatCurrency(kpis?.todayRevenue || 0)}
          change={
            revenueChange !== 0
              ? `${revenueChange > 0 ? '↑' : '↓'} ${Math.abs(revenueChange).toFixed(1)}%`
              : undefined
          }
          changeType={revenueChange > 0 ? 'positive' : revenueChange < 0 ? 'negative' : 'neutral'}
          sparklineData={sparklineData}
          icon={DollarSign}
          gradient="from-indonesia-red-500 to-indonesia-red-600"
          textColor="text-white"
          isLoading={kpisLoading}
        />
        <KPICard
          title={t('dashboard.executive.totalTransactions')}
          value={formatNumber(kpis?.totalTransactions || 0)}
          change={
            transactionChange !== 0
              ? `${transactionChange > 0 ? '↑' : '↓'} ${Math.abs(transactionChange).toFixed(1)}%`
              : undefined
          }
          changeType={
            transactionChange > 0 ? 'positive' : transactionChange < 0 ? 'negative' : 'neutral'
          }
          icon={ShoppingCart}
          gradient="from-white to-gray-100"
          textColor="text-indonesia-red-600"
          border="border-l-4 border-indonesia-red-600"
          isLoading={kpisLoading}
        />
        <KPICard
          title={t('dashboard.executive.activeServices')}
          value={`${kpis?.pendingServices || 0} / ${kpis?.activeServices || 0}`}
          change={
            kpis && kpis.activeServices > 0
              ? `${((kpis.pendingServices / kpis.activeServices) * 100).toFixed(0)}% pending`
              : undefined
          }
          changeType={kpis && kpis.overdueServices > 0 ? 'negative' : 'neutral'}
          icon={Wrench}
          gradient="from-indonesia-red-500 to-indonesia-red-600"
          textColor="text-white"
          isLoading={kpisLoading}
        />
        <KPICard
          title={t('dashboard.executive.stockAlerts')}
          value={`${kpis?.lowStockItems || 0} low / ${kpis?.outOfStockItems || 0} out`}
          change={
            kpis && (kpis.lowStockItems > 0 || kpis.outOfStockItems > 0)
              ? `${kpis.lowStockItems + kpis.outOfStockItems} items need attention`
              : undefined
          }
          changeType={
            kpis && (kpis.lowStockItems > 0 || kpis.outOfStockItems > 0) ? 'negative' : 'neutral'
          }
          icon={Package}
          gradient="from-white to-gray-100"
          textColor="text-indonesia-red-600"
          border="border-l-4 border-indonesia-red-600"
          isLoading={kpisLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title={t('dashboard.executive.revenueTrend')}
          isLoading={!revenueTrend}
          isEmpty={!revenueTrend || revenueTrend.length === 0}
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#dc2626"
                  strokeWidth={2}
                  name="Penjualan"
                />
                <Line
                  type="monotone"
                  dataKey="service"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Servis"
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Total"
                />
              </LineChart>
            </ResponsiveContainer>
          }
        />
        <ChartCard
          title={t('dashboard.executive.salesByCategory')}
          isLoading={!salesByCategory}
          isEmpty={!salesByCategory || salesByCategory.length === 0}
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={salesByCategory}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `${entry.category}: ${formatCurrency(entry.amount)}`}
                >
                  {salesByCategory?.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          }
        />
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-bold text-indonesia-red-700 mb-4">
            {t('dashboard.executive.topProducts')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Rank</th>
                  <th className="text-left py-2 px-4">Produk</th>
                  <th className="text-right py-2 px-4">Qty</th>
                  <th className="text-right py-2 px-4">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {!topProducts || topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <TableEmptyState message="Tidak ada data produk" />
                    </td>
                  </tr>
                ) : (
                  topProducts.map((product) => (
                    <tr key={product.rank} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-4">{product.rank}</td>
                      <td className="py-2 px-4">{product.productName}</td>
                      <td className="text-right py-2 px-4">{formatNumber(product.quantitySold)}</td>
                      <td className="text-right py-2 px-4">{formatCurrency(product.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <ChartCard
          title={t('dashboard.executive.branchPerformance')}
          isLoading={!branchPerformance}
          isEmpty={!branchPerformance || branchPerformance.length === 0}
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="branchName" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="revenue" fill="#dc2626" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          }
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-bold text-indonesia-red-700 mb-4">
            {t('dashboard.executive.recentTransactions')}
          </h3>
          <div className="space-y-2">
            {!recentTransactions || recentTransactions.length === 0 ? (
              <TableEmptyState message="Tidak ada transaksi terbaru" />
            ) : (
              recentTransactions.map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{txn.customer}</p>
                    <p className="text-sm text-gray-500">{txn.time}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(txn.amount)}</p>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        txn.status === 'completed'
                          ? 'bg-success-100 text-success-700'
                          : 'bg-warning-100 text-warning-700'
                      }`}
                    >
                      {txn.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-bold text-indonesia-red-700 mb-4">
            {t('dashboard.executive.pendingApprovals')}
          </h3>
          <div className="space-y-2">
            {!pendingApprovals || pendingApprovals.length === 0 ? (
              <TableEmptyState message="Tidak ada approval yang menunggu" />
            ) : (
              pendingApprovals.map((approval) => (
                <div
                  key={approval.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{approval.requester}</p>
                    <p className="text-sm text-gray-500 capitalize">{approval.type}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-bold">{formatCurrency(approval.amount)}</span>
                    <button className="px-3 py-1 bg-success-500 text-white rounded hover:bg-success-600 text-sm">
                      Approve
                    </button>
                    <button className="px-3 py-1 bg-danger-500 text-white rounded hover:bg-danger-600 text-sm">
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

