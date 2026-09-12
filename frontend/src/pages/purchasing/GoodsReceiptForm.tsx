import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, Trash2, Loader2, X, CheckCircle2 } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { api } from '@/services/api';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/format';
import { useBranchFilter } from '@/components/branch/BranchFilter';

const SELECT_CLS =
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export default function GoodsReceiptForm() {
  const { poId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { branchId } = useBranchFilter({ defaultAll: false });

  const presetPoId = searchParams.get('po') || '';
  const isPoLocked = searchParams.has('po') || !!poId;

  const [isHibah, setIsHibah] = useState(false);
  const [formData, setFormData] = useState(() => ({
    purchase_order_id: presetPoId || poId || '',
    branch_id: branchId || '',
    receipt_date: new Date().toISOString().split('T')[0],
    notes: '',
  }));

  // The branch auto-default from useBranchFilter resolves after mount — seed the
  // form's Cabang with it until the user picks one (keeps PO list + GR branch consistent).
  useEffect(() => {
    if (branchId) setFormData((f) => (f.branch_id === '' ? { ...f, branch_id: branchId } : f));
  }, [branchId]);

  const [items, setItems] = useState<Array<{
    purchase_order_item_id?: string;
    product_id: string;
    quantity_received: string;
    unit_price: number;
    remaining?: number;
    batch_number?: string;
    serial_number?: string;
    expiry_date?: string;
    notes?: string;
    product?: any;
  }>>([]);

  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState(0);

  const formatThousand = (n: number) =>
    n ? n.toLocaleString('id-ID') : '';
  const canAddProduct = !!formData.branch_id;
  const addQty = parseFloat(quantity) || 0;

  // Fetch PO if provided
  const { data: po } = useQuery({
    queryKey: ['purchase-order', formData.purchase_order_id],
    queryFn: () => purchasingService.getPurchaseOrder(formData.purchase_order_id),
    enabled: !!formData.purchase_order_id && !isHibah,
  });

  // Fetch receivable POs for selection: approved (D3 — no send-order step anymore),
  // partially received (additional GRs) + legacy 'ordered' rows.
  // Filter follows the form's Cabang so changing it re-filters the PO list.
  const { data: orderedPOs } = useQuery({
    queryKey: ['purchase-orders', 'receivable', formData.branch_id],
    queryFn: async () => {
      const [approved, ordered, partial] = await Promise.all([
        purchasingService.getPurchaseOrders({
          status: 'approved',
          branchId: formData.branch_id || undefined,
          limit: 100,
        }),
        purchasingService.getPurchaseOrders({
          status: 'ordered',
          branchId: formData.branch_id || undefined,
          limit: 100,
        }),
        purchasingService.getPurchaseOrders({
          status: 'partially_received',
          branchId: formData.branch_id || undefined,
          limit: 100,
        }),
      ]);
      const merged = [...(approved.data || []), ...(ordered.data || []), ...(partial.data || [])];
      const seen = new Set<string>();
      return merged.filter((p: any) => {
        if (!p?.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
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

  // PO from detail → auto-select branch from the PO (locked mode)
  useEffect(() => {
    if (isPoLocked && po?.branchId) {
      setFormData((f) => ({ ...f, branch_id: po.branchId }));
    }
  }, [po, isPoLocked]);

  // Load PO items if PO is selected
  useEffect(() => {
    if (po && po.items && !isHibah) {
      setItems(
        po.items
          .filter((item) => item.quantityOrdered > item.quantityReceived) // Only items that haven't been fully received
          .map((item) => ({
            remaining: item.quantityOrdered - item.quantityReceived,
            purchase_order_item_id: item.id,
            product_id: item.productId,
            quantity_received: String(item.quantityOrdered - item.quantityReceived),
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
    const qty = parseFloat(quantity) || 0;
    if (!selectedProduct || qty <= 0 || unitPrice <= 0) {
      toast.error('Lengkapi data produk');
      return;
    }
    if (!canAddProduct) {
      toast.error('Pilih cabang terlebih dahulu');
      return;
    }

    const existingIndex = items.findIndex((item) => item.product_id === selectedProduct.id);
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity_received: String((Number(updated[existingIndex].quantity_received) || 0) + qty),
      };
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          product_id: selectedProduct.id,
          quantity_received: String(qty),
          unit_price: unitPrice,
          product: selectedProduct,
        },
      ]);
    }

    setSelectedProduct(null);
    setQuantity('1');
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

    const payloadItems = items.map((item) => {
      let qty = Number(item.quantity_received) || 0;
      if (item.remaining !== undefined) {
        qty = Math.min(qty, item.remaining);
      }
      return {
        purchase_order_item_id: isHibah ? undefined : item.purchase_order_item_id,
        product_id: item.product_id,
        quantity_received: qty,
        unit_price: item.unit_price,
        batch_number: item.batch_number,
        serial_number: item.serial_number,
        expiry_date: item.expiry_date,
        notes: item.notes,
      };
    });

    const data = {
      ...formData,
      purchase_order_id: isHibah ? undefined : (formData.purchase_order_id || undefined),
      notes: isHibah ? (formData.notes || 'Hibah/Pemberian') : formData.notes,
      items: payloadItems,
    };

    createMutation.mutate(data);
  };

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader title="Buat Goods Receipt" />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informasi Umum</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isPoLocked && (
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={isHibah}
                    onCheckedChange={(v) => {
                      setIsHibah(v === true);
                      if (v) {
                        setFormData({ ...formData, purchase_order_id: '' });
                      }
                    }}
                  />
                  <span className="text-sm font-semibold">Hibah/Pemberian (tanpa Purchase Order)</span>
                </label>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="block mb-2">
                  Purchase Order {!isHibah && '*'}
                </Label>
                <select
                  value={formData.purchase_order_id}
                  onChange={(e) => setFormData({ ...formData, purchase_order_id: e.target.value })}
                  required={!isHibah}
                  disabled={isHibah || isPoLocked}
                  className={SELECT_CLS}
                >
                  <option value="">Pilih Purchase Order</option>
                  {isPoLocked && po && !orderedPOs?.some((p) => p.id === po.id) && (
                    <option key={po.id} value={po.id}>
                      {po.poNumber}
                    </option>
                  )}
                  {orderedPOs?.map((po: any) => (
                    <option key={po.id} value={po.id}>
                      {po.poNumber} - {po.supplier?.name} ({formatCurrency(po.totalAmount)})
                    </option>
                  ))}
                </select>
                {isPoLocked && po && (
                  <p className="text-sm text-muted-foreground mt-1">
                    PO diambil dari PO: {po.poNumber}
                  </p>
                )}
                {!isHibah && !isPoLocked && !formData.purchase_order_id && (
                  <p className="text-sm text-destructive mt-1">Purchase Order harus dipilih</p>
                )}
                {isHibah && (
                  <p className="text-sm text-muted-foreground mt-1">GR akan dibuat tanpa Purchase Order (Hibah/Pemberian)</p>
                )}
              </div>

              <div>
                <Label className="block mb-2">Cabang *</Label>
                <select
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                  required
                  disabled={isPoLocked}
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
                <Label className="block mb-2">Tanggal Receipt *</Label>
                <Input
                  type="date"
                  value={formData.receipt_date}
                  onChange={(e) => setFormData({ ...formData, receipt_date: e.target.value })}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label className="block mb-2">Catatan (opsional)</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Catatan tambahan untuk penerimaan barang..."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Items</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setItems(
                    items.map((item) =>
                      item.remaining !== undefined
                        ? { ...item, quantity_received: String(item.remaining) }
                        : item
                    )
                  );
                }}
                disabled={!items.some((item) => item.remaining !== undefined)}
              >
                <CheckCircle2 />
                Terima Semua
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!po && (
              <div className="flex gap-2 mb-4">
                <div className="flex-1 relative">
                  <Input
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
                    disabled={!canAddProduct}
                  />
                  {productSearch.length > 2 && productsData?.data && productsData.data.length > 0 && !selectedProduct && (
                    <div className="absolute z-10 mt-1 w-full bg-background border rounded-lg max-h-60 overflow-y-auto shadow-lg">
                      {productsData.data.map((product: any) => (
                        <div
                          key={product.id}
                          onClick={() => {
                            setSelectedProduct(product);
                            setUnitPrice(product.costPrice || 0);
                            setProductSearch('');
                          }}
                          className="p-3 hover:bg-muted cursor-pointer border-b last:border-0"
                        >
                          <div className="font-semibold">{product.name}</div>
                          <div className="text-sm text-muted-foreground">{product.sku}</div>
                          <div className="text-xs text-muted-foreground">Harga: {formatCurrency(product.costPrice || 0)}</div>
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value.replace(/[^\d.]/g, ''))}
                  placeholder="Qty"
                  className="w-24"
                />
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formatThousand(unitPrice)}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, '');
                    setUnitPrice(digits ? parseInt(digits, 10) : 0);
                  }}
                  placeholder="Harga"
                  className="w-32"
                />
                <Button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!selectedProduct || addQty <= 0 || unitPrice <= 0 || !canAddProduct}
                >
                  <Plus />
                  Tambah
                </Button>
              </div>
            )}
            {!canAddProduct && (
              <p className="text-sm text-destructive mb-4">
                Pilih cabang terlebih dahulu sebelum menambahkan produk
              </p>
            )}

            <div className="overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-20">Sisa</TableHead>
                    <TableHead className="w-28">Qty Received</TableHead>
                    <TableHead className="w-28">Unit Price</TableHead>
                    <TableHead className="w-32">Nominal</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    const qtyNum = Number(item.quantity_received) || 0;
                    const overRemaining =
                      item.remaining !== undefined && qtyNum > item.remaining;
                    return (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="font-semibold">{item.product?.name || 'N/A'}</div>
                        <div className="text-sm text-muted-foreground">{item.product?.sku}</div>
                      </TableCell>
                      <TableCell>
                        {item.remaining !== undefined ? (
                          <span
                            className={
                              overRemaining
                                ? 'text-red-600 font-semibold'
                                : ''
                            }
                          >
                            {item.remaining}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={item.quantity_received}
                          onChange={(e) => {
                            const updated = [...items];
                            updated[index].quantity_received = e.target.value.replace(
                              /[^\d.]/g,
                              ''
                            );
                            setItems(updated);
                          }}
                          onBlur={() => {
                            const updated = [...items];
                            let parsed = Number(updated[index].quantity_received || 0);
                            if (item.remaining !== undefined && parsed > item.remaining) {
                              parsed = item.remaining;
                            }
                            updated[index].quantity_received = parsed === 0 ? '' : String(parsed);
                            setItems(updated);
                          }}
                          className="w-full"
                        />
                        <div className="h-4">
                          {overRemaining && (
                            <p className="text-xs text-red-600">Melebihi sisa PO</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatCurrency(item.unit_price * qtyNum)}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
                {items.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-right">
                        Total
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold">
                        {formatCurrency(
                          items.reduce(
                            (sum, item) =>
                              sum + item.unit_price * (Number(item.quantity_received) || 0),
                            0
                          )
                        )}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/purchasing/goods-receipt')}
          >
            Batal
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="animate-spin" />}
            <Save />
            Simpan
          </Button>
        </div>
      </form>
    </div>
  );
}
