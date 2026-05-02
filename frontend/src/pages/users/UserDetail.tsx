import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit,
  Shield,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
  Calendar,
  Loader2,
  Trash2,
  Plus,
} from 'lucide-react';
import { usersService } from '../../services/users.service';
import { toast } from 'sonner';
import { Modal } from '../../components/ui/modal';
import RequirePermission from '../../components/guards/RequirePermission';
import { AssignRoleModal } from './components/AssignRoleModal';

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAssignRoleModal, setShowAssignRoleModal] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', id],
    queryFn: () => usersService.getById(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => usersService.delete(id!),
    onSuccess: () => {
      toast.success('Pengguna berhasil dihapus');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      navigate('/users');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus pengguna');
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: (userRoleId: string) => usersService.removeRole(id!, userRoleId),
    onSuccess: () => {
      toast.success('Role berhasil dihapus');
      queryClient.invalidateQueries({ queryKey: ['user', id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus role');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-gray-600 mb-4">Pengguna tidak ditemukan</p>
        <Link to="/users">
          <button className="px-4 py-2 bg-primary-600 text-white rounded-lg">Kembali ke Daftar</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/users">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{user.fullName}</h1>
            <p className="text-gray-600 mt-1">Detail pengguna</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RequirePermission permission="users.update" fallbackRoles={['SUPERADMIN', 'CHR']}>
            <Link to={`/users/${user.id}/edit`}>
              <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                <Edit className="w-4 h-4" />
                Edit
              </button>
            </Link>
          </RequirePermission>
          <RequirePermission permission="users.delete" fallbackRoles={['SUPERADMIN']}>
            <button
              onClick={() => setDeleteModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Hapus
            </button>
          </RequirePermission>
        </div>
      </div>

      {/* User Info Card */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0 h-24 w-24 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-3xl shadow-md">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{user.fullName}</h2>
              <div className="flex items-center gap-2 mt-2">
                {user.isActive ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-md text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    Aktif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm font-medium">
                    <XCircle className="w-4 h-4" />
                    Non-Aktif
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-base font-medium text-gray-900">{user.email}</p>
                </div>
              </div>
              {user.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Telepon</p>
                    <p className="text-base font-medium text-gray-900">{user.phone}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Tanggal Dibuat</p>
                  <p className="text-base font-medium text-gray-900">
                    {new Date(user.createdAt).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Roles Section */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Roles & Permissions
          </h2>
          <RequirePermission permission="users.assignRole" fallbackRoles={['SUPERADMIN', 'CHR']}>
            <button
              onClick={() => setShowAssignRoleModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Assign Role
            </button>
          </RequirePermission>
        </div>

        {user.roles && user.roles.length > 0 ? (
          <div className="space-y-3">
            {user.roles.map((userRole) => {
              // Support both formats: new format (code/name directly) and legacy format (role.code/role.name)
              const roleName = userRole.name || userRole.role?.name || 'Unknown Role';
              const roleCode = userRole.code || userRole.role?.code || 'N/A';
              const branchName = userRole.branchName || userRole.branch?.name;

              return (
                <div
                  key={userRole.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-primary-600" />
                      <div>
                        <p className="font-semibold text-gray-900">{roleName}</p>
                        <p className="text-sm text-gray-500">Code: {roleCode}</p>
                        {branchName && (
                          <p className="text-xs text-gray-400 mt-1">Cabang: {branchName}</p>
                        )}
                        {userRole.validUntil && (
                          <p className="text-xs text-gray-400">
                            Berlaku hingga: {new Date(userRole.validUntil).toLocaleDateString('id-ID')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <RequirePermission permission="users.removeRole" fallbackRoles={['SUPERADMIN', 'CHR']}>
                    <button
                      onClick={() => {
                        if (confirm('Yakin ingin menghapus role ini?')) {
                          removeRoleMutation.mutate(userRole.id);
                        }
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Hapus Role"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </RequirePermission>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>Belum ada role yang ditetapkan</p>
            <RequirePermission permission="users.assignRole" fallbackRoles={['SUPERADMIN', 'CHR']}>
              <button
                onClick={() => setShowAssignRoleModal(true)}
                className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
              >
                Assign Role Sekarang
              </button>
            </RequirePermission>
          </div>
        )}
      </div>

      {/* Assign Role Modal */}
      {showAssignRoleModal && (
        <AssignRoleModal
          userId={user.id}
          onClose={() => setShowAssignRoleModal(false)}
          onSuccess={() => {
            setShowAssignRoleModal(false);
            queryClient.invalidateQueries({ queryKey: ['user', id] });
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Hapus Pengguna">
        <div className="space-y-4">
          <p className="text-gray-600">
            Apakah Anda yakin ingin menghapus pengguna <strong>{user.fullName}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            Tindakan ini tidak dapat dibatalkan. Semua data pengguna akan dihapus secara permanen.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteMutation.isPending ? 'Menghapus...' : 'Hapus'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

