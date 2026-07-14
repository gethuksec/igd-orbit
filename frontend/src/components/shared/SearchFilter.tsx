import { type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterOption {
  value: string;
  label: string;
}

interface SearchFilterProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  filters?: Array<{
    key: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: FilterOption[];
    placeholder?: string;
  }>;

  className?: string;
  children?: ReactNode; // Extra buttons etc.
}

export function SearchFilter({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  className,
  children,
}: SearchFilterProps) {
  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      {/* Search input */}
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
        />
      </div>

      {/* Filter selects */}
      {filters.map((filter) => (
        <div key={filter.key} className="min-w-[140px]">
          {filter.label && (
            <Label className="text-xs text-muted-foreground mb-1 block">{filter.label}</Label>
          )}
          <select
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">All {filter.label}</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {/* Extra action buttons */}
      {children}
    </div>
  );
}
