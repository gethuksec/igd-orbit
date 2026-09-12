import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Eye, Loader2 } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { purchasingService, type PurchaseReturn } from '@/services/purchasing.service';
import { formatCurrency, formatDate } from '@/utils/format';

const fmtQty = (n: number) => new Intl.NumberFormat('id-ID').format(n);

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${accent ? 'text-red-600' : ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

export default function PurchaseReturnList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-returns', searchTerm],
    queryFn: () =>
      purchasingService.getPurchaseReturns({
        limit: 100,
        search: searchTerm || undefined,
      }),
  });

  const returns = data?.data || [];
  const total = data?.total || 0;

  const now = new Date();
  const isThisMonth = (d: string) => {
    const dt = new Date(d);
    return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
  };
  const thisMonth = returns.filter((r) => isThisMonth(r.createdAt));
  const openCount = returns.filter((r) => r.status !== 'completed').length;
  const totalQty = returns.reduce((s, r) => s + Number(r.totalQty || 0), 0);
  const monthValue = thisMonth.reduce((s, r) => s + Number(r.totalValue || 0), 0);

  return (
    <div className="space-y-6">
      <BreadcrumbHeader title="Retur Pembelian" subtitle="Kelola retur pembelian ke supplier">
        <div className="relative" ref={menuRef}>
          <Button onClick={() => setMenuOpen((v) => !v)}>
            Buat Retur
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-1.5">
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 rounded-md hover:bg-gray-50"
                onClick={() => navigate('/purchasing/returns/new?mode=po')}
              >
                <div className="text-sm font-semibold text-gray-900">Dari PO</div>
                <div className="text-xs text-gray-500">Pilih PO yang sudah diterima</div>
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 rounded-md hover:bg-gray-50"
                onClick={() => navigate('/purchasing/returns/new?mode=manual')}
              >
                <div className="text-sm font-semibold text-gray-900">Manual (tanpa PO)</div>
                <div className="text-xs text-gray-500">Input invoice &amp; produk manual</div>
              </button>
            </div>
          )}
        </div>
      </BreadcrumbHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total Retur" value={String(total)} />
        <Stat label="Pending" value={String(openCount)} />
        <Stat label="Total Qty Diretur" value={fmtQty(totalQty)} />
        <Stat label="Nilai Retur · Bulan Ini" value={formatCurrency(monthValue)} accent />
      </div>

      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="Cari nomor retur, nomor invoice, nomor PO, atau supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-4"
          />
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : returns.length === 0 ? (
            <div className="text-center py-12 text-gray-500">Belum ada retur pembelian</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Retur</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>No. Invoice</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>No. PO</TableHead>
                  <TableHead>Produk / Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Nilai</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((r: PurchaseReturn) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.returnNumber}</TableCell>
                    <TableCell>{formatDate(r.createdAt)}</TableCell>
                    <TableCell>{r.invoiceNumber || '-'}</TableCell>
                    <TableCell>
                      <div>{r.supplier?.name || '-'}</div>
                      <div className="text-xs text-gray-500">{r.supplier?.customerCode}</div>
                    </TableCell>
                    <TableCell>
                      {r.purchaseOrder?.poNumber ? (
                        r.purchaseOrder.poNumber
                      ) : (
                        <span className="text-gray-400">
                          — <span className="text-xs">(manual)</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.items?.length || 0} produk</div>
                      <div className="text-xs text-gray-500">{fmtQty(Number(r.totalQty || 0))} unit</div>
                    </TableCell>
                    <TableCell>
                      {r.status === 'completed' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 border border-green-300 text-green-700">
                          Selesai
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 border border-amber-300 text-amber-700">
                          Pending
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(r.totalValue || 0))}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/purchasing/returns/${r.id}`)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!isLoading && returns.length > 0 && (
            <div className="text-right text-sm text-gray-500 mt-4">
              Menampilkan {returns.length} dari {total} retur
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
