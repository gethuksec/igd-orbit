import type { LucideIcon } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { KPICardSkeleton } from './LoadingSkeleton';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  sparklineData?: Array<{ date: string; value: number }>;
  icon?: LucideIcon;
  iconColor?: string;
  gradient?: string;
  textColor?: string;
  border?: string;
  isLoading?: boolean;
}

export function KPICard({
  title,
  value,
  change,
  changeType = 'neutral',
  sparklineData,
  icon: Icon,
  iconColor = 'text-indonesia-red-600',
  gradient,
  textColor,
  border,
  isLoading = false,
}: KPICardProps) {
  if (isLoading) {
    return <KPICardSkeleton />;
  }

  const changeColor =
    changeType === 'positive'
      ? 'text-success-600'
      : changeType === 'negative'
        ? 'text-danger-600'
        : 'text-gray-600';

  return (
    <div
      className={`bg-white rounded-lg shadow-md p-4 ${border || ''} ${
        gradient ? `bg-gradient-to-br ${gradient} text-white` : ''
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-sm font-medium ${textColor || 'text-gray-600'}`}>{title}</h3>
        {Icon && (
          <div className={`p-2 rounded-lg ${gradient ? 'bg-white/20' : 'bg-indonesia-red-50'}`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        )}
      </div>
      <p className={`text-3xl font-bold mb-2 ${textColor || 'text-gray-900'}`}>{value}</p>
      {change && (
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${changeColor}`}>{change}</span>
          {sparklineData && sparklineData.length > 0 && (
            <div className="ml-auto w-20 h-8">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={changeType === 'positive' ? '#10b981' : '#ef4444'}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

