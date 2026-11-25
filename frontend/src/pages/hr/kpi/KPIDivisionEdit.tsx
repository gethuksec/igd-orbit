import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BreadcrumbHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { hrService } from '@/services/hr.service';
import { KpiScoreGrid } from './KpiScoreGrid';

/**
 * Edit division period — Phase 2 only (D6 split).
 * Scoring per karyawan; aspect CRUD lives in Master Data.
 * Approved periods render read-only; writes stay current-month only.
 */
export default function KPIDivisionEdit() {
  const { id: divisionId = '' } = useParams<{ id: string }>();

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const { data: grid } = useQuery({
    queryKey: ['kpi-grid', divisionId, month, year],
    queryFn: () => hrService.getKpiGrid(divisionId, month, year),
    enabled: !!divisionId,
  });

  const approved = grid?.lock?.status === 'approved' || grid?.lock?.status === 'locked';
  const subtitle = `${now.toLocaleString('id-ID', { month: 'long', year: 'numeric' })} · ${
    approved ? 'Approved by HR' : 'Assigned'
  }`;

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader title={`KPI — ${grid?.division?.name || '...'}`} subtitle={subtitle} />
      <Card>
        <CardContent className="p-0">
          <KpiScoreGrid divisionId={divisionId} periodMonth={month} periodYear={year} mode="edit" />
        </CardContent>
      </Card>
    </div>
  );
}
