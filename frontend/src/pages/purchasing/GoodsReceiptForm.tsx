import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, Trash2, Loader2, X } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { purchasingService } from '@/services/purchasing.service';
import { productsService } from '@/services/products.service';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/format';
import { useBranchFilter } from '@/components/branch/BranchFilter';

export default function GoodsReceiptForm() {
  const { poId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { branchId } = useBranchFilter();

  const [isHibah, setIsHibah] = useState(false);
  const [formData, setFormData] = useState({
    purchase_order_id: poId || '',
    branch_id: branchId || '',
    receipt_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [items, setItems] = useState<Array<{
    purchase_order_item_id?: string;
    product_id: string;
    quantity_received: number;
    unit_price: number;
    batch_number?: string;
    serial_number?: string;
    expiry_date?: string;
    notes?: string;
    product?: any;
  }>>([]);

  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);

  // Fetch PO if provided
  const { data: po } = useQuery({
    queryKey: ['purchase-order', formData.purchase_order_id],
    queryFn: () => purchasingService.getPurchaseOrder(formData.purchase_order_id),
    enabled: !!formData.purchase_order_id && !isHibah,
  });

  // Fetch ordered POs for selection
  const { data: orderedPOs } = useQuery({
    queryKey: ['purchase-orders', 'ordered', branchId],
    queryFn: async () => {
      const result = await purchasingService.getPurchaseOrders({
        status: 'ordered',
        branchId: branchId || undefined,
        limit: 100,
      });
      return result.data || [];
    },
    enabled: !isHibah,
  });

  // Fetch branches
  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches');
      return res.data.data || res.data;
    },
  });

  // Fetch products for search
  const { data: productsData } = useQuery({
    queryKey: ['products', 'search', productSearch],
    queryFn: () =>
      productsService.getAll({
        page: 1,
        limit: 10,
        search: productSearch || undefined,
      }),
    enabled: productSearch.length > 2,
  });

  // Load PO items if PO is selected
  useEffect(() => {
    if (po && po.items && !isHibah) {
      setItems(
        po.items
          .filter((item) => item.quantityOrdered > item.quantityReceived) // Only items that haven't been fully received
          .map((item) => ({
            purchase_order_item_id: item.id,
            product_id: item.productId,
            quantity_received: item.quantityOrdered - item.quantityReceived,
            unit_price: item.unitPrice,
            product: item.product,
          })),
      );
    } else if (isHibah) {
      // Clear items when switching to hibah mode
      setItems([]);
    }
  }, [po, isHibah]);

  const createMutation = useMutation({
    mutationFn: (data: any) => purchasingService.createGoodsReceipt(data),
    onSuccess: (gr) => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Goods receipt berhasil dibuat');
      navigate(`/purchasing/goods-receipt/${gr.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membuat goods receipt');
    },
  });

  const handleAddItem = () => {
    if (!selectedProduct || quantity <= 0 || unitPrice <= 0) {
      toast.error('Lengkapi data produk');
      return;
    }

    const existingIndex = items.findIndex((item) => item.product_id === selectedProduct.id);
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity_received: updated[existingIndex].quantity_received + quantity,
      };
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          product_id: selectedProduct.id,
          quantity_received: quantity,
          unit_price: unitPrice,
          product: selectedProduct,
        },
      ]);
    }

    setSelectedProduct(null);
    setQuantity(1);
    setUnitPrice(0);
    setProductSearch('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.branch_id) {
      toast.error('Pilih cabang');
      return;
    }

    if (!isHibah && !formData.purchase_order_id) {
      toast.error('Pilih Purchase Order atau centang "Hibah/Pemberian"');
      return;
    }

    if (items.length === 0) {
      toast.error('Tambahkan minimal satu item');
      return;
    }

    const data = {
      ...formData,
      purchase_order_id: isHibah ? undefined : (formData.purchase_order_id || undefined),
      notes: isHibah ? (formData.notes || 'Hibah/Pemberian') : formData.notes,
      items: items.map((item) => ({
        purchase_order_item_id: isHibah ? undefined : item.purchase_order_item_id,
        product_id: item.product_id,
        quantity_received: item.quantity_received,
        unit_price: item.unit_price,
        batch_number: item.batch_number,
        serial_number: item.serial_number,
        expiry_date: item.expiry_date,
        notes: item.notes,
      })),
    };

    createMutation.mutate(data);
  };

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader title="Buat Goods Receipt" />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Informasi Umum</h2>
          
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isHibah}
                onChange={(e) => {
                  setIsHibah(e.target.checked);
                  if (e.target.checked) {
                    setFormData({ ...formData, purchase_order_id: '' });
                  }
                }}
                className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-semibold text-gray-700">Hibah/Pemberian (tanpa Purchase Order)</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Purchase Order {!isHibah && '*'}
              </label>
              <select
                value={formData.purchase_order_id}
                onChange={(e) => setFormData({ ...formData, purchase_order_id: e.target.value })}
                required={!isHibah}
                disabled={isHibah}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Pilih Purchase Order</option>
                {orderedPOs?.map((po: any) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} - {po.supplier?.name} ({formatCurrency(po.totalAmount)})
                  </option>
                ))}
              </select>
              {!isHibah && !formData.purchase_order_id && (
                <p className="text-sm text-red-500 mt-1">Purchase Order harus dipilih</p>
              )}
              {isHibah && (
                <p className="text-sm text-gray-500 mt-1">GR akan dibuat tanpa Purchase Order (Hibah/Pemberian)</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Cabang *</label>
              <select
                value={formData.branch_id}
                onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Pilih Cabang</option>
                {branches?.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal Receipt *</label>
              <input
                type="date"
                value={formData.receipt_date}
                onChange={(e) => setFormData({ ...formData, receipt_date: e.target.value })}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Items</h2>

          {!po && (
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={selectedProduct ? `${selectedProduct.name} (${selectedProduct.sku})` : productSearch}
                  onChange={(e) => {
                    if (!selectedProduct) {
                      setProductSearch(e.target.value);
                    }
                  }}
                  onFocus={() => {
                    if (selectedProduct) {
                      setSelectedProduct(null);
                      setProductSearch('');
                    }
                  }}
                  placeholder="Cari produk..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                {productSearch.length > 2 && productsData?.data && productsData.data.length > 0 && !selectedProduct && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg max-h-60 overflow-y-auto shadow-lg">
                    {productsData.data.map((product: any) => (
                      <div
                        key={product.id}
                        onClick={() => {
                          setSelectedProduct(product);
                          setUnitPrice(product.costPrice || 0);
                          setProductSearch('');
                        }}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                      >
                        <div className="font-semibold">{product.name}</div>
                        <div className="text-sm text-gray-500">{product.sku}</div>
                        <div className="text-xs text-gray-400">Harga: {formatCurrency(product.costPrice || 0)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProduct(null);
                      setProductSearch('');
                      setUnitPrice(0);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                placeholder="Qty"
                min="1"
                className="w-24 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <input
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                placeholder="Harga"
                min="0"
                className="w-32 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!selectedProduct || quantity <= 0 || unitPrice <= 0}
                className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-5 h-5" />
                Tambah
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Qty Received</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Unit Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{item.product?.name || 'N/A'}</div>
                      <div className="text-sm text-gray-500">{item.product?.sku}</div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={item.quantity_received}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[index].quantity_received = parseFloat(e.target.value) || 0;
                          setItems(updated);
                        }}
                        min="0"
                        className="w-24 px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-4 py-3">{formatCurrency(item.unit_price)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/purchasing/goods-receipt')}
            className="px-6 py-3 border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 flex items-center gap-2 disabled:opacity-50"
          >
            {createMutation.isPending && <Loader2 className="w-5 h-5 animate-spin" />}
            <Save className="w-5 h-5" />
            Simpan
          </button>
        </div>
      </form>
    </div>
  );
}

