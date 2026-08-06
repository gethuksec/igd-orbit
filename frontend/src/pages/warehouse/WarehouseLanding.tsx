import { Link } from 'react-router-dom';
import { BreadcrumbHeader } from '@/components/shared';
import { Boxes, ArrowRightLeft, ClipboardCheck, PackageSearch } from 'lucide-react';

export default function WarehouseLanding() {
  const menuItems = [
    {
      icon: Boxes,
      title: 'Stok',
      description: 'Kelola stok produk per cabang',
      path: '/inventory/stock',
      color: 'from-primary-500 to-primary-600',
    },
    {
      icon: ArrowRightLeft,
      title: 'Transfer Stok',
      description: 'Transfer stok antar cabang',
      path: '/inventory/transfer',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: ClipboardCheck,
      title: 'Stock Opname',
      description: 'Stock opname dan audit stok',
      path: '/inventory/opname',
      color: 'from-green-500 to-green-600',
    },
    {
      icon: PackageSearch,
      title: 'Stock Adjustment',
      description: 'Penyesuaian stok',
      path: '/inventory/adjustment',
      color: 'from-yellow-500 to-yellow-600',
    },
  ];

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <BreadcrumbHeader title="Gudang & Inventory" subtitle="Kelola stok, transfer, dan inventory" />

      {/* Menu Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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

