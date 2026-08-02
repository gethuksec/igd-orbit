import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, Edit, Trash2, Shield, CheckCircle, XCircle, Loader2, Network, AlertTriangle, KeyRound } from 'lucide-react';
import { rolesService } from '../../services/roles.service';
import { toast } from 'sonner';
import { PageHeader, StatCard, SearchFilter, DataTable } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import RequirePermission from '../../components/guards/RequirePermission';
import { usePermissions } from '../../hooks/usePermissions';
import { RoleHierarchyTree } from './components/RoleHierarchyTree';

export default function RoleList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<10 | 20 | 50 | 100>(20);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<{ id: string; name: string } | null>(null);
  const [hierarchyModalOpen, setHierarchyModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { userRoles } = usePermissions();
  const isSuperAdmin = userRoles.includes('SUPERADMIN');

  // Query for paginated roles
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['roles', page, limit, searchTerm],
    queryFn: () =>
      rolesService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
      }),
  });

  // Query for active roles statistics (fetch all active roles to get accurate count)
  const { data: activeRolesData } = useQuery({
    queryKey: ['roles-active-stats'],
    queryFn: () =>
      rolesService.getAll({
        page: 1,
        limit: 1000,
        isActive: true,
      }),
    enabled: !searchTerm,
  });

  useEffect(() => {
    if (error && (error as any).response?.status === 403) {
      toast.error('Akses ditolak. Anda tidak memiliki izin untuk melihat daftar role.');
    }
  }, [error]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const roles = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  // Calculate active roles count: use stats data if available, otherwise fallback to current page data
  const activeRolesCount = searchTerm
    ? roles.filter((r) => r.isActive).length
    : (activeRolesData?.meta?.total ?? roles.filter((r) => r.isActive).length);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rolesService.delete(id),
    onSuccess: () => {
      toast.success('Role berhasil dihapus');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setDeleteModalOpen(false);
      setRoleToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus role');
    },
  });

  const systemRoleCount = roles.filter((r) => r.isSystemRole).length;

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Kode & Nama',
      cell: (role) => (
        <Link to={`/roles/${role.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center text-white shadow-sm">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground hover:text-primary-600 transition-colors">
              {role.name}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 font-mono">{role.code}</div>
            {role.isSystemRole && (
              <div className="text-xs text-primary-600 mt-0.5 font-medium">System Role</div>
            )}
          </div>
        </Link>
      ),
    },
    {
      key: 'description',
      header: 'Deskripsi',
      cell: (role) => (
        <div className="text-sm text-muted-foreground">
          {role.description || <span className="italic">-</span>}
        </div>
      ),
    },
    {
      key: 'permissions',
      header: 'Permissions',
      cell: (role) =>
        role.permissions && role.permissions.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
            <KeyRound className="w-4 h-4 text-muted-foreground" />
            {role.permissions.length} permissions
          </span>
        ) : (
          <span className="text-muted-foreground italic text-sm">0 permissions</span>
        ),
    },
    {
      key: 'isActive',
      header: 'Status',
      cell: (role) =>
        role.isActive ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 border border-green-200 rounded-lg text-xs font-semibold">
            <CheckCircle className="w-3 h-3" />
            Aktif
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded-lg text-xs font-semibold">
            <XCircle className="w-3 h-3" />
            Non-Aktif
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Manajemen Role" subtitle="Kelola role dan permissions">
        <Button
          variant="secondary"
          size="sm"
          className="font-semibold"
          onClick={() => setHierarchyModalOpen(true)}
        >
          <Network className="w-4 h-4" />
          Lihat Hierarki
        </Button>
        <RequirePermission permission="roles.create" fallbackRoles={['SUPERADMIN']}>
          <Button asChild size="sm" className="bg-white text-primary-600 hover:bg-primary-50 font-semibold">
            <Link to="/roles/new">
              <Plus className="w-4 h-4" />
              Tambah Role
            </Link>
          </Button>
        </RequirePermission>
      </PageHeader>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<Shield className="w-6 h-6 text-white" />}
          label="Total Role"
          value={isLoading ? '-' : pagination.total}
          subtitle="Semua role terdaftar"
        />
        <StatCard
          icon={<CheckCircle className="w-6 h-6 text-white" />}
          iconBg="from-green-500 to-green-600"
          label="Role Aktif"
          value={isLoading ? '-' : activeRolesCount}
          subtitle="Role yang aktif saat ini"
        />
        <StatCard
          icon={<XCircle className="w-6 h-6 text-white" />}
          iconBg="from-gray-500 to-gray-600"
          label="System Role"
          value={isLoading ? '-' : systemRoleCount}
          subtitle="Role sistem"
        />
      </div>

      {/* Search & Filter */}
      <SearchFilter
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama atau kode role..."
      />

      {/* Role Table */}
      <DataTable
        columns={columns}
        data={roles}
        keyExtractor={(role) => role.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada role ditemukan"
        emptyIcon={<Shield className="w-16 h-16" />}
        actions={(role) => (
          <>
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" title="Lihat Detail">
              <Link to={`/roles/${role.id}`}>
                <Eye className="w-4 h-4" />
              </Link>
            </Button>
            <RequirePermission permission="roles.update" fallbackRoles={['SUPERADMIN']}>
              <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50" title="Edit">
                <Link to={`/roles/${role.id}/edit`}>
                  <Edit className="w-4 h-4" />
                </Link>
              </Button>
            </RequirePermission>
            <RequirePermission permission="roles.delete" fallbackRoles={['SUPERADMIN']}>
              {(!role.isSystemRole || isSuperAdmin) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-600 hover:bg-red-50"
                  title="Hapus"
                  onClick={() => {
                    setRoleToDelete({ id: role.id, name: role.name });
                    setDeleteModalOpen(true);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </RequirePermission>
          </>
        )}
      />

      {/* Pagination */}
      {!isLoading && roles.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Menampilkan <span className="font-bold text-foreground">{roles.length}</span> dari{' '}
            <span className="font-bold text-foreground">{pagination.total}</span> role
            <span className="ml-2 text-muted-foreground/70">
              (Halaman {pagination.page} dari {pagination.totalPages})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value) as 10 | 20 | 50 | 100);
                setPage(1);
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Per Halaman"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
              Sebelumnya
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= pagination.totalPages}>
              Selanjutnya
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteModalOpen(false);
            setRoleToDelete(null);
          }
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
                  Apakah Anda yakin ingin menghapus role <strong>{roleToDelete?.name}</strong>?
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
                onClick={() => {
                  setDeleteModalOpen(false);
                  setRoleToDelete(null);
                }}
                disabled={deleteMutation.isPending}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => roleToDelete && deleteMutation.mutate(roleToDelete.id)}
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

      {/* Role Hierarchy Modal */}
      <Dialog open={hierarchyModalOpen} onOpenChange={setHierarchyModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="w-5 h-5 text-primary-600" />
              Role Hierarchy
            </DialogTitle>
            <DialogDescription>
              Struktur hierarki role — klik role untuk melihat detailnya
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto pr-2">
            <RoleHierarchyTree
              onRoleSelect={(roleId) => {
                setHierarchyModalOpen(false);
                navigate(`/roles/${roleId}`);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
