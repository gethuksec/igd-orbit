// IGDERP-241 (D5): print sheet for a queued offline sale — renders the
// provisional thermal receipt from the outbox snapshot (OFF- number +
// BELUM TERSINKRON mark). Plain route, no menu. After sync, reprint the
// real number via the normal Cetak Nota path.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { posOutbox, type PendingSaleSnapshot } from '@/lib/offline-db';

const fmtIDR = (n: number) =>
  'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');

const fmtDate = (ts: number) => {
  const d = new Date(ts);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function OfflineReceiptPrint() {
  const { key } = useParams<{ key: string }>();
  const [snap, setSnap] = useState<PendingSaleSnapshot | null>(null);
  const [ref, setRef] = useState('');
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    posOutbox
      .list()
      .then((all) => {
        const rec = all.find((r) => r.clientMutationId === key);
        if (!rec || !rec.snapshot) {
          setMissing(true);
          return;
        }
        setSnap(rec.snapshot);
        setRef(rec.provisionalNumber);
        setTimeout(() => window.print(), 500);
      })
      .catch(() => setMissing(true));
  }, [key]);

  if (missing) {
    return (
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        Antrean tidak ditemukan — kemungkinan sudah tersinkron. Cetak ulang dari
        Riwayat Penjualan (nomor nota resmi).
      </div>
    );
  }
  if (!snap) return null;

  const change = snap.paidAmount - snap.total;

  return (
    <div style={{ width: '72mm', fontFamily: "'Courier New', Courier, monospace", fontSize: 11, lineHeight: 1.45, color: '#000', padding: '2mm' }}>
      <style>{`@media print { @page { size: 80mm auto; margin: 2mm; } }`}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 'bold' }}>{snap.storeName}</div>
        <div>sparepart-accessories-service</div>
        <div>{snap.branchName}</div>
      </div>
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
      <div style={{ textAlign: 'center', fontWeight: 'bold' }}>NOTA PENJUALAN (OFFLINE)</div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>No</span><span>{ref}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tgl</span><span>{fmtDate(snap.createdAt)}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Kasir</span><span>{snap.cashierName || 'Kasir'}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Customer</span><span>{snap.customerName || 'Walk-in'}</span></div>
      <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 'bold', border: '2px solid #000', borderRadius: 6, padding: '2px 0', margin: '6px 0', letterSpacing: 2 }}>
        BELUM TERSINKRON
      </div>
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
      {snap.items.map((it, i) => (
        <div key={i} style={{ margin: '3px 0' }}>
          <div>{i + 1}. {it.name}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{it.quantity} x {fmtIDR(it.unitPrice)}</span>
            <span>{fmtIDR(it.quantity * it.unitPrice - (it.discountAmount || 0))}</span>
          </div>
        </div>
      ))}
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{fmtIDR(snap.subtotal)}</span></div>
      {snap.discountAmount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Diskon</span><span>-{fmtIDR(snap.discountAmount)}</span></div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 'bold' }}><span>TOTAL</span><span>{fmtIDR(snap.total)}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Bayar (TUNAI)</span><span>{fmtIDR(snap.paidAmount)}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Kembalian</span><span>{fmtIDR(change)}</span></div>
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
      <div style={{ textAlign: 'center', fontSize: 10 }}>
        NOTA SEMENTARA OFFLINE — TUKAR DENGAN NOTA RESMI SETELAH SYNC<br />TERIMA KASIH
      </div>
    </div>
  );
}
