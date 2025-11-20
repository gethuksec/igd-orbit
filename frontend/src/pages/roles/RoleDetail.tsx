import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit,
  Shield,
  CheckCircle,
  XCircle,
  Calendar,
  Loader2,
  Trash2,
  Save,
} from 'lucide-react';
import { rolesService, permissionsService } from '../../services/roles.service';
import { toast } from 'sonner';
import { Modal } from '../../components/ui/modal';
import RequirePermission from '../../components/guards/RequirePermission';
import { PermissionTree } from './components/PermissionTree';

export default function RoleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const { data: role, isLoading, error } = useQuery({
    queryKey: ['role', id],
    queryFn: () => rolesService.getById(id!),
    enabled: !!id,
  });

  const { data: permissionGroups } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => permissionsService.getAll(),
  });

  const { data: rolePermissions } = useQuery({
    queryKey: ['role-permissions', id],
    queryFn: () => rolesService.getPermissions(id!),
    enabled: !!id,
  });

  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  // Update selected permissions when rolePermissions loads
  useEffect(() => {
    if (rolePermissions) {
      setSelectedPermissions(new Set(rolePermissions.map((p) => p.id)));
    }
  }, [rolePermissions]);

  const deleteMutation = useMutation({
    mutationFn: () => rolesService.delete(id!),
    onSuccess: () => {
      toast.success('Role berhasil dihapus');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      navigate('/roles');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus role');
    },
  });

  const savePermissionsMutation = useMutation({
    mutationFn: async () => {
      if (!rolePermissions) return;

      const currentPermissionIds = new Set(rolePermissions.map((p) => p.id));
      const toAdd = Array.from(selectedPermissions).filter((id) => !currentPermissionIds.has(id));
      const toRemove = Array.from(currentPermissionIds).filter((id) => !selectedPermissions.has(id));

      // Add new permissions
      for (const permissionId of toAdd) {
        await rolesService.assignPermission(id!, permissionId);
      }

      // Remove permissions
      for (const permissionId of toRemove) {
        await rolesService.removePermission(id!, permissionId);
      }
    },
    onSuccess: () => {
      toast.success('Permissions berhasil diupdate');
      queryClient.invalidateQueries({ queryKey: ['role-permissions', id] });
      queryClient.invalidateQueries({ queryKey: ['role', id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal mengupdate permissions');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error || !role) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-gray-600 mb-4">Role tidak ditemukan</p>
        <Link to="/roles">
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
          <Link to="/roles">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{role.name}</h1>
            <p className="text-gray-600 mt-1">Detail role dan permissions</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RequirePermission permission="roles.update" fallbackRoles={['SUPERADMIN']}>
            <Link to={`/roles/${role.id}/edit`}>
              <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                <Edit className="w-4 h-4" />
                Edit
              </button>
            </Link>
          </RequirePermission>
          <RequirePermission permission="roles.delete" fallbackRoles={['SUPERADMIN']}>
            {!role.isSystem && (
              <button
                onClick={() => setDeleteModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Hapus
              </button>
            )}
          </RequirePermission>
        </div>
      </div>

      {/* Role Info Card */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0 h-24 w-24 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <Shield className="w-12 h-12" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{role.name}</h2>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-sm text-gray-500 font-mono">{role.code}</span>
                {role.isActive ? (
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
                {role.isSystem && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm font-medium">
                    System Role
                  </span>
                )}
              </div>
            </div>

            {role.description && (
              <div>
                <p className="text-sm text-gray-500">Deskripsi</p>
                <p className="text-base text-gray-900">{role.description}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Tanggal Dibuat</p>
                <p className="text-base font-medium text-gray-900">
                  {new Date(role.createdAt).toLocaleDateString('id-ID', {
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

      {/* Permissions Section */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Permissions
          </h2>
          <RequirePermission permission="roles.assignPermission" fallbackRoles={['SUPERADMIN']}>
            <button
              onClick={() => savePermissionsMutation.mutate()}
              disabled={savePermissionsMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savePermissionsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Simpan Permissions
                </>
              )}
            </button>
          </RequirePermission>
        </div>

        {permissionGroups && permissionGroups.length > 0 ? (
          <PermissionTree
            permissionGroups={permissionGroups}
            selectedPermissions={selectedPermissions}
            onPermissionToggle={(permissionId) => {
              const newSelected = new Set(selectedPermissions);
              if (newSelected.has(permissionId)) {
                newSelected.delete(permissionId);
              } else {
                newSelected.add(permissionId);
              }
              setSelectedPermissions(newSelected);
            }}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>Belum ada permissions tersedia</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Hapus Role">
        <div className="space-y-4">
          <p className="text-gray-600">
            Apakah Anda yakin ingin menghapus role <strong>{role.name}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            Tindakan ini tidak dapat dibatalkan. Semua data role akan dihapus secara permanen.
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

