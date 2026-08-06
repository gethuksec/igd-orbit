import { Link } from 'react-router-dom';
import { Wrench, Plus } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';

export default function ServiceLanding() {
  const menuItems = [
    {
      icon: Wrench,
      title: 'Service Order',
      description: 'Kelola pesanan servis dan perbaikan',
      path: '/service-orders',
      color: 'from-primary-500 to-primary-600',
    },
    {
      icon: Plus,
      title: 'Tambah Service',
      description: 'Buat service order baru',
      path: '/service-orders/new',
      color: 'from-green-500 to-green-600',
    },
  ];

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <BreadcrumbHeader title="Servis" subtitle="Kelola pesanan servis dan perbaikan" />

      {/* Menu Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group"
            >
              <div className={`p-4 bg-gradient-to-br ${item.color} rounded-xl mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-600">{item.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

