import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode; // Action buttons (right side)
  className?: string;
}

export function PageHeader({ title, subtitle, children, className }: PageHeaderProps) {
  return (
    <div className={cn(
      'bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white',
      className
    )}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">{title}</h1>
          {subtitle && <div className="text-primary-100">{subtitle}</div>}
        </div>
        {children && (
          <div className="flex items-center gap-3">{children}</div>
        )}
      </div>
    </div>
  );
}
