import { useState } from 'react';
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
  AlertTriangle,
  KeyRound,
  Users,
} from 'lucide-react';
import { rolesService } from '../../services/roles.service';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import RequirePermission from '../../components/guards/RequirePermission';
import { usePermissions } from '../../hooks/usePermissions';

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
            <>
              <Button asChild size="sm" className="bg-white text-primary-600 hover:bg-primary-50 font-semibold">
                <Link to={`/roles/${role.id}/permissions`}>
                  <KeyRound className="w-4 h-4" />
                  Kelola Hak Default
                </Link>
              </Button>
              <Button size="sm" className="bg-white text-primary-600 hover:bg-primary-50 font-semibold" onClick={() => navigate(`/roles?edit=${role.id}`)}>
                <Edit className="w-4 h-4" />
                Edit
              </Button>
            </>
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

      {/* D4: Users with this role */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary-600" />
            Pengguna dengan role ini
          </h3>
          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-md font-semibold text-gray-600">
            {role.userCount ?? 0} user
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-2.5 text-left text-[11px] font-bold uppercase text-gray-500">Nama</th>
                <th className="px-6 py-2.5 text-left text-[11px] font-bold uppercase text-gray-500">Email</th>
                <th className="px-6 py-2.5 text-left text-[11px] font-bold uppercase text-gray-500">Outlet</th>
                <th className="px-6 py-2.5 text-left text-[11px] font-bold uppercase text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(() => {
                const ub: Array<{
                  user: { id: string; fullName: string | null; email: string; isActive: boolean };
                  branch: { id: string; code: string; name: string } | null;
                  isPrimary: boolean;
                }> = (role as any).userBranches || [];
                // Dedupe by user, join branch names
                const byUser = new Map<string, { user: typeof ub[0]['user']; branches: string[] }>();
                for (const row of ub) {
                  if (!byUser.has(row.user.id)) {
                    byUser.set(row.user.id, { user: row.user, branches: [] });
                  }
                  if (row.branch) {
                    byUser.get(row.user.id)!.branches.push(`${row.branch.name} (${row.branch.code})`);
                  }
                }
                return [...byUser.values()].map(({ user, branches }) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-semibold text-gray-800">
                      {user.fullName || '-'}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">{user.email}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {branches.length > 0 ? branches.join(', ') : <span className="italic">-</span>}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">
                          <CheckCircle className="w-3 h-3" /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold">
                          <XCircle className="w-3 h-3" /> Non-Aktif
                        </span>
                      )}
                    </td>
                  </tr>
                ));
              })()}
              {((role as any).userBranches?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">
                    Belum ada pengguna dengan role ini
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
