import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface QcRow {
  name: string;
  qualified: boolean;
  note: string;
  general?: boolean;
}

interface QcModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  // Kelengkapan yang dicentang saat intake
  items: Array<{ name: string; conditionNote?: string }>;
  onPass: (notes: string) => void;
  onFail: (notes: string) => void;
  busy?: boolean;
}

// IGDERP-168: QC popup — intake checklist + tambah general checkup + note per baris.
// Centang = qualified. Lolos → Ready, Gagal → In Progress.
export default function QcModal({ open, onOpenChange, items, onPass, onFail, busy = false }: QcModalProps) {
  const [rows, setRows] = useState<QcRow[]>([]);
  const [newName, setNewName] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (open) {
      setRows(items.map((i) => ({ name: i.name, qualified: true, note: i.conditionNote || '' })));
      setNewName('');
      setShowAdd(false);
    }
  }, [open, items]);

  const qualified = rows.filter((r) => r.qualified).length;

  const composeNotes = (passed: boolean) => {
    const head = passed
      ? `QC lolos (${qualified}/${rows.length} qualified)`
      : `QC gagal: ${rows.filter((r) => !r.qualified).map((r) => r.name).join(', ') || 'tanpa keterangan'}`;
    const details = rows
      .filter((r) => r.note.trim())
      .map((r) => `${r.name}: ${r.note.trim()}`);
    return [head, ...details].join(' · ');
  };

  const addGeneral = () => {
    const name = newName.trim();
    if (!name) return;
    setRows((rs) => [...rs, { name, qualified: true, note: '', general: true }]);
    setNewName('');
    setShowAdd(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pemeriksaan QC</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Centang = qualified ({qualified}/{rows.length}). Tambah baris untuk general checkup.
          </p>
          <div className="max-h-64 space-y-2 overflow-auto">
            {rows.map((r, i) => (
              <div key={`${r.name}-${i}`} className="flex items-center gap-2 rounded-lg border p-2">
                <input
                  type="checkbox"
                  checked={r.qualified}
                  onChange={(e) =>
                    setRows((rs) => rs.map((x, xi) => (xi === i ? { ...x, qualified: e.target.checked } : x)))
                  }
                  className="h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="w-28 shrink-0 break-words text-sm">
                  {r.name}
                  {r.general && <span className="ml-1 text-[10px] text-muted-foreground">(checkup)</span>}
                </span>
                <Input
                  value={r.note}
                  onChange={(e) =>
                    setRows((rs) => rs.map((x, xi) => (xi === i ? { ...x, note: e.target.value } : x)))
                  }
                  placeholder="Note..."
                  className="h-7 text-xs"
                />
              </div>
            ))}
            {rows.length === 0 && (
              <p className="text-xs text-gray-400">Tidak ada item intake — tambah general checkup di bawah.</p>
            )}
          </div>
          {showAdd ? (
            <div className="flex items-center gap-2 rounded-lg bg-primary-50/50 p-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addGeneral();
                  }
                }}
                placeholder="Nama checkup (mis. Tes charging)"
                className="h-8 text-sm"
                autoFocus
              />
              <Button type="button" size="sm" className="text-xs" onClick={addGeneral}>
                Tambah
              </Button>
              <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={() => setShowAdd(false)}>
                Batal
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setShowAdd(true)}>
              + Tambah general checkup
            </Button>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-red-200 text-red-700"
            disabled={busy}
            onClick={() => onFail(composeNotes(false))}
          >
            Gagal → In Progress
          </Button>
          <Button type="button" disabled={busy} onClick={() => onPass(composeNotes(true))}>
            Lolos QC → Ready
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
