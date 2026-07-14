import { type ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  cell: (item: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  actions?: (item: T) => ReactNode;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  className?: string;
}

const ROWS = 5;

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading,
  emptyMessage = 'No data found',
  emptyIcon,
  actions,
  sortColumn,
  sortDirection,
  onSort,
  className,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className={cn('rounded-md border', className)}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.headerClassName}>
                  {col.header}
                </TableHead>
              ))}
              {actions && <TableHead className="w-20">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: ROWS }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
                {actions && (
                  <TableCell>
                    <Skeleton className="h-8 w-16" />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        {emptyIcon && <div className="mb-4 text-4xl">{emptyIcon}</div>}
        <p className="text-lg font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-md border', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  col.headerClassName,
                  col.sortable && onSort && 'cursor-pointer select-none hover:text-foreground'
                )}
                onClick={() => col.sortable && onSort?.(col.key)}
              >
                <span className="flex items-center gap-1">
                  {col.header}
                  {col.sortable && sortColumn === col.key && (
                    <span className="text-xs">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                  )}
                </span>
              </TableHead>
            ))}
            {actions && <TableHead className="w-20">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={keyExtractor(item)}>
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.cell(item)}
                </TableCell>
              ))}
              {actions && (
                <TableCell>
                  <div className="flex items-center gap-2">{actions(item)}</div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
