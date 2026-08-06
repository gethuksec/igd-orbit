import { useParams, Link } from 'react-router-dom';
import { BreadcrumbHeader } from '@/components/shared';
import { useQuery } from '@tanstack/react-query';
import { Building2, Briefcase, Calendar, Mail, Phone, CheckCircle, XCircle, AlertCircle, DollarSign } from 'lucide-react';
import { api } from '@/services/api';
import { formatDate, formatCurrency } from '@/utils/format';

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['employee', id],
    queryFn: async () => {
      const response = await api.get(`/users/${id}`);
      return response.data.data || response.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="w-full space-y-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (error || !user || !user.employee) {
    return (
      <div className="w-full space-y-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">Gagal memuat data karyawan atau karyawan tidak ditemukan</p>
          <Link to="/hr/employees" className="mt-4 text-primary-600 hover:underline">
            Kembali ke daftar
          </Link>
        </div>
      </div>
    );
  }

  const employee = user.employee;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <BreadcrumbHeader title="Detail Karyawan" subtitle={user.fullName || user.email} />

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Info */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Informasi Pribadi</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Nama Lengkap</p>
              <p className="text-base font-semibold text-gray-900">{user.fullName || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </p>
              <p className="text-base font-semibold text-gray-900">{user.email}</p>
            </div>
            {user.phone && (
              <div>
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Telepon
                </p>
                <p className="text-base font-semibold text-gray-900">{user.phone}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <div className="mt-1">
                {employee.isActive ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                    <CheckCircle className="w-4 h-4" />
                    Aktif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
                    <XCircle className="w-4 h-4" />
                    Tidak Aktif
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Employee Info */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Informasi Karyawan</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Employee Code</p>
              <p className="text-base font-mono font-semibold text-gray-900">{employee.employeeCode}</p>
            </div>
            {employee.position && (
              <div>
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Posisi
                </p>
                <p className="text-base font-semibold text-gray-900">{employee.position}</p>
              </div>
            )}
            {employee.branch && (
              <div>
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Cabang
                </p>
                <div>
                  <p className="text-base font-semibold text-gray-900">{employee.branch.name}</p>
                  <p className="text-xs text-gray-500">{employee.branch.code}</p>
                </div>
              </div>
            )}
            {employee.department && (
              <div>
                <p className="text-sm text-gray-600">Departemen</p>
                <p className="text-base font-semibold text-gray-900">{employee.department.name}</p>
              </div>
            )}
            {employee.hireDate && (
              <div>
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Tanggal Masuk
                </p>
                <p className="text-base font-semibold text-gray-900">{formatDate(employee.hireDate)}</p>
              </div>
            )}
            {employee.employmentType && (
              <div>
                <p className="text-sm text-gray-600">Tipe Karyawan</p>
                <p className="text-base font-semibold text-gray-900">
                  {employee.employmentType === 'full-time'
                    ? 'Full Time'
                    : employee.employmentType === 'part-time'
                      ? 'Part Time'
                      : 'Contract'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compensation Info */}
      {(employee.basicSalary || employee.hourlyRate) && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Kompensasi
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {employee.basicSalary && (
              <div>
                <p className="text-sm text-gray-600">Gaji Pokok</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(employee.basicSalary)}
                </p>
              </div>
            )}
            {employee.hourlyRate && (
              <div>
                <p className="text-sm text-gray-600">Tarif Per Jam</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(employee.hourlyRate)}/jam
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bank & Tax Info */}
      {(employee.bankAccount || employee.taxId || employee.bpjsNumber) && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Informasi Bank & Pajak</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {employee.bankAccount && (
              <div>
                <p className="text-sm text-gray-600">Rekening Bank</p>
                <p className="text-base font-semibold text-gray-900">{employee.bankAccount}</p>
                {employee.bankName && <p className="text-xs text-gray-500">{employee.bankName}</p>}
              </div>
            )}
            {employee.taxId && (
              <div>
                <p className="text-sm text-gray-600">NPWP</p>
                <p className="text-base font-semibold text-gray-900">{employee.taxId}</p>
              </div>
            )}
            {employee.bpjsNumber && (
              <div>
                <p className="text-sm text-gray-600">BPJS</p>
                <p className="text-base font-semibold text-gray-900">{employee.bpjsNumber}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Akses Cepat</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to={`/hr/attendance?employeeId=${employee.id}`}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <p className="text-sm font-semibold text-gray-900">Absensi</p>
            <p className="text-xs text-gray-500">Lihat riwayat absensi</p>
          </Link>
          <Link
            to={`/hr/leave?employeeId=${employee.id}`}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <p className="text-sm font-semibold text-gray-900">Cuti</p>
            <p className="text-xs text-gray-500">Lihat riwayat cuti</p>
          </Link>
          <Link
            to={`/hr/payroll?employeeId=${employee.id}`}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <p className="text-sm font-semibold text-gray-900">Payroll</p>
            <p className="text-xs text-gray-500">Lihat riwayat payroll</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

