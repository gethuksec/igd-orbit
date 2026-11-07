import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Plus, X } from 'lucide-react';
import {
  stockRequestsService,
  type IntakeCategory,
  type IntakeCustomer,
  type IntakeProduct,
} from '@/services/stock-requests.service';
import kecamatanJember from '@/data/kecamatan-jember.json';

interface RowState {
  key: string;
  barcode: string; // auto-filled from picked product (barcode/sku) or typed text for NEW
  listing: 'EXIST' | 'NEW';
  productId: string;
  productName: string; // EXIST: chosen master name (display) · NEW: free text
  categoryId: string;
  categoryName: string;
  note: string;
  stockHint: string;
}

const emptyRow = (): RowState => ({
  key: crypto.randomUUID(),
  barcode: '',
  listing: 'EXIST',
  productId: '',
  productName: '',
  categoryId: '',
  categoryName: '',
  note: '',
  stockHint: '',
});

const inputCls =
  'min-h-[46px] text-[15px] border-gray-300 focus-visible:ring-red-600 focus-visible:border-red-600';
const selectCls =
  'w-full min-h-[46px] text-[15px] px-3 border-[1.5px] border-gray-300 rounded-md bg-white focus:outline-none focus:border-red-600';

function ItemRow({
  index,
  row,
  token,
  categories,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  row: RowState;
  token: string;
  categories: IntakeCategory[];
  canRemove: boolean;
  onChange: (next: RowState) => void;
  onRemove: () => void;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<IntakeProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  // Dropdown: default top list on focus (empty query), filtered once ≥2 chars typed.
  useEffect(() => {
    if (!open) return;
    const q = search.trim();
    if (q.length > 0 && q.length < 2) {
      setResults([]);
      return;
    }
    const h = setTimeout(async () => {
      setSearching(true);
      try {
        const list = await stockRequestsService.searchIntakeProducts(token, q, 10);
        setResults(list);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(h);
  }, [search, open, token]);

  const set = (patch: Partial<RowState>) => onChange({ ...row, ...patch });

  // Scan/Enter on the unified field: exact barcode hit auto-picks the product.
  const runLookup = async (code: string) => {
    const c = code.trim();
    if (!c) return;
    try {
      const list = await stockRequestsService.searchIntakeProducts(token, c, 10);
      const exact = list.find((p) => (p.barcode || '').toLowerCase() === c.toLowerCase());
      if (exact) {
        pickProduct(exact);
      } else {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  };

  const pickProduct = (p: IntakeProduct) => {
    set({
      productId: p.id,
      productName: p.name,
      barcode: p.barcode || p.sku || '',
      categoryId: p.category?.id || '',
      categoryName: p.category?.name || '',
      stockHint: p.available > 0 ? `Stok outlet: ${p.available}` : 'Stok outlet kosong — tetap bisa request',
    });
    setSearch('');
    setResults([]);
    setOpen(false);
  };

  const chooseNewProduct = (name: string) => {
    set({
      listing: 'NEW',
      productId: '',
      productName: name.trim(),
      barcode: name.trim(),
      categoryId: '',
      categoryName: '',
      stockHint: '',
    });
    setSearch('');
    setResults([]);
    setOpen(false);
  };

  const clearProduct = () => {
    set({ listing: 'EXIST', productId: '', productName: '', barcode: '', categoryId: '', categoryName: '', stockHint: '' });
    setSearch('');
    setResults([]);
    setOpen(false);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[15px]">Barang #{index + 1}</h3>
          <button
            type="button"
            disabled={!canRemove}
            onClick={onRemove}
            className={`text-[13px] font-semibold px-2 py-1 ${canRemove ? 'text-red-600' : 'text-gray-400'}`}
          >
            Hapus
          </button>
        </div>

        <div>
          <Label className="text-[13.5px] font-semibold">Produk <span className="text-red-600">*</span></Label>
          {row.productId || row.listing === 'NEW' ? (
            <div className="flex gap-2 mt-1">
              <div className="flex-1 min-h-[46px] text-[15px] border-[1.5px] border-gray-300 rounded-md bg-white px-3 flex items-center gap-2">
                <span className="font-semibold truncate">
                  {row.productName}{' '}
                  {row.listing === 'NEW' && <span className="text-green-700 font-bold">NEW</span>}
                </span>
                <button type="button" onClick={clearProduct} aria-label="Ganti produk" className="ml-auto shrink-0 p-1">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <Input
                className={`${inputCls} mt-1`}
                placeholder="Ketik / scan barcode, nama, SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    runLookup(search);
                  } else if (e.key === 'Escape') {
                    setOpen(false);
                  }
                }}
              />
              {open && (searching || results.length > 0 || search.trim().length >= 2) && (
                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-56 overflow-auto">
                  {searching && <p className="px-3 py-2.5 text-xs text-gray-500">Mencari…</p>}
                  {results.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickProduct(p)}
                      className="block w-full text-left px-3 py-2.5 text-sm border-b border-gray-100 last:border-0 active:bg-red-50"
                    >
                      <span className="font-semibold">{p.name}</span>
                      <span className="block text-xs text-gray-500">
                        {p.barcode || p.sku} • {p.category?.name || '-'}
                      </span>
                    </button>
                  ))}
                  {!searching && search.trim().length >= 2 && !results.some((p) => p.name.toLowerCase() === search.trim().toLowerCase()) && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => chooseNewProduct(search)}
                      className="block w-full text-left px-3 py-2.5 text-sm font-bold text-red-600 border-t-2 border-dashed border-gray-200 active:bg-red-50"
                    >
                      ＋ Tambah baru: “{search.trim()}”
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {row.stockHint && <span className="text-xs text-gray-500 mt-1 block">{row.stockHint}</span>}
        </div>

        <div>
          <Label className="text-[13.5px] font-semibold">Kategori <span className="text-gray-400 font-normal">(opsional)</span></Label>
          <select
            className={`${selectCls} mt-1`}
            value={row.categoryId}
            onChange={(e) => {
              const cat = categories.find((c) => c.id === e.target.value);
              set({ categoryId: e.target.value, categoryName: cat ? cat.name : '' });
            }}
          >
            <option value="">— Pilih kategori —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <Label className="text-[13.5px] font-semibold">Catatan</Label>
          <Input
            className={`${inputCls} mt-1`}
            placeholder="cth: warna hitam, minta yang ori…"
            value={row.note}
            onChange={(e) => set({ note: e.target.value })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function RequestIntakePage() {
  const { token = '' } = useParams<{ token: string }>();
  const [staffName, setStaffName] = useState('');
  const [customer, setCustomer] = useState<IntakeCustomer | null>(null);
  const [custSearch, setCustSearch] = useState('');
  const [custResults, setCustResults] = useState<IntakeCustomer[]>([]);
  const [custSearching, setCustSearching] = useState(false);
  const [custErr, setCustErr] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickKec, setQuickKec] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickErr, setQuickErr] = useState('');
  const [rows, setRows] = useState<RowState[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ no: string; summary: string[]; customerName: string } | null>(null);
  const [formErr, setFormErr] = useState('');

  const ctx = useQuery({
    queryKey: ['intake-context', token],
    queryFn: () => stockRequestsService.getIntakeContext(token),
    retry: false,
  });

  useEffect(() => {
    if (custSearch.trim().length < 2) {
      setCustResults([]);
      return;
    }
    const h = setTimeout(async () => {
      setCustSearching(true);
      try {
        const list = await stockRequestsService.searchIntakeCustomers(token, custSearch.trim(), 8);
        setCustResults(list);
      } catch {
        setCustResults([]);
      } finally {
        setCustSearching(false);
      }
    }, 300);
    return () => clearTimeout(h);
  }, [custSearch, token]);

  const saveQuickAdd = async () => {
    setQuickErr('');
    if (!quickName.trim()) {
      setQuickErr('Isi nama pelanggan dulu.');
      return;
    }
    if (quickPhone.trim() && !/^(?:\+62|0)[0-9]{9,12}$/.test(quickPhone.trim())) {
      setQuickErr('No. WA tidak valid. Format: 08… atau +62…');
      return;
    }
    if (!quickKec) {
      setQuickErr('Pilih kecamatan dulu.');
      return;
    }
    setQuickSaving(true);
    try {
      const created = await stockRequestsService.quickAddIntakeCustomer(token, {
        name: quickName.trim(),
        ...(quickPhone.trim() ? { phone: quickPhone.trim() } : {}),
        subdistrict: quickKec,
      });
      setCustomer(created);
      setCustSearch('');
      setCustResults([]);
      setCustErr('');
      setQuickOpen(false);
      setQuickName('');
      setQuickPhone('');
      setQuickKec('');
    } catch (e: any) {
      setQuickErr(e?.response?.data?.message || 'Gagal menyimpan pelanggan, coba lagi.');
    } finally {
      setQuickSaving(false);
    }
  };

  const submit = async () => {
    setFormErr('');
    if (!staffName) {
      setFormErr('Pilih nama pengaju dulu.');
      return;
    }
    if (!customer) {
      setFormErr('Pilih pelanggan dulu (cari atau tambah baru).');
      return;
    }
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const prodOk = r.listing === 'EXIST' ? !!r.productId : !!r.productName.trim();
      if (!r.barcode.trim() || !prodOk) {
        setFormErr(`Barang #${i + 1} — pilih produk dulu ya.`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await stockRequestsService.createIntake(token, {
        staffName,
        customerId: customer.id,
        items: rows.map((r) => ({
          barcode: r.barcode.trim(),
          listing: r.listing,
          ...(r.productId ? { productId: r.productId } : {}),
          ...(r.listing === 'NEW' ? { productName: r.productName.trim() } : {}),
          ...(r.categoryId ? { categoryId: r.categoryId } : {}),
          categoryName: r.categoryName.trim(),
          quantity: 1,
          ...(r.note.trim() ? { note: r.note.trim() } : {}),
        })),
      });
      setDone({
        no: res.requestNumber,
        summary: (res.items || []).map(
          (it) => `${it.productName}${it.listing === 'NEW' ? ' NEW' : ''}${it.note ? ` — ${it.note}` : ''}`,
        ),
        customerName: customer.name,
      });
      window.scrollTo(0, 0);
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setFormErr(Array.isArray(msg) ? msg.join(', ') : msg || 'Gagal mengirim request, coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  if (ctx.isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <p className="text-gray-500">Memuat form request…</p>
      </div>
    );
  }

  if (ctx.isError || !ctx.data) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <Card className="max-w-sm w-full">
          <CardContent className="p-6 text-center space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto text-red-600" />
            <h1 className="font-bold text-lg">Tautan tidak valid</h1>
            <p className="text-sm text-gray-500">
              Link request ini tidak dikenal atau sudah tidak berlaku. Minta link terbaru ke SODO/outlet Anda.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { outlet, staff, categories } = ctx.data;

  if (done) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-md mx-auto pb-10">
          <header className="bg-red-600 text-white px-4 py-4 sticky top-0 z-10">
            <h1 className="font-bold text-[17px]">Request Stok</h1>
            <p className="text-[12.5px] opacity-90 mt-0.5">
              Outlet <span className="bg-white/20 rounded-full px-2 py-0.5 text-[11.5px] font-semibold">{outlet.name} • {outlet.code}</span>
            </p>
          </header>
          <div className="px-5 pt-8 text-center">
            <div className="w-[76px] h-[76px] rounded-full bg-green-50 border-2 border-green-200 text-green-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="font-bold text-xl mt-3">Request terkirim!</h2>
            <p className="text-sm text-gray-500 mt-1">SODO akan memeriksa &amp; menyetujui.<br />Tunjukkan nomor ini bila ditanya:</p>
            <div className="inline-block font-extrabold text-xl bg-white border-[1.5px] border-dashed border-gray-300 rounded-lg px-5 py-2 mt-2">
              {done.no}
            </div>
          </div>
          <ul className="bg-white border border-gray-200 rounded-xl mx-3 mt-4 px-4 py-2 text-sm list-disc">
            <li className="ml-4 my-2"><b>Pengaju:</b> {staffName} • <b>Customer:</b> {done.customerName}</li>
            {done.summary.map((s, i) => (
              <li key={i} className="ml-4 my-2">{s}</li>
            ))}
          </ul>
          <div className="px-3 mt-4">
            <Button
              className="w-full min-h-[52px] text-base font-extrabold bg-red-600 hover:bg-red-700"
              onClick={() => {
                setDone(null);
                setRows([emptyRow()]);
                setStaffName('');
                setCustomer(null);
                setCustSearch('');
                window.scrollTo(0, 0);
              }}
            >
              ＋ Buat request baru
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-md mx-auto pb-28">
        <header className="bg-red-600 text-white px-4 py-4 sticky top-0 z-10">
          <h1 className="font-bold text-[17px]">Request Stok</h1>
          <p className="text-[12.5px] opacity-90 mt-0.5">
            Outlet <span className="bg-white/20 rounded-full px-2 py-0.5 text-[11.5px] font-semibold">{outlet.name} • {outlet.code}</span>
          </p>
        </header>

        <div className="px-3 pt-3 space-y-3">
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="text-xs uppercase tracking-wide text-gray-500 font-bold">Requester</h2>
              <div>
                <Label className="text-[13.5px] font-semibold">Nama <span className="text-red-600">*</span></Label>
                <select className={`${selectCls} mt-1`} value={staffName} onChange={(e) => setStaffName(e.target.value)}>
                  <option value="">— Pilih nama —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="text-xs uppercase tracking-wide text-gray-500 font-bold">Customer</h2>
              <div>
                <Label className="text-[13.5px] font-semibold">Cari pelanggan <span className="text-red-600">*</span></Label>
                <div className="flex gap-2 mt-1">
                  {customer ? (
                    <div className="flex-1 min-h-[46px] text-[15px] border-[1.5px] border-gray-300 rounded-md bg-white px-3 flex items-center gap-2">
                      <span className="font-semibold truncate">
                        ✓ {customer.name}
                      </span>
                      <span className="text-xs text-gray-500 truncate">
                        {[customer.phone, customer.subdistrict].filter(Boolean).join(' • ') || '—'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomer(null);
                          setCustSearch('');
                        }}
                        aria-label="Ganti pelanggan"
                        className="ml-auto shrink-0 p-1"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  ) : (
                    <Input
                      className={inputCls}
                      placeholder="Ketik nama / WA… (min. 2 huruf)"
                      value={custSearch}
                      onChange={(e) => {
                        setCustSearch(e.target.value);
                        setCustErr('');
                      }}
                    />
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[46px] min-w-[46px] px-0 border-gray-300 font-bold text-xl"
                    onClick={() => {
                      setQuickErr('');
                      setQuickOpen(true);
                    }}
                    aria-label="Tambah pelanggan baru"
                  >
                    <Plus className="w-5 h-5 mx-auto" />
                  </Button>
                </div>
                {!customer && custSearching && <p className="text-xs text-gray-500 mt-1">Mencari…</p>}
                {!customer && custResults.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {custResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCustomer(c);
                          setCustSearch('');
                          setCustResults([]);
                          setCustErr('');
                        }}
                        className="block w-full text-left px-3 py-2.5 text-sm border border-gray-200 bg-white rounded-lg active:bg-red-50"
                      >
                        <span className="font-semibold">{c.name}</span>
                        <span className="block text-xs text-gray-500">
                          {[c.phone, c.subdistrict].filter(Boolean).join(' • ') || '—'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {!customer && !custSearching && custSearch.trim().length >= 2 && custResults.length === 0 && (
                  <p className="text-[12.5px] text-gray-500 mt-1.5">
                    Tidak ketemu? Tekan + untuk tambah pelanggan baru.
                  </p>
                )}
                {custErr && <p className="text-[12.5px] text-red-600 mt-1.5">{custErr}</p>}
              </div>
            </CardContent>
          </Card>

          {rows.map((r, i) => (
            <ItemRow
              key={r.key}
              index={i}
              row={r}
              token={token}
              categories={categories}
              canRemove={rows.length > 1}
              onChange={(next) => setRows((prev) => prev.map((p) => (p.key === r.key ? next : p)))}
              onRemove={() => setRows((prev) => prev.filter((p) => p.key !== r.key))}
            />
          ))}

          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, emptyRow()])}
            className="flex w-full min-h-[50px] items-center justify-center gap-2 border-2 border-dashed border-gray-300 bg-white rounded-xl text-red-600 text-[15px] font-bold active:border-red-600 active:bg-red-50"
          >
            ＋ Tambah barang
          </button>
          <p className="text-[13px] text-gray-500 px-1">{rows.length} jenis barang dalam request ini.</p>

          {formErr && (
            <div className="text-sm rounded-lg px-3 py-2.5 bg-red-50 text-red-700 border border-red-200 flex gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {formErr}
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 px-3 py-2.5">
          <Button
            className="w-full min-h-[52px] text-base font-extrabold bg-red-600 hover:bg-red-700"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? 'Mengirim…' : `Kirim Request (${rows.length} barang)`}
          </Button>
        </div>

        <div className="mt-6 flex justify-center">
          <Badge variant="secondary" className="text-[11px] text-gray-400">IGD-Orbit • Request Stok</Badge>
        </div>
      </div>

      {quickOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setQuickOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-t-2xl p-5 pb-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-[15px]">Pelanggan baru</h3>
                <p className="text-[12.5px] text-gray-500 mt-0.5">Langsung masuk master. No. WA opsional.</p>
              </div>
              <button type="button" onClick={() => setQuickOpen(false)} aria-label="Tutup">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3 mt-4">
              <div>
                <Label className="text-[13.5px] font-semibold">Nama <span className="text-red-600">*</span></Label>
                <Input
                  className={`${inputCls} mt-1`}
                  placeholder="cth: Ibu Rina"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-[13.5px] font-semibold">No. WA <span className="text-gray-400 font-normal">(opsional)</span></Label>
                <Input
                  className={`${inputCls} mt-1`}
                  placeholder="08… / +62…"
                  value={quickPhone}
                  onChange={(e) => setQuickPhone(e.target.value)}
                />
                <p className="text-[12px] text-gray-500 mt-1">Boleh kosong — kalau diisi, format: 08… atau +62…, dicek saat simpan.</p>
              </div>
              <div>
                <Label className="text-[13.5px] font-semibold">Kecamatan <span className="text-red-600">*</span></Label>
                <select className={`${selectCls} mt-1`} value={quickKec} onChange={(e) => setQuickKec(e.target.value)}>
                  <option value="">Pilih Kecamatan</option>
                  {(kecamatanJember as string[]).map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              {quickErr && <p className="text-[12.5px] text-red-600">{quickErr}</p>}
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1 min-h-[48px]" onClick={() => setQuickOpen(false)}>
                  Batal
                </Button>
                <Button
                  type="button"
                  className="flex-1 min-h-[48px] bg-red-600 hover:bg-red-700 font-bold"
                  onClick={saveQuickAdd}
                  disabled={quickSaving}
                >
                  {quickSaving ? 'Menyimpan…' : 'Simpan'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
