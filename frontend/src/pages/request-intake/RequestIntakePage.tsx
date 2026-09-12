import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Minus, Plus } from 'lucide-react';
import {
  stockRequestsService,
  type IntakeCategory,
  type IntakeMember,
  type IntakeProduct,
} from '@/services/stock-requests.service';

interface RowState {
  key: string;
  barcode: string;
  lookup: 'idle' | 'found' | 'miss';
  lookupText: string;
  listing: 'EXIST' | 'NEW';
  productId: string;
  productName: string; // EXIST: chosen master name (display) · NEW: free text
  categoryId: string;
  categoryName: string;
  qty: number;
  stockHint: string;
}

const emptyRow = (): RowState => ({
  key: crypto.randomUUID(),
  barcode: '',
  lookup: 'idle',
  lookupText: '',
  listing: 'EXIST',
  productId: '',
  productName: '',
  categoryId: '',
  categoryName: '',
  qty: 1,
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

  useEffect(() => {
    if (row.listing !== 'EXIST' || search.trim().length < 2) {
      setResults([]);
      return;
    }
    const h = setTimeout(async () => {
      setSearching(true);
      try {
        const list = await stockRequestsService.searchIntakeProducts(token, search.trim(), 8);
        setResults(list);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(h);
  }, [search, row.listing, token]);

  const set = (patch: Partial<RowState>) => onChange({ ...row, ...patch });

  const checkBarcode = async () => {
    const code = row.barcode.trim();
    if (!code) {
      set({ lookup: 'miss', lookupText: 'Isi barcode dulu, lalu tekan Cek.' });
      return;
    }
    try {
      const list = await stockRequestsService.searchIntakeProducts(token, code, 10);
      const exact = list.find((p) => (p.barcode || '').toLowerCase() === code.toLowerCase());
      if (exact) {
        set({
          lookup: 'found',
          lookupText: `✓ ${exact.name} • ${exact.category?.name || '-'}${exact.available > 0 ? ` • stok outlet: ${exact.available}` : ' • stok outlet kosong'}`,
          listing: 'EXIST',
          productId: exact.id,
          productName: exact.name,
          categoryId: exact.category?.id || '',
          categoryName: exact.category?.name || '',
          stockHint:
            exact.available > 0
              ? `Stok outlet: ${exact.available}`
              : 'Stok outlet kosong — tetap bisa request',
        });
      } else {
        set({
          lookup: 'miss',
          lookupText: 'Tidak terdaftar di master — pilih Listing “Baru” dan isi nama + kategori.',
        });
      }
    } catch {
      set({ lookup: 'miss', lookupText: 'Gagal memeriksa barcode, coba lagi.' });
    }
  };

  const pickProduct = (p: IntakeProduct) => {
    set({
      productId: p.id,
      productName: p.name,
      categoryId: p.category?.id || '',
      categoryName: p.category?.name || '',
      stockHint: p.available > 0 ? `Stok outlet: ${p.available}` : 'Stok outlet kosong — tetap bisa request',
    });
    setSearch('');
    setResults([]);
  };

  const isNewCat = row.categoryName.trim() && !categories.some((c) => c.name === row.categoryName.trim());

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
          <Label className="text-[13.5px] font-semibold">Barcode <span className="text-red-600">*</span></Label>
          <div className="flex gap-2 mt-1">
            <Input
              className={inputCls}
              placeholder="Ketik / tempel barcode…"
              value={row.barcode}
              onChange={(e) => set({ barcode: e.target.value })}
            />
            <Button type="button" variant="outline" className="min-h-[46px] border-red-600 text-red-600 font-bold" onClick={checkBarcode}>
              Cek
            </Button>
          </div>
          {row.lookup !== 'idle' && (
            <div
              className={`mt-2 text-[13px] rounded-lg px-3 py-2 border ${
                row.lookup === 'found'
                  ? 'bg-green-50 text-green-800 border-green-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {row.lookupText}
            </div>
          )}
        </div>

        <div>
          <Label className="text-[13.5px] font-semibold">Listing <span className="text-red-600">*</span></Label>
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1 mt-1">
            {(['EXIST', 'NEW'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => set({ listing: v })}
                className={`flex-1 rounded-md min-h-[42px] text-sm font-semibold ${
                  row.listing === v ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                {v === 'EXIST' ? 'Sudah ada' : 'Baru'}
              </button>
            ))}
          </div>
        </div>

        {row.listing === 'EXIST' ? (
          <div className="relative">
            <Label className="text-[13.5px] font-semibold">Produk <span className="text-red-600">*</span></Label>
            <Input
              className={`${inputCls} mt-1`}
              placeholder="Ketik nama / SKU / barcode… (min. 2 huruf)"
              value={row.productId ? row.productName : search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (row.productId) set({ productId: '', productName: '' });
              }}
              onFocus={() => row.productName && !row.productId && setSearch(row.productName)}
            />
            {searching && <p className="text-xs text-gray-500 mt-1">Mencari…</p>}
            {results.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-56 overflow-auto">
                {results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickProduct(p)}
                    className="block w-full text-left px-3 py-2.5 text-sm border-b border-gray-100 last:border-0 active:bg-red-50"
                  >
                    <span className="font-semibold">{p.name}</span>
                    <span className="block text-xs text-gray-500">
                      {p.barcode || p.sku} • {p.category?.name || '-'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <Label className="text-[13.5px] font-semibold">Nama produk baru <span className="text-red-600">*</span></Label>
            <Input
              className={`${inputCls} mt-1`}
              placeholder="cth: LCD + TS Oppo A58"
              value={row.productName}
              onChange={(e) => set({ productName: e.target.value })}
            />
          </div>
        )}

        <div>
          <Label className="text-[13.5px] font-semibold">Kategori <span className="text-red-600">*</span></Label>
          <Input
            className={`${inputCls} mt-1`}
            list={`catlist-${row.key}`}
            placeholder="Pilih dari master atau ketik baru…"
            autoComplete="off"
            value={row.categoryName}
            onChange={(e) => {
              const v = e.target.value;
              const match = categories.find((c) => c.name === v.trim());
              set({ categoryName: v, categoryId: match ? match.id : '' });
            }}
          />
          <datalist id={`catlist-${row.key}`}>
            {categories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          {isNewCat ? (
            <p className="text-[12.5px] text-amber-700 mt-1.5">
              “{row.categoryName.trim()}” belum ada di master — akan diajukan sebagai kategori baru.
            </p>
          ) : null}
        </div>

        <div>
          <Label className="text-[13.5px] font-semibold">Jumlah <span className="text-red-600">*</span></Label>
          <div className="flex items-center gap-3 mt-1">
            <button
              type="button"
              onClick={() => set({ qty: Math.max(1, row.qty - 1) })}
              className="w-[46px] h-[46px] rounded-lg border-[1.5px] border-gray-300 text-xl font-bold"
              aria-label="Kurangi"
            >
              <Minus className="w-4 h-4 mx-auto" />
            </button>
            <span className="text-lg font-extrabold min-w-[40px] text-center">{row.qty}</span>
            <button
              type="button"
              onClick={() => set({ qty: Math.min(9999, row.qty + 1) })}
              className="w-[46px] h-[46px] rounded-lg border-[1.5px] border-gray-300 text-xl font-bold"
              aria-label="Tambah"
            >
              <Plus className="w-4 h-4 mx-auto" />
            </button>
            {row.stockHint && <span className="text-xs text-gray-500">{row.stockHint}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RequestIntakePage() {
  const { token = '' } = useParams<{ token: string }>();
  const [staffName, setStaffName] = useState('');
  const [custType, setCustType] = useState<'USER' | 'MEMBER'>('USER');
  const [memberCode, setMemberCode] = useState('');
  const [member, setMember] = useState<IntakeMember | null>(null);
  const [memberErr, setMemberErr] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [rows, setRows] = useState<RowState[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ no: string; summary: string[] } | null>(null);
  const [formErr, setFormErr] = useState('');

  const ctx = useQuery({
    queryKey: ['intake-context', token],
    queryFn: () => stockRequestsService.getIntakeContext(token),
    retry: false,
  });

  const verifyMember = async () => {
    setMemberErr('');
    setMember(null);
    if (!memberCode.trim()) {
      setMemberErr('Isi nomor member dulu.');
      return;
    }
    setVerifying(true);
    try {
      const m = await stockRequestsService.verifyIntakeMember(token, memberCode.trim());
      setMember(m);
    } catch (e: any) {
      setMemberErr(e?.response?.data?.message || 'Member tidak ditemukan.');
    } finally {
      setVerifying(false);
    }
  };

  const submit = async () => {
    setFormErr('');
    if (!staffName) {
      setFormErr('Pilih nama pengaju dulu.');
      return;
    }
    if (custType === 'MEMBER' && !member) {
      setFormErr('Verifikasi member dulu (pakai nomor member).');
      return;
    }
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const prodOk = r.listing === 'EXIST' ? !!r.productId : !!r.productName.trim();
      if (!r.barcode.trim() || !prodOk || !r.categoryName.trim()) {
        setFormErr(`Barang #${i + 1} belum lengkap — cek barcode, produk & kategori.`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await stockRequestsService.createIntake(token, {
        staffName,
        customerType: custType,
        memberRef: custType === 'MEMBER' ? memberCode.trim() : undefined,
        items: rows.map((r) => ({
          barcode: r.barcode.trim(),
          listing: r.listing,
          ...(r.productId ? { productId: r.productId } : {}),
          ...(r.listing === 'NEW' ? { productName: r.productName.trim() } : {}),
          ...(r.categoryId ? { categoryId: r.categoryId } : {}),
          categoryName: r.categoryName.trim(),
          quantity: r.qty,
        })),
      });
      setDone({
        no: res.requestNumber,
        summary: (res.items || []).map(
          (it) => `${it.productName} ×${it.quantity}${it.listing === 'NEW' ? ' • Baru' : ''}`,
        ),
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
            <li className="ml-4 my-2"><b>Pengaju:</b> {staffName} • <b>Tipe:</b> {custType}{member ? ` (${member.customerCode})` : ''}</li>
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
                setMemberCode('');
                setMember(null);
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
              <h2 className="text-xs uppercase tracking-wide text-gray-500 font-bold">Data Pengaju</h2>
              <div>
                <Label className="text-[13.5px] font-semibold">Nama <span className="text-red-600">*</span></Label>
                <select className={`${selectCls} mt-1`} value={staffName} onChange={(e) => setStaffName(e.target.value)}>
                  <option value="">— Pilih nama —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-[13.5px] font-semibold">Tipe Customer <span className="text-red-600">*</span></Label>
                <div className="flex bg-gray-100 rounded-lg p-1 gap-1 mt-1">
                  {(['USER', 'MEMBER'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setCustType(v)}
                      className={`flex-1 rounded-md min-h-[42px] text-sm font-semibold ${
                        custType === v ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      {v === 'USER' ? 'User' : 'Member'}
                    </button>
                  ))}
                </div>
              </div>
              {custType === 'MEMBER' && (
                <div>
                  <Label className="text-[13.5px] font-semibold">Nomor member <span className="text-red-600">*</span></Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      className={inputCls}
                      placeholder="cth: MBR-001"
                      value={memberCode}
                      onChange={(e) => {
                        setMemberCode(e.target.value);
                        setMember(null);
                        setMemberErr('');
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-[46px] border-red-600 text-red-600 font-bold"
                      onClick={verifyMember}
                      disabled={verifying}
                    >
                      {verifying ? '…' : 'Cek'}
                    </Button>
                  </div>
                  {member && (
                    <div className="mt-2 text-[13px] rounded-lg px-3 py-2 bg-green-50 text-green-800 border border-green-200">
                      ✓ {member.name} • {member.customerCode}
                    </div>
                  )}
                  {memberErr && (
                    <p className="text-[12.5px] text-red-600 mt-1.5">{memberErr}</p>
                  )}
                  {!member && !memberErr && staff.length > 0 && (
                    <p className="text-[12px] text-gray-400 mt-1.5">Ketik nomor member persis seperti di kartu, lalu tekan Cek.</p>
                  )}
                </div>
              )}
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
    </div>
  );
}
