import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export interface AspectFormValue {
  name: string;
  description: string;
  weight: string;
  fixed_target: string;
  is_active: boolean;
}

export const emptyAspectForm: AspectFormValue = {
  name: '',
  description: '',
  weight: '0.2',
  fixed_target: '100',
  is_active: true,
};

// Trimmed aspect form: Nama, Deskripsi, Bobot, Target + optional Aktif
// switch (create pages omit it — new aspects are always active).
export function KpiAspectFields({
  value,
  onChange,
  showActive = true,
}: {
  value: AspectFormValue;
  onChange: (v: AspectFormValue) => void;
  showActive?: boolean;
}) {
  const set = (k: keyof AspectFormValue, v: any) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nama</Label>
        <Input value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="Kualitas kerja" />
      </div>
      <div className="space-y-2">
        <Label>Deskripsi</Label>
        <Input
          value={value.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Contoh: ketepatan diagnosa + kerapian pengerjaan"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Bobot (0–1)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={value.weight}
            onChange={(e) => set('weight', e.target.value)}
            className="font-mono tabular-nums"
          />
        </div>
        <div className="space-y-2">
          <Label>Target</Label>
          <Input
            type="number"
            value={value.fixed_target}
            onChange={(e) => set('fixed_target', e.target.value)}
            className="font-mono tabular-nums"
          />
        </div>
      </div>
      {showActive && (
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={value.is_active} onCheckedChange={(v) => set('is_active', v)} />
          Aktif
        </label>
      )}
    </div>
  );
}
