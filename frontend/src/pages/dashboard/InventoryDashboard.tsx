import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, AlertTriangle, TrendingUp, Box } from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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

export function InventoryDashboard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [_dateRange, setDateRange] = useState<{ startDate: Date; endDate: Date }>({
    startDate: new Date(),
    endDate: new Date(),
  });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch Inventory KPIs
  const { data: inventoryKPIs, isLoading: kpisLoading, error: kpisError } = useQuery({
    queryKey: ['dashboard', 'inventory', 'kpis'],
    queryFn: () => dashboardService.getInventoryKPIs(),
  });

  // Debug logging
  useEffect(() => {
    if (inventoryKPIs) {
      console.log('Inventory KPIs data:', inventoryKPIs);
    }
    if (kpisError) {
      console.error('Inventory KPIs error:', kpisError);
    }
  }, [inventoryKPIs, kpisError]);

  // Fetch Stock Status by Branch
  const { data: stockStatusByBranch } = useQuery({
    queryKey: ['dashboard', 'inventory', 'stock-by-branch'],
    queryFn: () => dashboardService.getStockStatusByBranch(),
  });

  // Fetch Stock Movement
  const { data: stockMovement } = useQuery({
    queryKey: ['dashboard', 'inventory', 'movement'],
    queryFn: () => dashboardService.getStockMovement(30),
  });

  // Fetch Top Moving Products
  const { data: topMovingProducts } = useQuery({
    queryKey: ['dashboard', 'inventory', 'top-moving'],
    queryFn: () => dashboardService.getTopMovingProducts(30, 10),
  });

  // Fetch Low Stock Alerts
  const { data: lowStockAlerts } = useQuery({
    queryKey: ['dashboard', 'inventory', 'low-stock'],
    queryFn: () => dashboardService.getLowStockAlerts(),
  });

  // Fetch Pending Transfers
  const { data: pendingTransfers } = useQuery({
    queryKey: ['dashboard', 'inventory', 'pending-transfers'],
    queryFn: () => dashboardService.getPendingTransfers(),
  });

  // Fetch Slow Moving Items
  const { data: slowMovingItems } = useQuery({
    queryKey: ['dashboard', 'inventory', 'slow-moving'],
    queryFn: () => dashboardService.getSlowMovingItems(90),
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'inventory'] });
    setLastUpdated(new Date());
  };

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-indonesia-red-700">
          {t('dashboard.inventory.title')}
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

      {/* Inventory KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title={t('dashboard.inventory.totalSKUs')}
          value={
            kpisLoading
              ? 'Loading...'
              : formatNumber(inventoryKPIs?.totalSKUs || 0)
          }
          icon={Package}
          gradient="from-indonesia-red-500 to-indonesia-red-600"
          textColor="text-white"
        />
        <KPICard
          title={t('dashboard.inventory.totalStockValue')}
          value={
            kpisLoading
              ? 'Loading...'
              : formatCurrency(inventoryKPIs?.totalStockValue || 0)
          }
          icon={TrendingUp}
          gradient="from-white to-gray-100"
          textColor="text-indonesia-red-600"
          border="border-l-4 border-indonesia-red-600"
        />
        <KPICard
          title={t('dashboard.inventory.lowStockItems')}
          value={
            kpisLoading
              ? 'Loading...'
              : formatNumber(inventoryKPIs?.lowStockItems || 0)
          }
          changeType={
            (inventoryKPIs?.lowStockItems || 0) > 0 ? 'negative' : 'neutral'
          }
          icon={AlertTriangle}
          gradient="from-indonesia-red-500 to-indonesia-red-600"
          textColor="text-white"
        />
        <KPICard
          title={t('dashboard.inventory.outOfStockItems')}
          value={
            kpisLoading
              ? 'Loading...'
              : formatNumber(inventoryKPIs?.outOfStockItems || 0)
          }
          changeType={
            (inventoryKPIs?.outOfStockItems || 0) > 0 ? 'negative' : 'neutral'
          }
          icon={Box}
          gradient="from-white to-gray-100"
          textColor="text-indonesia-red-600"
          border="border-l-4 border-indonesia-red-600"
        />
      </div>

      {/* Stock Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard
          title={t('dashboard.inventory.stockStatus')}
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockStatusByBranch || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="branch" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="available" stackId="a" fill="#10b981" name="Tersedia" />
                <Bar dataKey="reserved" stackId="a" fill="#f59e0b" name="Dipesan" />
                <Bar dataKey="damaged" stackId="a" fill="#ef4444" name="Rusak" />
              </BarChart>
            </ResponsiveContainer>
          }
        />
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-bold text-indonesia-red-700 mb-4">
            {t('dashboard.inventory.stockValueByCategory')}
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-indonesia-red-50 rounded-lg">
              <span className="font-medium">Aksesoris</span>
              <span className="font-bold text-indonesia-red-600">{formatCurrency(200000000)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">Spare Parts</span>
              <span className="font-bold text-gray-700">{formatCurrency(150000000)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">Tools</span>
              <span className="font-bold text-gray-700">{formatCurrency(100000000)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Movement Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard
          title={t('dashboard.inventory.stockInVsOut')}
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stockMovement || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="in"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Masuk"
                />
                <Line
                  type="monotone"
                  dataKey="out"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Keluar"
                />
              </LineChart>
            </ResponsiveContainer>
          }
        />
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-bold text-indonesia-red-700 mb-4">
            {t('dashboard.inventory.topMovingProducts')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Produk</th>
                  <th className="text-right py-2 px-4">Masuk</th>
                  <th className="text-right py-2 px-4">Keluar</th>
                  <th className="text-right py-2 px-4">Net</th>
                </tr>
              </thead>
              <tbody>
                {(topMovingProducts || []).map((product, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4">{product.product}</td>
                    <td className="text-right py-2 px-4">{formatNumber(product.qtyIn)}</td>
                    <td className="text-right py-2 px-4">{formatNumber(product.qtyOut)}</td>
                    <td className="text-right py-2 px-4">
                      <span
                        className={
                          product.netChange > 0 ? 'text-success-600' : 'text-danger-600'
                        }
                      >
                        {product.netChange > 0 ? '+' : ''}
                        {formatNumber(product.netChange)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Alerts & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-bold text-indonesia-red-700 mb-4">
            {t('dashboard.inventory.lowStockAlerts')}
          </h3>
          <div className="space-y-3">
            {(lowStockAlerts || []).map((alert, idx) => (
              <div key={idx} className="p-3 border border-warning-300 rounded-lg bg-warning-50">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium">{alert.product}</span>
                  <button className="px-3 py-1 bg-indonesia-red-600 text-white rounded text-sm hover:bg-indonesia-red-700">
                    Buat PO
                  </button>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Stok saat ini: {alert.currentQty} (Reorder: {alert.reorderPoint})</p>
                  <p>Pesanan terakhir: {alert.lastOrderDate}</p>
                  <p>Disarankan: {alert.suggestedQty} unit</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-bold text-indonesia-red-700 mb-4">
            {t('dashboard.inventory.pendingTransfers')}
          </h3>
          <div className="space-y-3">
            {(pendingTransfers || []).map((transfer) => (
              <div
                key={transfer.id}
                className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-medium">{transfer.id}</span>
                    <p className="text-sm text-gray-600">
                      {transfer.from} → {transfer.to}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      transfer.status === 'pending'
                        ? 'bg-warning-100 text-warning-700'
                        : 'bg-success-100 text-success-700'
                    }`}
                  >
                    {transfer.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-indonesia-red-600 text-white rounded text-sm hover:bg-indonesia-red-700">
                    Setujui
                  </button>
                  <button className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300">
                    Detail
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stock Aging */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold text-indonesia-red-700 mb-4">
          {t('dashboard.inventory.slowMovingItems')}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-4">Produk</th>
                <th className="text-right py-2 px-4">Hari Tanpa Pergerakan</th>
                <th className="text-right py-2 px-4">Nilai Stok</th>
                <th className="text-left py-2 px-4">Rekomendasi</th>
              </tr>
            </thead>
            <tbody>
              {(slowMovingItems || []).map((item, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-4">{item.product}</td>
                  <td className="text-right py-2 px-4">{item.daysNoMovement} hari</td>
                  <td className="text-right py-2 px-4">{formatCurrency(item.stockValue)}</td>
                  <td className="py-2 px-4">
                    <span className="px-2 py-1 bg-warning-100 text-warning-700 rounded text-xs">
                      Diskon/Promo
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

