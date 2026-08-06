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
  AlertTriangle,
} from 'lucide-react';
import { usersService } from '../../services/users.service';
import { toast } from 'sonner';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import RequirePermission from '../../components/guards/RequirePermission';
import { labelForPermission } from '../../utils/permissionLabels';

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
      <BreadcrumbHeader title={user.fullName} subtitle="Detail pengguna">
        <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/20">
          <Link to="/users">
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Link>
        </Button>
        <RequirePermission permission="users.update" fallbackRoles={['SUPERADMIN', 'CHR']}>
          <Button size="sm" className="bg-white text-primary-600 hover:bg-primary-50 font-semibold" onClick={() => navigate(`/users?edit=${user.id}`)}>
            <Edit className="w-4 h-4" />
            Edit User
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
      </BreadcrumbHeader>

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

      {/* Roles Section — read-only (edit via modal) */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary-600" />
            Penugasan Cabang &amp; Role
          </h2>
          <span className="text-xs text-gray-400">klik Edit User untuk mengubah</span>
        </div>

        {user.roles && user.roles.length > 0 ? (
          <div className="space-y-3">
            {user.roles.map((userRole) => {
              const roleName = userRole.name || userRole.role?.name || 'Unknown Role';
              const roleCode = userRole.code || userRole.role?.code || 'N/A';
              const branchName = userRole.branchName || userRole.branch?.name;
              const denies: string[] = (userRole as any).deniedPermissions || [];

              return (
                <div key={userRole.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Shield className="w-4 h-4 text-primary-600" />
                        <p className="font-semibold text-gray-900">{roleName}</p>
                        <span className="text-xs font-mono text-gray-400">{roleCode}</span>
                        {userRole.isPrimary && (
                          <span className="text-[10px] bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-md font-semibold">
                            Primary
                          </span>
                        )}
                      </div>
                      {branchName && (
                        <p className="text-xs text-muted-foreground mt-1">Outlet: {branchName}</p>
                      )}
                      {!branchName && (
                        <p className="text-xs text-muted-foreground mt-1 italic">Semua cabang (global)</p>
                      )}
                    </div>
                  </div>
                  {denies.length > 0 && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-gray-500 font-medium">Ditolak (deny-only):</span>
                      {denies.map((k) => (
                        <span
                          key={k}
                          className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-md flex flex-col leading-tight"
                          title={k}
                        >
                          <span className="text-[11px] font-semibold">{labelForPermission(k)}</span>
                          <span className="text-[10px] font-mono text-red-400">{k}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
            <p>Belum ada penugasan</p>
          </div>
        )}
      </div>

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
