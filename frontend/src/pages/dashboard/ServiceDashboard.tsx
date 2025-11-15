import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wrench, CheckCircle, Clock, Star } from 'lucide-react';
import {
  BarChart,
  Bar,
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
import { formatNumber } from '../../utils/format';

export function ServiceDashboard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<{ startDate: Date; endDate: Date }>({
    startDate: new Date(),
    endDate: new Date(),
  });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch Service KPIs
  const { data: serviceKPIs, isLoading: kpisLoading, error: kpisError } = useQuery({
    queryKey: ['dashboard', 'service', 'kpis'],
    queryFn: () => dashboardService.getServiceKPIs(),
  });

  // Debug logging
  useEffect(() => {
    if (serviceKPIs) {
      console.log('Service KPIs data:', serviceKPIs);
    }
    if (kpisError) {
      console.error('Service KPIs error:', kpisError);
    }
  }, [serviceKPIs, kpisError]);

  // Fetch Service Pipeline
  const { data: servicePipeline } = useQuery({
    queryKey: ['dashboard', 'service', 'pipeline'],
    queryFn: () => dashboardService.getServicePipeline(),
  });

  // Fetch Service Types Distribution
  const { data: serviceTypesDistribution } = useQuery({
    queryKey: ['dashboard', 'service', 'types', dateRange],
    queryFn: () =>
      dashboardService.getServiceTypesDistribution({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
      }),
  });

  // Fetch Workload by Technician
  const { data: workloadByTechnician } = useQuery({
    queryKey: ['dashboard', 'service', 'workload'],
    queryFn: () => dashboardService.getWorkloadByTechnician(),
  });

  // Fetch Performance Metrics
  const { data: performanceMetrics } = useQuery({
    queryKey: ['dashboard', 'service', 'performance'],
    queryFn: () => dashboardService.getPerformanceMetrics(30),
  });

  // Fetch Overdue Services
  const { data: overdueServices } = useQuery({
    queryKey: ['dashboard', 'service', 'overdue'],
    queryFn: () => dashboardService.getOverdueServices(),
  });

  // Fetch Most Used Parts
  const { data: mostUsedParts } = useQuery({
    queryKey: ['dashboard', 'service', 'most-used-parts'],
    queryFn: () => dashboardService.getMostUsedParts(30, 10),
  });

  // Fetch SLA Compliance
  const { data: slaCompliance } = useQuery({
    queryKey: ['dashboard', 'service', 'sla-compliance'],
    queryFn: () => dashboardService.getSLACompliance(),
  });

  const COLORS = ['#dc2626', '#fca5a5', '#fee2e2', '#fef2f2', '#3b82f6'];

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'service'] });
    setLastUpdated(new Date());
  };

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-indonesia-red-700">
          {t('dashboard.service.title')}
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

      {/* Service KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title={t('dashboard.service.activeServices')}
          value={
            kpisLoading
              ? 'Loading...'
              : formatNumber(serviceKPIs?.activeServices || 0)
          }
          icon={Wrench}
          gradient="from-indonesia-red-500 to-indonesia-red-600"
          textColor="text-white"
        />
        <KPICard
          title={t('dashboard.service.completedToday')}
          value={
            kpisLoading
              ? 'Loading...'
              : formatNumber(serviceKPIs?.completedToday || 0)
          }
          icon={CheckCircle}
          gradient="from-white to-gray-100"
          textColor="text-indonesia-red-600"
          border="border-l-4 border-indonesia-red-600"
        />
        <KPICard
          title={t('dashboard.service.averageTAT')}
          value={
            kpisLoading
              ? 'Loading...'
              : `${(serviceKPIs?.averageTAT || 0).toFixed(1)} hari`
          }
          icon={Clock}
          gradient="from-indonesia-red-500 to-indonesia-red-600"
          textColor="text-white"
        />
        <KPICard
          title={t('dashboard.service.customerRating')}
          value={
            kpisLoading
              ? 'Loading...'
              : `${(serviceKPIs?.customerRating || 0).toFixed(1)}/5.0`
          }
          icon={Star}
          gradient="from-white to-gray-100"
          textColor="text-indonesia-red-600"
          border="border-l-4 border-indonesia-red-600"
        />
      </div>

      {/* Service Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard
          title={t('dashboard.service.servicePipeline')}
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={servicePipeline || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="stage" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          }
        />
        <ChartCard
          title={t('dashboard.service.serviceTypesDistribution')}
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={serviceTypesDistribution || []}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `${entry.type}: ${entry.count}`}
                >
                  {(serviceTypesDistribution || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          }
        />
      </div>

      {/* Technician Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard
          title={t('dashboard.service.workloadByTechnician')}
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadByTechnician || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="active" fill="#dc2626" name="Aktif" />
                <Bar dataKey="completedToday" fill="#10b981" name="Selesai Hari Ini" />
              </BarChart>
            </ResponsiveContainer>
          }
        />
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-bold text-indonesia-red-700 mb-4">
            {t('dashboard.service.performanceMetrics')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Rank</th>
                  <th className="text-left py-2 px-4">Teknisi</th>
                  <th className="text-right py-2 px-4">Selesai</th>
                  <th className="text-right py-2 px-4">TAT</th>
                  <th className="text-right py-2 px-4">Rating</th>
                </tr>
              </thead>
              <tbody>
                {(performanceMetrics || []).map((tech) => (
                  <tr key={tech.name} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4">
                      <span className="px-2 py-1 bg-indonesia-red-600 text-white rounded text-xs">
                        #{tech.rank}
                      </span>
                    </td>
                    <td className="py-2 px-4">{tech.name}</td>
                    <td className="text-right py-2 px-4">{tech.completed}</td>
                    <td className="text-right py-2 px-4">{tech.averageTAT} hari</td>
                    <td className="text-right py-2 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Star className="w-4 h-4 text-garuda-gold-500 fill-current" />
                        <span>{tech.rating}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SLA Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-bold text-indonesia-red-700 mb-4">
            {t('dashboard.service.slaCompliance')}
          </h3>
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <div
                className={`text-6xl font-bold mb-2 ${
                  (slaCompliance || 0) >= 90
                    ? 'text-success-600'
                    : (slaCompliance || 0) >= 70
                      ? 'text-warning-600'
                      : 'text-danger-600'
                }`}
              >
                {slaCompliance || 0}%
              </div>
              <p className="text-gray-600">Target: 90%</p>
              <div className="mt-4 w-64 h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    (slaCompliance || 0) >= 90
                      ? 'bg-success-600'
                      : (slaCompliance || 0) >= 70
                        ? 'bg-warning-600'
                        : 'bg-danger-600'
                  }`}
                  style={{ width: `${slaCompliance || 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-bold text-indonesia-red-700 mb-4">
            {t('dashboard.service.overdueServices')}
          </h3>
          <div className="space-y-3">
            {(overdueServices || []).map((service) => (
              <div
                key={service.serviceNumber}
                className={`p-3 border rounded-lg ${
                  service.priority === 'high'
                    ? 'border-danger-500 bg-danger-50'
                    : 'border-warning-500 bg-warning-50'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-medium">{service.serviceNumber}</span>
                    <p className="text-sm text-gray-600">{service.customer} - {service.device}</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      service.priority === 'high'
                        ? 'bg-danger-600 text-white'
                        : 'bg-warning-600 text-white'
                    }`}
                  >
                    {service.daysOverdue} hari terlambat
                  </span>
                </div>
                <p className="text-sm text-gray-600">Ditugaskan ke: {service.assignedTo}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Parts Usage */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold text-indonesia-red-700 mb-4">
          {t('dashboard.service.mostUsedParts')}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-4">Suku Cadang</th>
                <th className="text-right py-2 px-4">Qty Digunakan</th>
                <th className="text-left py-2 px-4">Status Stok</th>
              </tr>
            </thead>
            <tbody>
              {(mostUsedParts || []).map((part, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-4">{part.part}</td>
                  <td className="text-right py-2 px-4">{part.qtyUsed}</td>
                  <td className="py-2 px-4">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        part.stockStatus === 'in-stock'
                          ? 'bg-success-100 text-success-700'
                          : 'bg-warning-100 text-warning-700'
                      }`}
                    >
                      {part.stockStatus === 'in-stock' ? 'Tersedia' : 'Stok Rendah'}
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

