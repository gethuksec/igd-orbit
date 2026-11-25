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
  /**
   * Master-table pattern: freeze this column on the left (the name column).
   * Multiple stickyLeft columns stack left-to-right past the actions column.
   */
  stickyLeft?: boolean;
  /** Frozen column width in px for stacking offsets (default 220). */
  frozenWidth?: number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  actions?: (item: T) => ReactNode;
  /**
   * Master-table pattern: 'left' puts the actions column first (frozen)
   * and renders the table as a white card. Default 'right' = legacy.
   */
  actionsPosition?: 'left' | 'right';
  /**
   * Frozen actions column width in px (default 128 — fits 3 icon buttons).
   * UserList passes 168 (conditional 4th reactivate button).
   * The frozen name column offsets past this width automatically.
   */
  actionsWidth?: number;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  className?: string;
  onRowClick?: (item: T) => void;
}

const ROWS = 5;

/** Default frozen actions column width (px) — fits 3 icon buttons. */
const DEFAULT_ACTIONS_W = 128;
/** Default frozen data-column width (px) for stacking offsets. */
const DEFAULT_FROZEN_W = 220;

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading,
  emptyMessage = 'No data found',
  emptyIcon,
  actions,
  actionsPosition = 'right',
  actionsWidth = DEFAULT_ACTIONS_W,
  sortColumn,
  sortDirection,
  onSort,
  className,
  onRowClick,
}: DataTableProps<T>) {
  const leftActions = actionsPosition === 'left' && !!actions;
  // Frozen data columns stack left-to-right past the actions column.
  const frozenOffset = new Map<string, number>();
  {
    let acc = leftActions ? actionsWidth : 0;
    for (const c of columns) {
      if (!c.stickyLeft) continue;
      frozenOffset.set(c.key, acc);
      acc += c.frozenWidth ?? DEFAULT_FROZEN_W;
    }
  }
  const isFrozen = (col: Column<T>) => leftActions && frozenOffset.has(col.key);
  const frozenLeft = (col: Column<T>) => frozenOffset.get(col.key) ?? 0;
  // Solid surfaces so frozen cells paint over horizontally-scrolled content.
  const frozenBody = 'sticky z-10 bg-white dark:bg-gray-900';
  const frozenHead = 'sticky z-20 bg-white dark:bg-gray-900';
  // Only the LAST frozen column in DOM order carries the shadow divider.
  const frozenKeys = columns.filter((c) => isFrozen(c)).map((c) => c.key);
  const lastFrozenKey = frozenKeys[frozenKeys.length - 1];
  const renderActionsHead = (extra?: string) =>
    actions ? (
      <TableHead
        className={
          leftActions
            ? cn(frozenHead, 'left-0', extra)
            : cn('w-20', extra)
        }
        style={leftActions ? { left: 0, width: actionsWidth, minWidth: actionsWidth } : undefined}
      >
        {leftActions ? 'Aksi' : 'Actions'}
      </TableHead>
    ) : null;
  const renderActionsCell = (item: T) =>
    actions ? (
      <TableCell
        className={leftActions ? cn(frozenBody, 'left-0 px-2') : undefined}
        style={leftActions ? { left: 0, width: actionsWidth, minWidth: actionsWidth } : undefined}
      >
        <div className="flex items-center gap-2">{actions(item)}</div>
      </TableCell>
    ) : null;
  const frozenCellClass = (col: Column<T>, head: boolean) =>
    isFrozen(col)
      ? {
          className: cn(
            head ? frozenHead : frozenBody,
            col.headerClassName,
            col.key === lastFrozenKey &&
              'border-r border-gray-100 dark:border-gray-800 shadow-[12px_0_16px_-12px_rgba(0,0,0,0.25)]'
          ),
          style: { left: frozenLeft(col) },
        }
      : { className: col.headerClassName, style: undefined };
  if (isLoading) {
    return (
      <div className={cn('rounded-md border', leftActions && 'bg-white dark:bg-gray-900', className)}>
        <Table>
          <TableHeader>
            <TableRow>
              {leftActions && renderActionsHead()}
              {columns.map((col) => {
                const f = frozenCellClass(col, true);
                return (
                  <TableHead key={col.key} className={f.className} style={f.style}>
                    {col.header}
                  </TableHead>
                );
              })}
              {!leftActions && renderActionsHead()}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: ROWS }).map((_, i) => (
              <TableRow key={i}>
                {leftActions && (
                  <TableCell
                    className={cn(frozenBody, 'left-0 px-2')}
                    style={{ left: 0, width: actionsWidth, minWidth: actionsWidth }}
                  >
                    <Skeleton className="h-8 w-16" />
                  </TableCell>
                )}
                {columns.map((col) => {
                  const frozen = isFrozen(col);
                  return (
                    <TableCell
                      key={col.key}
                      className={frozen ? frozenBody : undefined}
                      style={frozen ? { left: frozenLeft(col) } : undefined}
                    >
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  );
                })}
                {!leftActions && actions && (
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
    <div className={cn('rounded-md border', leftActions && 'bg-white dark:bg-gray-900', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {leftActions && renderActionsHead()}
            {columns.map((col) => {
              const f = frozenCellClass(col, true);
              return (
                <TableHead
                  key={col.key}
                  className={cn(
                    f.className,
                    col.sortable && onSort && 'cursor-pointer select-none hover:text-foreground'
                  )}
                  style={f.style}
                  onClick={() => col.sortable && onSort?.(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortColumn === col.key && (
                      <span className="text-xs">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </span>
                </TableHead>
              );
            })}
            {!leftActions && renderActionsHead()}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow
              key={keyExtractor(item)}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              className={onRowClick ? 'cursor-pointer' : undefined}
            >
              {leftActions && renderActionsCell(item)}
              {columns.map((col) => {
                const frozen = isFrozen(col);
                return (
                  <TableCell
                    key={col.key}
                    className={cn(col.className, frozen && frozenBody)}
                    style={frozen ? { left: frozenLeft(col) } : undefined}
                  >
                    {col.cell(item)}
                  </TableCell>
                );
              })}
              {!leftActions && actions && (
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
