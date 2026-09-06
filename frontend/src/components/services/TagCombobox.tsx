import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export const upperFirstTag = (s: string) => {
  const t = s.trim().replace(/\s+/g, ' ');
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : '';
};

// IGDERP-136 shared: combobox-multi creatable (dipakai intake + detail tambah layanan)
export default function TagCombobox({
  value,
  onChange,
  localSuggestions,
  suggestRemote,
  placeholder,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  localSuggestions: string[];
  suggestRemote?: (q: string) => Promise<string[]>;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [remote, setRemote] = useState<string[]>([]);
  const q = input.trim();
  useEffect(() => {
    if (!suggestRemote) return;
    const t = setTimeout(async () => {
      try {
        setRemote(await suggestRemote(q));
      } catch {
        setRemote([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q, suggestRemote]);
  const merged = [
    ...remote,
    ...localSuggestions.filter((s) => !remote.some((r) => r.toLowerCase() === s.toLowerCase())),
  ]
    .filter(
      (s) =>
        !value.some((v) => v.toLowerCase() === s.toLowerCase()) &&
        (!q || s.toLowerCase().includes(q.toLowerCase())),
    )
    .slice(0, 5);
  const newTag = upperFirstTag(q);
  const canAdd =
    newTag.length > 0 &&
    ![...value, ...merged].some((v) => v.toLowerCase() === newTag.toLowerCase());
  const commit = (tag: string) => {
    const t = upperFirstTag(tag);
    if (!t) return;
    if (!value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setInput('');
    setOpen(false);
  };
  return (
    <div className="relative">
      <div
        className="flex min-h-7 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1"
        onClick={() => setOpen(true)}
      >
        {value.map((t) => (
          <span
            key={t}
            className="flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800"
          >
            {t}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((x) => x !== t));
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (merged.length) commit(merged[0]);
              else if (canAdd) commit(newTag);
            }
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={value.length ? '' : placeholder || 'Pilih / ketik tag...'}
          className="min-w-20 flex-1 bg-transparent text-xs outline-none"
        />
      </div>
      {open && (merged.length > 0 || canAdd) && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-40 overflow-auto rounded-md border bg-white shadow">
          {merged.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                commit(s);
              }}
              className="block w-full px-3 py-2 text-left text-xs hover:bg-muted"
            >
              {s}
            </button>
          ))}
          {canAdd && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                commit(newTag);
              }}
              className="block w-full border-t px-3 py-2 text-left text-xs font-medium text-primary hover:bg-muted"
            >
              + Tambah &quot;{newTag}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
