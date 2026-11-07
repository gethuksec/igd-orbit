import { BreadcrumbHeader } from '@/components/shared';
import OpnameApproverCard from './OpnameApproverCard';

/**
 * Administrator → General. The Stock Opname approver card itself lives in
 * OpnameApproverCard (shared with the Approval page, the sidebar entry).
 */
export default function GeneralSettings() {
  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="General" subtitle="Pengaturan umum aplikasi" />

      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-5">
        <OpnameApproverCard />
      </div>
    </div>
  );
}
