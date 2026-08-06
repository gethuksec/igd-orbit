import { type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { getBreadcrumbs, type Crumb } from '@/lib/breadcrumbs';
import { cn } from '@/lib/utils';

interface BreadcrumbHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-side action buttons. */
  children?: ReactNode;
  /** Optional explicit trail; defaults to the route map in src/lib/breadcrumbs.ts. */
  trail?: Crumb[];
  className?: string;
}

/**
 * T23 — flat breadcrumb header replacing the red gradient PageHeader banner.
 * Trail (Beranda / Modul / Page) + compact title row + right-side actions.
 * Variant B (Flat Minimal): no card, no gradient — content sits directly on
 * the page background to free vertical space.
 */
export function BreadcrumbHeader({ title, subtitle, children, trail, className }: BreadcrumbHeaderProps) {
  const { pathname } = useLocation();
  const crumbs = trail ?? getBreadcrumbs(pathname);

  return (
    <header className={cn('py-2', className)}>
      {crumbs.length > 0 && (
        <Breadcrumb className="mb-1.5">
          <BreadcrumbList>
            {crumbs.map((crumb, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <BreadcrumbItem key={i}>
                  {isLast || !crumb.href ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link to={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                  {!isLast && <BreadcrumbSeparator />}
                </BreadcrumbItem>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}
