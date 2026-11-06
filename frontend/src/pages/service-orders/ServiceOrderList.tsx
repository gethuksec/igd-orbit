import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Edit, Eye, Wrench } from 'lucide-react';
import { serviceOrdersService } from '../../services/service-orders.service';
import { usersService } from '../../services/users.service';
import { useBranchFilter } from '@/components/branch/BranchFilter';
import { api } from '@/services/api';
import { BreadcrumbHeader, DataTable, FilterToolbar } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Button } from '@/components/ui/button';

export default function ServiceOrderList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedTechnician, setSelectedTechnician] = useState<string>('ALL');
  const [filterCode, setFilterCode] = useState('');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterPenerima, setFilterPenerima] = useState('');
  const [filterReceivedBy, setFilterReceivedBy] = useState('');
  const [filterDeviceUnit, setFilterDeviceUnit] = useState('');
  const [filterPartSearch, setFilterPartSearch] = useState('');
  const [filterSerial, setFilterSerial] = useState('');
  const [receivedFrom, setReceivedFrom] = useState('');
  const [receivedTo, setReceivedTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const { branchId, setBranchId } = useBranchFilter();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['service-orders', page, searchTerm, selectedStatus, selectedTechnician, branchId, filterCode, filterCustomerId, filterPenerima, filterReceivedBy, filterDeviceUnit, filterPartSearch, filterSerial, receivedFrom, receivedTo],
    queryFn: () =>
      serviceOrdersService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        branchId: branchId || undefined,
        technicianId: selectedTechnician !== 'ALL' ? selectedTechnician : undefined,
        code: filterCode || undefined,
        customerId: filterCustomerId || undefined,
        penerima: filterPenerima || undefined,
        createdBy: filterReceivedBy || undefined,
        deviceUnit: filterDeviceUnit || undefined,
        partSearch: filterPartSearch || undefined,
        serial: filterSerial || undefined,
        receivedFrom: receivedFrom || undefined,
        receivedTo: receivedTo || undefined,
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
  }, [searchTerm, selectedStatus, selectedTechnician, filterCode, filterCustomerId, filterPenerima, filterReceivedBy, filterDeviceUnit, filterPartSearch, filterSerial, receivedFrom, receivedTo, refetch]);

  // Searchable customer dropdown (nama / kode)
  const fetchCustomers = async (q: string) => {
    const res = await api.get('/customers', { params: { search: q || undefined, limit: 20 } });
    const rows = res.data.data || res.data || [];
    return (Array.isArray(rows) ? rows : [])
      .map((c: any) => ({
        value: c.id,
        label: c.customerCode ? `${c.name} (${c.customerCode})` : c.name,
      }))
      .filter((o: any) => o.value && o.label);
  };

  // Searchable user dropdown (penerima awal = CS pembuat order)
  const fetchUsers = async (q: string) => {
    const res = await usersService.getAll({ search: q || undefined, limit: 20 });
    const rows = (res as any).data || [];
    return (Array.isArray(rows) ? rows : [])
      .map((u: any) => ({ value: u.id, label: u.fullName || u.email }))
      .filter((o: any) => o.value && o.label);
  };

  // Searchable technician dropdown (from the TC list already loaded)
  const fetchTechnicians = async (q: string) => {
    const needle = (q || '').toLowerCase();
    return (technicians || [])
      .filter((t: any) => {
        if (!needle) return true;
        return (
          (t.fullName || '').toLowerCase().includes(needle) ||
          (t.email || '').toLowerCase().includes(needle)
        );
      })
      .slice(0, 20)
      .map((t: any) => ({ value: t.id, label: t.fullName || t.email }));
  };

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
      key: 'penerima',
      header: 'Penerima',
      cell: (order) => (
        <div className="text-sm text-foreground">
          {(order as any).pickedUpBy || <span className="text-muted-foreground">-</span>}
        </div>
      ),
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
      />

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
        </div>
      )}

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nomor service atau nama pelanggan..."
        branchFilter={{ value: branchId, onChange: setBranchId, allowAll: true }}
        fields={[
          {
            key: 'code',
            label: 'Kode service',
            type: 'input',
            placeholder: 'cth. SRV-20261105',
          },
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
              { value: 'ready-cancel', label: 'Ready-Cancel' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
          {
            key: 'customer',
            label: 'Customer',
            type: 'search-select',
            fetchOptions: fetchCustomers,
            placeholder: 'Ketik nama / kode customer...',
          },
          {
            key: 'technician',
            label: 'Teknisi',
            type: 'search-select',
            fetchOptions: fetchTechnicians,
            placeholder: 'Ketik nama teknisi...',
          },
          {
            key: 'penerima',
            label: 'Nama penerima',
            type: 'input',
            placeholder: 'cth. Siti',
          },
          {
            key: 'receivedBy',
            label: 'Diterima oleh (CS)',
            type: 'search-select',
            fetchOptions: fetchUsers,
            placeholder: 'Ketik nama CS...',
          },
          {
            key: 'deviceUnit',
            label: 'Nama unit',
            type: 'input',
            placeholder: 'cth. Samsung A52',
          },
          {
            key: 'partSearch',
            label: 'Barcode / nama produk / SKU',
            type: 'input',
            placeholder: 'Sparepart yang dipakai...',
          },
          {
            key: 'serial',
            label: 'Serial number',
            type: 'input',
            placeholder: 'cth. 358111234567890',
          },
          {
            key: 'received',
            label: 'Tanggal terima',
            type: 'date-range',
          },
        ]}
        values={{
          code: filterCode,
          status: selectedStatus === 'ALL' ? '' : selectedStatus,
          customer: filterCustomerId,
          technician: selectedTechnician === 'ALL' ? '' : selectedTechnician,
          penerima: filterPenerima,
          receivedBy: filterReceivedBy,
          deviceUnit: filterDeviceUnit,
          partSearch: filterPartSearch,
          serial: filterSerial,
          receivedFrom,
          receivedTo,
        }}
        onFieldChange={(key, v) => {
          setPage(1);
          switch (key) {
            case 'code': setFilterCode(v); break;
            case 'status': setSelectedStatus((v || 'ALL') as any); break;
            case 'customer': setFilterCustomerId(v); break;
            case 'technician': setSelectedTechnician((v || 'ALL') as any); break;
            case 'penerima': setFilterPenerima(v); break;
            case 'receivedBy': setFilterReceivedBy(v); break;
            case 'deviceUnit': setFilterDeviceUnit(v); break;
            case 'partSearch': setFilterPartSearch(v); break;
            case 'serial': setFilterSerial(v); break;
            case 'receivedFrom': setReceivedFrom(v); break;
            case 'receivedTo': setReceivedTo(v); break;
          }
        }}
        onReset={() => {
          setSelectedStatus('ALL');
          setSelectedTechnician('ALL');
          setFilterCode('');
          setFilterCustomerId('');
          setFilterPenerima('');
          setFilterReceivedBy('');
          setFilterDeviceUnit('');
          setFilterPartSearch('');
          setFilterSerial('');
          setReceivedFrom('');
          setReceivedTo('');
          setPage(1);
        }}
      />

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
