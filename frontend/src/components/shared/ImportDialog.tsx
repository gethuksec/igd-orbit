import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export const IMPORT_STEPS = ['Upload', 'Validasi', 'Import'] as const;

/** Stepper dots. Quiet chrome, red marks done/active (current primary kept). */
export function ImportStepper({
  step,
  steps = IMPORT_STEPS as unknown as string[],
}: {
  step: 1 | 2 | 3;
  steps?: string[];
}) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < step;
        const active = n === step;
        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && <div className={cn('h-px w-6', done || active ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700')} />}
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                active ? 'bg-primary text-primary-foreground' : done ? 'bg-primary/10 text-primary' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
              )}
            >
              <span
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold',
                  active ? 'bg-primary-foreground text-primary' : done ? 'bg-primary text-primary-foreground' : 'bg-gray-300 dark:bg-gray-600 text-white',
                )}
              >
                {done ? '✓' : n}
              </span>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ImportNotice({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'info' | 'good' | 'bad';
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 text-sm',
        tone === 'good' && 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200',
        tone === 'bad' && 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200',
        tone === 'info' && 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-700 dark:text-gray-300',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  step: 1 | 2 | 3;
  steps?: string[];
  headerActions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'lg' | 'xl';
}

/**
 * Shared import dialog shell (IGDERP-279, mock v2d-red).
 * Fixed-size scrollable body, sticky header/footer via flex column.
 * Domain logic (preview tables, pickers, mutations) stays in the page;
 * this shell owns Dialog chrome, stepper, and layout only.
 * Labels stay exact: Import / Export / Batal / Simpan. State text lives
 * in ImportNotice above the table, never on the button.
 */
export function ImportDialog({
  open,
  onClose,
  title,
  step,
  steps,
  headerActions,
  children,
  footer,
  size = 'xl',
}: ImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={cn(
          'flex flex-col',
          size === 'xl' ? 'h-[80vh] max-h-[80vh] w-[75vw] max-w-[75vw]' : 'max-h-[80vh]',
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <ImportStepper step={step} steps={steps} />
        {headerActions}
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

interface ImportDropzoneProps {
  file: File | null;
  onFile: (f: File | null) => void;
  hint?: string;
}

/** Shared xlsx dropzone. Rejects non-xlsx with a toast. */
export function ImportDropzone({ file, onFile, hint }: ImportDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    if (!f) return;
    if (!/\.xlsx?$/i.test(f.name)) {
      toast.error('File harus .xlsx');
      return;
    }
    onFile(f);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        pick(e.dataTransfer.files?.[0] || null);
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors',
        dragOver ? 'border-primary bg-primary/5' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-950 hover:border-primary/60',
      )}
    >
      <Upload className="mb-2 h-8 w-8 text-gray-400 dark:text-gray-500" />
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{file ? file.name : (hint ?? 'Seret file .xlsx ke sini atau klik untuk pilih')}</p>
      {file && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{(file.size / 1024).toFixed(2)} KB</p>}
      <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => pick(e.target.files?.[0] || null)} />
    </div>
  );
}

interface ImportFooterProps {
  onCancel: () => void;
  onPrimary: () => void;
  primaryLabel?: string;
  primaryDisabled?: boolean;
  primaryBusy?: boolean;
  cancelLabel?: string;
}

/** Shared footer: Batal (ghost) + primary action with exact label kept. */
export function ImportFooter({
  onCancel,
  onPrimary,
  primaryLabel = 'Import',
  primaryDisabled,
  primaryBusy,
  cancelLabel = 'Batal',
}: ImportFooterProps) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button type="button" onClick={onPrimary} disabled={primaryDisabled || primaryBusy}>
        {primaryLabel}
      </Button>
    </div>
  );
}
