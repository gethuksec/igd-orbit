import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Save,
  Loader2,
  ClipboardCheck,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { toast } from 'sonner';

export default function StockOpnameCount() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [conditions, setConditions] = useState<Record<string, 'good' | 'damaged' | 'expired'>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const { data: opname, isLoading } = useQuery({
    queryKey: ['inventory-opname', id],
    queryFn: () => inventoryService.getOpnameById(id!),
    enabled: !!id,
  });

  const recordMutation = useMutation({
    mutationFn: (data: any) => inventoryService.recordCount(id!, data),
    onSuccess: () => {
      toast.success('Hasil perhitungan berhasil disimpan');
      queryClient.invalidateQueries({ queryKey: ['inventory-opname', id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyimpan hasil perhitungan');
    },
  });

  // Initialize counts from existing data
  useEffect(() => {
    if (opname) {
      const initialCounts: Record<string, number> = {};
      const initialConditions: Record<string, 'good' | 'damaged' | 'expired'> = {};
      const initialNotes: Record<string, string> = {};

      opname.items.forEach((item) => {
        if (item.physicalQuantity !== null) {
          initialCounts[item.id] = Number(item.physicalQuantity);
        } else {
          initialCounts[item.id] = Number(item.systemQuantity);
        }
        if (item.condition) {
          initialConditions[item.id] = item.condition;
        } else {
          initialConditions[item.id] = 'good';
        }
        if (item.notes) {
          initialNotes[item.id] = item.notes;
        }
      });

      setCounts(initialCounts);
      setConditions(initialConditions);
      setNotes(initialNotes);
    }
  }, [opname]);

  if (isLoading || !opname) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
          <p className="text-gray-600 font-semibold text-lg">Memuat data opname...</p>
        </div>
      </div>
    );
  }

  const filteredItems = opname.items.filter((item) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      item.product?.name.toLowerCase().includes(search) ||
      item.product?.sku.toLowerCase().includes(search)
    );
  });

  const handleSaveAll = () => {
    const itemsToSave = opname.items.map((item) => ({
      productId: item.productId,
      physicalQuantity: counts[item.id] || Number(item.systemQuantity),
      condition: conditions[item.id] || 'good',
      notes: notes[item.id] || undefined,
    }));

    recordMutation.mutate({ items: itemsToSave });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to={`/inventory/opname/${id}`}
              className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold mb-1">Catat Hasil Perhitungan</h1>
              <p className="text-primary-100">{opname.opnameNumber}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari produk..."
            className="block w-full pl-12 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
          />
        </div>
      </div>

      {/* Items List */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary-600" />
            Daftar Item ({filteredItems.length} dari {opname.items.length})
          </h2>
          <button
            onClick={handleSaveAll}
            disabled={recordMutation.isPending}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {recordMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Simpan Semua</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Produk</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Stok Sistem</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Stok Fisik
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Discrepancy</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Kondisi</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Catatan</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.map((item) => {
                const systemQty = Number(item.systemQuantity);
                const physicalQty = counts[item.id] || systemQty;
                const discrepancy = physicalQty - systemQty;
                const costPrice = item.product?.costPrice
                  ? typeof item.product.costPrice === 'string'
                    ? parseFloat(item.product.costPrice)
                    : Number(item.product.costPrice)
                  : 0;
                const discrepancyValue = discrepancy * costPrice;
                const percentage = systemQty > 0 ? Math.abs((discrepancy / systemQty) * 100) : 0;
                const isLargeDiscrepancy = percentage > 5;

                return (
                  <tr key={item.id} className={`hover:bg-gray-50 ${isLargeDiscrepancy ? 'bg-yellow-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{item.product?.name || '-'}</div>
                      <div className="text-xs text-gray-500">SKU: {item.product?.sku || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-semibold text-gray-900">{systemQty}</div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        value={counts[item.id] ?? systemQty}
                        onChange={(e) =>
                          setCounts({ ...counts, [item.id]: parseInt(e.target.value) || 0 })
                        }
                        className="w-24 px-2 py-1 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div
                        className={`text-sm font-semibold ${
                          discrepancy > 0
                            ? 'text-green-600'
                            : discrepancy < 0
                              ? 'text-red-600'
                              : 'text-gray-900'
                        }`}
                      >
                        {discrepancy > 0 ? '+' : ''}
                        {discrepancy} ({percentage.toFixed(1)}%)
                      </div>
                      {isLargeDiscrepancy && (
                        <div className="text-xs text-yellow-600 flex items-center gap-1 mt-1">
                          <AlertTriangle className="w-3 h-3" />
                          {'>'} 5%
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {formatCurrency(Math.abs(discrepancyValue))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={conditions[item.id] || 'good'}
                        onChange={(e) =>
                          setConditions({
                            ...conditions,
                            [item.id]: e.target.value as 'good' | 'damaged' | 'expired',
                          })
                        }
                        className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="good">Baik</option>
                        <option value="damaged">Rusak</option>
                        <option value="expired">Kadaluarsa</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={notes[item.id] || ''}
                        onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                        placeholder="Catatan..."
                        className="w-full px-2 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => {
                          recordMutation.mutate({
                            items: [
                              {
                                productId: item.productId,
                                physicalQuantity: counts[item.id] || systemQty,
                                condition: conditions[item.id] || 'good',
                                notes: notes[item.id] || undefined,
                              },
                            ],
                          });
                        }}
                        disabled={recordMutation.isPending}
                        className="px-3 py-1 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-xs font-medium disabled:opacity-50"
                      >
                        Simpan
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link
          to={`/inventory/opname/${id}`}
          className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Detail
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveAll}
            disabled={recordMutation.isPending}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {recordMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Simpan Semua Perubahan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

