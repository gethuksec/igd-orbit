interface RowsPerPageSelectProps {
  value: number;
  onChange: (value: number) => void;
  options?: number[];
}

/**
 * Rows-per-page dropdown for list footers (approved mockup 2026-08-24).
 * Lives in the table footer next to pagination — NOT inside the filter popup.
 */
export function RowsPerPageSelect({
  value,
  onChange,
  options = [10, 25, 50, 100],
}: RowsPerPageSelectProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="whitespace-nowrap text-xs">Baris per halaman</span>
      <select
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus:ring-2 focus:ring-primary-500"
      >
        {options.map((opt) => (
          <option key={opt} value={String(opt)}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
