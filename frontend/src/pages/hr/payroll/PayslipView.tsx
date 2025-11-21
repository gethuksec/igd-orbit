import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Printer, FileText, AlertCircle } from 'lucide-react';
import { hrService } from '@/services/hr.service';
import { formatCurrency, formatDate } from '@/utils/format';

export default function PayslipView() {
  const { id } = useParams<{ id: string }>();

  const { data: payroll, isLoading, error } = useQuery({
    queryKey: ['payroll', id],
    queryFn: () => hrService.getPayroll(id!),
    enabled: !!id,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // In production, this would download the PDF
    // For now, trigger print dialog
    window.print();
  };

  if (isLoading) {
    return (
      <div className="w-full space-y-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Memuat data payslip...</p>
        </div>
      </div>
    );
  }

  if (error || !payroll) {
    return (
      <div className="w-full space-y-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">Gagal memuat data payslip</p>
          <Link to="/hr/payroll" className="mt-4 text-primary-600 hover:underline">
            Kembali ke daftar
          </Link>
        </div>
      </div>
    );
  }

  const earnings = payroll.components?.filter((c) => c.componentType === 'earning') || [];
  const deductions = payroll.components?.filter((c) => c.componentType === 'deduction') || [];

  return (
    <div className="w-full space-y-6">
      {/* Header - Hidden on print */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to={`/hr/payroll/${id}`}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <FileText className="w-10 h-10" />
                Payslip
              </h1>
              <p className="text-primary-100 text-lg">{payroll.payrollNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-6 py-3 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-colors flex items-center gap-2"
            >
              <Printer className="w-5 h-5" />
              Print
            </button>
            <button
              onClick={handleDownload}
              className="px-6 py-3 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-colors flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* Payslip Content */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-8 print:shadow-none print:border-none">
        {/* Company Header */}
        <div className="text-center mb-8 pb-6 border-b-2 border-gray-200">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">PT. IGD GROUP</h2>
          <p className="text-gray-600">Jl. Sudirman No. 123, Jember, Jawa Timur</p>
          <p className="text-gray-600">Telp: 0331-123456 | Email: info@igdgroup.com</p>
        </div>

        {/* Payslip Title */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">SLIP GAJI</h3>
          <p className="text-gray-600">Periode: {new Date(2000, payroll.periodMonth - 1).toLocaleString('id-ID', { month: 'long' })} {payroll.periodYear}</p>
        </div>

        {/* Employee Info */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Informasi Karyawan</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <p><span className="font-semibold">Nama:</span> {payroll.employee?.user?.fullName || 'N/A'}</p>
              <p><span className="font-semibold">Employee Code:</span> {payroll.employee?.employeeCode || 'N/A'}</p>
              <p><span className="font-semibold">Posisi:</span> {payroll.employee?.position || 'N/A'}</p>
              <p><span className="font-semibold">Departemen:</span> {payroll.employee?.department?.name || 'N/A'}</p>
              <p><span className="font-semibold">Cabang:</span> {payroll.employee?.branch?.name || 'N/A'}</p>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Informasi Payroll</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <p><span className="font-semibold">Nomor Payroll:</span> {payroll.payrollNumber}</p>
              {payroll.calculatedAt && (
                <p><span className="font-semibold">Tanggal Dibuat:</span> {formatDate(payroll.calculatedAt)}</p>
              )}
              {payroll.processedAt && (
                <p><span className="font-semibold">Tanggal Dibayar:</span> {formatDate(payroll.processedAt)}</p>
              )}
              <p><span className="font-semibold">Hari Kerja:</span> {payroll.attendanceDays} hari</p>
            </div>
          </div>
        </div>

        {/* Earnings */}
        <div className="mb-6">
          <h4 className="text-lg font-bold text-gray-900 mb-3">Pendapatan</h4>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Komponen</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {earnings.length > 0 ? (
                  earnings.map((component) => (
                    <tr key={component.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">{component.componentName}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                        {formatCurrency(component.amount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-sm text-gray-500 text-center">
                      Tidak ada pendapatan
                    </td>
                  </tr>
                )}
                <tr className="bg-gray-50 font-bold">
                  <td className="px-4 py-3 text-sm text-gray-900">Total Pendapatan</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {formatCurrency(payroll.totalEarnings)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Deductions */}
        <div className="mb-6">
          <h4 className="text-lg font-bold text-gray-900 mb-3">Potongan</h4>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Komponen</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {deductions.length > 0 ? (
                  deductions.map((component) => (
                    <tr key={component.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">{component.componentName}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                        {formatCurrency(component.amount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-sm text-gray-500 text-center">
                      Tidak ada potongan
                    </td>
                  </tr>
                )}
                <tr className="bg-gray-50 font-bold">
                  <td className="px-4 py-3 text-sm text-gray-900">Total Potongan</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {formatCurrency(payroll.totalDeductions)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Net Salary */}
        <div className="bg-primary-50 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <h4 className="text-2xl font-bold text-gray-900">Gaji Bersih</h4>
            <p className="text-3xl font-bold text-primary-600">{formatCurrency(payroll.nettSalary)}</p>
          </div>
        </div>

        {/* Attendance Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-600 mb-1">Hari Kerja</p>
            <p className="text-lg font-bold text-gray-900">{payroll.attendanceDays} hari</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-600 mb-1">Terlambat</p>
            <p className="text-lg font-bold text-gray-900">{payroll.lateCount} kali</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-600 mb-1">Absen</p>
            <p className="text-lg font-bold text-gray-900">{payroll.absenceCount} hari</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-600 mb-1">Lembur</p>
            <p className="text-lg font-bold text-gray-900">{payroll.overtimeHours} jam</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-sm text-gray-600 mb-4">Dibuat oleh:</p>
              <div className="h-16 border-b border-gray-300"></div>
              <p className="text-xs text-gray-500 mt-2">HR Department</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-4">Diterima oleh:</p>
              <div className="h-16 border-b border-gray-300"></div>
              <p className="text-xs text-gray-500 mt-2">{payroll.employee?.user?.fullName || 'Karyawan'}</p>
            </div>
          </div>
          <div className="mt-6 text-center text-xs text-gray-500">
            <p>Dokumen ini adalah bukti pembayaran gaji yang sah</p>
            <p className="mt-1">Dicetak pada: {formatDate(new Date())}</p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            background: white;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}

