import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BranchFilterSelect } from '@/components/branch/BranchFilter';
import { useBranchStore } from '@/stores/branchStore';
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
    }
  | {
      key: string;
      label: string;
      type: 'branch';
    }
  | {
      key: string;
      label: string;
      type: 'toggle';
      hint?: string;
    }
  | {
      key: string;
      label: string;
      type: 'search-select';
      fetchOptions: (q: string) => Promise<{ value: string; label: string }[]>;
      placeholder?: string;
    }
  | {
      key: string;
      label: string;
      type: 'number-compare';
      placeholder?: string;
    }
  | {
      key: string;
      label: string;
      type: 'age';
    };

export const COMPARE_SYMBOLS: Record<string, string> = { gt: '>', lt: '<', eq: '=' };
export const AGE_UNIT_LABELS: Record<string, string> = { days: 'hari', months: 'bulan', years: 'tahun' };

interface FilterToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  fields: FilterField[];
  values: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  onReset: () => void;

  /** Known value→label pairs for search-select fields (page-kept map of selections). */
  optionLabels?: Record<string, string>;

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
  if (field.type === 'toggle') {
    return values[field.key] === 'true';
  }
  if (field.type === 'number-compare' || field.type === 'age') {
    return Boolean(values[field.key]);
  }
  const v = values[field.key];
  return Boolean(v && v !== '' && v !== 'all');
}

function getFieldSummary(
  field: FilterField,
  values: Record<string, string>,
  branchName?: (id: string) => string,
  labelOf?: (value: string) => string,
): string {
  if (field.type === 'date-range') {
    const from = values[`${field.key}From`];
    const to = values[`${field.key}To`];
    if (from && to) return `${from} – ${to}`;
    if (from) return `dari ${from}`;
    return `sampai ${to}`;
  }
  if (field.type === 'number-compare') {
    const op = values[`${field.key}Op`] || 'eq';
    return `${COMPARE_SYMBOLS[op] ?? op} ${values[field.key]}`;
  }
  if (field.type === 'age') {
    const op = values[`${field.key}Op`] || 'gt';
    const unit = values[`${field.key}Unit`] || 'days';
    return `${COMPARE_SYMBOLS[op] ?? op} ${values[field.key]} ${AGE_UNIT_LABELS[unit] ?? unit}`;
  }
  if (field.type === 'search-select') {
    const v = values[field.key];
    return labelOf?.(v) ?? v;
  }
  const v = values[field.key];
  if (field.type === 'select') {
    return field.options.find((o) => o.value === v)?.label || v;
  }
  if (field.type === 'toggle') {
    return v === 'true' ? 'Ya' : '';
  }
  // IGDERP-192: branch chips resolve id → name (was raw UUID)
  if (field.type === 'branch') {
    return branchName?.(v) || v;
  }
  return v;
}

function SearchSelectInput({
  value,
  label,
  fetchOptions,
  placeholder,
  onSelect,
  onClear,
}: {
  value: string;
  label: string;
  fetchOptions: (q: string) => Promise<{ value: string; label: string }[]>;
  placeholder?: string;
  onSelect: (value: string, label: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const fetchRef = useRef(fetchOptions);
  fetchRef.current = fetchOptions;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        setOptions(await fetchRef.current(query));
      } catch {
        setOptions([]);
      }
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  if (value && !editing) {
    return (
      <div className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm">
        <button
          type="button"
          className="flex-1 truncate text-left"
          title="Ubah pilihan"
          onClick={() => {
            setQuery('');
            setEditing(true);
            setOpen(true);
          }}
        >
          {label || value}
        </button>
        <button
          type="button"
          onClick={() => {
            onClear();
            setQuery('');
            setEditing(false);
          }}
          aria-label="Hapus pilihan"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    );
  }
  return (
    <div ref={boxRef} className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setEditing(true);
          setOpen(true);
        }}
        placeholder={placeholder ?? 'Ketik untuk mencari...'}
        className="h-9"
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-background shadow-lg">
          {loading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Mencari...</div>
          ) : options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Tidak ada hasil</div>
          ) : (
            options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(opt.value, opt.label);
                  setOpen(false);
                  setEditing(false);
                  setQuery('');
                }}
                className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-accent"
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function FilterToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  fields,
  values,
  onFieldChange,
  onReset,
  optionLabels,
  branchFilter,
  className,
  children,
}: FilterToolbarProps) {
  const [open, setOpen] = useState(false);
  // Local draft while the popup is open — committed on "Terapkan".
  const [draft, setDraft] = useState<Record<string, string>>({});
  // value → label cache for search-select fields (fills in as the user picks)
  const [labelCache, setLabelCache] = useState<Record<string, string>>({});
  const labelOf = (v: string) => optionLabels?.[v] ?? labelCache[v] ?? v;

  // IGDERP-192: resolve branch ids to names for chips (falls back to raw id)
  const { availableBranches } = useBranchStore();
  const branchName = (id: string) =>
    availableBranches.find((b) => b.id === id)?.name || id;

  const activeCount = fields.filter((f) => isFieldActive(f, values)).length;

  const openPopup = () => {
    setDraft({ ...values });
    setOpen(true);
  };

  const applyDraft = () => {
    // number-compare/age: a value without an explicit operator/unit still
    // applies — default to `>` and `days` so the backend filter engages.
    const normalized = { ...draft };
    for (const f of fields) {
      if ((f.type === 'number-compare' || f.type === 'age') && normalized[f.key]) {
        if (!normalized[`${f.key}Op`]) normalized[`${f.key}Op`] = values[`${f.key}Op`] || 'gt';
        if (f.type === 'age' && !normalized[`${f.key}Unit`])
          normalized[`${f.key}Unit`] = values[`${f.key}Unit`] || 'days';
      }
    }
    Object.keys(normalized).forEach((key) => {
      const next = normalized[key];
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
    } else if (field.type === 'number-compare') {
      onFieldChange(field.key, '');
      onFieldChange(`${field.key}Op`, '');
    } else if (field.type === 'age') {
      onFieldChange(field.key, '');
      onFieldChange(`${field.key}Op`, '');
      onFieldChange(`${field.key}Unit`, '');
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

        {/* Filter button with active-count badge — hidden when the page
            declares no filter fields (no empty popups, IGDERP-110 rollout) */}
        {fields.length > 0 && (
          <Button type="button" variant="outline" onClick={openPopup} className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filter
            {activeCount > 0 && (
              <Badge className="h-5 min-w-5 px-1.5 text-[11px] bg-primary text-primary-foreground">
                {activeCount}
              </Badge>
            )}
          </Button>
        )}

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
              {field.label}: {getFieldSummary(field, values, branchName, labelOf)}
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
                {field.type === 'branch' && (
                  <BranchFilterSelect
                    value={draft[field.key] ?? ''}
                    onChange={(v) => setDraft((d) => ({ ...d, [field.key]: v }))}
                    allowAll
                    label=""
                    className="h-9 w-full text-sm"
                  />
                )}
                {field.type === 'toggle' && (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={(draft[field.key] ?? values[field.key]) === 'true'}
                      onCheckedChange={(checked) =>
                        setDraft((d) => ({ ...d, [field.key]: checked ? 'true' : '' }))
                      }
                    />
                    {field.hint && <span className="text-xs text-muted-foreground">{field.hint}</span>}
                  </div>
                )}
                {field.type === 'search-select' && (
                  <SearchSelectInput
                    value={draft[field.key] ?? values[field.key] ?? ''}
                    label={labelOf(draft[field.key] ?? values[field.key] ?? '')}
                    fetchOptions={field.fetchOptions}
                    placeholder={field.placeholder}
                    onSelect={(v, label) => {
                      setDraft((d) => ({ ...d, [field.key]: v }));
                      setLabelCache((c) => ({ ...c, [v]: label }));
                    }}
                    onClear={() => setDraft((d) => ({ ...d, [field.key]: '' }))}
                  />
                )}
                {field.type === 'number-compare' && (
                  <div className="flex gap-2">
                    <select
                      value={draft[`${field.key}Op`] ?? values[`${field.key}Op`] ?? 'eq'}
                      onChange={(e) => setDraft((d) => ({ ...d, [`${field.key}Op`]: e.target.value }))}
                      className="h-9 w-20 shrink-0 rounded-md border border-input bg-background px-2 py-1 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Operator ${field.label}`}
                    >
                      <option value="eq">=</option>
                      <option value="gt">&gt;</option>
                      <option value="lt">&lt;</option>
                    </select>
                    <Input
                      type="number"
                      min={0}
                      value={draft[field.key] ?? values[field.key] ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="h-9"
                    />
                  </div>
                )}
                {field.type === 'age' && (
                  <div className="flex gap-2">
                    <select
                      value={draft[`${field.key}Op`] ?? values[`${field.key}Op`] ?? 'gt'}
                      onChange={(e) => setDraft((d) => ({ ...d, [`${field.key}Op`]: e.target.value }))}
                      className="h-9 w-20 shrink-0 rounded-md border border-input bg-background px-2 py-1 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Operator ${field.label}`}
                    >
                      <option value="gt">&gt;</option>
                      <option value="lt">&lt;</option>
                      <option value="eq">=</option>
                    </select>
                    <Input
                      type="number"
                      min={0}
                      value={draft[field.key] ?? values[field.key] ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                      placeholder="0"
                      className="h-9"
                    />
                    <select
                      value={draft[`${field.key}Unit`] ?? values[`${field.key}Unit`] ?? 'days'}
                      onChange={(e) => setDraft((d) => ({ ...d, [`${field.key}Unit`]: e.target.value }))}
                      className="h-9 shrink-0 rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Satuan ${field.label}`}
                    >
                      <option value="days">hari</option>
                      <option value="months">bulan</option>
                      <option value="years">tahun</option>
                    </select>
                  </div>
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
