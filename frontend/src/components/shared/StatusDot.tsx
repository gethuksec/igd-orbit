import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StatusTone = 'ok' | 'warn' | 'off' | 'bad';

const toneClass: Record<StatusTone, string> = {
  ok: 'bg-green-600',
  warn: 'bg-amber-700',
  off: 'bg-slate-300',
  bad: 'bg-red-600',
};

interface StatusDotProps {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}

/**
 * v2d-red signature: status is a quiet 8px dot + text, never a pill.
 * Tones: ok (green), warn (amber), off (slate), bad (red).
 */
export function StatusDot({ tone = 'ok', children, className }: StatusDotProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[13px] text-muted-foreground', className)}>
      <span className={cn('h-2 w-2 flex-none rounded-full', toneClass[tone])} />
      {children}
    </span>
  );
}
