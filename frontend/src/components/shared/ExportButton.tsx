import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { saveBlob } from './file';

interface ExportButtonProps {
  label?: string;
  filename: string | (() => string);
  onExport: () => Promise<Blob>;
  variant?: 'outline' | 'secondary' | 'default';
  size?: 'sm' | 'default';
  className?: string;
  disabled?: boolean;
  title?: string;
}

/**
 * Shared export button (IGDERP-279).
 * Contract: backend GET export returns .xlsx blob. Filename may be static
 * or a function (e.g. dated). Toast on failure, busy spinner while running.
 */
export function ExportButton({
  label = 'Export',
  filename,
  onExport,
  variant = 'outline',
  size = 'sm',
  className,
  disabled,
  title,
}: ExportButtonProps) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const blob = await onExport();
      saveBlob(blob, typeof filename === 'function' ? filename() : filename);
    } catch {
      toast.error('Gagal mengekspor data');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant={variant} size={size} onClick={run} disabled={busy || disabled} title={title} className={className}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {label}
    </Button>
  );
}

export function datedFilename(prefix: string): string {
  return `${prefix}-${new Date().toISOString().split('T')[0]}.xlsx`;
}
