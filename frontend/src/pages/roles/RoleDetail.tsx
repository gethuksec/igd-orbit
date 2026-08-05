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
  AlertTriangle,
} from 'lucide-react';
import { rolesService, permissionsService } from '../../services/roles.service';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import RequirePermission from '../../components/guards/RequirePermission';
import { PermissionTree } from './components/PermissionTree';
import { usePermissions } from '../../hooks/usePermissions';
import { MenuAccessSelector } from './components/MenuAccessSelector';

export default function RoleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const { userRoles } = usePermissions();
  const isSuperAdmin = userRoles.includes('SUPERADMIN');

  const { data: role, isLoading, error } = useQuery({
    queryKey: ['role', id],
    queryFn: () => rolesService.getById(id!),
    enabled: !!id,
  });

  const { data: groupedPermissions } = useQuery({
    queryKey: ['permissions-grouped'],
    queryFn: () => permissionsService.getAllGrouped(),
  });

  const { data: rolePermissionsData } = useQuery({
    queryKey: ['role-permissions', id],
    queryFn: () => rolesService.getPermissions(id!),
    enabled: !!id,
  });

  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  // Update selected permissions when rolePermissions loads
  useEffect(() => {
    if (rolePermissionsData?.permissions) {
      // Backend returns: { permissions: Array<{ id, module, submodule, action, ... }> }
      setSelectedPermissions(
        new Set(rolePermissionsData.permissions.map((p: any) => p.id)),
      );
    }
  }, [rolePermissionsData]);

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
      if (!rolePermissionsData?.permissions) return;

      const currentPermissionIds = new Set(rolePermissionsData.permissions.map((p: any) => p.id));
      const toAdd = Array.from(selectedPermissions).filter((id) => !currentPermissionIds.has(id));
      const toRemove = Array.from(currentPermissionIds).filter((id) => !selectedPermissions.has(id));

      // Add new permissions
      for (const permissionId of toAdd) {
        await rolesService.assignPermission(id!, { permissionId });
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error || !role) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground mb-4">Role tidak ditemukan</p>
        <Button asChild>
          <Link to="/roles">Kembali ke Daftar</Link>
        </Button>
      </div>
    );
  }

  // D-SEC: SUPERADMIN role is immutable — view-only page
  const isSuperAdminRole = role.code === 'SUPERADMIN';

  return (
    <div className="space-y-6">
      <PageHeader title={role.name} subtitle="Detail role dan permissions">
        <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/20">
          <Link to="/roles">
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Link>
        </Button>
        <RequirePermission permission="roles.update" fallbackRoles={['SUPERADMIN']}>
          {!isSuperAdminRole && (
            <Button asChild size="sm" className="bg-white text-primary-600 hover:bg-primary-50 font-semibold">
              <Link to={`/roles/${role.id}/edit`}>
                <Edit className="w-4 h-4" />
                Edit
              </Link>
            </Button>
          )}
        </RequirePermission>
        <RequirePermission permission="roles.delete" fallbackRoles={['SUPERADMIN']}>
          {!isSuperAdminRole && (!role.isSystemRole || isSuperAdmin) && (
            <Button
              variant="destructive"
              size="sm"
              className="font-semibold"
              onClick={() => setDeleteModalOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
              Hapus
            </Button>
          )}
        </RequirePermission>
      </PageHeader>

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
                {role.isSystemRole && (
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

      {/* Menu Access Section — hidden for immutable SUPERADMIN role */}
      {!isSuperAdminRole && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5" />
            Menu Access
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Pilih menu dan halaman yang boleh diakses oleh role ini
          </p>
          <MenuAccessSelector roleId={role.id} />
        </div>
      )}

      {/* Permissions Section — hidden for immutable SUPERADMIN role */}
      {!isSuperAdminRole && (
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

          {groupedPermissions && Object.keys(groupedPermissions).length > 0 ? (
            <PermissionTree
              permissions={groupedPermissions}
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
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          if (!open) setDeleteModalOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Hapus</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 p-2 bg-red-100 rounded-full">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-700 mb-2">
                  Apakah Anda yakin ingin menghapus role <strong>{role.name}</strong>?
                </p>
                <p className="text-xs text-gray-500">
                  Tindakan ini tidak dapat dibatalkan. Semua data role akan dihapus secara permanen.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleteMutation.isPending}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Menghapus...
                  </>
                ) : (
                  'Hapus'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

