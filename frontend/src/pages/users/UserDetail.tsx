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
  AlertTriangle,
} from 'lucide-react';
import { usersService } from '../../services/users.service';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import RequirePermission from '../../components/guards/RequirePermission';
import { AssignRoleModal } from './components/AssignRoleModal';

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAssignRoleModal, setShowAssignRoleModal] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [roleToRemove, setRoleToRemove] = useState<{ id: string; name: string } | null>(null);

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
      setRoleToRemove(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus role');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground mb-4">Pengguna tidak ditemukan</p>
        <Button asChild>
          <Link to="/users">Kembali ke Daftar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={user.fullName} subtitle="Detail pengguna">
        <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/20">
          <Link to="/users">
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Link>
        </Button>
        <RequirePermission permission="users.update" fallbackRoles={['SUPERADMIN', 'CHR']}>
          <Button asChild size="sm" className="bg-white text-primary-600 hover:bg-primary-50 font-semibold">
            <Link to={`/users/${user.id}/edit`}>
              <Edit className="w-4 h-4" />
              Edit
            </Link>
          </Button>
        </RequirePermission>
        <RequirePermission permission="users.delete" fallbackRoles={['SUPERADMIN']}>
          <Button
            variant="destructive"
            size="sm"
            className="font-semibold"
            onClick={() => setDeleteModalOpen(true)}
          >
            <Trash2 className="w-4 h-4" />
            Hapus
          </Button>
        </RequirePermission>
      </PageHeader>

      {/* User Info Card */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0 h-20 w-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-3xl shadow-md">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{user.fullName}</h2>
              <div className="flex items-center gap-2 mt-2">
                {user.isActive ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 border border-green-200 rounded-lg text-sm font-semibold">
                    <CheckCircle className="w-4 h-4" />
                    Aktif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded-lg text-sm font-semibold">
                    <XCircle className="w-4 h-4" />
                    Non-Aktif
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="text-base font-medium text-gray-900">{user.email}</p>
                </div>
              </div>
              {user.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Telepon</p>
                    <p className="text-base font-medium text-gray-900">{user.phone}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Tanggal Dibuat</p>
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
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary-600" />
            Roles & Permissions
          </h2>
          <RequirePermission permission="users.assignRole" fallbackRoles={['SUPERADMIN', 'CHR']}>
            <Button size="sm" onClick={() => setShowAssignRoleModal(true)}>
              <Plus className="w-4 h-4" />
              Assign Role
            </Button>
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
                        <p className="text-sm text-muted-foreground">Code: {roleCode}</p>
                        {branchName && (
                          <p className="text-xs text-muted-foreground mt-1">Cabang: {branchName}</p>
                        )}
                        {userRole.validUntil && (
                          <p className="text-xs text-muted-foreground">
                            Berlaku hingga: {new Date(userRole.validUntil).toLocaleDateString('id-ID')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <RequirePermission permission="users.removeRole" fallbackRoles={['SUPERADMIN', 'CHR']}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:bg-red-50"
                      title="Hapus Role"
                      onClick={() => setRoleToRemove({ id: userRole.id, name: roleName })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </RequirePermission>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
            <p>Belum ada role yang ditetapkan</p>
            <RequirePermission permission="users.assignRole" fallbackRoles={['SUPERADMIN', 'CHR']}>
              <Button
                variant="link"
                className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
                onClick={() => setShowAssignRoleModal(true)}
              >
                Assign Role Sekarang
              </Button>
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

      {/* Remove Role Dialog */}
      <Dialog
        open={!!roleToRemove}
        onOpenChange={(open) => {
          if (!open) setRoleToRemove(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 p-2 bg-red-100 rounded-full">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-sm text-gray-700">
                Yakin ingin menghapus role <strong>{roleToRemove?.name}</strong> dari pengguna ini?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setRoleToRemove(null)}
                disabled={removeRoleMutation.isPending}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => roleToRemove && removeRoleMutation.mutate(roleToRemove.id)}
                disabled={removeRoleMutation.isPending}
              >
                {removeRoleMutation.isPending ? (
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
                  Apakah Anda yakin ingin menghapus pengguna <strong>{user.fullName}</strong>?
                </p>
                <p className="text-xs text-gray-500">
                  Tindakan ini tidak dapat dibatalkan. Semua data pengguna akan dihapus secara permanen.
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
