import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Master-table pattern: "Terakhir Diupdate" cell format.
 * id-ID short date + 24h hour:minute, e.g. "03 Nov 2026, 14:32".
 * (id-ID toLocaleTimeString uses dots — normalized to colons.)
 */
export function formatDateTimeId(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const date = d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const time = d
    .toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
    .replace(/\./g, ':');
  return `${date}, ${time}`;
}

