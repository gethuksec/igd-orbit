import { type ReactNode } from 'react';
import { FilterToolbar, type FilterField } from './FilterToolbar';

interface FilterOption {
  value: string;
  label: string;
}

interface SearchFilterProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  filters?: Array<{
    key: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: FilterOption[];
    placeholder?: string;
  }>;

  className?: string;
  children?: ReactNode; // Extra buttons etc.
}

/**
 * Backward-compatible wrapper over FilterToolbar (IGDERP-110).
 *
 * Existing pages keep their current props; the inline selects now render
 * inside the shared filter popup instead of inline. Migrate pages to
 * FilterToolbar directly when adding popup-only field types (date-range, input).
 */
export function SearchFilter({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  className,
  children,
}: SearchFilterProps) {
  const values = Object.fromEntries(filters.map((f) => [f.key, f.value]));
  const fields: FilterField[] = filters.map((f) => ({
    key: f.key,
    label: f.label,
    type: 'select',
    options: f.options,
  }));

  const handleFieldChange = (key: string, value: string) => {
    filters.find((f) => f.key === key)?.onChange(value);
  };

  const handleReset = () => {
    filters.forEach((f) => f.onChange(''));
  };

  return (
    <FilterToolbar
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      fields={fields}
      values={values}
      onFieldChange={handleFieldChange}
      onReset={handleReset}
      className={className}
    >
      {children}
    </FilterToolbar>
  );
}
