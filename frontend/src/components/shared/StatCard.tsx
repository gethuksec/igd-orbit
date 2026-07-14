import { type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: ReactNode;
  iconBg?: string;
  label: string;
  value: string | number;
  subtitle?: string;
  badge?: { text: string; className: string };
}

export function StatCard({ icon, iconBg = 'from-primary-500 to-primary-600', label, value, subtitle, badge }: StatCardProps) {
  return (
    <Card className="hover:shadow-lg transition-all duration-300 group">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn('p-3 rounded-xl bg-gradient-to-br group-hover:scale-110 transition-transform', iconBg)}>
            {icon}
          </div>
          {badge && (
            <span className={cn('px-2 py-1 rounded-full text-xs font-semibold', badge.className)}>
              {badge.text}
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
        <h3 className="text-2xl font-bold text-foreground mb-1">{value}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
