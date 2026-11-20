import { type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  icon: ReactNode;
  iconBg?: string;
  label: string;
  value: string | number;
  subtitle?: string;
  badge?: { text: string; className: string };
}

export function StatCard({ icon, label, value, subtitle, badge }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground [&_svg]:text-muted-foreground">
            {icon}
          </div>
          {badge && (
            <span className="text-xs text-muted-foreground">
              {badge.text}
            </span>
          )}
        </div>
        <p className="mb-1 text-sm text-muted-foreground">{label}</p>
        <h3 className="mb-1 font-mono text-[28px] font-medium tabular-nums leading-none">{value}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
