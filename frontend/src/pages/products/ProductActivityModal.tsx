import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowUp,
  ArrowDown,
  ArrowRightLeft,
  Settings,
  TrendingUp,
  Package,
  History,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '../../services/api';

interface Props {
  product: { id: string; name?: string; sku?: string } | null;
  open: boolean;
  onClose: () => void;
}

function activityIcon(type: string) {
  switch (type) {
    case 'STOCK_IN':
      return <ArrowUp className="w-4 h-4 text-green-600 dark:text-green-400" />;
    case 'STOCK_OUT':
      return <ArrowDown className="w-4 h-4 text-red-600 dark:text-red-400" />;
    case 'STOCK_TRANSFER':
      return <ArrowRightLeft className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    case 'STOCK_ADJUSTMENT':
      return <Settings className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />;
    case 'SALES':
      return <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    case 'SALES_RETURN':
      return <TrendingUp className="w-4 h-4 text-red-600 dark:text-red-400 rotate-180" />;
    case 'SERVICE_USAGE':
      return <Package className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
    default:
      return <Package className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
  }
}

function activityColor(type: string) {
  switch (type) {
    case 'STOCK_IN':
      return 'border-l-4 border-green-500 bg-green-50/30 dark:bg-green-950/30';
    case 'STOCK_OUT':
      return 'border-l-4 border-red-500 bg-red-50/30 dark:bg-red-950/30';
    case 'STOCK_TRANSFER':
      return 'border-l-4 border-blue-500 bg-blue-50/30 dark:bg-blue-950/30';
    case 'STOCK_ADJUSTMENT':
      return 'border-l-4 border-yellow-500 bg-yellow-50/30 dark:bg-yellow-950/30';
    case 'SALES':
      return 'border-l-4 border-purple-500 bg-purple-50/30 dark:bg-purple-950/30';
    case 'SALES_RETURN':
      return 'border-l-4 border-red-500 bg-red-50/30 dark:bg-red-950/30';
    case 'SERVICE_USAGE':
    case 'SERVICE_USAGE_PENDING':
      return 'border-l-4 border-orange-500 bg-orange-50/30 dark:bg-orange-950/30';
    default:
      return 'border-l-4 border-gray-400 bg-gray-50/30 dark:bg-gray-950/30';
  }
}

// Product activity popup — same shell as the stock menu's Riwayat pergerakan
// modal, but the content is the product's full Riwayat Aktivitas timeline
// (stock + sales + service usage), same source as the detail page.
export default function ProductActivityModal({ product, open, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['product-activity-modal', product?.id],
    enabled: open && !!product?.id,
    staleTime: 30000,
    queryFn: async () => {
      const response = await api.get(`/products/${product!.id}/activity`, {
        params: { page: 1, limit: 50 },
      });
      return response.data;
    },
  });

  const activities = data?.data || [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[75vw] max-w-[75vw] h-[50vh] max-h-[50vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            Riwayat aktivitas — {product?.name || '-'}
            <span className="font-normal text-muted-foreground">{product?.sku || ''}</span>
            {activities.length > 0 && (
              <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                {activities.length} aktivitas
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary-500 dark:text-primary-400 animate-spin" />
            </div>
          ) : !activities.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Belum ada aktivitas untuk produk ini.
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((activity: any) => (
                <div key={activity.id} className={`p-2 rounded-r-lg ${activityColor(activity.type)}`}>
                  <div className="flex items-start gap-2 mb-1">
                    <div className="mt-0.5 flex-shrink-0">{activityIcon(activity.type)}</div>
                    <div className="flex-1 min-w-0">
                      {activity.referenceId ? (
                        activity.referenceType === 'SALES_TRANSACTION' ? (
                          <Link
                            to={`/sales/transactions/${activity.referenceId}`}
                            className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                          >
                            {activity.description}
                          </Link>
                        ) : activity.referenceType === 'SERVICE_ORDER' ? (
                          <Link
                            to={`/service-orders/${activity.referenceId}`}
                            className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-orange-600 dark:hover:text-orange-400 hover:underline"
                          >
                            {activity.description}
                          </Link>
                        ) : (
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {activity.description}
                          </p>
                        )
                      ) : (
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {activity.description}
                        </p>
                      )}
                      {activity.branch && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          {activity.branch.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      {activity.quantityBefore !== undefined && activity.quantityAfter !== undefined ? (
                        <>
                          {activity.quantityBefore} →{' '}
                          <span className="font-semibold">{activity.quantityAfter}</span>
                        </>
                      ) : activity.quantityChange ? (
                        <span
                          className={
                            activity.quantityChange > 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }
                        >
                          {activity.quantityChange > 0 ? '+' : ''}
                          {activity.quantityChange} unit
                        </span>
                      ) : null}
                    </span>
                    <span>
                      {new Date(activity.createdAt).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {activity.referenceId && activity.referenceType === 'SALES_TRANSACTION' && (
                    <Link
                      to={`/sales/transactions/${activity.referenceId}`}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                    >
                      Lihat transaksi →
                    </Link>
                  )}
                  {activity.referenceId && activity.referenceType === 'SERVICE_ORDER' && (
                    <Link
                      to={`/service-orders/${activity.referenceId}`}
                      className="text-xs text-orange-600 dark:text-orange-400 hover:underline mt-1 inline-block"
                    >
                      Lihat service order →
                    </Link>
                  )}
                  {activity.notes && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-1" title={activity.notes}>
                      {activity.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
