import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Target, Save } from 'lucide-react';
import { hrService } from '@/services/hr.service';
import { toast } from 'sonner';
import { api } from '@/services/api';

export default function KPIRecordForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    employee_id: '',
    period_month: new Date().getMonth() + 1,
    period_year: new Date().getFullYear(),
    sales_target_achievement: '',
    service_quality_score: '',
    customer_satisfaction: '',
    attendance_score: '',
    target_bonus: '',
    bonus_multiplier: '1.0',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get employees list
  const { data: employees, isLoading: isLoadingEmployees } = useQuery({
    queryKey: ['employees-for-kpi'],
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
        const employeesList = users.filter((user: any) => user.employee);
        return employeesList;
      } catch (error) {
        console.error('Error fetching employees:', error);
        toast.error('Gagal memuat daftar karyawan');
        return [];
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      hrService.recordKPI({
        employee_id: formData.employee_id,
        period_month: formData.period_month,
        period_year: formData.period_year,
        sales_target_achievement: formData.sales_target_achievement
          ? parseFloat(formData.sales_target_achievement)
          : undefined,
        service_quality_score: formData.service_quality_score ? parseFloat(formData.service_quality_score) : undefined,
        customer_satisfaction: formData.customer_satisfaction ? parseFloat(formData.customer_satisfaction) : undefined,
        attendance_score: formData.attendance_score ? parseFloat(formData.attendance_score) : undefined,
        target_bonus: formData.target_bonus ? parseFloat(formData.target_bonus) : undefined,
        bonus_multiplier: formData.bonus_multiplier ? parseFloat(formData.bonus_multiplier) : undefined,
        notes: formData.notes || undefined,
      }),
    onSuccess: (data) => {
      toast.success('KPI berhasil direcord');
      queryClient.invalidateQueries({ queryKey: ['kpi-records'] });
      navigate(`/hr/kpi/${data.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal record KPI');
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.employee_id) {
      newErrors.employee_id = 'Karyawan wajib dipilih';
    }
    if (!formData.period_month || formData.period_month < 1 || formData.period_month > 12) {
      newErrors.period_month = 'Bulan tidak valid';
    }
    if (!formData.period_year || formData.period_year < 2020) {
      newErrors.period_year = 'Tahun tidak valid';
    }

    // Validate scores (0-100)
    if (formData.service_quality_score) {
      const score = parseFloat(formData.service_quality_score);
      if (score < 0 || score > 100) {
        newErrors.service_quality_score = 'Score harus antara 0-100';
      }
    }
    if (formData.customer_satisfaction) {
      const score = parseFloat(formData.customer_satisfaction);
      if (score < 0 || score > 100) {
        newErrors.customer_satisfaction = 'Score harus antara 0-100';
      }
    }
    if (formData.attendance_score) {
      const score = parseFloat(formData.attendance_score);
      if (score < 0 || score > 100) {
        newErrors.attendance_score = 'Score harus antara 0-100';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    createMutation.mutate();
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center gap-4">
          <Link
            to="/hr/kpi"
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <Target className="w-10 h-10" />
              Record KPI
            </h1>
            <p className="text-purple-100 text-lg">Formulir pencatatan KPI karyawan</p>
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
            value={formData.employee_id}
            onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
            required
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
              errors.employee_id ? 'border-red-300' : 'border-gray-300'
            }`}
          >
            <option value="">Pilih Karyawan</option>
            {isLoadingEmployees ? (
              <option value="">Memuat data karyawan...</option>
            ) : employees?.length === 0 ? (
              <option value="">Tidak ada karyawan ditemukan</option>
            ) : (
              employees?.map((user: any) => {
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
          {errors.employee_id && <p className="mt-1 text-sm text-red-600">{errors.employee_id}</p>}
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
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
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
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                errors.period_year ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.period_year && <p className="mt-1 text-sm text-red-600">{errors.period_year}</p>}
          </div>
        </div>

        {/* KPI Scores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Sales Target Achievement</label>
            <input
              type="number"
              value={formData.sales_target_achievement}
              onChange={(e) => setFormData({ ...formData, sales_target_achievement: e.target.value })}
              min="0"
              step="0.01"
              placeholder="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Service Quality Score (0-100)</label>
            <input
              type="number"
              value={formData.service_quality_score}
              onChange={(e) => setFormData({ ...formData, service_quality_score: e.target.value })}
              min="0"
              max="100"
              step="0.1"
              placeholder="0-100"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                errors.service_quality_score ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.service_quality_score && (
              <p className="mt-1 text-sm text-red-600">{errors.service_quality_score}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Customer Satisfaction (0-100)</label>
            <input
              type="number"
              value={formData.customer_satisfaction}
              onChange={(e) => setFormData({ ...formData, customer_satisfaction: e.target.value })}
              min="0"
              max="100"
              step="0.1"
              placeholder="0-100"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                errors.customer_satisfaction ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.customer_satisfaction && (
              <p className="mt-1 text-sm text-red-600">{errors.customer_satisfaction}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Attendance Score (0-100)</label>
            <input
              type="number"
              value={formData.attendance_score}
              onChange={(e) => setFormData({ ...formData, attendance_score: e.target.value })}
              min="0"
              max="100"
              step="0.1"
              placeholder="0-100"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                errors.attendance_score ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.attendance_score && <p className="mt-1 text-sm text-red-600">{errors.attendance_score}</p>}
          </div>
        </div>

        {/* Bonus */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Target Bonus</label>
            <input
              type="number"
              value={formData.target_bonus}
              onChange={(e) => setFormData({ ...formData, target_bonus: e.target.value })}
              min="0"
              step="0.01"
              placeholder="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Bonus Multiplier</label>
            <input
              type="number"
              value={formData.bonus_multiplier}
              onChange={(e) => setFormData({ ...formData, bonus_multiplier: e.target.value })}
              min="0"
              step="0.01"
              placeholder="1.0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Catatan (Opsional)</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={4}
            placeholder="Tambahkan catatan tentang KPI..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Link
            to="/hr/kpi"
            className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 text-center"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {createMutation.isPending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Record KPI
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

