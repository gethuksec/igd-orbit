import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Save } from 'lucide-react';
import { hrService } from '@/services/hr.service';
import { toast } from 'sonner';

export default function LeaveRequestForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    leave_type: 'annual' as 'annual' | 'sick' | 'emergency' | 'unpaid',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: () => {
      return hrService.requestLeave({
        ...formData,
      });
    },
    onSuccess: () => {
      toast.success('Permohonan cuti berhasil diajukan');
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      navigate('/hr/leave');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal mengajukan cuti');
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
    if (!formData.start_date) {
      newErrors.start_date = 'Tanggal mulai wajib diisi';
    }
    if (!formData.end_date) {
      newErrors.end_date = 'Tanggal selesai wajib diisi';
    }
    if (formData.start_date && formData.end_date && new Date(formData.start_date) > new Date(formData.end_date)) {
      newErrors.end_date = 'Tanggal selesai harus setelah tanggal mulai';
    }
    if (!formData.reason.trim()) {
      newErrors.reason = 'Alasan wajib diisi';
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
            to="/hr/leave"
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <Calendar className="w-10 h-10" />
              Ajukan Cuti
            </h1>
            <p className="text-green-100 text-lg">Formulir permohonan cuti</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-6">
        {/* Leave Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Tipe Cuti <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.leave_type}
            onChange={(e) => setFormData({ ...formData, leave_type: e.target.value as any })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="annual">Cuti Tahunan</option>
            <option value="sick">Sakit</option>
            <option value="emergency">Darurat</option>
            <option value="unpaid">Tanpa Gaji</option>
          </select>
          {errors.leave_type && <p className="mt-1 text-sm text-red-600">{errors.leave_type}</p>}
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tanggal Mulai <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                errors.start_date ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.start_date && <p className="mt-1 text-sm text-red-600">{errors.start_date}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tanggal Selesai <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              min={formData.start_date}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                errors.end_date ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.end_date && <p className="mt-1 text-sm text-red-600">{errors.end_date}</p>}
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Alasan <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            rows={4}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
              errors.reason ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Masukkan alasan cuti..."
          />
          {errors.reason && <p className="mt-1 text-sm text-red-600">{errors.reason}</p>}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Link
            to="/hr/leave"
            className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 text-center"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {createMutation.isPending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Mengajukan...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Ajukan Cuti
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

