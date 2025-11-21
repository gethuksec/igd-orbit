import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Banknote, Plus, X, Save } from 'lucide-react';
import { hrService } from '@/services/hr.service';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/format';

interface PayrollComponent {
  component_type: 'earning' | 'deduction';
  component_name: string;
  amount: number;
  is_taxable?: boolean;
  notes?: string;
}

export default function PayrollCalculationForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    employee_ids: [] as string[],
    period_month: new Date().getMonth() + 1,
    period_year: new Date().getFullYear(),
  });

  const [components, setComponents] = useState<PayrollComponent[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get employees list
  const { data: employeesData, isLoading: isLoadingEmployees } = useQuery({
    queryKey: ['employees-for-payroll'],
    queryFn: async () => {
      try {
        // Fetch users with employee data - same approach as EmployeeList
        // Backend limit max is 100, so we need to fetch multiple pages if needed
        const response = await api.get('/users', {
          params: {
            page: 1,
            limit: 100, // Max limit allowed by backend
          },
        });
        const users = response.data.data || response.data || [];
        // Filter only users that have employee data
        const employees = users.filter((user: any) => user.employee);
        console.log('Total users:', users.length, 'Employees:', employees.length);
        return employees;
      } catch (error) {
        console.error('Error fetching employees:', error);
        toast.error('Gagal memuat daftar karyawan');
        return [];
      }
    },
  });

  const employees = employeesData || [];

  const calculateMutation = useMutation({
    mutationFn: () =>
      hrService.calculatePayroll({
        employee_ids: formData.employee_ids.length > 0 ? formData.employee_ids : undefined,
        period_month: formData.period_month,
        period_year: formData.period_year,
        components: components.length > 0 ? components : undefined,
      }),
    onSuccess: (data) => {
      const calculatedCount = data.calculatedPayrolls || data.payrolls?.length || 0;
      toast.success(`Payroll berhasil dihitung untuk ${calculatedCount} karyawan`);
      
      // Invalidate all payroll queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      
      // If only one employee was selected and calculated, navigate to that payroll detail
      if (formData.employee_ids.length === 1 && data.payrolls && data.payrolls.length === 1) {
        // Wait a bit for the query to invalidate, then navigate
        setTimeout(() => {
          navigate(`/hr/payroll/${data.payrolls[0].payrollId}`);
        }, 100);
      } else {
        // If multiple employees, navigate to list with period filter
        setTimeout(() => {
          navigate(`/hr/payroll?periodMonth=${formData.period_month}&periodYear=${formData.period_year}`);
        }, 100);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghitung payroll');
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      }
    },
  });

  const addComponent = () => {
    setComponents([
      ...components,
      {
        component_type: 'earning',
        component_name: '',
        amount: 0,
        is_taxable: true,
        notes: '',
      },
    ]);
  };

  const removeComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const updateComponent = (index: number, field: keyof PayrollComponent, value: any) => {
    const updated = [...components];
    updated[index] = { ...updated[index], [field]: value };
    setComponents(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    if (formData.employee_ids.length === 0) {
      newErrors.employee_ids = 'Minimal satu karyawan wajib dipilih';
    }
    if (!formData.period_month || formData.period_month < 1 || formData.period_month > 12) {
      newErrors.period_month = 'Bulan tidak valid';
    }
    if (!formData.period_year || formData.period_year < 2020) {
      newErrors.period_year = 'Tahun tidak valid';
    }

    // Validate components
    components.forEach((comp, index) => {
      if (!comp.component_name.trim()) {
        newErrors[`component_${index}_name`] = 'Nama komponen wajib diisi';
      }
      if (comp.amount <= 0) {
        newErrors[`component_${index}_amount`] = 'Jumlah harus lebih dari 0';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    calculateMutation.mutate();
  };

  const totalEarnings = components
    .filter((c) => c.component_type === 'earning')
    .reduce((sum, c) => sum + (c.amount || 0), 0);

  const totalDeductions = components
    .filter((c) => c.component_type === 'deduction')
    .reduce((sum, c) => sum + (c.amount || 0), 0);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center gap-4">
          <Link
            to="/hr/payroll"
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <Banknote className="w-10 h-10" />
              Hitung Payroll
            </h1>
            <p className="text-primary-100 text-lg">Formulir perhitungan payroll karyawan</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-6">
        {/* Employee Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Karyawan <span className="text-red-500">*</span>
          </label>
          <select
            multiple
            value={formData.employee_ids}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, (option) => option.value);
              setFormData({ ...formData, employee_ids: selected });
            }}
            required
            size={5}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
              errors.employee_ids ? 'border-red-300' : 'border-gray-300'
            }`}
          >
            {isLoadingEmployees ? (
              <option value="">Memuat data karyawan...</option>
            ) : employees.length === 0 ? (
              <option value="">Tidak ada karyawan ditemukan</option>
            ) : (
              employees.map((user: any) => {
                // user is a User object with employee property
                const employeeId = user.employee?.id;
                if (!employeeId) return null;
                const userName = user.fullName || user.email || 'Unknown';
                const employeeCode = user.employee?.employeeCode || '';
                return (
                  <option key={employeeId} value={employeeId}>
                    {userName} {employeeCode ? `(${employeeCode})` : ''}
                  </option>
                );
              })
            )}
          </select>
          <p className="mt-1 text-xs text-gray-500">Gunakan Ctrl/Cmd + Click untuk memilih multiple karyawan</p>
          {errors.employee_ids && <p className="mt-1 text-sm text-red-600">{errors.employee_ids}</p>}
          {formData.employee_ids.length > 0 && (
            <p className="mt-2 text-sm text-gray-700">
              <span className="font-semibold">{formData.employee_ids.length}</span> karyawan dipilih
            </p>
          )}
        </div>

        {/* Period */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Bulan <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.period_month}
              onChange={(e) => setFormData({ ...formData, period_month: parseInt(e.target.value) })}
              required
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.period_month ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {new Date(2000, month - 1).toLocaleString('id-ID', { month: 'long' })}
                </option>
              ))}
            </select>
            {errors.period_month && <p className="mt-1 text-sm text-red-600">{errors.period_month}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tahun <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.period_year}
              onChange={(e) => setFormData({ ...formData, period_year: parseInt(e.target.value) })}
              min="2020"
              max="2100"
              required
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.period_year ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.period_year && <p className="mt-1 text-sm text-red-600">{errors.period_year}</p>}
          </div>
        </div>

        {/* Components */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-semibold text-gray-700">Komponen Payroll (Opsional)</label>
            <button
              type="button"
              onClick={addComponent}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Tambah Komponen
            </button>
          </div>

          {components.length > 0 && (
            <div className="space-y-4">
              {components.map((component, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">Komponen #{index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => removeComponent(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Tipe</label>
                      <select
                        value={component.component_type}
                        onChange={(e) =>
                          updateComponent(index, 'component_type', e.target.value as 'earning' | 'deduction')
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="earning">Earning</option>
                        <option value="deduction">Deduction</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Nama Komponen <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={component.component_name}
                        onChange={(e) => updateComponent(index, 'component_name', e.target.value)}
                        placeholder="e.g., Tunjangan, Potongan"
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                          errors[`component_${index}_name`] ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      {errors[`component_${index}_name`] && (
                        <p className="mt-1 text-sm text-red-600">{errors[`component_${index}_name`]}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Jumlah <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={component.amount || ''}
                        onChange={(e) => updateComponent(index, 'amount', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        placeholder="0"
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                          errors[`component_${index}_amount`] ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      {errors[`component_${index}_amount`] && (
                        <p className="mt-1 text-sm text-red-600">{errors[`component_${index}_amount`]}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Taxable</label>
                      <select
                        value={component.is_taxable ? 'true' : 'false'}
                        onChange={(e) => updateComponent(index, 'is_taxable', e.target.value === 'true')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Catatan (Opsional)</label>
                    <textarea
                      value={component.notes || ''}
                      onChange={(e) => updateComponent(index, 'notes', e.target.value)}
                      rows={2}
                      placeholder="Tambahkan catatan..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {components.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-gray-700">Total Earnings:</span>
                <span className="text-sm font-bold text-green-600">{formatCurrency(totalEarnings)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-gray-700">Total Deductions:</span>
                <span className="text-sm font-bold text-red-600">{formatCurrency(totalDeductions)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-base font-bold text-gray-900">Net:</span>
                <span className="text-base font-bold text-gray-900">
                  {formatCurrency(totalEarnings - totalDeductions)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Link
            to="/hr/payroll"
            className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 text-center"
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

