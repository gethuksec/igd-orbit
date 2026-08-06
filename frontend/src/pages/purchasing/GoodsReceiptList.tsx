import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package, Search, Eye, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { purchasingService, type GoodsReceipt } from '@/services/purchasing.service';
import { formatDate } from '@/utils/format';
import { useBranchFilter, BranchFilterSelect } from '@/components/branch/BranchFilter';

export default function GoodsReceiptList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;
  const { branchId, setBranchId } = useBranchFilter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['goods-receipts', page, limit, searchTerm, statusFilter, branchId],
    queryFn: async () => {
      try {
        const result = await purchasingService.getGoodsReceipts({
          page,
          limit,
          search: searchTerm || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          branchId: branchId || undefined,
        });
        return result;
      } catch (err: any) {
        console.error('Error fetching goods receipts:', err);
        throw err;
      }
    },
  });

  // Backend returns { data: [], total, page, limit, totalPages }
  const goodsReceipts = data?.data || [];
  const total = data?.total || 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">Draft</span>;
      case 'received':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Received</span>;
      case 'inspected':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">Inspected</span>;
      case 'approved':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Approved</span>;
      case 'rejected':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Rejected</span>;
      case 'cancelled':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Cancelled</span>;
      default:
        return null;
    }
  };

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader title="Goods Receipt" subtitle="Kelola penerimaan barang">
        <Link
          to="/purchasing/goods-receipt/new"
          className="px-4 py-2 bg-white text-primary-600 border border-gray-200 rounded-lg font-semibold hover:bg-primary-50 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          GR Baru
        </Link>
      </BreadcrumbHeader>

      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex items-end">
            <BranchFilterSelect value={branchId} onChange={setBranchId} />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Cari Penerimaan Barang</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Cari nomor GR, PO..."
                className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all bg-white min-w-[150px]"
            >
              <option value="all">Semua Status</option>
              <option value="draft">Draft</option>
              <option value="received">Received</option>
              <option value="inspected">Inspected</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-600" />
            <p className="text-gray-600">Memuat data...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">Gagal memuat data goods receipt</p>
          </div>
        ) : goodsReceipts.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Tidak ada data goods receipt</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Nomor GR</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">PO Number</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Tanggal</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {goodsReceipts.map((gr: GoodsReceipt) => (
                    <tr key={gr.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/purchasing/goods-receipt/${gr.id}`}
                          className="text-sm font-mono font-semibold text-primary-600 hover:text-primary-800 hover:underline"
                        >
                          {gr.grNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {gr.purchaseOrder?.poNumber ? (
                          <Link
                            to={`/purchasing/po/${gr.purchaseOrderId}`}
                            className="text-sm font-mono text-primary-600 hover:underline"
                          >
                            {gr.purchaseOrder.poNumber}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(gr.receiptDate)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(gr.status)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/purchasing/goods-receipt/${gr.id}`}
                          className="text-primary-600 hover:text-primary-800 font-semibold text-sm"
                        >
                          <Eye className="w-5 h-5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data && data.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Menampilkan {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} dari {total}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Sebelumnya
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                    disabled={page >= data.totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Selanjutnya
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

