import { Link } from 'react-router-dom';
import { Building2, FileText, Truck } from 'lucide-react';

export default function PurchasingLanding() {
  const menuItems = [
    {
      icon: Building2,
      title: 'Supplier',
      description: 'Kelola supplier untuk purchasing',
      path: '/purchasing/suppliers',
      color: 'from-primary-500 to-primary-600',
    },
    {
      icon: FileText,
      title: 'Purchase Order',
      description: 'Kelola purchase order',
      path: '/purchasing/po',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: Truck,
      title: 'Goods Receipt',
      description: 'Kelola penerimaan barang',
      path: '/purchasing/goods-receipt',
      color: 'from-green-500 to-green-600',
    },
  ];

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div>
          <h1 className="text-4xl font-bold mb-2">Pembelian</h1>
          <p className="text-primary-100 text-lg">Kelola pembelian dan supplier</p>
        </div>
      </div>

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

