import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import PatternPad from './PatternPad';

export type LockType = 'none' | 'password' | 'pin' | 'pattern';

export const LOCK_TYPE_LABELS: Record<LockType, string> = {
  none: 'Tanpa kunci',
  password: 'Password',
  pin: 'PIN',
  pattern: 'Pola',
};

interface LockModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialType?: string;
  initialValue?: string;
  onSave: (lockType: LockType, value: string) => void;
}

// IGDERP-185: intake modal for the customer phone lock credential.
// Pattern serializes as 'pattern:0-3-4-5-8' (validated server-side).
export default function LockModal({ open, onOpenChange, initialType = 'none', initialValue = '', onSave }: LockModalProps) {
  const [lockType, setLockType] = useState<LockType>((initialType as LockType) || 'none');
  const [text, setText] = useState('');
  const [nodes, setNodes] = useState<number[]>([]);
  const [showText, setShowText] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      const t = (initialType as LockType) || 'none';
      setLockType(t);
      setShowText(false);
      setError('');
      if (t === 'pattern' && initialValue.startsWith('pattern:')) {
        setNodes(
          initialValue
            .replace(/^pattern:/, '')
            .split('-')
            .map(Number)
            .filter((n) => Number.isInteger(n) && n >= 0 && n <= 8),
        );
        setText('');
      } else {
        setNodes([]);
        setText(t === 'none' ? '' : initialValue);
      }
    }
  }, [open, initialType, initialValue]);

  const valid =
    lockType === 'none' ||
    (lockType === 'password' && text.trim().length > 0 && text.trim().length <= 128) ||
    (lockType === 'pin' && /^[0-9]{4,8}$/.test(text.trim())) ||
    (lockType === 'pattern' && nodes.length >= 4);

  const hint =
    lockType === 'pin'
      ? '4–8 digit angka'
      : lockType === 'pattern'
        ? `Gambar pola seperti di HP · min. 4 titik (terpilih: ${nodes.length})`
        : lockType === 'password'
          ? 'Maks. 128 karakter'
          : '';

  const handleSave = () => {
    if (!valid) {
      setError('Lengkapi kunci layar terlebih dahulu');
      return;
    }
    if (lockType === 'none') return onSave('none', '');
    if (lockType === 'pattern') return onSave('pattern', `pattern:${nodes.join('-')}`);
    return onSave(lockType, text.trim());
  };

  const handleReset = () => {
    setText('');
    setNodes([]);
    setError('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Kunci Layar Perangkat</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Jenis kunci</Label>
            <Select
              value={lockType}
              onValueChange={(v) => {
                setLockType(v as LockType);
                setError('');
              }}
              className="mt-1"
            >
              {(Object.keys(LOCK_TYPE_LABELS) as LockType[]).map((t) => (
                <option key={t} value={t}>
                  {LOCK_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
          {lockType === 'password' && (
            <div>
              <Label>Password</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type={showText ? 'text' : 'password'}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Password HP customer"
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setShowText((v) => !v)}>
                  {showText ? 'Sembunyikan' : 'Tampilkan'}
                </Button>
              </div>
            </div>
          )}
          {lockType === 'pin' && (
            <div>
              <Label>PIN (4–8 digit)</Label>
              <Input
                inputMode="numeric"
                value={text}
                onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="Mis. 290171"
                className="mt-1 tracking-[0.3em]"
              />
            </div>
          )}
          {lockType === 'pattern' && (
            <div>
              <PatternPad value={nodes} onChange={setNodes} />
              <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            </div>
          )}
          {lockType !== 'pattern' && hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button onClick={handleSave} disabled={!valid}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
