import { type ReactNode } from 'react';
import { type LucideIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MenuGroupProps {
  icon: LucideIcon;
  label: string;
  isExpanded: boolean;
  /** True when this parent or any child is the active route */
  isActive: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function MenuGroup({
  icon: Icon,
  label,
  isExpanded,
  isActive,
  onToggle,
  children,
}: MenuGroupProps) {
  return (
    <div>
      <Button
        variant="ghost"
        onClick={onToggle}
        className={cn(
          'w-full justify-between gap-3 px-4 py-3 h-auto rounded-lg',
          isActive
            ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg hover:from-primary-600 hover:to-primary-500 hover:text-white'
            : 'text-foreground hover:bg-muted'
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon className="w-5 h-5 shrink-0" />
          <span className="font-medium truncate">{label}</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0" />
        )}
      </Button>
      {isExpanded && (
        <div className="ml-4 mt-1 space-y-1 border-l-2 border-border pl-4">
          {children}
        </div>
      )}
    </div>
  );
}
