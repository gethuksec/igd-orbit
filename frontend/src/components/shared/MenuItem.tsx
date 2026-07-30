import { Link } from 'react-router-dom';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

interface MenuItemProps {
  icon: LucideIcon;
  label: string;
  path: string;
  isActive?: boolean;
  /** 'default' = standalone (Dashboard, Cabang), 'child' = sub-menu item */
  variant?: 'default' | 'child';
}

export function MenuItem({
  icon: Icon,
  label,
  path,
  isActive = false,
  variant = 'default',
}: MenuItemProps) {
  if (variant === 'child') {
    return (
      <Link
        to={path}
        className={cn(
          'flex items-center gap-3 px-4 py-2.5 rounded-md text-sm transition-all',
          isActive
            ? 'bg-primary-50 text-primary-700 font-semibold border-l-2 border-primary-600 -ml-[3px]'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <Link
      to={path}
      className={cn(
        buttonVariants({ variant: 'ghost' }),
        'w-full justify-start gap-3 px-4 py-3 h-auto rounded-lg',
        isActive
          ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg hover:from-primary-600 hover:to-primary-500 hover:text-white'
          : 'text-foreground hover:bg-muted'
      )}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="font-medium">{label}</span>
    </Link>
  );
}
