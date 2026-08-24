import { type ReactNode, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BranchFilterSelect } from '@/components/branch/BranchFilter';
import { cn } from '@/lib/utils';

/**
 * Filter toolbar — schema-driven shared component (IGDERP-110).
 *
 * Design (approved mockup 2026-08-24):
 * - Search bar stays INLINE (high-frequency), default search = document number.
 * - Branch dropdown stays INLINE next to search (IGDERP-107).
 * - "Filter (n)" button with active-count badge opens a FIXED-SIZE scrollable
 *   popup (Dialog; Sheet on mobile can be added later) with sticky header/footer.
 * - Popup fields are declared per page as a `fields` schema — adding a new
 *   parameter later = one more object in the array, zero new UI code (DRY).
 * - Active filters show as removable chips; "Hapus semua" resets.
 *
 * Field value keys:
 * - select / input → values[field.key]
 * - date-range     → values[`${field.key}From`] and values[`${field.key}To`]
 *   (single string values, ISO format, as used by the page's query params)
 */

export type FilterField =
  | {
      key: string;
      label: string;
      type: 'select';
      options: { value: string; label: string }[];
    }
  | {
      key: string;
      label: string;
      type: 'date-range';
    }
  | {
      key: string;
      label: string;
      type: 'input';
      placeholder?: string;
    };

interface FilterToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  fields: FilterField[];
  values: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  onReset: () => void;

  /** Inline branch dropdown (IGDERP-107). */
  branchFilter?: {
    value: string;
    onChange: (value: string) => void;
    allowAll?: boolean;
  };

  className?: string;
  children?: ReactNode; // Extra buttons etc.
}

function isFieldActive(field: FilterField, values: Record<string, string>): boolean {
  if (field.type === 'date-range') {
    return Boolean(values[`${field.key}From`] || values[`${field.key}To`]);
  }
  const v = values[field.key];
  return Boolean(v && v !== '' && v !== 'all');
}

function getFieldSummary(field: FilterField, values: Record<string, string>): string {
  if (field.type === 'date-range') {
    const from = values[`${field.key}From`];
    const to = values[`${field.key}To`];
    if (from && to) return `${from} – ${to}`;
    if (from) return `dari ${from}`;
    return `sampai ${to}`;
  }
  const v = values[field.key];
  if (field.type === 'select') {
    return field.options.find((o) => o.value === v)?.label || v;
  }
  return v;
}

export function FilterToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  fields,
  values,
  onFieldChange,
  onReset,
  branchFilter,
  className,
  children,
}: FilterToolbarProps) {
  const [open, setOpen] = useState(false);
  // Local draft while the popup is open — committed on "Terapkan".
  const [draft, setDraft] = useState<Record<string, string>>({});

  const activeCount = fields.filter((f) => isFieldActive(f, values)).length;

  const openPopup = () => {
    setDraft({ ...values });
    setOpen(true);
  };

  const applyDraft = () => {
    Object.keys(draft).forEach((key) => {
      const next = draft[key];
      if (values[key] !== next) onFieldChange(key, next);
    });
    setOpen(false);
  };

  const resetAll = () => {
    onReset();
    setOpen(false);
  };

  const removeChip = (field: FilterField) => {
    if (field.type === 'date-range') {
      onFieldChange(`${field.key}From`, '');
      onFieldChange(`${field.key}To`, '');
    } else {
      onFieldChange(field.key, '');
    }
  };

  const activeFields = fields.filter((f) => isFieldActive(f, values));

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-end gap-3">
        {/* Search input — inline, always visible */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>

        {/* Branch dropdown — inline (IGDERP-107) */}
        {branchFilter && (
          <BranchFilterSelect
            value={branchFilter.value}
            onChange={branchFilter.onChange}
            allowAll={branchFilter.allowAll}
          />
        )}

        {/* Filter button with active-count badge */}
        <Button type="button" variant="outline" onClick={openPopup} className="gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          Filter
          {activeCount > 0 && (
            <Badge className="h-5 min-w-5 px-1.5 text-[11px] bg-primary text-primary-foreground">
              {activeCount}
            </Badge>
          )}
        </Button>

        {children}
      </div>

      {/* Active filter chips */}
      {activeFields.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeFields.map((field) => (
            <span
              key={field.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary-700"
            >
              {field.label}: {getFieldSummary(field, values)}
              <button
                type="button"
                aria-label={`Hapus filter ${field.label}`}
                onClick={() => removeChip(field)}
                className="text-primary-600 hover:text-primary-800"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={resetAll}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Hapus semua
          </button>
        </div>
      )}

      {/* Filter popup — fixed size, scrollable body, sticky header/footer */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(520px,80vh)] w-full max-w-sm flex-col gap-0 p-0">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Filter</DialogTitle>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {fields.map((field) => (
              <div key={field.key}>
                <Label className="mb-1.5 block text-xs font-medium">{field.label}</Label>
                {field.type === 'select' && (
                  <select
                    value={draft[field.key] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Semua {field.label}</option>
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
                {field.type === 'date-range' && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={draft[`${field.key}From`] ?? ''}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [`${field.key}From`]: e.target.value }))
                      }
                      className="h-9"
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="date"
                      value={draft[`${field.key}To`] ?? ''}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [`${field.key}To`]: e.target.value }))
                      }
                      className="h-9"
                    />
                  </div>
                )}
                {field.type === 'input' && (
                  <Input
                    value={draft[field.key] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="h-9"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 border-t px-4 py-3">
            <Button type="button" variant="ghost" onClick={resetAll} className="flex-1">
              Reset
            </Button>
            <Button type="button" onClick={applyDraft} className="flex-1">
              Terapkan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
