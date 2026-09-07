import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Trash2, Loader2, X, Pencil, Check } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { purchasingService } from '@/services/purchasing.service';
import { productsService } from '@/services/products.service';
import { suppliersService } from '@/services/suppliers.service';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/format';
import { useBranchFilter } from '@/components/branch/BranchFilter';

const SELECT_CLS =
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export default function PurchaseOrderForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const { branchId } = useBranchFilter({ defaultAll: false });

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
    quantity_ordered: string;
    unit_price: number;
    discount_percent: number;
    notes?: string;
    product?: any;
  }>>([]);

  const [productSearch, setProductSearch] = useState('');
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editQty, setEditQty] = useState('1');
  const [editPrice, setEditPrice] = useState(0);

  const formatThousandStr = (v: string) => {
    const n = parseFloat(v) || 0;
    return n ? n.toLocaleString('id-ID') : '';
  };
  const handleAmountChange = (key: 'discount_amount' | 'tax_amount' | 'shipping_cost', raw: string) => {
    setFormData((f) => ({ ...f, [key]: raw.replace(/[^\d]/g, '') }));
  };

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
          quantity_ordered: String(item.quantityOrdered),
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

  // Click a product in the dropdown → auto-add row (qty 1, harga costPrice)
  const addProduct = (product: any) => {
    const price = product.costPrice || 0;
    const existingIndex = items.findIndex((item) => item.product_id === product.id);
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity_ordered: String((Number(updated[existingIndex].quantity_ordered) || 0) + 1),
      };
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          product_id: product.id,
          quantity_ordered: '1',
          unit_price: price,
          discount_percent: 0,
          product,
        },
      ]);
    }
    setProductSearch('');
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditQty(items[index].quantity_ordered || '1');
    setEditPrice(items[index].unit_price);
  };

  const saveEdit = (index: number) => {
    const qty = parseFloat(editQty);
    if (!qty || qty <= 0) {
      toast.error('Qty harus lebih dari 0');
      return;
    }
    if (!(editPrice > 0)) {
      toast.error('Harga harus lebih dari 0');
      return;
    }
    setItems(
      items.map((it, i) =>
        i === index ? { ...it, quantity_ordered: String(qty), unit_price: editPrice } : it,
      ),
    );
    setEditingIndex(-1);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    let subtotal = 0;
    items.forEach((item) => {
      const qty = Number(item.quantity_ordered) || 0;
      const itemSubtotal = qty * item.unit_price;
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
        quantity_ordered: Number(item.quantity_ordered) || 0,
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
        <Card>
          <CardHeader>
            <CardTitle>Informasi Umum</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="block mb-2">Supplier *</Label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  required
                  disabled={loadingSuppliers}
                  className={SELECT_CLS}
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
                  <p className="text-sm text-muted-foreground mt-1">Tidak ada supplier. <Link to="/purchasing/suppliers/new" className="text-primary hover:underline">Buat supplier baru</Link></p>
                )}
              </div>

              <div>
                <Label className="block mb-2">Cabang *</Label>
                <select
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                  required
                  className={SELECT_CLS}
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
                <Label className="block mb-2">Tanggal Order *</Label>
                <Input
                  type="date"
                  value={formData.order_date}
                  onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label className="block mb-2">Expected Delivery Date *</Label>
                <Input
                  type="date"
                  value={formData.expected_delivery_date}
                  onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label className="block mb-2">Payment Terms</Label>
                <select
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  className={SELECT_CLS}
                >
                  <option value="">Pilih Payment Terms</option>
                  <option value="CASH">CASH</option>
                  <option value="COD">COD</option>
                  <option value="CREDIT">CREDIT</option>
                </select>
              </div>

              <div>
                <Label className="block mb-2">Payment Term Days</Label>
                <Input
                  type="number"
                  value={formData.payment_term_days}
                  onChange={(e) => setFormData({ ...formData, payment_term_days: e.target.value })}
                  min="0"
                  placeholder="Contoh: 30"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <Input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Cari produk... klik hasil untuk menambah (qty default 1)"
                />
                {productSearch.length > 2 && productsData?.data && productsData.data.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-background border rounded-lg max-h-60 overflow-y-auto shadow-lg">
                    {productsData.data.map((product: any) => (
                      <div
                        key={product.id}
                        onClick={() => addProduct(product)}
                        className="p-3 hover:bg-muted cursor-pointer border-b last:border-0"
                      >
                        <div className="font-semibold">{product.name}</div>
                        <div className="text-sm text-muted-foreground">{product.sku}</div>
                        <div className="text-xs text-muted-foreground">Harga: {formatCurrency(product.costPrice || 0)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    const itemSubtotal = (Number(item.quantity_ordered) || 0) * item.unit_price;
                    const isEditing = editingIndex === index;
                    return (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="font-semibold">{item.product?.name || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">{item.product?.sku}</div>
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={editQty}
                              onChange={(e) => setEditQty(e.target.value.replace(/[^\d.]/g, ''))}
                              className="h-8 w-24"
                              autoFocus
                            />
                          ) : (
                            <span>{item.quantity_ordered}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={formatThousandStr(String(editPrice))}
                              onChange={(e) => {
                                const digits = e.target.value.replace(/[^\d]/g, '');
                                setEditPrice(digits ? parseInt(digits, 10) : 0);
                              }}
                              className="h-8 w-32"
                            />
                          ) : (
                            <span className="whitespace-nowrap">{formatCurrency(item.unit_price)}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold whitespace-nowrap">{formatCurrency(itemSubtotal)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            {isEditing ? (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-green-600 hover:text-green-700"
                                  onClick={() => saveEdit(index)}
                                >
                                  <Check />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingIndex(-1)}
                                >
                                  <X />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => startEdit(index)}
                                >
                                  <Pencil />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveItem(index)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

          <Card>
            <CardHeader>
              <CardTitle>PO Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={5}
                placeholder="Catatan PO (opsional)"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="flex items-center gap-2">
                    <span className="text-red-600 font-semibold">−</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={formatThousandStr(formData.discount_amount)}
                      onChange={(e) => handleAmountChange('discount_amount', e.target.value)}
                      placeholder="0"
                      className="h-8 w-28 text-right"
                    />
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">+</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={formatThousandStr(formData.tax_amount)}
                      onChange={(e) => handleAmountChange('tax_amount', e.target.value)}
                      placeholder="0"
                      className="h-8 w-28 text-right"
                    />
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">+</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={formatThousandStr(formData.shipping_cost)}
                      onChange={(e) => handleAmountChange('shipping_cost', e.target.value)}
                      placeholder="0"
                      className="h-8 w-28 text-right"
                    />
                  </span>
                </div>
                <div className="flex justify-between items-center border-t-2 border-foreground pt-3 mt-2">
                  <span className="font-bold text-base">Total</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/purchasing/po')}
          >
            Batal
          </Button>
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            {(createMutation.isPending || updateMutation.isPending) && (
              <Loader2 className="animate-spin" />
            )}
            <Save />
            {isEdit ? 'Update' : 'Simpan'}
          </Button>
        </div>
      </form>
    </div>
  );
}
