import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { KPICard } from '../../components/dashboard/KPICard';
import { ChartCard } from '../../components/dashboard/ChartCard';
import { DateRangePicker } from '../../components/dashboard/DateRangePicker';
import { RefreshButton } from '../../components/dashboard/RefreshButton';
import { dashboardService } from '../../services/dashboard.service';
import { formatCurrency, formatNumber } from '../../utils/format';

export function SalesDashboard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<{ startDate: Date; endDate: Date }>({
    startDate: new Date(),
    endDate: new Date(),
  });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch Sales KPIs
  const { data: salesKPIs, isLoading: kpisLoading, error: kpisError } = useQuery({
    queryKey: ['dashboard', 'sales', 'kpis', dateRange],
    queryFn: () =>
      dashboardService.getSalesKPIs({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
      }),
  });

  // Debug logging
  useEffect(() => {
    if (salesKPIs) {
      console.log('Sales KPIs data:', salesKPIs);
    }
    if (kpisError) {
      console.error('Sales KPIs error:', kpisError);
    }
  }, [salesKPIs, kpisError]);

  // Fetch Hourly Sales
  const { data: hourlySales } = useQuery({
    queryKey: ['dashboard', 'sales', 'hourly'],
    queryFn: () => dashboardService.getHourlySales(),
  });

  // Fetch Daily Sales
  const { data: dailySales } = useQuery({
    queryKey: ['dashboard', 'sales', 'daily'],
    queryFn: () => dashboardService.getDailySales(30),
  });

  // Fetch Sales by Payment Method
  const { data: paymentMethodData } = useQuery({
    queryKey: ['dashboard', 'sales', 'payment-method', dateRange],
    queryFn: () =>
      dashboardService.getSalesByPaymentMethod({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
      }),
  });

  // Fetch Sales by Customer Type
  const { data: customerTypeData } = useQuery({
    queryKey: ['dashboard', 'sales', 'customer-type', dateRange],
    queryFn: () =>
      dashboardService.getSalesByCustomerType({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
      }),
  });

  // Fetch Top Customers
  const { data: topCustomers } = useQuery({
    queryKey: ['dashboard', 'sales', 'top-customers'],
    queryFn: () => dashboardService.getTopCustomers(10),
  });

  // Fetch Sales by Cashier
  const { data: salesByCashier } = useQuery({
    queryKey: ['dashboard', 'sales', 'cashier', dateRange],
    queryFn: () =>
      dashboardService.getSalesByCashier({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
      }),
  });

  const COLORS = ['#dc2626', '#fca5a5', '#fee2e2', '#fef2f2', '#f3f4f6'];

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'sales'] });
    setLastUpdated(new Date());
  };

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-indonesia-red-700">
          {t('dashboard.sales.title')}
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

      {/* Sales KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title={t('dashboard.sales.totalSales')}
          value={
            kpisLoading
              ? 'Loading...'
              : formatCurrency(salesKPIs?.totalSales || 0)
          }
          icon={DollarSign}
          gradient="from-indonesia-red-500 to-indonesia-red-600"
          textColor="text-white"
        />
        <KPICard
          title={t('dashboard.sales.totalOrders')}
          value={
            kpisLoading
              ? 'Loading...'
              : formatNumber(salesKPIs?.totalOrders || 0)
          }
          icon={ShoppingCart}
          gradient="from-white to-gray-100"
          textColor="text-indonesia-red-600"
          border="border-l-4 border-indonesia-red-600"
        />
        <KPICard
          title={t('dashboard.sales.averageOrderValue')}
          value={
            kpisLoading
              ? 'Loading...'
              : formatCurrency(salesKPIs?.averageOrderValue || 0)
          }
          icon={TrendingUp}
          gradient="from-indonesia-red-500 to-indonesia-red-600"
          textColor="text-white"
        />
        <KPICard
          title={t('dashboard.sales.conversionRate')}
          value={
            kpisLoading
              ? 'Loading...'
              : `${(salesKPIs?.conversionRate || 0).toFixed(1)}%`
          }
          icon={Users}
          gradient="from-white to-gray-100"
          textColor="text-indonesia-red-600"
          border="border-l-4 border-indonesia-red-600"
        />
      </div>

      {/* Sales Trend Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard
          title={t('dashboard.sales.hourlySalesPattern')}
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlySales || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="sales" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          }
        />
        <ChartCard
          title={t('dashboard.sales.dailySales')}
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySales || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#dc2626"
                  strokeWidth={2}
                  name="Bulan Ini"
                />
                <Line
                  type="monotone"
                  dataKey="lastMonth"
                  stroke="#9ca3af"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Bulan Lalu"
                />
              </LineChart>
            </ResponsiveContainer>
          }
        />
      </div>

      {/* Sales Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard
          title={t('dashboard.sales.byPaymentMethod')}
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethodData || []}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  label={(entry) => `${entry.name}: ${entry.value}%`}
                >
                  {(paymentMethodData || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          }
        />
        <ChartCard
          title={t('dashboard.sales.byCustomerType')}
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={customerTypeData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="value" fill="#dc2626" name="Nilai" />
                <Bar dataKey="count" fill="#3b82f6" name="Jumlah" />
              </BarChart>
            </ResponsiveContainer>
          }
        />
      </div>

      {/* Sales Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-bold text-indonesia-red-700 mb-4">
            {t('dashboard.sales.topCustomers')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Nama</th>
                  <th className="text-left py-2 px-4">Tier</th>
                  <th className="text-right py-2 px-4">Orders</th>
                  <th className="text-right py-2 px-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {(topCustomers || []).map((customer, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4">{customer.name}</td>
                    <td className="py-2 px-4">
                      <span className="px-2 py-1 bg-garuda-gold-500 text-white rounded text-xs">
                        {customer.tier}
                      </span>
                    </td>
                    <td className="text-right py-2 px-4">{customer.orders}</td>
                    <td className="text-right py-2 px-4">{formatCurrency(customer.totalSpent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-bold text-indonesia-red-700 mb-4">
            {t('dashboard.sales.salesByCashier')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Rank</th>
                  <th className="text-left py-2 px-4">Kasir</th>
                  <th className="text-right py-2 px-4">Transaksi</th>
                  <th className="text-right py-2 px-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {(salesByCashier || []).map((cashier) => (
                  <tr key={cashier.name} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4">
                      <span className="px-2 py-1 bg-indonesia-red-600 text-white rounded text-xs">
                        #{cashier.rank}
                      </span>
                    </td>
                    <td className="py-2 px-4">{cashier.name}</td>
                    <td className="text-right py-2 px-4">{cashier.transactions}</td>
                    <td className="text-right py-2 px-4">{formatCurrency(cashier.totalSales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Discount Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-bold text-indonesia-red-700 mb-4">
            {t('dashboard.sales.discountImpact')}
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Diskon Diberikan</span>
              <span className="text-2xl font-bold text-indonesia-red-600">
                {formatCurrency(3500000)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Persentase dari Penjualan</span>
              <span className="text-2xl font-bold text-gray-900">7.8%</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-bold text-indonesia-red-700 mb-4">
            {t('dashboard.sales.memberVsNonMember')}
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Member</span>
              <span className="text-2xl font-bold text-indonesia-red-600">
                {formatCurrency(28000000)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Non-Member</span>
              <span className="text-2xl font-bold text-gray-900">
                {formatCurrency(17000000)}
              </span>
            </div>
            <div className="pt-4 border-t">
              <span className="text-gray-600">Tingkat Konversi Member</span>
              <span className="text-2xl font-bold text-success-600 block mt-2">62.2%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

