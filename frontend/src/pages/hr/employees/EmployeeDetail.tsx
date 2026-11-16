import { useParams, Link } from 'react-router-dom';
import { BreadcrumbHeader } from '@/components/shared';
import { useQuery } from '@tanstack/react-query';
import { Building2, Briefcase, Calendar, Mail, Phone, CheckCircle, XCircle, AlertCircle, DollarSign } from 'lucide-react';
import { api } from "@/services/api";
import { contractsService } from "@/services/contracts.service";
import { formatDate, formatCurrency } from "@/utils/format";

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

  const employeeId = (user as any)?.employee?.id as string | undefined;
  const { data: chainData } = useQuery({
    queryKey: ["contract-chain", employeeId],
    queryFn: () => contractsService.getChain(employeeId as string),
    enabled: !!employeeId,
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
  const chain = chainData?.data ?? [];
  const activeContract = chain.find((c) => c.status === "active");

  const STAGE_BADGE: Record<string, string> = {
    trial: "bg-amber-100 text-amber-800 border-amber-200",
    probation: "bg-blue-100 text-blue-800 border-blue-200",
    pkwt: "bg-indigo-100 text-indigo-800 border-indigo-200",
    pkwtt: "bg-green-100 text-green-800 border-green-200",
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <BreadcrumbHeader title="Detail Karyawan" subtitle={user.fullName || user.email}>
        {activeContract && (
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border bg-green-100 text-green-800 border-green-200">
            Kontrak aktif: {activeContract.type.toUpperCase()}
            {activeContract.endDate ? ` · s.d. ${formatDate(activeContract.endDate)}` : " · tetap"}
          </span>
        )}
      </BreadcrumbHeader>

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
            {(employee.position || (employee as any).positionDetail) && (
              <div>
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Jabatan
                </p>
                <p className="text-base font-semibold text-gray-900">
                  {employee.position || (employee as any).positionDetail?.name}
                  {(employee as any).positionDetail?.grade && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                      G{(employee as any).positionDetail.grade.rank}
                    </span>
                  )}
                </p>
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
            {(employee as any).division && (
              <div>
                <p className="text-sm text-gray-600">Divisi</p>
                <p className="text-base font-semibold text-gray-900">{(employee as any).division.name}</p>
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

      {/* Contract Timeline */}
      {chain.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Timeline Kontrak</h2>
          <div className="relative pl-6">
            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-red-200" />
            <div className="space-y-3">
              {chain.map((c) => (
                <div key={c.id} className="relative">
                  <div
                    className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-white ${
                      c.status === "active" ? "bg-green-500" : "bg-red-400"
                    }`}
                  />
                  <div className="border border-gray-100 rounded-lg p-3">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold border ${STAGE_BADGE[c.type] ?? "bg-gray-100 text-gray-800 border-gray-200"}`}>
                        {c.type.toUpperCase()}
                      </span>
                      <span className="font-mono text-xs text-gray-700">{c.contractNumber}</span>
                      <span className="text-xs font-semibold text-gray-500">{c.status}</span>
                      {c.grade && (
                        <span className="text-xs font-semibold text-purple-700">{c.grade.code}</span>
                      )}
                      {c.changeReason && c.changeReason !== "initial" && (
                        <span className="text-xs text-purple-700">{c.changeReason}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatDate(c.startDate)} – {c.endDate ? formatDate(c.endDate) : "tetap"}
                      {c.position?.name ? ` · ${c.position.name}` : ""}
                      {c.workingLocation?.name ? ` · ${c.workingLocation.name}` : ""}
                      {c.basicSalary != null ? ` · ${formatCurrency(c.basicSalary)}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
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

