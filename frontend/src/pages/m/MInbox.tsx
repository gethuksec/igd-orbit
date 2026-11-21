import ApprovalsInbox from '../hr/approvals/ApprovalsInbox';
import LeaveList from '../hr/leave/LeaveList';
import { isManagerLike, useMe } from './MobileShell';

/** IGDERP-276: kotak masuk — persetujuan (atasan) atau status pengajuan saya (staf). */
export default function MInbox() {
  const { data: me } = useMe();
  if (isManagerLike(me)) return <ApprovalsInbox />;
  return <LeaveList />;
}
