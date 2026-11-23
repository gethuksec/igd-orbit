import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BreadcrumbHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { hrService } from '@/services/hr.service';
import { KpiAspectTable } from './KpiAspectTable';
import { KpiScoreGrid } from './KpiScoreGrid';
import { toast } from 'sonner';

const monthName = (m: number, y: number) =>
  new Date(y, m - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' });

/**
 * Assign wizard (IGDERP-266): step 1 aspects (prefilled from the latest
 * previous period) -> step 2 employee inputs -> Simpan opens the period.
 * Assign-once is enforced server-side; Next needs bobot total 1,00.
 */
export default function KPIAssign() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const divisionId = searchParams.get('division') || '';
  const [step, setStep] = useState<1 | 2>(1);
  const [weightsSum, setWeightsSum] = useState(0);
  const [aspectCount, setAspectCount] = useState(0);

  const { data: ctx, isLoading } = useQuery({
    queryKey: ['kpi-assign-context', divisionId],
    queryFn: () => hrService.getKpiAssignContext(divisionId),
    enabled: !!divisionId,
    retry: false,
  });

  if (!divisionId) {
    return (
      <div className="w-full space-y-6">
        <p className="text-sm text-muted-foreground p-8">Pilih divisi dari daftar KPI terlebih dahulu.</p>
      </div>
    );
  }

  const ready = !!ctx;
  const blocked = aspectCount === 0 || Math.abs(weightsSum - 1) > 1e-9;

  const next = () => {
    if (blocked) {
      toast.error(
        aspectCount === 0 ? 'Tambah minimal satu aspek' : `Total bobot harus 1,00 (saat ini ${weightsSum.toFixed(2)})`,
      );
      return;
    }
    setStep(2);
  };

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader
        title={`Assign KPI — ${ctx?.division?.name || '...'}`}
        subtitle={`Langkah ${step} dari 2. Nilai awal ${ready ? monthName(ctx.periodMonth, ctx.periodYear) : '...'}.`}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-xl border overflow-hidden">
        <div className={`px-5 py-3 ${step === 1 ? 'bg-muted border-t-2 border-t-primary' : 'text-muted-foreground'}`}>
          <p className="font-medium text-sm">Langkah 1 — Aspek dan target</p>
          <p className="text-xs text-muted-foreground">
            {ctx?.prefill
              ? `Target disalin dari ${monthName(ctx.prefill.month, ctx.prefill.year)}, periksa sebelum lanjut`
              : 'Susun daftar aspek divisi ini'}
          </p>
        </div>
        <div className={`px-5 py-3 ${step === 2 ? 'bg-muted border-t-2 border-t-primary' : 'text-muted-foreground'}`}>
          <p className="font-medium text-sm">Langkah 2 — Nilai karyawan</p>
          <p className="text-xs text-muted-foreground">Input per karyawan, draf tersimpan otomatis</p>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground">Memuat...</CardContent>
        </Card>
      ) : !ctx ? (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground">
            Periode ini sudah di-assign — buka lewat Edit.
            <Button variant="link" onClick={() => navigate(`/hr/kpi/division/${divisionId}`)}>
              Ke halaman edit
            </Button>
          </CardContent>
        </Card>
      ) : step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Aspek dan target</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <KpiAspectTable
              divisionId={divisionId}
              onStats={(sum, count) => {
                setWeightsSum(sum);
                setAspectCount(count);
              }}
            />
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t">
              <Button onClick={next} disabled={blocked}>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <KpiScoreGrid
              divisionId={divisionId}
              periodMonth={ctx.periodMonth}
              periodYear={ctx.periodYear}
              mode="assign"
              onBack={() => setStep(1)}
              onDone={() => navigate(`/hr/kpi/division/${divisionId}`)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
