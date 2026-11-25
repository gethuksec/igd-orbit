import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BreadcrumbHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { hrService } from '@/services/hr.service';
import { KpiScoreGrid } from './KpiScoreGrid';

const monthName = (m: number, y: number) =>
  new Date(y, m - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' });

/**
 * Assign KPI — Phase 2 only (D6 split, mock v2).
 * Aspects are read-only here (managed in Master Data);
 * scoring writes open the period. Assign-once enforced server-side.
 */
export default function KPIAssign() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const divisionId = searchParams.get('division') || '';

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

  const aspects = ctx?.aspects ?? [];
  const sum = ctx?.weightsSum ?? 0;
  const blocked = aspects.length === 0 || Math.abs(sum - 1) > 1e-9;

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader
        title={`Assign KPI — ${ctx?.division?.name || '...'}`}
        subtitle={`Nilai awal ${ctx ? monthName(ctx.periodMonth, ctx.periodYear) : '...'}. Aspek dari Master Data.`}
      />

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
      ) : blocked ? (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground space-y-2">
            <p>
              {aspects.length === 0
                ? 'Divisi ini belum punya aspek.'
                : `Total bobot harus 1,00 (saat ini ${sum.toFixed(2)}).`}
            </p>
            <p>
              Kelola aspek di{' '}
              <Link to="/hr/master-data/kpi" className="text-primary underline">
                Master Data Aspek KPI
              </Link>
              , lalu kembali ke sini untuk assign.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Aspek (read-only{ctx.prefill ? `, target disalin dari ${monthName(ctx.prefill.month, ctx.prefill.year)}` : ''})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <tbody>
                  {aspects.map((a) => (
                    <tr key={a.id} className="border-t first:border-t-0">
                      <td className="px-5 py-2">
                        <span className="font-medium">{a.name}</span>
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums text-muted-foreground">
                        {Number(a.weight).toFixed(2)} ·{' '}
                        {a.targetType === 'FIXED'
                          ? `target ${a.fixedTarget}`
                          : `target ${ctx.prefill?.targets[a.id] ?? '—'} / bln`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <KpiScoreGrid
                divisionId={divisionId}
                periodMonth={ctx.periodMonth}
                periodYear={ctx.periodYear}
                mode="assign"
                onBack={() => navigate('/hr/kpi')}
                onDone={() => navigate(`/hr/kpi/division/${divisionId}`)}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
