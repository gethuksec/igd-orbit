import { useState } from 'react';
import { BreadcrumbHeader } from '@/components/shared';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Save } from 'lucide-react';
import { hrService } from '@/services/hr.service';
import { payrollComponentsService } from '@/services/payroll-components.service';
import { toast } from 'sonner';

interface SelectedComponent {
  masterId: string;
  notes: string;
}

export default function PayrollCalculationForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [components, setComponents] = useState<SelectedComponent[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Active component master checklist (denda lives in PenaltyType, listed separately)
  const { data: mastersData, isLoading: isLoadingMasters } = useQuery({
    queryKey: ['payroll-component-masters-active'],
    queryFn: async () => {
      try {
        const response = await payrollComponentsService.getAll({ limit: 100 });
        return response.data || [];
      } catch (error) {
        console.error('Error fetching component masters:', error);
        toast.error('Gagal memuat master komponen');
        return [];
      }
    },
  });

  const masters = mastersData || [];
  const usedIds = new Set(components.map((c) => c.masterId).filter(Boolean));

  const calculateMutation = useMutation({
    mutationFn: () =>
      hrService.calculatePayroll({
        period_month: periodMonth,
        period_year: periodYear,
        components: components.map((c) => ({
          masterId: c.masterId,
          notes: c.notes?.trim() ? c.notes.trim() : undefined,
        })),
      }),
    onSuccess: (data) => {
      const calculatedCount = data.calculatedPayrolls || data.payrolls?.length || 0;
      toast.success(`Payroll berhasil dihitung untuk ${calculatedCount} karyawan`);

      queryClient.invalidateQueries({ queryKey: ['payrolls'] });

      setTimeout(() => {
        navigate(`/hr/payroll?periodMonth=${periodMonth}&periodYear=${periodYear}`);
      }, 100);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghitung payroll');
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      }
    },
  });

  const addComponent = () => {
    setComponents([...components, { masterId: '', notes: '' }]);
  };

  const removeComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const updateComponent = (index: number, field: keyof SelectedComponent, value: string) => {
    const updated = [...components];
    updated[index] = { ...updated[index], [field]: value };
    setComponents(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!periodMonth || periodMonth < 1 || periodMonth > 12) {
      newErrors.period_month = 'Bulan tidak valid';
    }
    if (!periodYear || periodYear < 2000) {
      newErrors.period_year = 'Tahun tidak valid';
    }

    // Component mandatory minimum 1, each row must pick a master
    if (components.length === 0) {
      newErrors.components = 'Minimal 1 komponen payroll wajib dipilih';
    }
    components.forEach((comp, index) => {
      if (!comp.masterId) {
        newErrors[`component_${index}_master`] = 'Komponen wajib dipilih';
      }
    });
    const ids = components.map((c) => c.masterId).filter(Boolean);
    if (new Set(ids).size !== ids.length) {
      newErrors.components = 'Komponen tidak boleh dipilih ganda';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    calculateMutation.mutate();
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <BreadcrumbHeader title="Hitung Payroll" subtitle="Pilih periode dan komponen — dihitung untuk semua karyawan aktif" />

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6 space-y-6">
        {/* Period */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Bulan <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <select
              value={periodMonth}
              onChange={(e) => setPeriodMonth(parseInt(e.target.value))}
              required
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.period_month ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {new Date(2000, month - 1).toLocaleString('id-ID', { month: 'long' })}
                </option>
              ))}
            </select>
            {errors.period_month && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.period_month}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Tahun <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="number"
              value={periodYear}
              onChange={(e) => setPeriodYear(parseInt(e.target.value))}
              min="2000"
              max="2100"
              required
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.period_year ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {errors.period_year && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.period_year}</p>}
          </div>
        </div>

        {/* Components */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Komponen Payroll <span className="text-red-500 dark:text-red-400">*</span>
              <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
                Minimal 1 — dihitung untuk semua karyawan aktif
              </span>
            </label>
            <button
              type="button"
              onClick={addComponent}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Tambah Komponen
            </button>
          </div>

          {errors.components && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{errors.components}</p>}

          {components.length > 0 && (
            <div className="space-y-4">
              {components.map((component, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">Komponen #{index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => removeComponent(index)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Komponen <span className="text-red-500 dark:text-red-400">*</span>
                      </label>
                      <select
                        value={component.masterId}
                        onChange={(e) => updateComponent(index, 'masterId', e.target.value)}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                          errors[`component_${index}_master`] ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        <option value="">{isLoadingMasters ? 'Memuat...' : '-- Pilih komponen --'}</option>
                        {masters
                          .filter((m: any) => m.id === component.masterId || !usedIds.has(m.id))
                          .map((m: any) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.category === 'earning' ? '+' : '-'})
                            </option>
                          ))}
                      </select>
                      {errors[`component_${index}_master`] && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors[`component_${index}_master`]}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Catatan</label>
                      <textarea
                        value={component.notes || ''}
                        onChange={(e) => updateComponent(index, 'notes', e.target.value)}
                        rows={2}
                        maxLength={500}
                        placeholder="Catatan untuk komponen ini..."
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Link
            to="/hr/payroll"
            className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-center"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={calculateMutation.isPending}
            className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {calculateMutation.isPending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Menghitung...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Hitung Payroll
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
