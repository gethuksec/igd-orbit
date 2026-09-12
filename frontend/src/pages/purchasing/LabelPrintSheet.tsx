import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { LabelCard } from '@/components/purchasing/LabelCard';
import { labelPrintingService } from '@/services/labelPrinting.service';

/**
 * S5: print sheet — renders queued labels at exact size and opens the browser
 * print dialog. After printing, mark the jobs printed (queue bookkeeping).
 */
export default function LabelPrintSheet() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ids = (params.get('ids') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const { data: settings } = useQuery({
    queryKey: ['label-settings'],
    queryFn: () => labelPrintingService.getSettings(),
  });
  const { data: resp, isLoading } = useQuery({
    queryKey: ['label-sheet', ids.join(',')],
    queryFn: () => labelPrintingService.getJobs({ ids: ids.join(',') }),
    enabled: ids.length > 0,
  });

  const jobs = resp?.data || [];
  const autoPrinted = useRef(false);

  useEffect(() => {
    if (!settings || isLoading || jobs.length === 0 || autoPrinted.current) return;
    autoPrinted.current = true;
    const t = setTimeout(() => window.print(), 700);
    return () => clearTimeout(t);
  }, [settings, isLoading, jobs.length]);

  const markMutation = useMutation({
    mutationFn: () => labelPrintingService.markPrinted(ids),
    onSuccess: (r) => {
      toast.success(`${r.updated} label ditandai sudah dicetak`);
      navigate(-1);
    },
    onError: () => toast.error('Gagal menandai label sudah dicetak'),
  });

  const pageRule = settings
    ? settings.paperType === 'A4'
      ? '@page { size: A4; margin: 8mm; }'
      : `@page { size: ${settings.labelWidthMm}mm ${settings.labelHeightMm}mm; margin: 0; }`
    : '';

  const flatLabels = jobs.flatMap((job) =>
    Array.from({ length: Math.max(1, job.copies) }).map((_, i) => ({
      key: `${job.id}-${i}`,
      data: job.payload,
    })),
  );

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <style>{`${pageRule}
        @media print {
          .no-print { display: none !important; }
          .label-card { border: none !important; }
        }
        .label-qr svg { width: 100%; height: 100%; }
      `}</style>

      <div className="no-print sticky top-0 z-10 bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Printer className="w-5 h-5 text-gray-500" />
          <div>
            <div className="font-semibold">Cetak Label</div>
            <div className="text-xs text-gray-500">
              {jobs.length} job · {flatLabels.length} label
              {settings ? ` · ${settings.paperType === 'A4' ? `${settings.columns} kolom (A4)` : 'thermal'}` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Cetak Lagi
          </Button>
          <Button
            onClick={() => markMutation.mutate()}
            disabled={markMutation.isPending || flatLabels.length === 0}
          >
            {markMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            )}
            Tandai Sudah Dicetak
          </Button>
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : flatLabels.length === 0 ? (
        <div className="text-center py-24 text-gray-500">Tidak ada label untuk dicetak.</div>
      ) : (
        <div className="p-6 print:p-0">
          <div
            className={
              settings?.paperType === 'A4'
                ? 'print:grid'
                : 'flex flex-col items-center gap-4 print:gap-0'
            }
            style={
              settings?.paperType === 'A4'
                ? {
                    display: 'grid',
                    gridTemplateColumns: `repeat(${settings.columns}, ${settings.labelWidthMm}mm)`,
                    gap: '2mm',
                    justifyContent: 'center',
                  }
                : undefined
            }
          >
            {flatLabels.map((label, idx) => (
              <div
                key={label.key}
                className={
                  settings?.paperType === 'A4'
                    ? ''
                    : idx < flatLabels.length - 1
                      ? 'break-after-page'
                      : ''
                }
                style={
                  settings?.paperType === 'A4'
                    ? undefined
                    : { breakAfter: idx < flatLabels.length - 1 ? 'page' : 'auto' }
                }
              >
                {settings && <LabelCard data={label.data} settings={settings} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
