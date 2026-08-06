import { useParams, Link } from 'react-router-dom';
import { BreadcrumbHeader } from '@/components/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, AlertCircle } from 'lucide-react';
import { hrService } from '@/services/hr.service';
import { formatCurrency } from '@/utils/format';
import { toast } from 'sonner';
import { useState } from 'react';

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function KPIDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const currentUser = getCurrentUser();
  const userRoles: string[] = currentUser?.roles || (currentUser?.role?.code ? [currentUser.role.code] : []);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({
    sales_target_achievement: '',
    service_quality_score: '',
    customer_satisfaction: '',
    attendance_score: '',
    overall_score: '',
    calculated_bonus: '',
    notes: '',
  });

  const { data: kpiRecord, isLoading, error } = useQuery({
    queryKey: ['kpi-record', id],
    queryFn: () => hrService.getKPI(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      hrService.updateKPIScore(id!, {
        sales_target_achievement: editData.sales_target_achievement
          ? parseFloat(editData.sales_target_achievement)
          : undefined,
        service_quality_score: editData.service_quality_score ? parseFloat(editData.service_quality_score) : undefined,
        customer_satisfaction: editData.customer_satisfaction ? parseFloat(editData.customer_satisfaction) : undefined,
        attendance_score: editData.attendance_score ? parseFloat(editData.attendance_score) : undefined,
        overall_score: editData.overall_score ? parseFloat(editData.overall_score) : undefined,
        calculated_bonus: editData.calculated_bonus ? parseFloat(editData.calculated_bonus) : undefined,
        notes: editData.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('KPI berhasil diupdate');
      queryClient.invalidateQueries({ queryKey: ['kpi-record', id] });
      queryClient.invalidateQueries({ queryKey: ['kpi-records'] });
      setShowEditModal(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal update KPI');
    },
  });

  const canEdit = userRoles.some((r) => ['HS', 'SPV', 'CHR'].includes(r));

  if (isLoading) {
    return (
      <div className="w-full space-y-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <p className="mt-4 text-gray-600">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (error || !kpiRecord) {
    return (
      <div className="w-full space-y-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">Gagal memuat data KPI</p>
          <Link to="/hr/kpi" className="mt-4 text-purple-600 hover:underline">
            Kembali ke daftar
          </Link>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
          Excellent
        </span>
      );
    }
    if (score >= 60) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800">
          Good
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
        Needs Improvement
      </span>
    );
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <BreadcrumbHeader title="Detail KPI" subtitle={<>{kpiRecord.employee?.user?.fullName || kpiRecord.employee?.employeeCode || 'N/A'} -{' '} {new Date(2000, kpiRecord.periodMonth - 1).toLocaleString('id-ID', { month: 'long' })}{' '} {kpiRecord.periodYear}</>}>
        {canEdit && (
            <button
              onClick={() => {
                setEditData({
                  sales_target_achievement: kpiRecord.salesTargetAchievement?.toString() || '',
                  service_quality_score: kpiRecord.serviceQualityScore?.toString() || '',
                  customer_satisfaction: kpiRecord.customerSatisfaction?.toString() || '',
                  attendance_score: kpiRecord.attendanceScore?.toString() || '',
                  overall_score: kpiRecord.overallScore.toString(),
                  calculated_bonus: kpiRecord.calculatedBonus?.toString() || '',
                  notes: kpiRecord.notes || '',
                });
                setShowEditModal(true);
              }}
              className="px-4 py-2 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
      </BreadcrumbHeader>

      {/* Employee & Period Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Informasi Karyawan</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Nama</p>
              <p className="text-base font-semibold text-gray-900">
                {kpiRecord.employee?.user?.fullName || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Employee Code</p>
              <p className="text-base font-semibold text-gray-900">{kpiRecord.employee?.employeeCode || 'N/A'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Periode</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Bulan & Tahun</p>
              <p className="text-base font-semibold text-gray-900">
                {new Date(2000, kpiRecord.periodMonth - 1).toLocaleString('id-ID', { month: 'long' })}{' '}
                {kpiRecord.periodYear}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Overall Score</p>
              <div className="mt-1">
                <p className={`text-3xl font-bold ${getScoreColor(kpiRecord.overallScore)}`}>
                  {kpiRecord.overallScore.toFixed(1)}
                </p>
                {getScoreBadge(kpiRecord.overallScore)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Scores */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Detail Score</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Sales Target Achievement</p>
              <p className="text-xl font-bold text-gray-900">
                {kpiRecord.salesTargetAchievement ? formatCurrency(kpiRecord.salesTargetAchievement) : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Service Quality Score</p>
              <p className="text-xl font-bold text-gray-900">
                {kpiRecord.serviceQualityScore ? kpiRecord.serviceQualityScore.toFixed(1) : '-'}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Customer Satisfaction</p>
              <p className="text-xl font-bold text-gray-900">
                {kpiRecord.customerSatisfaction ? kpiRecord.customerSatisfaction.toFixed(1) : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Attendance Score</p>
              <p className="text-xl font-bold text-gray-900">
                {kpiRecord.attendanceScore ? kpiRecord.attendanceScore.toFixed(1) : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bonus Info */}
      {(kpiRecord.targetBonus || kpiRecord.calculatedBonus) && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Bonus</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {kpiRecord.targetBonus && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Target Bonus</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(kpiRecord.targetBonus)}</p>
              </div>
            )}
            {kpiRecord.calculatedBonus && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Calculated Bonus</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(kpiRecord.calculatedBonus)}</p>
              </div>
            )}
            {kpiRecord.bonusMultiplier && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Multiplier</p>
                <p className="text-2xl font-bold text-gray-900">x{kpiRecord.bonusMultiplier.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {kpiRecord.notes && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Catatan</h2>
          <p className="text-base text-gray-900">{kpiRecord.notes}</p>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Edit KPI Score</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Sales Target Achievement</label>
                  <input
                    type="number"
                    value={editData.sales_target_achievement}
                    onChange={(e) => setEditData({ ...editData, sales_target_achievement: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Service Quality Score</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={editData.service_quality_score}
                    onChange={(e) => setEditData({ ...editData, service_quality_score: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Customer Satisfaction</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={editData.customer_satisfaction}
                    onChange={(e) => setEditData({ ...editData, customer_satisfaction: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Attendance Score</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={editData.attendance_score}
                    onChange={(e) => setEditData({ ...editData, attendance_score: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Overall Score</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={editData.overall_score}
                    onChange={(e) => setEditData({ ...editData, overall_score: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Calculated Bonus</label>
                  <input
                    type="number"
                    value={editData.calculated_bonus}
                    onChange={(e) => setEditData({ ...editData, calculated_bonus: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Catatan</label>
                <textarea
                  value={editData.notes}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Tambahkan catatan..."
                />
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending || !editData.overall_score}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

