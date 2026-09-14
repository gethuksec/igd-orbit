import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { inventoryService } from '../../services/inventory.service';

// IGDERP-174: printable packer checklist for a pending/sent mutasi doc.
// Plain layout with tick boxes + signature lines; the Print button and
// navigation hide via the inline print stylesheet.
export default function MutasiChecklist() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: doc, isLoading } = useQuery({
    queryKey: ['transfer-doc', id],
    queryFn: () => inventoryService.getMutasiById(id!),
    enabled: !!id,
  });

  if (isLoading || !doc) {
    return <div style={{ padding: 24 }}>Memuat checklist…</div>;
  }

  const total = doc.items.reduce((s: number, i: any) => s + Number(i.quantityRequested || 0), 0);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24, background: '#fff', color: '#111' }}>
      <style>{`@media print { .no-print { display: none !important; } body { background: #fff; } }`}</style>
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button variant="outline" size="sm" onClick={() => navigate(`/inventory/mutasi/${id}`)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Kembali
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1" /> Cetak
        </Button>
      </div>

      <h1 style={{ fontSize: 20, fontWeight: 800 }}>Checklist Pengepakan Mutasi</h1>
      <p style={{ fontSize: 13, color: '#555' }}>
        {doc.transferNumber} · {new Date(doc.createdAt).toLocaleString('id-ID')}
      </p>
      <p style={{ fontSize: 14, marginTop: 8 }}>
        <b>Dari:</b> {doc.fromWarehouse?.name || '-'} ({doc.fromBranch?.name || '—'})<br />
        <b>Ke:</b> {doc.toWarehouse?.name || '-'} (
        {doc.toBranch?.name || 'Gudang pusat (sistem)'})
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, fontSize: 14 }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #999', padding: 8, width: 40 }}>✓</th>
            <th style={{ border: '1px solid #999', padding: 8, textAlign: 'left' }}>Produk / SKU</th>
            <th style={{ border: '1px solid #999', padding: 8, width: 90 }}>Diminta</th>
            <th style={{ border: '1px solid #999', padding: 8, width: 90 }}>Dikirim</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((i: any) => (
            <tr key={i.id}>
              <td style={{ border: '1px solid #999', padding: 8, textAlign: 'center' }}>☐</td>
              <td style={{ border: '1px solid #999', padding: 8 }}>
                <b>{i.productName || i.product?.name}</b>
                <br />
                <span style={{ fontSize: 12, color: '#555' }}>{i.productSku || i.product?.sku}</span>
              </td>
              <td style={{ border: '1px solid #999', padding: 8, textAlign: 'right' }}>
                {Number(i.quantityRequested)}
              </td>
              <td style={{ border: '1px solid #999', padding: 8 }} />
            </tr>
          ))}
          <tr>
            <td colSpan={2} style={{ border: '1px solid #999', padding: 8, textAlign: 'right' }}>
              <b>Total</b>
            </td>
            <td style={{ border: '1px solid #999', padding: 8, textAlign: 'right' }}>
              <b>{total}</b>
            </td>
            <td style={{ border: '1px solid #999', padding: 8 }} />
          </tr>
        </tbody>
      </table>

      {doc.notes && (
        <p style={{ fontSize: 13, marginTop: 8 }}>
          <b>Catatan:</b> {doc.notes}
        </p>
      )}

      <div style={{ display: 'flex', gap: 32, marginTop: 40, fontSize: 13 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          Penyortir
          <div style={{ height: 64 }} />
          ( ……………… )
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          Penanggung Jawab
          <div style={{ height: 64 }} />
          ( ……………… )
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          Penerima
          <div style={{ height: 64 }} />
          ( ……………… )
        </div>
      </div>
    </div>
  );
}
