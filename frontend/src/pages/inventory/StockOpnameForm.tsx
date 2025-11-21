import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2, ClipboardCheck, Calendar } from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { useBranchStore } from '@/stores/branchStore';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useQuery } from '@tanstack/react-query';

export default function StockOpnameForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentBranchId } = useBranchStore();

  const [formData, setFormData] = useState({
    branchId: currentBranchId || '',
    opnameDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches');
      return res.data.data || res.data;
    },
  });

  const mutation = useMutation({
    mutationFn: (data: any) => inventoryService.startOpname(data),
    onSuccess: (opname) => {
      toast.success('Stock opname berhasil dimulai');
      queryClient.invalidateQueries({ queryKey: ['inventory-opnames'] });
      navigate(`/inventory/opname/${opname.id}/count`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal memulai stock opname');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.branchId) {
      toast.error('Pilih cabang');
      return;
    }

    mutation.mutate({
      branchId: formData.branchId,
      opnameDate: formData.opnameDate,
      notes: formData.notes || undefined,
    });
  };

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/inventory/opname')}
              className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold mb-1">Mulai Stock Opname</h1>
              <p className="text-primary-100">Buat stock opname baru untuk cabang</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Form */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary-600" />
            Informasi Opname
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cabang <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.branchId}
                onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              >
                <option value="">Pilih Cabang</option>
                {branches?.map((branch: any) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tanggal Opname <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  value={formData.opnameDate}
                  onChange={(e) => setFormData({ ...formData, opnameDate: e.target.value })}
                  className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Catatan</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Tambahkan catatan untuk opname ini..."
              />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-2">Informasi</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Stock opname akan membuat daftar semua produk dengan stok di cabang yang dipilih</li>
            <li>Setelah dibuat, Anda akan diarahkan ke halaman perhitungan untuk mencatat stok fisik</li>
            <li>Pastikan tidak ada opname aktif untuk cabang yang sama</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/inventory/opname')}
            className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg font-semibold hover:from-primary-700 hover:to-primary-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memulai...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Mulai Opname</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

