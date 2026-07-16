import * as React from 'react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * @deprecated Use shadcn Dialog instead (@/components/ui/dialog).
 * Replace Modal with Dialog + DialogContent + DialogHeader + DialogTitle.
 * Props to migrate: open→open, onClose→onOpenChange, title→DialogTitle, children→DialogContent children.
 * Sizes: sm→sm:max-w-sm, md→sm:max-w-md, lg→sm:max-w-lg, xl→sm:max-w-xl
 */
export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-white rounded-lg shadow-xl p-6 max-h-[90vh] overflow-y-auto border border-gray-200',
          {
            'w-full max-w-sm': size === 'sm',
            'w-full max-w-md': size === 'md',
            'w-full max-w-lg': size === 'lg',
            'w-full max-w-xl': size === 'xl',
          },
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

