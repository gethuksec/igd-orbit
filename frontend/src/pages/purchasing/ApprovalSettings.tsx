import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BreadcrumbHeader } from '@/components/shared';
import { purchasingService } from '@/services/purchasing.service';

// {'PURCHASE_INVOICE': 'Purchase Invoice', 'GOODS_RECEIPT': 'Goods Receipt'}
export default function ApprovalSettingsPage() {
  const queryClient = useQueryClient();
  const { data: approvalSettings = [] } = useQuery({
    queryKey: ['approval-settings'],
    queryFn: () => purchasingService.getApprovalSettings(),
  });

  const [draft, setDraft] = useState<Record<string, any>>({});

  useEffect(() => {
    if (approvalSettings.length && Object.keys(draft).length === 0) {
      setDraft(
        Object.fromEntries(
          approvalSettings.map((s: any) => [s.category, { ...s }]),
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalSettings]);

  const roles = ['SUPERADMIN', 'OWNER', 'MGR', 'CFO', 'CMO', 'CSO', 'SPV', 'HS', 'SODO', 'ASA'];
  const labels: Record<string, string> = {
    PURCHASE_INVOICE: 'Purchase Invoice',
    GOODS_RECEIPT: 'Goods Receipt',
    SUPERADMIN: 'Super Admin',
    OWNER: 'Owner',
    MGR: 'Manajer',
    CFO: 'CFO',
    CMO: 'CMO',
    CSO: 'CSO',
    SPV: 'Supervisor',
    HS: 'Head Store',
    SODO: 'SODO',
    ASA: 'Asisten',
  };
  const toggleRole = (s: any, role: string) => {
    const cur = (draft[s.category]?.roles ?? []) as string[];
    const next = cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role];
    setDraft((d: any) => ({ ...d, [s.category]: { ...d[s.category], roles: next } }));
  };
  const toggleMandatoryInvoice = (s: any) => {
    setDraft((d: any) => ({ ...d, [s.category]: { ...d[s.category], mandatoryInvoice: !d[s.category]?.mandatoryInvoice } }));
  };

  const saveMutation = useMutation({
    mutationFn: (payload: { category: string; roles: string[]; userIds: string[]; mandatoryInvoice: boolean }) =>
      purchasingService.updateApprovalSetting(payload.category, {
        roles: payload.roles,
        userIds: payload.userIds,
        mandatoryInvoice: payload.mandatoryInvoice,
      }),
  });

  const handleSave = () => {
    const payloads = ['PURCHASE_INVOICE', 'GOODS_RECEIPT']
      .filter((c) => draft[c])
      .map((c) => ({
        category: c,
        roles: draft[c].roles,
        userIds: draft[c].userIds,
        mandatoryInvoice: false,
      }));
    Promise.all(payloads.map((p) => saveMutation.mutateAsync(p)))
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['approval-settings'] });
        toast.success('Pengaturan persetujuan tersimpan');
      })
      .catch((e) => toast.error(e?.response?.data?.message || 'Gagal menyimpan pengaturan'));
  };

  return (
    <div className="space-y-6">
      <BreadcrumbHeader title="Persetujuan Pembelian" />
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-red-600" />
          <h2 className="text-lg font-semibold text-gray-900">Persetujuan Pembelian</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Atur siapa yang menyetujui dokumen pembelian. Kosongkan semua peran untuk kembali ke
          perilaku default (HS / SPV / CSO / Owner + Super Admin).
        </p>
        {(['PURCHASE_INVOICE', 'GOODS_RECEIPT'] as const).map((cat) => {
          const s = draft[cat] || { roles: [], userIds: [], mandatoryInvoice: false };
          return (
            <div key={cat} className="border border-gray-200 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">{labels[cat]}</h3>
                <span className="text-xs text-gray-400">
                  {s.roles.length === 0 && s.userIds.length === 0 ? 'Default' : 'Kustom'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(cat, role)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      s.roles.includes(role)
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-red-400'
                    }`}
                  >
                    {labels[role] || role}
                  </button>
                ))}
              </div>
              {cat === 'GOODS_RECEIPT' && (
                <label className="flex items-center gap-2 mt-4 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!s.mandatoryInvoice}
                    onChange={() => toggleMandatoryInvoice(cat)}
                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  Invoice wajib diunggah sebelum approve
                </label>
              )}
            </div>
          );
        })}
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Simpan Pengaturan
        </button>
      </div>
    </div>
  );
}
