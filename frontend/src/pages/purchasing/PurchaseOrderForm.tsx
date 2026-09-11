import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Trash2, Loader2, X, Pencil, Check, Plus } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Modal } from '@/components/ui/modal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { categoriesService } from '@/services/categories.service';
import { unitsService } from '@/services/units.service';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/format';

const SELECT_CLS =
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

/** Local (WIB-safe) today as YYYY-MM-DD — toISOString() would shift before 07:00. */
const todayLocal = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function PurchaseOrderForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    supplier_id: '',
    // IGDERP-79 (8 Sep): PO is recorded after the supplier invoice exists —
    // invoice number + date are mandatory at creation.
    invoice_number: '',
    invoice_date: '',
    order_date: todayLocal(),
    expected_delivery_date: '',
    payment_terms: '',
    payment_term_days: '',
    discount_amount: '',
    tax_amount: '',
    shipping_cost: '',
    notes: '',
  });

  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

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

  // Quick add product (shortcut, 8 Sep §5)
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [qaForm, setQaForm] = useState({
    name: '',
    categoryId: '',
    sellingPrice: '',
    barcode: '',
    unitId: '',
  });

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

  // Quick-add reference data
  const { data: categoriesResp } = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: () => categoriesService.getAll({ limit: 200 }),
  });
  const categories: any[] = (categoriesResp as any)?.data || [];
  const { data: unitsResp } = useQuery({
    queryKey: ['units', 'all'],
    queryFn: () => unitsService.getAll({ limit: 200 }),
  });
  const units: any[] = (unitsResp as any)?.data || [];

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
        invoice_number: existingPO.invoiceNumber || '',
        invoice_date: existingPO.invoiceDate?.split('T')[0] || '',
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

  const uploadInvoiceIfAny = async (poId: string) => {
    if (!invoiceFile) return;
    try {
      await purchasingService.uploadAttachments('PURCHASE_ORDER', poId, 'INVOICE', [invoiceFile]);
    } catch {
      toast.error('PO tersimpan, tetapi upload invoice gagal — unggah manual di halaman detail.');
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => purchasingService.createPurchaseOrder(data),
    onSuccess: async (po) => {
      await uploadInvoiceIfAny(po.id);
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
    onSuccess: async (po) => {
      await uploadInvoiceIfAny(po.id);
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order berhasil diupdate');
      navigate(`/purchasing/po/${po.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal mengupdate purchase order');
    },
  });

  const quickAddMutation = useMutation({
    mutationFn: (payload: any) => productsService.create(payload),
    onSuccess: (product: any) => {
      toast.success(`Produk "${product.name}" dibuat — isi harga beli di baris item.`);
      setItems((prev) => [
        ...prev,
        {
          product_id: product.id,
          quantity_ordered: '1',
          unit_price: 0,
          discount_percent: 0,
          product,
        },
      ]);
      setQuickAddOpen(false);
      setQaForm({ name: '', categoryId: '', sellingPrice: '', barcode: '', unitId: '' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membuat produk');
    },
  });

  const handleQuickAddSubmit = () => {
    if (!qaForm.name.trim()) {
      toast.error('Nama produk wajib diisi');
      return;
    }
    if (!qaForm.categoryId) {
      toast.error('Kategori produk wajib diisi');
      return;
    }
    if (!qaForm.sellingPrice || parseFloat(qaForm.sellingPrice) <= 0) {
      toast.error('Harga jual wajib diisi');
      return;
    }
    quickAddMutation.mutate({
      name: qaForm.name.trim(),
      categoryId: qaForm.categoryId,
      sellingPrice: parseFloat(qaForm.sellingPrice),
      costPrice: 0,
      barcode: qaForm.barcode.trim() || undefined,
      unitId: qaForm.unitId || undefined,
      isActive: true,
    });
  };

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

  /** Per-row margin reference (D2: display only — no writes to product master) */
  const marginOf = (item: { unit_price: number; product?: any }): number | null => {
    const selling = Number(item.product?.sellingPrice || 0);
    const buy = Number(item.unit_price) || 0;
    if (selling <= 0 || buy <= 0) return null;
    return ((selling - buy) / selling) * 100;
  };

  const dueDateDisplay = (() => {
    const days = parseInt(formData.payment_term_days || '', 10);
    if (!formData.invoice_date || !days || days <= 0) return null;
    const base = new Date(formData.invoice_date);
    if (isNaN(base.getTime())) return null;
    const due = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    return due.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplier_id) {
      toast.error('Pilih supplier');
      return;
    }
    if (!formData.invoice_number.trim()) {
      toast.error('Nomor invoice supplier wajib diisi');
      return;
    }
    if (!formData.invoice_date) {
      toast.error('Tanggal invoice supplier wajib diisi');
      return;
    }
    if (items.length === 0) {
      toast.error('Tambahkan minimal satu item');
      return;
    }
    if (!isEdit && !invoiceFile) {
      toast.error('Dokumen invoice supplier wajib diunggah');
      return;
    }

    setConfirmChecked(false);
    setConfirmOpen(true);
  };

  const doSubmit = () => {
    const data = {
      ...formData,
      expected_delivery_date: formData.expected_delivery_date || undefined,
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
    setConfirmOpen(false);
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
                <Label className="block mb-2">Nomor Invoice Supplier *</Label>
                <Input
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  placeholder="Sesuai dokumen invoice supplier"
                  required
                />
              </div>

              <div>
                <Label className="block mb-2">Tanggal Invoice Supplier *</Label>
                <Input
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                  required
                />
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
                <Label className="block mb-2">Expected Delivery Date</Label>
                <Input
                  type="date"
                  value={formData.expected_delivery_date}
                  onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
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
                {dueDateDisplay && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Jatuh tempo: <span className="font-medium text-foreground">{dueDateDisplay}</span>
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <Label className="block mb-2">
                  Dokumen Invoice Supplier {!isEdit && '*'}
                </Label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {isEdit
                    ? 'Kosongkan bila tidak ingin mengganti dokumen.'
                    : 'Wajib diunggah — PDF / JPG / PNG.'}
                </p>
              </div>
            </div>

            <div>
              <Label className="block mb-2">Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Catatan PO (opsional)"
              />
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
                        <div className="text-xs text-muted-foreground">
                          Beli: {formatCurrency(product.costPrice || 0)} · Jual: {formatCurrency(product.sellingPrice || 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button type="button" variant="outline" onClick={() => setQuickAddOpen(true)}>
                <Plus /> Produk Baru
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Margin</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    const itemSubtotal = (Number(item.quantity_ordered) || 0) * item.unit_price;
                    const isEditing = editingIndex === index;
                    const margin = marginOf(item);
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
                        <TableCell>
                          {margin === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span
                              className={
                                margin < 0
                                  ? 'font-semibold text-destructive'
                                  : margin < 10
                                    ? 'font-semibold text-amber-600'
                                    : 'font-semibold text-green-600'
                              }
                            >
                              {margin.toFixed(1)}%
                            </span>
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

      {/* D1 (8 Sep): invoice-total confirmation modal — no value input, a human
          confirmation against the uploaded supplier invoice. */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Konfirmasi Total Invoice"
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Total PO</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totals.total)}</p>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={confirmChecked}
              onCheckedChange={(checked) => setConfirmChecked(checked)}
              className="mt-0.5"
            />
            <span className="text-sm">
              Saya sudah memeriksa dan <strong>total PO ini sesuai dengan invoice supplier</strong>
              {formData.invoice_number ? ` (No. ${formData.invoice_number})` : ''}. Bila ada selisih,
              jelaskan di kolom Catatan PO.
            </span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmOpen(false)}
            >
              Batal
            </Button>
            <Button
              className="flex-1"
              onClick={doSubmit}
              disabled={!confirmChecked || createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Menyimpan...' : 'Ya, Simpan'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Quick add product — reuse Item entry shortcut (8 Sep §5) */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Produk Baru</DialogTitle>
            <DialogDescription>
              Buat produk cepat lalu tambahkan langsung ke daftar item PO. Produk lengkap tetap bisa
              disempurnakan di Master Data.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label className="block text-sm font-medium mb-2">
                Nama Produk <span className="text-red-500">*</span>
              </Label>
              <Input
                value={qaForm.name}
                onChange={(e) => setQaForm({ ...qaForm, name: e.target.value })}
                placeholder="Contoh: iPhone 15 Pro 128GB"
              />
            </div>
            <div>
              <Label className="block text-sm font-medium mb-2">
                Kategori <span className="text-red-500">*</span>
              </Label>
              <select
                value={qaForm.categoryId}
                onChange={(e) => setQaForm({ ...qaForm, categoryId: e.target.value })}
                className={SELECT_CLS}
              >
                <option value="">Pilih Kategori</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="block text-sm font-medium mb-2">
                Harga Jual <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={qaForm.sellingPrice}
                onChange={(e) => setQaForm({ ...qaForm, sellingPrice: e.target.value })}
                placeholder="0"
              />
            </div>
            <div>
              <Label className="block text-sm font-medium mb-2">Barcode</Label>
              <Input
                value={qaForm.barcode}
                onChange={(e) => setQaForm({ ...qaForm, barcode: e.target.value })}
                placeholder="Opsional"
              />
            </div>
            <div>
              <Label className="block text-sm font-medium mb-2">Satuan</Label>
              <select
                value={qaForm.unitId}
                onChange={(e) => setQaForm({ ...qaForm, unitId: e.target.value })}
                className={SELECT_CLS}
              >
                <option value="">-</option>
                {units.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 mt-2">
            <Button type="button" variant="outline" onClick={() => setQuickAddOpen(false)}>
              Batal
            </Button>
            <Button type="button" onClick={handleQuickAddSubmit} disabled={quickAddMutation.isPending}>
              {quickAddMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <Plus /> Buat & Tambahkan
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
