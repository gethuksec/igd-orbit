import { useState, useEffect } from 'react';
import { BreadcrumbHeader } from '@/components/shared';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, User, Building2, Briefcase, Calendar, CheckCircle, XCircle, AlertCircle, Eye, Edit, Save, Plus } from 'lucide-react';
import { formatDate, formatDateForInput } from '@/utils/format';
import { useBranchStore } from '@/stores/branchStore';
import { api } from '@/services/api';
import { Modal } from '@/components/ui/modal';
import { toast } from 'sonner';

const emptyForm = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  branchId: '',
  departmentId: '',
  position: '',
  hireDate: '',
  employmentType: '' as 'PKWT' | 'PKWTT' | '',
  endDate: '',
  isActive: true,
};

export default function EmployeeList() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<10 | 20 | 50 | 100>(20);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const { availableBranches } = useBranchStore();

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, selectedBranchId, limit]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['employees', page, limit, searchTerm, statusFilter, selectedBranchId],
    queryFn: async () => {
      const response = await api.get('/users', {
        params: {
          page,
          limit,
          search: searchTerm || undefined,
          includeEmployee: true,
        },
      });
      return response.data;
    },
  });

  // Fetch departments for dropdown
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await api.get('/departments?page=1&limit=100');
      return response.data.data || response.data || [];
    },
  });

  const users = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  // Filter employees only (users that have employee data)
  const employees = users.filter((user: any) => user.employee);

  // Additional filtering by branch and status
  const filteredEmployees = employees.filter((user: any) => {
    if (selectedBranchId && user.employee?.branchId !== selectedBranchId) {
      return false;
    }
    if (statusFilter === 'active' && !user.employee?.isActive) {
      return false;
    }
    if (statusFilter === 'inactive' && user.employee?.isActive) {
      return false;
    }
    return true;
  });

  const activeCount = employees.filter((u: any) => u.employee?.isActive).length;
  const inactiveCount = employees.filter((u: any) => !u.employee?.isActive).length;

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, statusFilter, selectedBranchId]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      const response = await api.post('/users', data);
      return response.data.data || response.data;
    },
    onSuccess: () => {
      toast.success('Karyawan berhasil ditambahkan');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      closeAddModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menambahkan karyawan');
    },
  });

  // Update mutation (for editing from modal)
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof emptyForm }) => {
      const { password, ...updateData } = data;
      const response = await api.put(`/users/${id}`, updateData);
      return response.data.data || response.data;
    },
    onSuccess: () => {
      toast.success('Data karyawan berhasil diperbarui');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      closeAddModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal memperbarui data karyawan');
    },
  });

  const closeAddModal = () => {
    setShowAddModal(false);
    setEditId(null);
    setForm({ ...emptyForm });
  };

  const openAddModal = () => {
    setForm({ ...emptyForm });
    setEditId(null);
    setShowAddModal(true);
  };

  const openEditModal = async (user: any) => {
    setEditId(user.id);
    setForm({
      fullName: user.fullName || '',
      email: user.email || '',
      phone: user.phone || '',
      password: '',
      branchId: user.employee?.branchId || '',
      departmentId: user.employee?.departmentId || '',
      position: user.employee?.position || '',
      hireDate: user.employee?.hireDate ? formatDateForInput(user.employee.hireDate) : '',
      employmentType: (user.employee?.employmentType as 'PKWT' | 'PKWTT') || '',
      endDate: user.employee?.endDate ? formatDateForInput(user.employee.endDate) : '',
      isActive: user.employee?.isActive !== undefined ? user.employee.isActive : true,
    });
    setShowAddModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) {
      updateMutation.mutate({ id: editId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <BreadcrumbHeader title="Data Karyawan" subtitle="Kelola data karyawan dan informasi HR">
        <button
            onClick={openAddModal}
            className="px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Tambah Karyawan
          </button>
      </BreadcrumbHeader>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Cari Karyawan</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama, email, atau employee code..."
                className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all bg-white min-w-[150px]"
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Tidak Aktif</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Cabang</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all bg-white min-w-[200px]"
              >
                <option value="">Semua Cabang</option>
                {availableBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Per Halaman</label>
              <select
                value={limit}
                onChange={(e) => {
                  const newLimit = parseInt(e.target.value) as 10 | 20 | 50 | 100;
                  setLimit(newLimit);
                  setPage(1);
                }}
                className="px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all bg-white min-w-[150px]"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Karyawan</p>
              <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Aktif</p>
              <p className="text-2xl font-bold text-green-600">{activeCount}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Tidak Aktif</p>
              <p className="text-2xl font-bold text-red-600">{inactiveCount}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Memuat data...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">Gagal memuat data karyawan</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Tidak ada data karyawan</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Karyawan</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Posisi</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Cabang</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Tanggal Masuk</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Tipe</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEmployees.map((user: any) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link to={`/hr/employees/${user.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
                          <div className="p-2 bg-primary-100 rounded-lg">
                            <User className="w-4 h-4 text-primary-600" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{user.fullName || user.email}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                            {user.phone && <div className="text-xs text-gray-500">{user.phone}</div>}
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-gray-400" />
                          <div className="text-sm font-semibold text-gray-900">{user.employee?.position || '-'}</div>
                        </div>
                        {user.employee?.department && (
                          <div className="text-xs text-gray-500 mt-1">{user.employee.department.name}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.employee?.branch ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{user.employee.branch.name}</div>
                              <div className="text-xs text-gray-500">{user.employee.branch.code}</div>
                            </div>
                          </div>
                        ) : <span className="text-sm text-gray-400">-</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.employee?.hireDate ? (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <div className="text-sm font-semibold text-gray-900">{formatDate(user.employee.hireDate)}</div>
                          </div>
                        ) : <span className="text-sm text-gray-400">-</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {user.employee?.employmentType ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                              user.employee.employmentType === 'PKWT'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {user.employee.employmentType === 'PKWT' ? 'PKWT' : 'PKWTT'}
                            </span>
                          ) : <span className="text-sm text-gray-400">-</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.employee?.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3" /> Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3" /> Tidak Aktif
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Link to={`/hr/employees/${user.id}`} className="p-2 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors" title="Detail">
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button onClick={() => openEditModal(user)} className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, pagination.total)} dari {pagination.total}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-4 py-2 border-2 border-gray-200 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 font-semibold transition-all">Previous</button>
                  <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
                    className="px-4 py-2 border-2 border-gray-200 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 font-semibold transition-all">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Employee Modal */}
      <Modal open={showAddModal} onClose={closeAddModal} title={editId ? "Edit Karyawan" : "Tambah Karyawan"} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* Personal Information */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Informasi Pribadi</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Lengkap *</label>
                <input type="text" required value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input type="email" required value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>
              {!editId && (
                <div>
                  <label className="block text-sm font-medium mb-1">Password *</label>
                  <input type="password" required={!editId} value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Telepon</label>
                <input type="tel" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>
              {editId && (
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select value={form.isActive ? 'true' : 'false'}
                    onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
                    <option value="true">Aktif</option>
                    <option value="false">Tidak Aktif</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Employee Information */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4" /> Informasi Karyawan
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Posisi */}
              <div>
                <label className="block text-sm font-medium mb-1">Posisi</label>
                <input type="text" value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" placeholder="e.g., Manager, Staff" />
              </div>
              {/* Tipe Karyawan */}
              <div>
                <label className="block text-sm font-medium mb-1">Tipe Karyawan</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="employmentType" value="PKWT" checked={form.employmentType === 'PKWT'}
                      onChange={(e) => setForm({ ...form, employmentType: e.target.value as 'PKWT' | 'PKWTT' })}
                      className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                    <span className="text-sm">PKWT (Kontrak)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="employmentType" value="PKWTT" checked={form.employmentType === 'PKWTT'}
                      onChange={(e) => setForm({ ...form, employmentType: e.target.value as 'PKWT' | 'PKWTT' })}
                      className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                    <span className="text-sm">PKWTT (Tetap)</span>
                  </label>
                </div>
              </div>
              {/* Departemen */}
              <div>
                <label className="block text-sm font-medium mb-1">Departemen</label>
                <select value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
                  <option value="">Pilih Departemen</option>
                  {Array.isArray(departments) && departments.map((dept: any) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              {/* Cabang */}
              <div>
                <label className="block text-sm font-medium mb-1">Cabang</label>
                <select value={form.branchId}
                  onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
                  <option value="">Pilih Cabang (Opsional)</option>
                  {availableBranches?.map((branch: any) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>
              {/* Tanggal Masuk */}
              <div>
                <label className="block text-sm font-medium mb-1">Tanggal Masuk</label>
                <input type="date" value={form.hireDate}
                  onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>
              {/* Tanggal Berakhir Kontrak — same row as Tanggal Masuk when PKWT */}
              {form.employmentType === 'PKWT' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Tanggal Berakhir Kontrak</label>
                  <input type="date" value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t border-gray-200">
            <button type="button" onClick={closeAddModal}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 text-sm">Batal</button>
            <button type="submit" disabled={isPending}
              className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
              {isPending ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Menyimpan...</>
              ) : (
                <><Save className="w-4 h-4" /> {editId ? 'Simpan Perubahan' : 'Tambah Karyawan'}</>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
