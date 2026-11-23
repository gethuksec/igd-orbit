import { useState } from 'react';
import { BreadcrumbHeader } from '@/components/shared';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2 } from 'lucide-react';
import { hrService } from '@/services/hr.service';
import { shiftsService, type Shift } from '@/services/shifts.service';
import { api } from '@/services/api';
import { toast } from 'sonner';

export default function ShiftSwapForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ target_employee_id: '', date: '', from_shift_id: '', to_shift_id: '', reason: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: shiftsData } = useQuery({
    queryKey: ['shifts-active'],
    queryFn: () => shiftsService.getAll({ limit: 100 }),
  });
  const shifts: Shift[] = (shiftsData as any)?.data || [];

  const { data: employeesData } = useQuery({
    queryKey: ['employees-lite'],
    queryFn: async () => {
      const res = await api.get('/users', { params: { limit: 100, includeEmployee: true } });
      return res.data?.data || res.data;
    },
  });
  const employees: any[] = employeesData?.data || employeesData || [];

  const createMutation = useMutation({
    mutationFn: () => hrService.requestShiftSwap(form),
    onSuccess: () => {
      toast.success('Pengajuan tukar shift terkirim');
      queryClient.invalidateQueries({ queryKey: ['shift-swaps'] });
      navigate('/hr/shift-swap');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal mengajukan');
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.date) errs.date = 'Tanggal wajib diisi';
    if (!form.target_employee_id) errs.target_employee_id = 'Pilih rekan tukar';
    if (!form.from_shift_id) errs.from_shift_id = 'Pilih shift saat ini';
    if (!form.to_shift_id) errs.to_shift_id = 'Pilih shift tujuan';
    if (form.from_shift_id && form.to_shift_id && form.from_shift_id === form.to_shift_id)
      errs.to_shift_id = 'Shift tujuan harus berbeda';
    setErrors(errs);
    if (Object.keys(errs).length === 0) createMutation.mutate();
  };

  const input = 'w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-base focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  return (
    <div className="w-full space-y-4 max-w-xl mx-auto">
      <BreadcrumbHeader title="Ajukan Tukar Shift" subtitle="Tanggal + tukar dengan siapa + shift tujuan" />
      <form onSubmit={submit} className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-4 md:p-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-2">Tanggal <span className="text-red-500">*</span></label>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={input} />
          {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date}</p>}
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">Tukar dengan <span className="text-red-500">*</span></label>
          <select value={form.target_employee_id} onChange={(e) => setForm({ ...form, target_employee_id: e.target.value })} className={input}>
            <option value="">Pilih karyawan...</option>
            {employees
              .filter((u: any) => u.employee?.id)
              .map((u: any) => (
                <option key={u.employee.id} value={u.employee.id}>
                  {u.employee.user?.fullName || u.fullName || u.employee.employeeCode} ({u.employee.employeeCode})
                </option>
              ))}
          </select>
          {errors.target_employee_id && <p className="mt-1 text-sm text-red-600">{errors.target_employee_id}</p>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Shift saya <span className="text-red-500">*</span></label>
            <select value={form.from_shift_id} onChange={(e) => setForm({ ...form, from_shift_id: e.target.value })} className={input}>
              <option value="">Pilih shift...</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.clockIn}-{s.clockOut})</option>
              ))}
            </select>
            {errors.from_shift_id && <p className="mt-1 text-sm text-red-600">{errors.from_shift_id}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Shift tujuan <span className="text-red-500">*</span></label>
            <select value={form.to_shift_id} onChange={(e) => setForm({ ...form, to_shift_id: e.target.value })} className={input}>
              <option value="">Pilih shift...</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.clockIn}-{s.clockOut})</option>
              ))}
            </select>
            {errors.to_shift_id && <p className="mt-1 text-sm text-red-600">{errors.to_shift_id}</p>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">Alasan (opsional)</label>
          <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} className={`${input} resize-none`} placeholder="Cth: ada acara keluarga..." />
        </div>
        <div className="flex gap-3 pt-2">
          <Link to="/hr/shift-swap" className="px-6 py-3 border rounded-lg font-semibold text-center">
            Batal
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Ajukan
          </button>
        </div>
      </form>
    </div>
  );
}
