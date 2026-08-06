import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, Trash2, Loader2, X } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { purchasingService } from '@/services/purchasing.service';
import { productsService } from '@/services/products.service';
import { suppliersService } from '@/services/suppliers.service';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/format';
import { useBranchFilter } from '@/components/branch/BranchFilter';

export default function PurchaseOrderForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const { branchId } = useBranchFilter();

  const [formData, setFormData] = useState({
    // D7: default = first-in-list branch (hook)
    branch_id: branchId || '',
    supplier_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    payment_terms: '',
    payment_term_days: '',
    discount_amount: '',
    tax_amount: '',
    shipping_cost: '',
    notes: '',
  });

  const [items, setItems] = useState<Array<{
    product_id: string;
    quantity_ordered: number;
    unit_price: number;
    discount_percent: number;
    notes?: string;
    product?: any;
  }>>([]);

  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);

  // Fetch suppliers - fetch all pages if needed
  const { data: suppliersData, isLoading: loadingSuppliers } = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: async () => {
      try {
        // Fetch first page with max limit (100)
        const firstPage = await suppliersService.getAll({ limit: 100, page: 1 });
        const allSuppliers = [...(firstPage.data || [])];
        
        // If there are more pages, fetch them
        if (firstPage.meta && firstPage.meta.totalPages > 1) {
          const remainingPages = [];
          for (let page = 2; page <= firstPage.meta.totalPages; page++) {
            remainingPages.push(
              suppliersService.getAll({ limit: 100, page })
            );
          }
          const remainingResults = await Promise.all(remainingPages);
          remainingResults.forEach((result) => {
            allSuppliers.push(...(result.data || []));
          });
        }
        
        return {
          data: allSuppliers,
          meta: firstPage.meta || { total: allSuppliers.length, page: 1, limit: 100, totalPages: 1 },
        };
      } catch (error) {
        console.error('Error fetching suppliers:', error);
        return { data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } };
      }
    },
  });

  const suppliers = suppliersData?.data || [];

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

  // Fetch existing PO if editing
  const { data: existingPO } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => purchasingService.getPurchaseOrder(id!),
    enabled: isEdit && !!id,
  });

  useEffect(() => {
    if (existingPO) {
      setFormData({
        supplier_id: existingPO.supplierId,
        branch_id: existingPO.branchId,
        order_date: existingPO.orderDate.split('T')[0],
        expected_delivery_date: existingPO.expectedDeliveryDate?.split('T')[0] || '',
        payment_terms: existingPO.paymentTerms || '',
        payment_term_days: existingPO.paymentTermDays?.toString() || '',
        discount_amount: existingPO.discountAmount.toString(),
        tax_amount: existingPO.taxAmount.toString(),
        shipping_cost: existingPO.shippingCost.toString(),
        notes: existingPO.notes || '',
      });
      setItems(
        existingPO.items?.map((item) => ({
          product_id: item.productId,
          quantity_ordered: item.quantityOrdered,
          unit_price: item.unitPrice,
          discount_percent: item.discountPercent,
          notes: item.notes,
          product: item.product,
        })) || [],
      );
    }
  }, [existingPO]);

  const createMutation = useMutation({
    mutationFn: (data: any) => purchasingService.createPurchaseOrder(data),
    onSuccess: (po) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order berhasil dibuat');
      navigate(`/purchasing/po/${po.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membuat purchase order');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => purchasingService.updatePurchaseOrder(id!, data),
    onSuccess: (po) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order berhasil diupdate');
      navigate(`/purchasing/po/${po.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal mengupdate purchase order');
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
        quantity_ordered: updated[existingIndex].quantity_ordered + quantity,
      };
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          product_id: selectedProduct.id,
          quantity_ordered: quantity,
          unit_price: unitPrice,
          discount_percent: 0,
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

  const calculateTotals = () => {
    let subtotal = 0;
    items.forEach((item) => {
      const itemSubtotal = item.quantity_ordered * item.unit_price;
      const discount = itemSubtotal * (item.discount_percent / 100);
      subtotal += itemSubtotal - discount;
    });
    const discountAmount = parseFloat(formData.discount_amount) || 0;
    const taxAmount = parseFloat(formData.tax_amount) || 0;
    const shippingCost = parseFloat(formData.shipping_cost) || 0;
    const total = subtotal - discountAmount + taxAmount + shippingCost;
    return { subtotal, discountAmount, taxAmount, shippingCost, total };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplier_id || !formData.branch_id) {
      toast.error('Pilih supplier dan cabang');
      return;
    }

    if (items.length === 0) {
      toast.error('Tambahkan minimal satu item');
      return;
    }

    const data = {
      ...formData,
      payment_term_days: formData.payment_term_days ? parseInt(formData.payment_term_days) : undefined,
      discount_amount: parseFloat(formData.discount_amount) || 0,
      tax_amount: parseFloat(formData.tax_amount) || 0,
      shipping_cost: parseFloat(formData.shipping_cost) || 0,
      items: items.map((item) => ({
        product_id: item.product_id,
        quantity_ordered: item.quantity_ordered,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent,
        notes: item.notes,
      })),
    };

    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader title={isEdit ? 'Edit Purchase Order' : 'Buat Purchase Order'} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Informasi Umum</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Supplier *</label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                required
                disabled={loadingSuppliers}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {loadingSuppliers ? 'Memuat supplier...' : 'Pilih Supplier'}
                </option>
                {suppliers?.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.customerCode || s.code || s.id.slice(0, 8)})
                  </option>
                ))}
              </select>
              {!loadingSuppliers && suppliers.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">Tidak ada supplier. <Link to="/purchasing/suppliers/new" className="text-primary-600 hover:underline">Buat supplier baru</Link></p>
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal Order *</label>
              <input
                type="date"
                value={formData.order_date}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Expected Delivery Date *</label>
              <input
                type="date"
                value={formData.expected_delivery_date}
                onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Items</h2>

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

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Unit Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Subtotal</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, index) => {
                  const itemSubtotal = item.quantity_ordered * item.unit_price;
                  return (
                    <tr key={index}>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{item.product?.name || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{item.product?.sku}</div>
                      </td>
                      <td className="px-4 py-3">{item.quantity_ordered}</td>
                      <td className="px-4 py-3">{formatCurrency(item.unit_price)}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(itemSubtotal)}</td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Summary</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Discount Amount</label>
              <input
                type="number"
                value={formData.discount_amount}
                onChange={(e) => setFormData({ ...formData, discount_amount: e.target.value })}
                min="0"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tax Amount</label>
              <input
                type="number"
                value={formData.tax_amount}
                onChange={(e) => setFormData({ ...formData, tax_amount: e.target.value })}
                min="0"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Shipping Cost</label>
              <input
                type="number"
                value={formData.shipping_cost}
                onChange={(e) => setFormData({ ...formData, shipping_cost: e.target.value })}
                min="0"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Total</label>
              <div className="px-4 py-3 bg-gray-50 rounded-xl text-2xl font-bold text-primary-600">
                {formatCurrency(totals.total)}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/purchasing/po')}
            className="px-6 py-3 border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 flex items-center gap-2 disabled:opacity-50"
          >
            {(createMutation.isPending || updateMutation.isPending) && (
              <Loader2 className="w-5 h-5 animate-spin" />
            )}
            <Save className="w-5 h-5" />
            {isEdit ? 'Update' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  );
}

