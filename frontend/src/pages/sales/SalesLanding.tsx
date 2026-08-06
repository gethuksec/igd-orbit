import { Link } from 'react-router-dom';
import { ShoppingCart, Receipt, ArrowRightLeft } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';

export default function SalesLanding() {
  const menuItems = [
    {
      icon: ShoppingCart,
      title: 'POS',
      description: 'Point of Sale untuk transaksi penjualan',
      path: '/pos',
      color: 'from-primary-500 to-primary-600',
    },
    {
      icon: Receipt,
      title: 'Riwayat Penjualan',
      description: 'Daftar semua transaksi penjualan',
      path: '/sales/history',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: ArrowRightLeft,
      title: 'Retur Penjualan',
      description: 'Kelola retur dan refund penjualan',
      path: '/sales/returns',
      color: 'from-green-500 to-green-600',
    },
  ];

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <BreadcrumbHeader title="Penjualan" subtitle="Kelola transaksi penjualan dan POS" />

      {/* Menu Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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

