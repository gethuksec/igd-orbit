import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Wrench } from 'lucide-react';
import { serviceOrdersService } from '@/services/service-orders.service';
import { useBranchFilter } from '@/components/branch/BranchFilter';
import { BreadcrumbHeader, DataTable, FilterToolbar } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Button } from '@/components/ui/button';

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function MyServiceOrders() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;
  const { branchId, setBranchId } = useBranchFilter();
  const user = getCurrentUser();
  const technicianId = user?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['my-service-orders', page, searchTerm, selectedStatus, branchId, technicianId],
    queryFn: () =>
      serviceOrdersService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        branchId: branchId || undefined,
        technicianId,
      }),
    enabled: !!technicianId,
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, selectedStatus, refetch]);

  const orders = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: orders.length, totalPages: 1 };

  const getStatusBadge = (status: string) => {
    const s = status?.toUpperCase();
    let classes = 'bg-gray-100 text-gray-800 border-gray-200';
    if (s === 'PENDING' || s === 'DIAGNOSED' || s === 'QUOTED' || s === 'APPROVED')
      classes = 'bg-yellow-100 text-yellow-800 border-yellow-200';
    else if (s === 'IN-PROGRESS' || s === 'IN_PROGRESS' || s === 'QC')
      classes = 'bg-blue-100 text-blue-800 border-blue-200';
    else if (s === 'COMPLETED')
      classes = 'bg-green-100 text-green-800 border-green-200';
    else if (s === 'CANCELLED')
      classes = 'bg-red-100 text-red-800 border-red-200';
    return (
      <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${classes}`}>
        {status}
      </span>
    );
  };

  const columns: Column<any>[] = [
    {
      key: 'serviceNumber',
      header: 'Nomor Service',
      cell: (order) => (
        <div>
          <Link
            to={`/service-orders/${order.id}`}
            className="text-sm font-semibold text-primary-600 hover:text-primary-700"
          >
            {order.serviceNumber}
          </Link>
          {order.internalNumber && (
            <div className="text-xs text-muted-foreground">{order.internalNumber}</div>
          )}
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Pelanggan',
      cell: (order) => (
        <div>
          <div className="text-sm font-medium text-foreground">
            {order.customerName || order.customer?.name || 'Walk-in Customer'}
          </div>
          {order.customerPhone && <div className="text-xs text-muted-foreground">{order.customerPhone}</div>}
        </div>
      ),
    },
    {
      key: 'device',
      header: 'Perangkat',
      cell: (order) => (
        <div>
          <div className="text-sm text-foreground">{order.deviceUnit || '-'}</div>
          {order.deviceType && <div className="text-xs text-muted-foreground uppercase">{order.deviceType}</div>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (order) => getStatusBadge(order.status),
    },
  ];

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Service Saya" subtitle="Daftar service order yang sedang ditangani oleh kamu sebagai teknisi" />

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">
            {(error as Error).message || 'Terjadi kesalahan saat memuat data service.'}
          </p>
        </div>
      )}

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nomor service, pelanggan, atau perangkat..."
        branchFilter={{ value: branchId, onChange: setBranchId, allowAll: true }}
        fields={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'diagnosed', label: 'Diagnosed' },
              { value: 'in-progress', label: 'In Progress' },
              { value: 'qc', label: 'QC' },
              { value: 'ready', label: 'Ready' },
              { value: 'done', label: 'Done' },
            ],
          },
        ]}
        values={{ status: selectedStatus === 'ALL' ? '' : selectedStatus }}
        onFieldChange={(key, v) => {
          if (key === 'status') {
            setSelectedStatus((v || 'ALL') as any);
            setPage(1);
          }
        }}
        onReset={() => {
          setSelectedStatus('ALL');
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={orders}
        keyExtractor={(order: any) => order.id}
        isLoading={isLoading}
        emptyMessage="Belum ada service yang ditugaskan ke kamu"
        emptyIcon={<Wrench className="w-16 h-16" />}
        actions={(order: any) => (
          <Link to={`/service-orders/${order.id}`}>
            <Button variant="ghost" size="sm">
              <Wrench className="w-4 h-4 mr-1" />
              Detail
            </Button>
          </Link>
        )}
      />

      {/* Pagination */}
      {!isLoading && orders.length > 0 && pagination.totalPages > 1 && (
        <div className="bg-white px-6 py-4 rounded-xl border border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Menampilkan {orders.length} dari{' '}
            <span className="font-semibold">{pagination.total}</span> service
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
