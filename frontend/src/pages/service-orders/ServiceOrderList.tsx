import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Edit, Eye, Wrench, Filter, UserCircle } from 'lucide-react';
import { serviceOrdersService } from '../../services/service-orders.service';
import { useBranchFilter, BranchFilterSelect } from '@/components/branch/BranchFilter';
import { api } from '@/services/api';
import { BreadcrumbHeader } from '@/components/shared';
import { DataTable } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ServiceOrderList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedTechnician, setSelectedTechnician] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;
  const { branchId, setBranchId } = useBranchFilter();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['service-orders', page, searchTerm, selectedStatus, selectedTechnician, branchId],
    queryFn: () =>
      serviceOrdersService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        branchId: branchId || undefined,
        technicianId: selectedTechnician !== 'ALL' ? selectedTechnician : undefined,
      }),
  });

  const { data: technicians } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      try {
        const res = await api.get('/users', {
          params: {
            page: 1,
            limit: 100,
            'filter[role]': 'TC',
          },
        });
        const raw = res.data?.data || res.data || [];
        return raw.filter((user: any) =>
          Array.isArray(user.roles) &&
          user.roles.some((r: any) => r.code === 'TC'),
        );
      } catch {
        return [];
      }
    },
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, selectedStatus, selectedTechnician, refetch]);

  const orders = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const getStatusBadge = (status: string) => {
    const s = String(status || '').toLowerCase();
    let classes = 'bg-gray-100 text-gray-800 border-gray-200';
    if (['pending', 'diagnosed', 'quoted', 'approved'].includes(s))
      classes = 'bg-yellow-100 text-yellow-800 border-yellow-200';
    else if (['in-progress', 'qc'].includes(s))
      classes = 'bg-blue-100 text-blue-800 border-blue-200';
    else if (['completed', 'delivered'].includes(s))
      classes = 'bg-green-100 text-green-800 border-green-200';
    else if (s === 'cancelled')
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
        <Link
          to={`/service-orders/${order.id}`}
          className="text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline transition-colors"
        >
          {order.serviceNumber}
        </Link>
      ),
    },
    {
      key: 'customer',
      header: 'Pelanggan',
      cell: (order) => {
        const customerId = order.customer?.id || order.customerId || null;
        const customerName = order.customerName || order.customer?.name || order.customer?.fullName || 'Walk-in Customer';
        const customerPhone = order.customerPhone || order.customer?.phone;
        return (
          <div>
            {customerId ? (
              <Link to={`/customers/${customerId}`} className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors hover:underline">
                {customerName}
              </Link>
            ) : (
              <div className="text-sm font-medium text-foreground">{customerName}</div>
            )}
            {customerPhone && <div className="text-xs text-muted-foreground">{customerPhone}</div>}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (order) => getStatusBadge(order.status),
    },
    {
      key: 'createdAt',
      header: 'Tanggal',
      cell: (order) => (
        <div className="text-sm text-foreground">
          {new Date(order.createdAt).toLocaleDateString('id-ID')}
        </div>
      ),
    },
  ];

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader
        title="Manajemen Service Order"
        subtitle="Kelola pesanan servis dan perbaikan"
      >
        <Link to="/service-orders/new">
          <Button className="flex items-center gap-2 bg-white text-primary-600 border border-gray-200 hover:bg-primary-50">
            <Plus className="w-5 h-5" />
            <span>Tambah Service Order</span>
          </Button>
        </Link>
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex items-end">
            <BranchFilterSelect value={branchId} onChange={setBranchId} />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Cari Service Order</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nomor service atau nama pelanggan..."
                className="w-full pl-10"
              />
            </div>
          </div>

          <div className="lg:w-56">
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full pl-10 h-10 rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none"
              >
                <option value="ALL">Semua Status</option>
                <option value="pending">Pending</option>
                <option value="diagnosed">Diagnosed</option>
                <option value="quoted">Quoted</option>
                <option value="approved">Approved</option>
                <option value="in-progress">In Progress</option>
                <option value="qc">QC</option>
                <option value="completed">Completed</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="lg:w-56">
            <label className="block text-sm font-medium text-gray-700 mb-2">Teknisi</label>
            <div className="relative">
              <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <select
                value={selectedTechnician}
                onChange={(e) => setSelectedTechnician(e.target.value)}
                className="w-full pl-10 h-10 rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none"
              >
                <option value="ALL">Semua Teknisi</option>
                {(technicians || []).map((tech: any) => (
                  <option key={tech.id} value={tech.id}>{tech.fullName || tech.email}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={orders}
        keyExtractor={(order: any) => order.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada service order ditemukan"
        emptyIcon={<Wrench className="w-16 h-16" />}
        actions={(order: any) => (
          <div className="flex items-center gap-1">
            <Link to={`/service-orders/${order.id}`}>
              <Button variant="ghost" size="sm" title="Lihat Detail">
                <Eye className="w-4 h-4" />
              </Button>
            </Link>
            <Link to={`/service-orders/${order.id}/edit`}>
              <Button variant="ghost" size="sm" title="Edit">
                <Edit className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        )}
      />

      {/* Pagination */}
      {!isLoading && orders.length > 0 && pagination.totalPages > 1 && (
        <div className="bg-white px-6 py-4 rounded-xl border border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Menampilkan {orders.length} dari{' '}
            <span className="font-semibold">{pagination.total}</span> service order
            <span className="ml-2 text-gray-500">
              (Halaman {pagination.page} dari {pagination.totalPages})
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
              Sebelumnya
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= pagination.totalPages}>
              Selanjutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
