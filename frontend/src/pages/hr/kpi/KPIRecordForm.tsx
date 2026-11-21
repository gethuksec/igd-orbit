import { useState } from 'react';
import { BreadcrumbHeader } from '@/components/shared';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { hrService } from '@/services/hr.service';
import { toast } from 'sonner';

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

// Shared fields: the list-page edit modal and the /hr/kpi/new page render
// the same inputs in the same order — only editability wrapper differs.
export function AspectFields({
  value,
  onChange,
}: {
  value: AspectFormValue;
  onChange: (v: AspectFormValue) => void;
}) {
  const set = (k: keyof AspectFormValue, v: any) => onChange({ ...value, [k]: v });
  const input = 'w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2">Kode *</label>
          <input value={value.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="mis. KUALITAS" className={input} />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">Bobot (0–1) *</label>
          <input type="number" step="0.01" min="0" max="1" value={value.weight} onChange={(e) => set('weight', e.target.value)} className={input} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2">Nama *</label>
        <input value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="mis. Kualitas kerja" className={input} />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2">Deskripsi</label>
        <textarea value={value.description} onChange={(e) => set('description', e.target.value)} rows={2} className={input} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2">Tipe target *</label>
          <select value={value.target_type} onChange={(e) => set('target_type', e.target.value)} className={input}>
            <option value="FIXED">Tetap (di aspek)</option>
            <option value="PERIOD">Per periode (diinput tiap bulan)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">Target tetap</label>
          <input
            type="number"
            value={value.fixed_target}
            onChange={(e) => set('fixed_target', e.target.value)}
            disabled={value.target_type !== 'FIXED'}
            className={input}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">Urutan</label>
          <input type="number" value={value.sort_order} onChange={(e) => set('sort_order', e.target.value)} className={input} />
        </div>
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={value.is_kolektif} onChange={(e) => set('is_kolektif', e.target.checked)} />
          Kolektif (diinput sekali per divisi, bukan per karyawan)
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={value.is_active} onChange={(e) => set('is_active', e.target.checked)} />
          Aktif
        </label>
      </div>
    </div>
  );
}

export default function KPIRecordForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const divisionId = searchParams.get('division') || '';
  const [value, setValue] = useState<AspectFormValue>(emptyAspectForm);

  const createMutation = useMutation({
    mutationFn: () =>
      hrService.createKpiAspect(divisionId, {
        code: value.code,
        name: value.name,
        description: value.description || undefined,
        weight: parseFloat(value.weight),
        target_type: value.target_type,
        fixed_target: value.fixed_target === '' ? null : parseFloat(value.fixed_target),
        is_kolektif: value.is_kolektif,
        sort_order: parseInt(value.sort_order || '0', 10),
      }),
    onSuccess: () => {
      toast.success('Aspek KPI ditambahkan');
      queryClient.invalidateQueries({ queryKey: ['kpi-grid'] });
      navigate('/hr/kpi');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menambah aspek');
    },
  });

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader title="Tambah Aspek KPI" subtitle="Aspek baru untuk satu divisi (bobot total harus 1.00 saat kunci)" />
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6 space-y-6">
        <AspectFields value={value} onChange={setValue} />
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Link
            to="/hr/kpi"
            className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-center"
          >
            Batal
          </Link>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !divisionId || !value.code || !value.name}
            className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {createMutation.isPending ? (
              'Menyimpan...'
            ) : (
              <>
                <Save className="w-5 h-5" /> Tambah Aspek
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
