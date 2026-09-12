import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { suppliersService } from '@/services/suppliers.service';
import { productsService } from '@/services/products.service';
import { formatCurrency } from '@/utils/format';
import { toast } from 'sonner';

interface Line {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  maxQty?: number;
  received?: number;
  alreadyReturned?: number;
}

const errMessage = (e: any, fallback: string) => {
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg[0];
  return msg || fallback;
};

export default function PurchaseReturnForm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode: 'po' | 'manual' =
    params.get('po') || params.get('mode') === 'po' ? 'po' : 'manual';
  const preselectPoId = params.get('po') || '';

  const [selectedPoId, setSelectedPoId] = useState(preselectPoId);
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Suppliers (manual mode)
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers', 'returns-form'],
    queryFn: () => suppliersService.getAll({ limit: 100, page: 1 }),
    enabled: mode === 'manual',
  });
  const suppliers = suppliersData?.data || [];

  // Received POs (PO mode picker)
  const { data: poListData } = useQuery({
    queryKey: ['purchase-orders', 'returns-picker'],
    queryFn: () => purchasingService.getPurchaseOrders({ limit: 100 }),
    enabled: mode === 'po',
  });
  const eligiblePos = (poListData?.data || []).filter(
    (p: any) => p.status === 'received' || p.status === 'partially_received',
  );

  const { data: po } = useQuery({
    queryKey: ['purchase-order', selectedPoId],
    queryFn: () => purchasingService.getPurchaseOrder(selectedPoId),
    enabled: mode === 'po' && !!selectedPoId,
  });

  // 1 invoice = 1 return: block when a return already exists for this PO
  const { data: existingReturns } = useQuery({
    queryKey: ['purchase-returns', 'po', selectedPoId],
    queryFn: () => purchasingService.getPurchaseReturns({ purchaseOrderId: selectedPoId, limit: 100 }),
    enabled: mode === 'po' && !!selectedPoId,
  });
  const existingReturn = (existingReturns?.data || [])[0];

  const returnedByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of existingReturns?.data || []) {
      for (const it of r.items || []) {
        map.set(it.productId, (map.get(it.productId) || 0) + Number(it.quantity));
      }
    }
    return map;
  }, [existingReturns]);

  useEffect(() => {
    if (mode === 'po' && po) {
      setInvoiceNumber(po.invoiceNumber || '');
    }
  }, [mode, po]);

  // Product search
  const { data: productsData } = useQuery({
    queryKey: ['products', 'search', productSearch],
    queryFn: () => productsService.getAll({ limit: 50, search: productSearch }),
    enabled: productSearch.length > 2,
  });

  const addProduct = (product: any) => {
    setProductSearch('');
    let unitPrice = Number(product.costPrice || 0);
    let maxQty: number | undefined;
    let received: number | undefined;
    let alreadyReturned: number | undefined;

    if (mode === 'po') {
      if (!po) {
        toast.error('Pilih PO terlebih dahulu');
        return;
      }
      const poItem = (po.items || []).find((i: any) => i.productId === product.id);
      if (!poItem) {
        toast.error('Produk ini tidak ada pada PO terpilih');
        return;
      }
      unitPrice = Number(poItem.unitPrice || 0);
      received = Number(poItem.quantityReceived || 0);
      alreadyReturned = returnedByProduct.get(product.id) || 0;
      maxQty = Math.max(received - alreadyReturned, 0);
      if (maxQty <= 0) {
        toast.error('Tidak ada sisa yang bisa diretur untuk produk ini');
        return;
      }
    }

    setLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === product.id);
      if (idx >= 0) {
        const copy = [...prev];
        const nextQty = copy[idx].quantity + 1;
        copy[idx] = {
          ...copy[idx],
          quantity: copy[idx].maxQty !== undefined ? Math.min(nextQty, copy[idx].maxQty) : nextQty,
        };
        return copy;
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          quantity: 1,
          unitPrice,
          maxQty,
          received,
          alreadyReturned,
        },
      ];
    });
  };

  const updateLine = (productId: string, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
  };
  const removeLine = (productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  };

  const totalQty = lines.reduce((s, l) => s + Number(l.quantity || 0), 0);
  const totalValue = lines.reduce(
    (s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0),
    0,
  );

  const doSubmit = async () => {
    if (mode === 'po') {
      if (!selectedPoId) {
        toast.error('Pilih PO / invoice supplier terlebih dahulu');
        return;
      }
      if (existingReturn) {
        toast.error(`Retur untuk invoice ini sudah dibuat (${existingReturn.returnNumber})`);
        return;
      }
    }
    if (mode === 'manual') {
      if (!supplierId) {
        toast.error('Supplier wajib diisi');
        return;
      }
      if (!invoiceNumber.trim()) {
        toast.error('Nomor invoice supplier wajib diisi');
        return;
      }
    }
    if (!reason.trim()) {
      toast.error('Alasan retur wajib diisi');
      return;
    }
    if (lines.length === 0) {
      toast.error('Minimal satu produk untuk diretur');
      return;
    }
    if (mode === 'manual' && lines.some((l) => !l.unitPrice || l.unitPrice <= 0)) {
      toast.error('Harga satuan wajib diisi untuk setiap produk');
      return;
    }
    if (mode === 'po') {
      const over = lines.find((l) => l.maxQty !== undefined && l.quantity > l.maxQty);
      if (over) {
        toast.error(`Qty retur ${over.name} melebihi sisa yang bisa diretur`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload: any = {
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        items: lines.map((l) =>
          mode === 'po'
            ? { product_id: l.productId, quantity: Number(l.quantity) }
            : { product_id: l.productId, quantity: Number(l.quantity), unit_price: Number(l.unitPrice) },
        ),
      };
      if (mode === 'po') {
        payload.purchase_order_id = selectedPoId;
      } else {
        payload.supplier_id = supplierId;
        payload.invoice_number = invoiceNumber.trim();
      }
      const created = await purchasingService.createPurchaseReturn(payload);
      toast.success(`Retur ${created.returnNumber} berhasil dibuat`);
      navigate(`/purchasing/returns/${created.id}`);
    } catch (e: any) {
      toast.error(errMessage(e, 'Gagal membuat retur pembelian'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <BreadcrumbHeader title="Buat Retur Pembelian">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 border border-gray-300 text-gray-700">
          {mode === 'po' ? 'Dari PO' : 'Manual (tanpa PO)'}
        </span>
      </BreadcrumbHeader>

      <Card>
        <CardHeader>
          <CardTitle>Informasi Retur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === 'po' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Purchase Order / Invoice Supplier *
                </label>
                <select
                  className="w-full h-10 border border-gray-300 rounded-md px-3 text-sm bg-white"
                  value={selectedPoId}
                  onChange={(e) => {
                    setSelectedPoId(e.target.value);
                    setLines([]);
                  }}
                >
                  <option value="">— Pilih PO yang sudah diterima —</option>
                  {eligiblePos.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.poNumber} — {p.invoiceNumber || 'tanpa invoice'} — {p.supplier?.name || ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Supplier</label>
                  <div className="h-10 flex items-center border border-gray-200 bg-gray-50 rounded-md px-3 text-sm text-gray-700">
                    {po?.supplier?.name ? `${po.supplier.name} (${po.supplier.customerCode})` : '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    No. Invoice Supplier
                  </label>
                  <div className="h-10 flex items-center border border-gray-200 bg-gray-50 rounded-md px-3 text-sm text-gray-700">
                    {po?.invoiceNumber || '—'}
                  </div>
                </div>
              </div>
              {existingReturn && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Retur untuk invoice ini sudah dibuat ({existingReturn.returnNumber}).{' '}
                  <button
                    type="button"
                    className="underline font-medium"
                    onClick={() => navigate(`/purchasing/returns/${existingReturn.id}`)}
                  >
                    Lihat retur
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Supplier *</label>
                <select
                  className="w-full h-10 border border-gray-300 rounded-md px-3 text-sm bg-white"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="">— Pilih supplier —</option>
                  {suppliers.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.customerCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  No. Invoice Supplier *
                </label>
                <Input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Contoh: INV-2026-0884"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Alasan Retur *</label>
              <Textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Contoh: barang rusak saat diterima / salah kirim"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Catatan</label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opsional"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          {mode === 'po' && !selectedPoId ? (
            <div className="text-sm text-gray-500 py-6 text-center">
              Pilih PO terlebih dahulu untuk memuat daftar produk.
            </div>
          ) : (
            <>
              <div className="relative mb-4">
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Cari produk... klik hasil untuk menambah"
                />
                {productSearch.length > 2 && productsData?.data && productsData.data.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-auto">
                    {productsData.data.map((product: any) => (
                      <button
                        key={product.id}
                        type="button"
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        onClick={() => addProduct(product)}
                      >
                        <div className="text-sm font-medium">{product.name}</div>
                        <div className="text-xs text-gray-500">
                          {product.sku} · Beli: {formatCurrency(product.costPrice || 0)} · Jual:{' '}
                          {formatCurrency(product.sellingPrice || 0)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk</TableHead>
                    {mode === 'po' && <TableHead className="text-right">Qty Diterima</TableHead>}
                    {mode === 'po' && <TableHead className="text-right">Sudah di-Retur</TableHead>}
                    <TableHead className="text-right">{mode === 'po' ? 'Harga PO' : 'Harga Satuan'}</TableHead>
                    <TableHead className="text-right">Qty Retur</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                        Belum ada produk — gunakan pencarian di atas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((l) => (
                      <TableRow key={l.productId}>
                        <TableCell>
                          <div className="font-medium">{l.name}</div>
                          <div className="text-xs text-gray-500">{l.sku}</div>
                        </TableCell>
                        {mode === 'po' && (
                          <TableCell className="text-right">{l.received ?? 0}</TableCell>
                        )}
                        {mode === 'po' && (
                          <TableCell className="text-right">{l.alreadyReturned ?? 0}</TableCell>
                        )}
                        <TableCell className="text-right">
                          {mode === 'po' ? (
                            formatCurrency(l.unitPrice)
                          ) : (
                            <Input
                              type="number"
                              min={0}
                              className="w-32 text-right ml-auto"
                              value={l.unitPrice}
                              onChange={(e) =>
                                updateLine(l.productId, { unitPrice: Number(e.target.value) })
                              }
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={1}
                            max={l.maxQty}
                            className="w-24 text-right ml-auto"
                            value={l.quantity}
                            onChange={(e) =>
                              updateLine(l.productId, { quantity: Number(e.target.value) })
                            }
                          />
                          {mode === 'po' && l.maxQty !== undefined && (
                            <div className="text-xs text-gray-400 mt-1">maks {l.maxQty}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(l.quantity || 0) * Number(l.unitPrice || 0))}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => removeLine(l.productId)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className="flex justify-end gap-10 mt-4 pt-4 border-t border-gray-100">
                <div className="text-right">
                  <div className="text-xs text-gray-500">Total Qty Retur</div>
                  <div className="text-lg font-bold">{new Intl.NumberFormat('id-ID').format(totalQty)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Nilai Retur (kredit supplier)</div>
                  <div className="text-lg font-bold text-red-600">{formatCurrency(totalValue)}</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/purchasing/returns')} disabled={saving}>
          Batal
        </Button>
        <Button onClick={doSubmit} disabled={saving || (mode === 'po' && !!existingReturn)}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Simpan Retur
        </Button>
      </div>
    </div>
  );
}
