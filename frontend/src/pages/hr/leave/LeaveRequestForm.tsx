import { useState } from 'react';
import { BreadcrumbHeader } from '@/components/shared';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Paperclip, Loader2 } from 'lucide-react';
import { hrService } from '@/services/hr.service';
import { leaveTypesService, type LeaveType } from '@/services/leave-types.service';
import { toast } from 'sonner';

export default function LeaveRequestForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // IGDERP-308: self-service lookup — no HR role required (junior-safe).
  const { data: leaveTypesData } = useQuery({
    queryKey: ['leave-types-active'],
    queryFn: () => leaveTypesService.getActiveOptions(),
  });
  const leaveTypes: LeaveType[] = Array.isArray(leaveTypesData) ? leaveTypesData : [];

  const [formData, setFormData] = useState({
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: '',
    attachment_url: '',
  });
  const [uploading, setUploading] = useState(false);

  const selectedType = leaveTypes.find((t) => t.code === formData.leave_type);
  const needsAttachment = !!selectedType?.requiresAttachment;

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = {
        leave_type: formData.leave_type,
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason,
      };
      if (formData.attachment_url) payload.attachment_url = formData.attachment_url;
      return hrService.requestLeave(payload as any);
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
    if (!formData.leave_type) {
      newErrors.leave_type = 'Tipe cuti wajib dipilih';
    }
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
    if (needsAttachment && !formData.attachment_url) {
      newErrors.attachment_url = `Lampiran wajib untuk ${selectedType?.name}`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    createMutation.mutate();
  };

  const handleAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setUploading(true);
    try {
      const { url } = await hrService.uploadLeaveAttachment(f);
      setFormData({ ...formData, attachment_url: url });
      toast.success('Lampiran terunggah');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal mengunggah lampiran');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <BreadcrumbHeader title="Ajukan Cuti" subtitle="Formulir permohonan cuti" />

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6 space-y-6">
        {/* Leave Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Tipe Cuti <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <select
            value={formData.leave_type}
            onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
            className="w-full px-4 py-3 border text-base border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="">Pilih tipe cuti...</option>
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.code}>
                {t.name}
                {t.isPaid && t.quotaDays ? ` (${t.quotaDays} hari/thn)` : t.isPaid ? '' : ' (tanpa gaji)'}
              </option>
            ))}
          </select>
          {errors.leave_type && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.leave_type}</p>}
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Tanggal Mulai <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                errors.start_date ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {errors.start_date && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.start_date}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Tanggal Selesai <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              min={formData.start_date}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                errors.end_date ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {errors.end_date && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.end_date}</p>}
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Alasan <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <textarea
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            rows={4}
            className={`w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-green-500 focus:border-transparent ${
              errors.reason ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="Masukkan alasan cuti..."
          />
          {errors.reason && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.reason}</p>}
        </div>

        {/* Attachment — mandatory when the leave type requires it (IGDERP-275) */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Lampiran {needsAttachment ? <span className="text-red-500 dark:text-red-400">*</span> : <span className="font-normal text-gray-500">(opsional)</span>}
          </label>
          {formData.attachment_url ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <Paperclip className="w-5 h-5 text-green-600 shrink-0" />
              <a href={formData.attachment_url} target="_blank" rel="noreferrer" className="flex-1 text-sm text-green-800 dark:text-green-200 underline truncate">
                Lampiran terunggah — lihat
              </a>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, attachment_url: '' })}
                className="text-sm font-semibold text-gray-500 underline"
              >
                Ganti
              </button>
            </div>
          ) : (
            <label className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 flex items-center justify-center gap-2 font-semibold cursor-pointer active:bg-gray-50 dark:active:bg-gray-800">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
              {uploading ? 'Mengunggah...' : 'Ketuk untuk lampirkan foto / PDF'}
              <input type="file" accept="image/*,.pdf" className="hidden" disabled={uploading} onChange={handleAttachment} />
            </label>
          )}
          {errors.attachment_url && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.attachment_url}</p>}
          {needsAttachment && !formData.attachment_url && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Cth: surat dokter untuk Sakit, dokumen pendukung untuk Darurat.</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Link
            to="/hr/leave"
            className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-center"
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

