import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export interface AspectFormValue {
  code: string;
  name: string;
  description: string;
  weight: string;
  target_type: string;
  fixed_target: string;
  is_kolektif: boolean;
  sort_order: string;
  is_active: boolean;
}

export const emptyAspectForm: AspectFormValue = {
  code: '',
  name: '',
  description: '',
  weight: '0.2',
  target_type: 'FIXED',
  fixed_target: '100',
  is_kolektif: false,
  sort_order: '0',
  is_active: true,
};

// Shared aspect inputs: assign wizard, edit tab, and the add dialog
// render the same fields in the same order.
export function KpiAspectFields({
  value,
  onChange,
}: {
  value: AspectFormValue;
  onChange: (v: AspectFormValue) => void;
}) {
  const set = (k: keyof AspectFormValue, v: any) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Kode</Label>
          <Input value={value.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="KUALITAS" className="font-mono" />
        </div>
        <div className="space-y-2">
          <Label>Bobot (0–1)</Label>
          <Input type="number" step="0.01" min="0" max="1" value={value.weight} onChange={(e) => set('weight', e.target.value)} className="font-mono tabular-nums" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Nama</Label>
        <Input value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="Kualitas kerja" />
      </div>
      <div className="space-y-2">
        <Label>Deskripsi</Label>
        <Input value={value.description} onChange={(e) => set('description', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Tipe target</Label>
          <select
            value={value.target_type}
            onChange={(e) => set('target_type', e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="FIXED">Tetap (di aspek)</option>
            <option value="PERIOD">Per periode</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>Target tetap</Label>
          <Input
            type="number"
            value={value.fixed_target}
            onChange={(e) => set('fixed_target', e.target.value)}
            disabled={value.target_type !== 'FIXED'}
            className="font-mono tabular-nums"
          />
        </div>
        <div className="space-y-2">
          <Label>Urutan</Label>
          <Input type="number" value={value.sort_order} onChange={(e) => set('sort_order', e.target.value)} className="font-mono tabular-nums" />
        </div>
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={value.is_kolektif} onCheckedChange={(v) => set('is_kolektif', v)} />
          Kolektif (sekali per divisi)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={value.is_active} onCheckedChange={(v) => set('is_active', v)} />
          Aktif
        </label>
      </div>
    </div>
  );
}
