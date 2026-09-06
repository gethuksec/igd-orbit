import { Bell, Shield, Globe, Moon, Sun, FileCheck2 } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { purchasingService } from '@/services/purchasing.service';

const APPROVAL_ROLES = ['HS', 'SPV', 'CSO', 'CFO', 'OWNER', 'MGR', 'SODO'];
const CATEGORY_LABEL: Record<string, string> = {
  PURCHASE_INVOICE: 'Purchase Invoice',
  GOODS_RECEIPT: 'Goods Receipt',
};

export default function Settings() {
  const queryClient = useQueryClient();
  const { data: approvalSettings = [] } = useQuery({
    queryKey: ['approval-settings'],
    queryFn: () => purchasingService.getApprovalSettings(),
  });

  const [draft, setDraft] = useState<Record<string, any>>({});
  const settings = useMemo(() => {
    const map: Record<string, any> = {};
    (approvalSettings as any[]).forEach((s: any) => {
      map[s.category] = {
        roles: s.roles || [],
        userIds: s.userIds || [],
        mandatoryInvoice: s.mandatoryInvoice || false,
      };
    });
    // merge edits
    Object.keys(draft).forEach((k) => {
      map[k] = { ...(map[k] || {}), ...draft[k] };
    });
    return map;
  }, [approvalSettings, draft]);

  const saveMutation = useMutation({
    mutationFn: (payload: { category: string; roles: string[]; userIds: string[]; mandatoryInvoice: boolean }) =>
      purchasingService.updateApprovalSetting(payload.category, {
        roles: payload.roles,
        userIds: payload.userIds,
        mandatoryInvoice: payload.mandatoryInvoice,
      }),
    onSuccess: () => {
      toast.success('Pengaturan persetujuan tersimpan');
      queryClient.invalidateQueries({ queryKey: ['approval-settings'] });
    },
    onError: () => toast.error('Gagal menyimpan pengaturan'),
  });

  const toggleRole = (category: string, role: string) => {
    const current = settings[category]?.roles || [];
    const next = current.includes(role) ? current.filter((r: string) => r !== role) : [...current, role];
    setDraft((d) => ({ ...d, [category]: { ...(d[category] || {}), roles: next } }));
  };

  const toggleMandatory = (category: string, value: boolean) => {
    setDraft((d) => ({ ...d, [category]: { ...(d[category] || {}), mandatoryInvoice: value } }));
  };

  const handleSave = () => {
    saveMutation.mutate({
      category: 'GOODS_RECEIPT',
      roles: settings['GOODS_RECEIPT']?.roles || [],
      userIds: [],
      mandatoryInvoice: !!settings['GOODS_RECEIPT']?.mandatoryInvoice,
    });
    saveMutation.mutate({
      category: 'PURCHASE_INVOICE',
      roles: settings['PURCHASE_INVOICE']?.roles || [],
      userIds: [],
      mandatoryInvoice: !!settings['PURCHASE_INVOICE']?.mandatoryInvoice,
    });
  };

  return (
    <div className="space-y-6">
      <BreadcrumbHeader title="Pengaturan" subtitle="Kelola preferensi dan pengaturan akun Anda" />

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* IGDERP-80/81: purchase approval settings */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileCheck2 className="w-5 h-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">Persetujuan Pembelian</h2>
          </div>
          <div className="space-y-4">
            {(['PURCHASE_INVOICE', 'GOODS_RECEIPT'] as const).map((category) => (
              <div key={category} className="p-4 bg-gray-50 rounded-lg">
                <p className="font-semibold text-gray-900 mb-1">{CATEGORY_LABEL[category]}</p>
                <p className="text-sm text-gray-500 mb-2">
                  Kosong = perilaku sekarang (HS, SPV, CSO, OWNER). Pilih role approver:
                </p>
                <div className="flex flex-wrap gap-2">
                  {APPROVAL_ROLES.map((role) => {
                    const on = (settings[category]?.roles || []).includes(role);
                    return (
                      <button
                        key={role}
                        onClick={() => toggleRole(category, role)}
                        className={`px-3 py-1 rounded-full text-sm font-semibold border transition-colors ${
                          on
                            ? 'bg-red-50 border-red-500 text-red-600'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {role}
                      </button>
                    );
                  })}
                </div>
                {category === 'GOODS_RECEIPT' && (
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Invoice wajib sebelum approve</p>
                      <p className="text-xs text-gray-500">
                        #81 — opsional secara default; aktifkan bila klien minta
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!settings[category]?.mandatoryInvoice}
                        onChange={(e) => toggleMandatory(category, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600" />
                    </label>
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">Notifikasi</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-gray-900">Notifikasi Email</p>
                <p className="text-sm text-gray-500">Terima notifikasi via email</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-gray-900">Notifikasi Push</p>
                <p className="text-sm text-gray-500">Terima notifikasi push di browser</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">Keamanan</h2>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900 mb-1">Ubah Password</p>
              <p className="text-sm text-gray-500 mb-3">Ubah password akun Anda untuk keamanan yang lebih baik</p>
              <button
                disabled
                className="px-4 py-2 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed"
              >
                Fitur ini akan segera tersedia
              </button>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900 mb-1">Sesi Aktif</p>
              <p className="text-sm text-gray-500">Kelola sesi aktif Anda di berbagai perangkat</p>
              <button
                disabled
                className="px-4 py-2 bg-gray-200 text-gray-500 rounded-lg mt-2 cursor-not-allowed"
              >
                Fitur ini akan segera tersedia
              </button>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">Preferensi</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-gray-900">Bahasa</p>
                <p className="text-sm text-gray-500">Pilih bahasa untuk antarmuka</p>
              </div>
              <select
                defaultValue="id"
                className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-gray-900">Tema</p>
                <p className="text-sm text-gray-500">Pilih tema tampilan</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 bg-red-100 text-red-600 rounded-lg" title="Light Mode">
                  <Sun className="w-5 h-5" />
                </button>
                <button className="p-2 bg-gray-100 text-gray-600 rounded-lg" title="Dark Mode">
                  <Moon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

