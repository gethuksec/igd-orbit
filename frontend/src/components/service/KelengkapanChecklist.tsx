import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, X, CheckSquare } from 'lucide-react';
import { serviceCheckpointsService } from '@/services/service-checkpoints.service';
import type { CompletenessItem } from '@/types/service';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface KelengkapanChecklistProps {
  items: CompletenessItem[];
  onChange: (items: CompletenessItem[]) => void;
}

/**
 * 2-column dynamic kelengkapan checklist.
 * - Active checkpoints from GET /service-checkpoints/active render automatically.
 * - "+ Tambah" adds one-off inline items (no checkpointId, stored in JSON only).
 * - Each row: checkbox + name + condition note input.
 */
export default function KelengkapanChecklist({ items, onChange }: KelengkapanChecklistProps) {
  const [newItemName, setNewItemName] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const { data: checkpoints = [] } = useQuery({
    queryKey: ['service-checkpoints', 'active'],
    queryFn: () => serviceCheckpointsService.getActive(),
  });

  // Merge active checkpoints with any extra items already in state
  const rows: CompletenessItem[] = checkpoints.map((cp) => {
    const existing = items.find((i) => i.checkpointId === cp.id) || items.find((i) => i.name === cp.name);
    return existing ?? { checkpointId: cp.id, name: cp.name, checked: false, conditionNote: '' };
  });
  // Extra one-off items (no matching checkpoint)
  const extraItems = items.filter(
    (i) => !checkpoints.some((cp) => cp.id === i.checkpointId) && !checkpoints.some((cp) => cp.name === i.name),
  );
  const allRows = [...rows, ...extraItems];

  const updateItem = (index: number, patch: Partial<CompletenessItem>) => {
    const next = [...allRows];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeItem = (index: number) => {
    const next = [...allRows];
    next.splice(index, 1);
    onChange(next);
  };

  const addInlineItem = () => {
    const name = newItemName.trim();
    if (!name) return;
    onChange([...allRows, { name, checked: true, conditionNote: '' }]);
    setNewItemName('');
    setShowAdd(false);
  };

  const checkedCount = allRows.filter((r) => r.checked).length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
          <CheckSquare className="w-3.5 h-3.5 text-primary" />
          Kelengkapan
          <span className="text-xs text-gray-400">
            ({checkedCount}/{allRows.length} tercentang)
          </span>
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs border-primary text-primary hover:bg-primary-50"
          onClick={() => setShowAdd((v) => !v)}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Tambah
        </Button>
      </div>

      {/* Inline add form */}
      {showAdd && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-primary-50/50 rounded-lg">
          <Input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addInlineItem();
              }
            }}
            placeholder="Nama kelengkapan (mis. Anti gores)"
            className="h-8 text-sm"
            autoFocus
          />
          <Button type="button" size="sm" className="text-xs bg-primary text-primary-foreground hover:bg-primary-700" onClick={addInlineItem}>
            Simpan
          </Button>
          <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={() => setShowAdd(false)}>
            Batal
          </Button>
        </div>
      )}

      {/* 2-column checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {allRows.map((row, i) => (
          <div key={`${row.checkpointId ?? 'extra'}-${i}`} className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              checked={row.checked}
              onChange={(e) => updateItem(i, { checked: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary shrink-0"
            />
            <span className="text-sm text-gray-800 w-32 shrink-0 truncate" title={row.name}>
              {row.name}
            </span>
            <Input
              value={row.conditionNote || ''}
              onChange={(e) => updateItem(i, { conditionNote: e.target.value })}
              placeholder="Kondisi..."
              className="h-7 text-xs flex-1 min-w-0"
            />
            {!row.checkpointId && (
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="w-5 h-5 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center shrink-0"
              >
                <X className="w-3 h-3 text-red-500" />
              </button>
            )}
          </div>
        ))}
        {allRows.length === 0 && (
          <p className="text-xs text-gray-400 col-span-2">Tidak ada item kelengkapan.</p>
        )}
      </div>
    </div>
  );
}
