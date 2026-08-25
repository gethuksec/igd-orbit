import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Eye, Package } from 'lucide-react';
import { serviceReturnsService } from '../../services/service-returns.service';
import { useBranchFilter } from '@/components/branch/BranchFilter';
import { BreadcrumbHeader, DataTable, FilterToolbar } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Button } from '@/components/ui/button';

export default function ServiceReturnsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedReturnType, setSelectedReturnType] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;
  const { branchId, setBranchId } = useBranchFilter();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['service-returns', page, searchTerm, selectedStatus, selectedReturnType, branchId],
    queryFn: () =>
      serviceReturnsService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        returnType: selectedReturnType !== 'ALL' ? selectedReturnType : undefined,
        branchId: branchId || undefined,
      }),
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, selectedStatus, selectedReturnType, refetch]);

  const returns = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase();
    let classes = 'bg-gray-100 text-gray-800 border-gray-200';
    if (s === 'pending' || s === 'investigating')
      classes = 'bg-yellow-100 text-yellow-800 border-yellow-200';
    else if (s === 'approved')
      classes = 'bg-green-100 text-green-800 border-green-200';
    else if (s === 'rejected')
      classes = 'bg-red-100 text-red-800 border-red-200';
    else if (s === 'resolved')
      classes = 'bg-blue-100 text-blue-800 border-blue-200';
    return (
      <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${classes}`}>
        {status}
      </span>
    );
  };

  const getReturnTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      're-service': 'Re-Service',
      complaint: 'Complaint',
      warranty: 'Warranty',
      combination: 'Combination',
    };
    return map[type] || type;
  };

  const columns: Column<any>[] = [
    {
      key: 'returnNumber',
      header: 'Return Number',
      cell: (ret) => (
        <Link
          to={`/service-returns/${ret.id}`}
          className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
        >
          {ret.returnNumber}
        </Link>
      ),
    },
    {
      key: 'serviceOrder',
      header: 'Service Order',
      cell: (ret) =>
        ret.serviceOrder ? (
          <Link
            to={`/service-orders/${ret.serviceOrder.id}`}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
          >
            {ret.serviceOrder.serviceNumber}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (ret) => {
        const so = ret.serviceOrder;
        if (!so) return <span className="text-sm text-foreground">-</span>;
        const soAny = so as any;
        const customerId = soAny.customer?.id || soAny.customerId || null;
        const customerName = so.customerName || soAny.customer?.name || soAny.customer?.fullName || '-';
        return customerId ? (
          <Link
            to={`/customers/${customerId}`}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors hover:underline"
          >
            {customerName}
          </Link>
        ) : (
          <span className="text-sm text-foreground">{customerName}</span>
        );
      },
    },
    {
      key: 'device',
      header: 'Device',
      cell: (ret) => (
        <div className="text-sm text-foreground">
          {ret.serviceOrder?.deviceType || '-'}
          {ret.serviceOrder?.deviceUnit && <> {ret.serviceOrder.deviceUnit}</>}
        </div>
      ),
    },
    {
      key: 'returnType',
      header: 'Tipe',
      cell: (ret) => (
        <span className="text-sm font-medium text-foreground">{getReturnTypeLabel(ret.returnType)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (ret) => getStatusBadge(ret.status),
    },
    {
      key: 'returnedAt',
      header: 'Returned Date',
      cell: (ret) => (
        <div className="text-sm text-foreground">
          {new Date(ret.returnedAt).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </div>
      ),
    },
  ];

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader
        title="Retur & Komplain Service"
        subtitle="Kelola retur dan komplain service"
      >
        <Link to="/service-returns/new">
          <Button className="flex items-center gap-2 bg-white text-primary-600 border border-gray-200 hover:bg-primary-50">
            <Plus className="w-5 h-5" />
            <span>Tambah Retur</span>
          </Button>
        </Link>
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">Gagal memuat data. Silakan coba lagi.</p>
        </div>
      )}

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari return number, service order, atau nama customer..."
        branchFilter={{ value: branchId, onChange: setBranchId, allowAll: true }}
        fields={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'investigating', label: 'Investigating' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'resolved', label: 'Resolved' },
            ],
          },
          {
            key: 'returnType',
            label: 'Tipe Retur',
            type: 'select',
            options: [
              { value: 're-service', label: 'Re-Service' },
              { value: 'complaint', label: 'Complaint' },
              { value: 'warranty', label: 'Warranty' },
              { value: 'combination', label: 'Combination' },
            ],
          },
        ]}
        values={{
          status: selectedStatus === 'ALL' ? '' : selectedStatus,
          returnType: selectedReturnType === 'ALL' ? '' : selectedReturnType,
        }}
        onFieldChange={(key, v) => {
          if (key === 'status') {
            setSelectedStatus((v || 'ALL') as any);
            setPage(1);
          }
          if (key === 'returnType') {
            setSelectedReturnType((v || 'ALL') as any);
            setPage(1);
          }
        }}
        onReset={() => {
          setSelectedStatus('ALL');
          setSelectedReturnType('ALL');
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={returns}
        keyExtractor={(ret: any) => ret.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada data retur service"
        emptyIcon={<Package className="w-16 h-16" />}
        actions={(ret: any) => (
          <Link to={`/service-returns/${ret.id}`}>
            <Button variant="ghost" size="sm">
              <Eye className="w-4 h-4 mr-1" />
              View
            </Button>
          </Link>
        )}
      />

      {/* Pagination */}
      {!isLoading && returns.length > 0 && pagination.totalPages > 1 && (
        <div className="bg-white px-6 py-4 rounded-xl border border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Menampilkan {((pagination.page - 1) * pagination.limit) + 1} sampai{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} dari{' '}
            <span className="font-semibold">{pagination.total}</span> data
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
