import { Link } from 'react-router-dom';
import { Building2, FileText, Truck, ShieldCheck } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';

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
    {
      icon: ShieldCheck,
      title: 'Approval',
      description: 'Pengaturan persetujuan pembelian',
      path: '/purchasing/approval',
      color: 'from-amber-500 to-amber-600',
    },
  ];

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <BreadcrumbHeader title="Pembelian" subtitle="Kelola pembelian dan supplier" />

      {/* Menu Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.path} className="hover:shadow-lg transition-all duration-300 group">
              <CardContent className="p-6">
                <Link to={item.path} className="block">
                  <div className={`p-4 bg-gradient-to-br ${item.color} rounded-xl mb-4 group-hover:scale-110 transition-transform w-fit`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
