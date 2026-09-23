import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { inventoryService } from '../../services/inventory.service';
import { formatCurrency } from '../../utils/format';

// IGDERP-177: signed SO result document (print → PDF via browser print-to-PDF,
// same pattern as MutasiChecklist IGDERP-174). Shows SO number, per-item
// selisih qty + nominal (SIGNED, netto-compatible per IGDERP-193, cost basis),
// totals, and signature lines. The Print button and navigation hide on print.
export default function OpnameResultDoc() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: opname, isLoading } = useQuery({
    queryKey: ['opname-doc', id],
    queryFn: () => inventoryService.getOpnameById(id!),
    enabled: !!id,
  });

  if (isLoading || !opname) {
    return <div style={{ padding: 24 }}>Memuat dokumen…</div>;
  }

  const items: any[] = opname.items ?? [];
  const counted = items.filter((i: any) => i.physicalQuantity !== null && i.physicalQuantity !== undefined);
  const withDiff = counted.filter((i: any) => Number(i.discrepancy || 0) !== 0);
  const totalValue = counted.reduce((s: number, i: any) => s + Number(i.discrepancyValue || 0), 0);
  const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatCurrency(Math.abs(n))}`;
  const condLabel = (c: string | null) =>
    c === 'damaged' ? 'Rusak' : c === 'expired' ? 'Kadaluarsa' : 'Baik';

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24, background: '#fff', color: '#111' }}>
      <style>{`@media print { .no-print { display: none !important; } body { background: #fff; } }`}</style>
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button variant="outline" size="sm" onClick={() => navigate(`/inventory/opname/${id}`)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Kembali
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1" /> Cetak / PDF
        </Button>
      </div>

      <h1 style={{ fontSize: 20, fontWeight: 800 }}>Berita Acara Hasil Stock Opname</h1>
      <p style={{ fontSize: 13, color: '#555' }}>
        {opname.opnameNumber} · {opname.branch?.name || '-'} ·{' '}
        {opname.opnameDate ? new Date(opname.opnameDate).toLocaleDateString('id-ID') : '-'}
      </p>
      <p style={{ fontSize: 14, marginTop: 8 }}>
        Total item: <b>{items.length}</b> · Dihitung: <b>{counted.length}</b> · Selisih:{' '}
        <b>{withDiff.length}</b> · Nilai netto: <b>{signed(totalValue)}</b>
      </p>
      <p style={{ fontSize: 12, color: '#555' }}>Nominal selisih dihitung dari harga beli (cost).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #999', padding: 8, textAlign: 'left' }}>Produk / SKU</th>
            <th style={{ border: '1px solid #999', padding: 8, width: 70 }}>Sistem</th>
            <th style={{ border: '1px solid #999', padding: 8, width: 70 }}>Fisik</th>
            <th style={{ border: '1px solid #999', padding: 8, width: 90 }}>Selisih</th>
            <th style={{ border: '1px solid #999', padding: 8, width: 120 }}>Nilai</th>
            <th style={{ border: '1px solid #999', padding: 8, width: 90 }}>Kondisi</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i: any) => (
            <tr key={i.id}>
              <td style={{ border: '1px solid #999', padding: 8 }}>
                <b>{i.product?.name || '-'}</b>
                <br />
                <span style={{ fontSize: 12, color: '#555' }}>{i.product?.sku || '-'}</span>
              </td>
              <td style={{ border: '1px solid #999', padding: 8, textAlign: 'right' }}>
                {Number(i.systemQuantity || 0)}
              </td>
              <td style={{ border: '1px solid #999', padding: 8, textAlign: 'right' }}>
                {i.physicalQuantity === null || i.physicalQuantity === undefined
                  ? '—'
                  : Number(i.physicalQuantity)}
              </td>
              <td style={{ border: '1px solid #999', padding: 8, textAlign: 'right' }}>
                {Number(i.discrepancy || 0) > 0 ? '+' : ''}
                {Number(i.discrepancy || 0)}
              </td>
              <td style={{ border: '1px solid #999', padding: 8, textAlign: 'right' }}>
                {signed(Number(i.discrepancyValue || 0))}
              </td>
              <td style={{ border: '1px solid #999', padding: 8 }}>{condLabel(i.condition)}</td>
            </tr>
          ))}
          <tr>
            <td
              colSpan={4}
              style={{ border: '1px solid #999', padding: 8, textAlign: 'right' }}
            >
              <b>Total netto</b>
            </td>
            <td style={{ border: '1px solid #999', padding: 8, textAlign: 'right' }}>
              <b>{signed(totalValue)}</b>
            </td>
            <td style={{ border: '1px solid #999', padding: 8 }} />
          </tr>
        </tbody>
      </table>

      {opname.notes && (
        <p style={{ fontSize: 13, marginTop: 8 }}>
          <b>Catatan:</b> {opname.notes}
        </p>
      )}

      <div style={{ display: 'flex', gap: 32, marginTop: 40, fontSize: 13 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          Penghitung
          <div style={{ height: 64 }} />
          ( ……………… )
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          Penanggung Jawab
          <div style={{ height: 64 }} />
          ( ……………… )
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          Menyetujui
          <div style={{ height: 64 }} />
          ( ……………… )
        </div>
      </div>
    </div>
  );
}
