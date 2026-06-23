import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Eye, Loader2, Filter, Package } from 'lucide-react';
import { serviceReturnsService } from '../../services/service-returns.service';
import { useBranchStore } from '@/stores/branchStore';

export default function ServiceReturnsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedReturnType, setSelectedReturnType] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;
  const { currentBranchId } = useBranchStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      'service-returns',
      page,
      searchTerm,
      selectedStatus,
      selectedReturnType,
      currentBranchId,
    ],
    queryFn: () =>
      serviceReturnsService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        returnType: selectedReturnType !== 'ALL' ? selectedReturnType : undefined,
        branchId: currentBranchId || undefined,
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

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
      case 'investigating':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'resolved':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getReturnTypeLabel = (type: string) => {
    switch (type) {
      case 're-service':
        return 'Re-Service';
      case 'complaint':
        return 'Complaint';
      case 'warranty':
        return 'Warranty';
      case 'combination':
        return 'Combination';
      default:
        return type;
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Page Header - Enhanced */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Retur & Komplain Service</h1>
            <p className="text-primary-100 text-lg">Kelola retur dan komplain service</p>
          </div>
          <Link to="/service-returns/new">
            <button className="flex items-center gap-2 px-6 py-3 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-all shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />
              <span>Tambah Retur</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Cari Retur</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari return number, service order, atau nama customer..."
                className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
              />
            </div>
          </div>

          <div className="lg:w-64">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Filter className="h-5 w-5 text-gray-400" />
              </div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
              >
                <option value="ALL">Semua Status</option>
                <option value="pending">Pending</option>
                <option value="investigating">Investigating</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          <div className="lg:w-64">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tipe Retur</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Filter className="h-5 w-5 text-gray-400" />
              </div>
              <select
                value={selectedReturnType}
                onChange={(e) => setSelectedReturnType(e.target.value)}
                className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
              >
                <option value="ALL">Semua Tipe</option>
                <option value="re-service">Re-Service</option>
                <option value="complaint">Complaint</option>
                <option value="warranty">Warranty</option>
                <option value="combination">Combination</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">Gagal memuat data. Silakan coba lagi.</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        ) : returns.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">Tidak ada data retur service</p>
            <p className="text-gray-400 text-sm mt-2">Mulai dengan membuat retur baru</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Return Number
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Service Order
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Device
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Tipe
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Returned Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {returns.map((returnItem) => (
                    <tr key={returnItem.id} className="hover:bg-primary-50/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/service-returns/${returnItem.id}`}
                          className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                        >
                          {returnItem.returnNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {returnItem.serviceOrder ? (
                          <Link
                            to={`/service-orders/${returnItem.serviceOrder.id}`}
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                          >
                            {returnItem.serviceOrder.serviceNumber}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(() => {
                          const serviceOrder = returnItem.serviceOrder;
                          if (!serviceOrder) {
                            return <span className="text-sm text-gray-900">-</span>;
                          }

                          // Debug: log structure untuk troubleshooting
                          // console.log('ServiceOrder data:', {
                          //   customerId: (serviceOrder as any).customerId,
                          //   customer: (serviceOrder as any).customer,
                          //   customerName: serviceOrder.customerName,
                          // });

                          // Try to get customerId from multiple sources
                          // Priority: customer.id > customerId (direct field)
                          const serviceOrderAny = serviceOrder as any;
                          const customerId = 
                            serviceOrderAny.customer?.id || 
                            serviceOrderAny.customerId ||
                            null;
                          
                          const customerName = 
                            serviceOrder.customerName || 
                            serviceOrderAny.customer?.name ||
                            serviceOrderAny.customer?.fullName ||
                            '-';
                          
                          // If we have customerId (not null/undefined), make it clickable
                          if (customerId && customerId !== null && customerId !== undefined) {
                            return (
                              <Link
                                to={`/customers/${customerId}`}
                                className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors hover:underline cursor-pointer"
                              >
                                {customerName}
                              </Link>
                            );
                          }
                          
                          // No customerId, just show name as text (walk-in customer)
                          return (
                            <span className="text-sm text-gray-900">
                              {customerName}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {returnItem.serviceOrder?.deviceType || '-'}
                          {returnItem.serviceOrder?.deviceUnit && (
                            <> {returnItem.serviceOrder.deviceUnit}</>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {getReturnTypeLabel(returnItem.returnType)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(
                            returnItem.status,
                          )}`}
                        >
                          {returnItem.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(returnItem.returnedAt).toLocaleDateString('id-ID', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/service-returns/${returnItem.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-all font-medium"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t-2 border-gray-100 bg-gray-50 flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700">
                  Menampilkan <span className="font-bold">{((pagination.page - 1) * pagination.limit) + 1}</span> sampai{' '}
                  <span className="font-bold">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> dari{' '}
                  <span className="font-bold">{pagination.total}</span> data
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 text-sm font-medium border-2 border-gray-300 rounded-lg hover:bg-white hover:border-primary-500 hover:text-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-200 rounded-lg">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-4 py-2 text-sm font-medium border-2 border-gray-300 rounded-lg hover:bg-white hover:border-primary-500 hover:text-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

