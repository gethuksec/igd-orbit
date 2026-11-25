import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { GripVertical, Pencil } from 'lucide-react';
import { DataTable, type Column } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { hrService, type KpiAspect } from '@/services/hr.service';

const fmt2 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Read-only aspect list for one division (template: DataTable, Aksi left).
 * Aksi holds a drag grip (reorder, auto-saves) + a pencil to the edit page.
 * Editing lives on dedicated pages; rows are not clickable.
 */
export function KpiAspectTable({ divisionId }: { divisionId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const dragId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const key = ['kpi-aspects', divisionId];
  const { data: aspects = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => hrService.listKpiAspects(divisionId),
    enabled: !!divisionId,
  });

  // Locked (in-use) aspects stay visible with a marker but keep their order.
  const sum = aspects
    .filter((a) => a.isActive !== false)
    .reduce((s, a) => s + Number(a.weight), 0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ['kpi-grid'] });
  };

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => hrService.reorderKpiAspects(divisionId, ids),
    onSuccess: invalidate,
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Gagal menyusun ulang aspek');
      invalidate();
    },
  });

  const move = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const ids = aspects.map((a) => a.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    reorderMutation.mutate(ids);
  };

  const columns: Column<KpiAspect>[] = [
    {
      key: 'name',
      header: 'Aspek',
      cell: (a) => (
        <span className="font-medium">
          {a.name}{' '}
          {a.isActive === false && (
            <span className="font-normal text-xs text-muted-foreground">(nonaktif)</span>
          )}
        </span>
      ),
    },
    {
      key: 'weight',
      header: 'Bobot',
      headerClassName: 'text-right',
      className: 'text-right font-mono tabular-nums',
      cell: (a) => fmt2.format(Number(a.weight)),
    },
    {
      key: 'target',
      header: 'Target',
      headerClassName: 'text-right',
      className: 'text-right font-mono tabular-nums',
      cell: (a) =>
        a.targetType === 'FIXED' ? (
          String(a.fixedTarget ?? '—')
        ) : (
          <span className="text-muted-foreground">Per periode</span>
        ),
    },
  ];

  return (
    <div>
      <DataTable
        actionsPosition="left"
        actionsWidth={104}
        columns={columns}
        data={aspects}
        keyExtractor={(a) => a.id}
        isLoading={isLoading}
        emptyMessage="Belum ada aspek — tambah lewat tombol di bawah"
        actions={(a) => (
          <div className="flex items-center gap-1">
            <span
              role="button"
              tabIndex={0}
              title="Seret untuk susun ulang"
              draggable
              onDragStart={(e) => {
                dragId.current = a.id;
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => {
                dragId.current = null;
                setDragOverId(null);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                toast.message('Seret gagang ini ke baris tujuan untuk menyusun ulang');
              }}
              className="inline-flex h-8 w-6 items-center justify-center rounded-md text-muted-foreground cursor-grab active:cursor-grabbing hover:bg-muted hover:text-foreground"
            >
              <GripVertical className="h-4 w-4" />
            </span>
            <button
              type="button"
              title="Edit"
              onClick={() =>
                navigate(`/hr/master-data/kpi/${divisionId}/aspek/${a.id}/edit`)
              }
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        )}
        rowProps={(a) => ({
          onDragOver: (e) => {
            if (!dragId.current) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (dragOverId !== a.id) setDragOverId(a.id);
          },
          onDragLeave: () => {
            if (dragOverId === a.id) setDragOverId(null);
          },
          onDrop: (e) => {
            e.preventDefault();
            if (dragId.current) move(dragId.current, a.id);
            dragId.current = null;
            setDragOverId(null);
          },
          style: dragOverId === a.id ? { background: 'var(--muted)' } : undefined,
        })}
      />
      {!isLoading && aspects.length > 0 && (
        <div className="flex items-center justify-between px-1 py-3 text-sm">
          <span className="text-muted-foreground">
            Seret gagang di kolom Aksi untuk menyusun ulang — urutan tersimpan otomatis.
          </span>
          <span className="font-mono tabular-nums">
            Total bobot <span className="font-medium">{fmt2.format(sum)}</span>
          </span>
        </div>
      )}
      <div className="flex justify-end px-1 pb-1">
        <Button variant="outline" size="sm" onClick={() => navigate(`/hr/master-data/kpi/${divisionId}/aspek/new`)}>
          Tambah aspek
        </Button>
      </div>
    </div>
  );
}
