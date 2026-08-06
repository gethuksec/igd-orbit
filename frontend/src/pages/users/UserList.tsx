import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, Edit, Trash2, Users, Mail, Phone, Shield, CheckCircle, XCircle, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { usersService, type User } from '../../services/users.service';
import { toast } from 'sonner';
import { BreadcrumbHeader, StatCard, SearchFilter, DataTable } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import RequirePermission from '../../components/guards/RequirePermission';
import { UserFormModal } from './components/UserFormModal';

type StatusFilter = 'all' | 'active' | 'banned';

export default function UserList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<10 | 20 | 50 | 100>(20);
  const [sortBy, setSortBy] = useState<'createdAt' | 'fullName'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; fullName: string } | null>(null);
  // D4: create/edit via modal (same surface)
  const [formModal, setFormModal] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [searchParams, setSearchParams] = useSearchParams();

  // UserDetail "Edit" → /users?edit=<id> → open modal here
  const editId = searchParams.get('edit');
  const { data: editUser } = useQuery({
    queryKey: ['user', editId],
    queryFn: () => usersService.getById(editId!),
    enabled: !!editId,
  });
  useEffect(() => {
    if (editUser) {
      setFormModal({ open: true, user: editUser });
      setSearchParams({}, { replace: true });
    }
  }, [editUser, setSearchParams]);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['users', page, limit, searchTerm, sortBy, sortOrder],
    queryFn: () =>
      usersService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        sort: sortBy,
        order: sortOrder,
      }),
  });

  useEffect(() => {
    if (error) {
      const errorResponse = error as any;
      if (errorResponse.response?.status === 403) {
        toast.error('Akses ditolak. Anda tidak memiliki izin untuk melihat daftar pengguna.');
      } else if (errorResponse.response?.status === 401) {
        toast.error('Session expired. Silakan login kembali.');
      } else {
        toast.error(errorResponse.response?.data?.message || 'Gagal memuat daftar pengguna');
      }
    }
  }, [error]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const users = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  // Client-side status filter
  const filteredUsers = users.filter((user) => {
    if (statusFilter === 'active') return user.isActive;
    if (statusFilter === 'banned') return !user.isActive;
    return true;
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersService.delete(id),
    onSuccess: () => {
      toast.success('Pengguna berhasil dihapus');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteModalOpen(false);
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus pengguna');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => usersService.reactivate(id),
    onSuccess: () => {
      toast.success('Pengguna berhasil diaktifkan kembali');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal reactivasi pengguna');
    },
  });

  const handleSort = (column: string) => {
    setPage(1);
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column as 'createdAt' | 'fullName');
      setSortOrder(column === 'fullName' ? 'asc' : 'desc');
    }
  };

  const activeCount = users.filter((u) => u.isActive).length;
  const inactiveCount = users.filter((u) => !u.isActive).length;

  const columns: Column<any>[] = [
    {
      key: 'fullName',
      header: 'Nama & Email',
      sortable: true,
      cell: (user) => (
        <Link to={`/users/${user.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
            {user.fullName?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground hover:text-primary-600 transition-colors">
              {user.fullName}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Mail className="w-3 h-3" />
              {user.email}
            </div>
          </div>
        </Link>
      ),
    },
    {
      key: 'phone',
      header: 'Telepon',
      cell: (user) =>
        user.phone ? (
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Phone className="w-4 h-4 text-muted-foreground" />
            {user.phone}
          </div>
        ) : (
          <span className="text-muted-foreground italic text-sm">-</span>
        ),
    },
    {
      key: 'roles',
      header: 'Roles',
      cell: (user) =>
        user.roles && user.roles.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {user.roles.map((role: any) => {
              const roleName = role.name || role.role?.name || 'Unknown Role';
              return (
                <span
                  key={role.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 border border-primary-100 rounded-md text-xs font-medium"
                >
                  <Shield className="w-3 h-3" />
                  {roleName}
                </span>
              );
            })}
          </div>
        ) : (
          <span className="text-muted-foreground italic text-xs">Tidak ada role</span>
        ),
    },
    {
      key: 'isActive',
      header: 'Status',
      cell: (user) =>
        user.isActive ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 border border-green-200 rounded-lg text-xs font-semibold">
            <CheckCircle className="w-3 h-3" />
            Aktif
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold">
            <XCircle className="w-3 h-3" />
            Dibanned
          </span>
        ),
    },
    {
      key: 'createdAt',
      header: 'Tanggal Dibuat',
      sortable: true,
      cell: (user) => (
        <div>
          <div className="text-sm text-foreground">
            {new Date(user.createdAt).toLocaleDateString('id-ID', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {new Date(user.createdAt).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <BreadcrumbHeader title="Manajemen Pengguna" subtitle="Kelola pengguna dan akses sistem">
        <RequirePermission permission="users.create" fallbackRoles={['SUPERADMIN', 'CHR']}>
          <Button size="sm" className="bg-white text-primary-600 hover:bg-primary-50 font-semibold" onClick={() => setFormModal({ open: true, user: null })}>
            <Plus className="w-4 h-4" />
            Tambah Pengguna
          </Button>
        </RequirePermission>
      </BreadcrumbHeader>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<Users className="w-6 h-6 text-white" />}
          label="Total Pengguna"
          value={isLoading ? '-' : pagination.total}
          subtitle="Semua pengguna terdaftar"
        />
        <StatCard
          icon={<CheckCircle className="w-6 h-6 text-white" />}
          iconBg="from-green-500 to-green-600"
          label="Pengguna Aktif"
          value={isLoading ? '-' : activeCount}
          subtitle="Pengguna yang aktif"
        />
        <StatCard
          icon={<XCircle className="w-6 h-6 text-white" />}
          iconBg="from-gray-500 to-gray-600"
          label="Pengguna Non-Aktif"
          value={isLoading ? '-' : inactiveCount}
          subtitle="Pengguna yang dinonaktifkan"
        />
      </div>

      {/* Search & Filter */}
      <SearchFilter
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama, email, atau telepon..."
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: (v) => {
              setStatusFilter(v as StatusFilter);
              setPage(1);
            },
            options: [
              { value: 'all', label: 'Semua' },
              { value: 'active', label: 'Aktif' },
              { value: 'banned', label: 'Dibanned' },
            ],
          },
        ]}
      />

      {/* User Table */}
      <DataTable
        columns={columns}
        data={filteredUsers}
        keyExtractor={(user) => user.id}
        isLoading={isLoading}
        emptyMessage={filteredUsers.length === 0 && users.length > 0 ? 'Tidak ada pengguna dengan status ini' : 'Tidak ada pengguna ditemukan'}
        emptyIcon={<Users className="w-16 h-16" />}
        sortColumn={sortBy}
        sortDirection={sortOrder}
        onSort={handleSort}
        actions={(user) => (
          <>
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" title="Lihat Detail">
              <Link to={`/users/${user.id}`}>
                <Eye className="w-4 h-4" />
              </Link>
            </Button>
            {!user.isActive && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-600 hover:bg-amber-50"
                title="Reaktivasi"
                disabled={reactivateMutation.isPending}
                onClick={() => reactivateMutation.mutate(user.id)}
              >
                <RefreshCw className={`w-4 h-4 ${reactivateMutation.isPending ? 'animate-spin' : ''}`} />
              </Button>
            )}
            <RequirePermission permission="users.update" fallbackRoles={['SUPERADMIN', 'CHR']}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-green-600 hover:bg-green-50"
                title="Edit"
                onClick={() => setFormModal({ open: true, user })}
              >
                <Edit className="w-4 h-4" />
              </Button>
            </RequirePermission>
            <RequirePermission permission="users.delete" fallbackRoles={['SUPERADMIN']}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 hover:bg-red-50"
                title="Hapus"
                onClick={() => {
                  setUserToDelete({ id: user.id, fullName: user.fullName });
                  setDeleteModalOpen(true);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </RequirePermission>
          </>
        )}
      />

      {/* Pagination */}
      {!isLoading && users.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Menampilkan <span className="font-bold text-foreground">{filteredUsers.length}</span> dari{' '}
            <span className="font-bold text-foreground">{pagination.total}</span> pengguna
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
            setUserToDelete(null);
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
                  Apakah Anda yakin ingin menghapus pengguna <strong>{userToDelete?.fullName}</strong>?
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
                onClick={() => {
                  setDeleteModalOpen(false);
                  setUserToDelete(null);
                }}
                disabled={deleteMutation.isPending}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => userToDelete && deleteMutation.mutate(userToDelete.id)}
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

      {/* D4: Create/Edit User Modal */}
      <UserFormModal
        open={formModal.open}
        user={formModal.user}
        onClose={() => setFormModal({ open: false, user: null })}
      />
    </div>
  );
}
