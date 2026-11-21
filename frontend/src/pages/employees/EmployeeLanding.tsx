import { Link } from 'react-router-dom';
import { BreadcrumbHeader } from '@/components/shared';
import { Users, Clock, CalendarDays, Banknote, Target, Inbox, ArrowLeftRight, ReceiptText } from 'lucide-react';

export default function EmployeeLanding() {
  const menuItems = [
    {
      icon: Users,
      title: 'Data Karyawan',
      description: 'Kelola data karyawan',
      path: '/hr/employees',
      color: 'from-primary-500 to-primary-600',
    },
    {
      icon: Clock,
      title: 'Absensi',
      description: 'Absen masuk & pulang via HP',
      path: '/hr/attendance/clock',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: CalendarDays,
      title: 'Cuti',
      description: 'Ajukan cuti dan izin',
      path: '/hr/leave/new',
      color: 'from-green-500 to-green-600',
    },
    {
      icon: ArrowLeftRight,
      title: 'Tukar Shift',
      description: 'Ajukan tukar shift dengan rekan',
      path: '/hr/shift-swap',
      color: 'from-teal-500 to-teal-600',
    },
    {
      icon: Inbox,
      title: 'Persetujuan',
      description: 'Pengajuan menunggu keputusan',
      path: '/hr/approvals',
      color: 'from-orange-500 to-orange-600',
    },
    {
      icon: ReceiptText,
      title: 'Slip Gaji Saya',
      description: 'Lihat slip gaji dengan PIN',
      path: '/hr/payroll/my-slips',
      color: 'from-yellow-500 to-yellow-600',
    },
    {
      icon: Banknote,
      title: 'Payroll',
      description: 'Kelola penggajian',
      path: '/hr/payroll',
      color: 'from-yellow-500 to-yellow-600',
    },
    {
      icon: Target,
      title: 'KPI',
      description: 'Kelola KPI karyawan',
      path: '/hr/kpi',
      color: 'from-purple-500 to-purple-600',
    },
  ];

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <BreadcrumbHeader title="Karyawan" subtitle="Kelola data karyawan dan HR" />

      {/* Menu Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path + item.title}
              to={item.path}
              className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-4 md:p-6 hover:shadow-lg transition-all duration-300 group active:scale-[0.98]"
            >
              <div className={`p-3 md:p-4 bg-gradient-to-br ${item.color} rounded-xl mb-3 md:mb-4 group-hover:scale-110 transition-transform w-fit`}>
                <Icon className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-gray-100 mb-1 md:mb-2">{item.title}</h3>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
