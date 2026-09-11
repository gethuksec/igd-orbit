import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Settings, Loader2, Save, UserRound, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { purchasingService } from '@/services/purchasing.service';
import { usersService } from '@/services/users.service';
import { formatCurrency, formatDate } from '@/utils/format';

const ROLE_LABELS: Record<string, string> = {
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

/** Roles eligible as approvers (shown as quick-pick chips). */
const APPROVER_ROLES = ['SUPERADMIN', 'OWNER', 'MGR', 'CFO', 'CSO', 'SPV', 'HS', 'CHR'];
/** Roles shown in the per-user picker. */
const PICKER_ROLE_CODES = ['HS', 'SPV', 'CSO', 'OWNER', 'CFO', 'MGR', 'CHR'];

const CATEGORY_LABEL: Record<string, string> = {
  PURCHASE_INVOICE: 'Purchase Invoice',
  GOODS_RECEIPT: 'Goods Receipt',
};

/** Statuses that still require GR approval (awaiting queue). */
const GR_AWAITING_STATUSES = ['draft', 'received', 'inspected', 'revisit'];
/** Final GR statuses shown in history. */
const GR_HISTORY_STATUSES = ['approved', 'rejected', 'cancelled'];
/** PO statuses shown in history. */
const PO_HISTORY_STATUSES = ['approved', 'ordered', 'received', 'rejected', 'cancelled'];

const GR_HISTORY_BADGE: Record<string, { label: string; className: string }> = {
  approved: { label: 'Disetujui', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  rejected: { label: 'Ditolak', className: 'bg-red-900 text-white border-red-900' },
  cancelled: { label: 'Dibatalkan', className: 'bg-slate-200 text-slate-700 border-slate-300' },
};

const PO_HISTORY_BADGE: Record<string, { label: string; className: string }> = {
  approved: { label: 'Disetujui', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  ordered: { label: 'Dipesan', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  received: { label: 'Diterima', className: 'bg-teal-100 text-teal-800 border-teal-300' },
  rejected: { label: 'Ditolak', className: 'bg-red-900 text-white border-red-900' },
  cancelled: { label: 'Dibatalkan', className: 'bg-slate-200 text-slate-700 border-slate-300' },
};

/** Approval tier per PO amount: <5M CSO, 5M-50M CSO+CFO, >50M CSO+CFO+OWNER. */
const poTierHint = (total: number): string => {
  if (total < 5_000_000) return 'CSO';
  if (total <= 50_000_000) return 'CSO + CFO';
  return 'CSO + CFO + OWNER';
};

const dedupeById = <T extends { id: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((x) => {
    if (!x?.id || seen.has(x.id)) return false;
    seen.add(x.id);
    return true;
  });
};

/**
 * Approval queue page: GR awaiting approve / PO awaiting approve / Riwayat.
 * NOTE: queue pages do NOT auto-filter by role — SUPERADMIN sees all rows;
 * any approver also sees all pending rows (role enforcement happens at the API).
 */
export default function ApprovalSettingsPage() {
  const queryClient = useQueryClient();

  // Current user (same pattern as PurchaseOrderDetail.tsx)
  const getCurrentUser = () => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const currentUser = getCurrentUser();
  const userRoles: string[] =
    currentUser?.roles || (currentUser?.role?.code ? [currentUser.role.code] : []);
  const isSuperAdmin = userRoles.includes('SUPERADMIN');

  const [tab, setTab] = useState<'gr' | 'po' | 'history'>('gr');

  // ---------------------------------------------------------------
  // Data queries
  // ---------------------------------------------------------------
  const { data: approvalSettings = [] } = useQuery({
    queryKey: ['approval-settings'],
    queryFn: () => purchasingService.getApprovalSettings(),
  });

  const { data: usersResp } = useQuery({
    queryKey: ['users', 'approval-picker'],
    queryFn: () => usersService.getAll({ limit: 100, sort: 'name', order: 'asc' }),
  });

  const approverUsers = useMemo(() => {
    const items: any[] = (usersResp as any)?.data || [];
    return items.filter((u: any) =>
      (u.roles || []).some((r: any) => PICKER_ROLE_CODES.includes(r.code)),
    );
  }, [usersResp]);

  /** id -> display name, used to resolve GR receivedBy. */
  const userById = useMemo(() => {
    const map: Record<string, string> = {};
    const items: any[] = (usersResp as any)?.data || [];
    items.forEach((u: any) => {
      if (u?.id) map[u.id] = u.fullName || u.name || u.email?.split('@')[0] || '';
    });
    return map;
  }, [usersResp]);

  // GR awaiting approval (merged across statuses, deduped by id)
  const { data: grAwaiting, isLoading: grWaitingLoading } = useQuery({
    queryKey: ['goods-receipts', 'awaiting'],
    queryFn: async () => {
      const results = await Promise.all(
        GR_AWAITING_STATUSES.map((status) =>
          purchasingService.getGoodsReceipts({ status, limit: 100 }),
        ),
      );
      return dedupeById<{ id: string }>(results.flatMap((r: any) => r.data || []));
    },
  });

  // PO awaiting approval
  const { data: poAwaiting, isLoading: poWaitingLoading } = useQuery({
    queryKey: ['purchase-orders', 'awaiting'],
    queryFn: () => purchasingService.getPurchaseOrders({ status: 'pending', limit: 100 }),
  });
  const poAwaitingList = poAwaiting?.data || [];

  // History (final states)
  const { data: grHistory } = useQuery({
    queryKey: ['goods-receipts', 'history'],
    queryFn: async () => {
      const results = await Promise.all(
        GR_HISTORY_STATUSES.map((status) =>
          purchasingService.getGoodsReceipts({ status, limit: 50 }),
        ),
      );
      return dedupeById<{ id: string }>(results.flatMap((r: any) => r.data || []));
    },
  });

  const { data: poHistory } = useQuery({
    queryKey: ['purchase-orders', 'history'],
    queryFn: async () => {
      const results = await Promise.all(
        PO_HISTORY_STATUSES.map((status) =>
          purchasingService.getPurchaseOrders({ status, limit: 50 }),
        ),
      );
      return dedupeById<{ id: string }>(results.flatMap((r: any) => r.data || []));
    },
  });

  // ---------------------------------------------------------------
  // Action mutations
  // ---------------------------------------------------------------
  const approveGRMutation = useMutation({
    mutationFn: (id: string) => purchasingService.approveGoodsReceipt(id),
    onSuccess: () => {
      toast.success('Goods receipt disetujui');
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Gagal menyetujui goods receipt'),
  });

  const approvePOMutation = useMutation({
    mutationFn: (vars: { id: string; notes: string }) =>
      purchasingService.approvePurchaseOrder(vars.id, vars.notes || undefined),
    onSuccess: () => {
      toast.success('Purchase order disetujui');
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setApprovePo({ open: false, id: null, notes: '' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Gagal menyetujui purchase order'),
  });

  // Shared reason modal (GR reject / GR revisit / PO reject)
  const [reasonState, setReasonState] = useState<{
    kind: 'reject' | 'revisit' | 'po_reject' | null;
    id: string | null;
  }>({ kind: null, id: null });
  const [reason, setReason] = useState('');

  const reasonMutation = useMutation({
    mutationFn: (vars: { kind: string; id: string; reason: string }) => {
      if (vars.kind === 'revisit') return purchasingService.revisitGoodsReceipt(vars.id, vars.reason);
      if (vars.kind === 'po_reject') return purchasingService.rejectPurchaseOrder(vars.id, vars.reason);
      return purchasingService.rejectGoodsReceipt(vars.id, vars.reason);
    },
    onSuccess: (_, vars) => {
      toast.success(
        vars.kind === 'revisit'
          ? 'GR dikembalikan ke SODO'
          : vars.kind === 'po_reject'
            ? 'Purchase order ditolak'
            : 'Goods receipt ditolak',
      );
      queryClient.invalidateQueries({
        queryKey: vars.kind === 'po_reject' ? ['purchase-orders'] : ['goods-receipts'],
      });
      setReasonState({ kind: null, id: null });
      setReason('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Gagal memproses alasan'),
  });

  const closeReasonModal = () => {
    setReasonState({ kind: null, id: null });
    setReason('');
  };

  const handleReasonConfirm = () => {
    if (!reasonState.id || !reason.trim() || !reasonState.kind) return;
    reasonMutation.mutate({ kind: reasonState.kind, id: reasonState.id, reason: reason.trim() });
  };

  const reasonModalTitle =
    reasonState.kind === 'revisit' ? 'Revisit Goods Receipt' : reasonState.kind === 'po_reject' ? 'Tolak Purchase Order' : 'Tolak Goods Receipt';

  // PO approve modal
  const [approvePo, setApprovePo] = useState<{ open: boolean; id: string | null; notes: string }>({
    open: false,
    id: null,
    notes: '',
  });

  // Gear / settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ---------------------------------------------------------------
  // Approval settings draft (moved into modal)
  // ---------------------------------------------------------------
  const [draft, setDraft] = useState<Record<string, any>>({});

  useEffect(() => {
    // Reset draft from server data each time the settings modal opens (or data refetches).
    if (settingsOpen && approvalSettings.length) {
      setDraft(
        Object.fromEntries(
          approvalSettings.map((s: any) => [
            s.category,
            {
              roles: s.roles || [],
              userIds: s.userIds || [],
              mandatoryInvoice: !!s.mandatoryInvoice,
            },
          ]),
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen, approvalSettings]);

  const toggleIn = (category: string, key: 'roles' | 'userIds', value: string) => {
    setDraft((d: any) => {
      const base = d[category] || { roles: [], userIds: [], mandatoryInvoice: category === 'PURCHASE_INVOICE' };
      const cur: string[] = base[key] || [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...d, [category]: { ...base, [key]: next } };
    });
  };

  const toggleMandatoryInvoice = (category: string) => {
    setDraft((d: any) => ({
      ...d,
      [category]: {
        ...(d[category] || { roles: [], userIds: [] }),
        mandatoryInvoice: !d[category]?.mandatoryInvoice,
      },
    }));
  };

  const saveMutation = useMutation({
    mutationFn: (payload: {
      category: string;
      roles: string[];
      userIds: string[];
      mandatoryInvoice: boolean;
    }) =>
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
        roles: draft[c].roles || [],
        userIds: draft[c].userIds || [],
        mandatoryInvoice: !!draft[c].mandatoryInvoice,
      }));
    if (!payloads.length) {
      toast.error('Tidak ada pengaturan untuk disimpan');
      return;
    }
    Promise.all(payloads.map((p) => saveMutation.mutateAsync(p)))
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['approval-settings'] });
        toast.success('Pengaturan persetujuan tersimpan');
      })
      .catch((e) => toast.error(e?.response?.data?.message || 'Gagal menyimpan pengaturan'));
  };

  // ---------------------------------------------------------------
  // Row helpers
  // ---------------------------------------------------------------
  const grMainLine = (gr: any) => {
    const first = gr.items?.[0];
    const productName = first?.product?.name || 'Item';
    const ordered =
      first?.purchaseOrderItem?.quantityOrdered ??
      gr.purchaseOrder?.items?.find((i: any) => i.id === first?.purchaseOrderItemId)?.quantityOrdered;
    const received = Number(first?.quantityReceived ?? 0);
    const poNumber = gr.purchaseOrder?.poNumber || first?.purchaseOrderItem?.purchaseOrder?.poNumber;
    return { productName, qtyText: ordered != null ? `${received}/${ordered} diterima` : `${received} diterima`, poNumber };
  };

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader title="Persetujuan" subtitle="Antrian persetujuan goods receipt & purchase order" />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <CardTitle>Antrian Persetujuan</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toolbar: tabs left, gear right (SUPERADMIN only) */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={tab === 'gr' ? 'default' : 'outline'} onClick={() => setTab('gr')}>
                GR Menunggu approve
              </Button>
              <Button size="sm" variant={tab === 'po' ? 'default' : 'outline'} onClick={() => setTab('po')}>
                PO Menunggu approve
              </Button>
              <Button size="sm" variant={tab === 'history' ? 'default' : 'outline'} onClick={() => setTab('history')}>
                Riwayat
              </Button>
            </div>
            {isSuperAdmin && (
              <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
                <Settings className="w-4 h-4" />
                Atur Persetujuan
              </Button>
            )}
          </div>

          {/* ========== GR approving queue ========== */}
          {tab === 'gr' && (
            <div className="space-y-3">
              {grWaitingLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : !grAwaiting?.length ? (
                <p className="text-sm text-muted-foreground">Tidak ada goods receipt yang menunggu approve.</p>
              ) : (
                grAwaiting.map((gr: any) => {
                  const { productName, qtyText, poNumber } = grMainLine(gr);
                  const userName = userById[gr.receivedBy] || null;
                  const subParts = [
                    userName,
                    gr.branch?.name,
                    gr.receiptDate ? formatDate(gr.receiptDate) : null,
                    gr.variancePercent != null ? `varian ${gr.variancePercent}%` : null,
                  ].filter((p): p is string => !!p);
                  return (
                    <div
                      key={gr.id}
                      className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border bg-card p-4"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                            {gr.grNumber}
                          </Badge>
                          <span className="font-semibold">{productName}</span>
                          <span className="text-sm text-muted-foreground">{qtyText}</span>
                          {poNumber && (
                            <span className="text-xs text-muted-foreground">PO {poNumber}</span>
                          )}
                        </div>
                        {subParts.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">{subParts.join(' · ')}</div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => approveGRMutation.mutate(gr.id)}
                        >
                          <CheckCircle className="w-4 h-4" />
                          approve
                        </Button>
                        <Button
                          size="sm"
                          className="bg-red-700 hover:bg-red-800"
                          onClick={() => setReasonState({ kind: 'reject', id: gr.id })}
                        >
                          <XCircle className="w-4 h-4" />
                          reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReasonState({ kind: 'revisit', id: gr.id })}
                        >
                          <RotateCcw className="w-4 h-4" />
                          revisit
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/purchasing/goods-receipt/${gr.id}`}>Detail</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ========== PO approving queue ========== */}
          {tab === 'po' && (
            <div className="space-y-3">
              {poWaitingLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : !poAwaitingList.length ? (
                <p className="text-sm text-muted-foreground">Tidak ada purchase order yang menunggu approve.</p>
              ) : (
                poAwaitingList.map((po: any) => (
                  <div
                    key={po.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border bg-card p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-800">
                          {po.poNumber}
                        </Badge>
                        <span className="font-semibold">{po.supplier?.name || '-'}</span>
                        <span className="font-semibold">{formatCurrency(po.totalAmount)}</span>
                        <span className="text-xs text-muted-foreground">Tier: {poTierHint(po.totalAmount)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {!po.approvedBy ? 'menunggu CSO' : 'menunggu CFO'}
                        {po.orderDate ? ` · ${formatDate(po.orderDate)}` : ''}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => setApprovePo({ open: true, id: po.id, notes: '' })}
                      >
                        <CheckCircle className="w-4 h-4" />
                        approve
                      </Button>
                      <Button
                        size="sm"
                        className="bg-red-700 hover:bg-red-800"
                        onClick={() => setReasonState({ kind: 'po_reject', id: po.id })}
                      >
                        <XCircle className="w-4 h-4" />
                        reject
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/purchasing/po/${po.id}`}>Detail</Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ========== Riwayat ========== */}
          {tab === 'history' && (
            <div className="space-y-6">
              {/* GR done */}
              <div>
                <h3 className="font-semibold mb-3">Goods receipt selesai</h3>
                {!grHistory?.length ? (
                  <p className="text-sm text-muted-foreground">Belum ada riwayat goods receipt.</p>
                ) : (
                  <div className="space-y-2">
                    {grHistory.map((gr: any) => {
                      const badge = GR_HISTORY_BADGE[gr.status] || {
                        label: gr.status,
                        className: 'bg-slate-200 text-slate-700 border-slate-300',
                      };
                      const { productName } = grMainLine(gr);
                      return (
                        <div
                          key={gr.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={badge.className}>
                              {badge.label}
                            </Badge>
                            <span className="font-mono text-sm">{gr.grNumber}</span>
                            <span className="text-sm">{productName}</span>
                            <span className="text-xs text-muted-foreground">
                              {gr.receiptDate ? formatDate(gr.receiptDate) : ''}
                            </span>
                          </div>
                          <Link
                            to={`/purchasing/goods-receipt/${gr.id}`}
                            className="text-xs text-primary hover:underline"
                          >
                            Detail
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* PO done */}
              <div>
                <h3 className="font-semibold mb-3">Purchase order selesai</h3>
                {!poHistory?.length ? (
                  <p className="text-sm text-muted-foreground">Belum ada riwayat purchase order.</p>
                ) : (
                  <div className="space-y-2">
                    {poHistory.map((po: any) => {
                      const badge = PO_HISTORY_BADGE[po.status] || {
                        label: po.status,
                        className: 'bg-slate-200 text-slate-700 border-slate-300',
                      };
                      return (
                        <div
                          key={po.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={badge.className}>
                              {badge.label}
                            </Badge>
                            <span className="font-mono text-sm">{po.poNumber}</span>
                            <span className="text-sm">{po.supplier?.name || '-'}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(po.totalAmount)}
                            </span>
                          </div>
                          <Link
                            to={`/purchasing/po/${po.id}`}
                            className="text-xs text-primary hover:underline"
                          >
                            Detail
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========== Shared reason modal (reject / revisit) ========== */}
      <Modal
        open={!!reasonState.kind}
        onClose={closeReasonModal}
        title={reasonModalTitle}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <Label>Alasan</Label>
            <Textarea
              className="mt-2"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tulis alasan (wajib)..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeReasonModal}>
              Batal
            </Button>
            <Button
              disabled={!reason.trim() || reasonMutation.isPending}
              onClick={handleReasonConfirm}
            >
              {reasonMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {reasonState.kind === 'revisit' ? 'revisit' : 'reject'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========== PO approve modal ========== */}
      <Modal
        open={approvePo.open}
        onClose={() => setApprovePo({ open: false, id: null, notes: '' })}
        title="Setujui Purchase Order"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm">
            Apakah Anda yakin ingin menyetujui purchase order ini? Catatan opsional dapat ditambahkan.
          </p>
          <div>
            <Label>Catatan (opsional)</Label>
            <Textarea
              className="mt-2"
              rows={3}
              value={approvePo.notes}
              onChange={(e) => setApprovePo((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Catatan persetujuan (opsional)..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setApprovePo({ open: false, id: null, notes: '' })}>
              Batal
            </Button>
            <Button
              disabled={!approvePo.id || approvePOMutation.isPending}
              onClick={() => approvePo.id && approvePOMutation.mutate({ id: approvePo.id, notes: approvePo.notes })}
            >
              {approvePOMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Setujui
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========== Settings modal (SUPERADMIN only) ========== */}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Atur Persetujuan"
        size="xl"
      >
        <div className="space-y-6">
          {(['PURCHASE_INVOICE', 'GOODS_RECEIPT'] as const).map((cat) => {
            const s = draft[cat] || { roles: [], userIds: [], mandatoryInvoice: cat === 'PURCHASE_INVOICE' };
            const isCustom = (s.roles?.length ?? 0) > 0 || (s.userIds?.length ?? 0) > 0;
            return (
              <div key={cat} className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{CATEGORY_LABEL[cat]}</h3>
                  <Badge variant={isCustom ? 'default' : 'secondary'}>
                    {isCustom ? 'Kustom' : 'Default'}
                  </Badge>
                </div>

                <Label className="mb-2 block text-muted-foreground">Peran approver</Label>
                <div className="flex flex-wrap gap-2">
                  {APPROVER_ROLES.map((role) => {
                    const on = (s.roles || []).includes(role);
                    return (
                      <Button
                        key={role}
                        type="button"
                        size="sm"
                        variant={on ? 'default' : 'outline'}
                        onClick={() => toggleIn(cat, 'roles', role)}
                      >
                        {ROLE_LABELS[role] || role}
                      </Button>
                    );
                  })}
                </div>

                <Separator className="my-4" />
                <Label className="mb-2 block text-muted-foreground">Pengguna tertentu (opsional)</Label>
                {approverUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada pengguna dengan peran approver.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {approverUsers.map((u: any) => {
                      const on = (s.userIds || []).includes(u.id);
                      const role =
                        (u.roles || []).find((r: any) => PICKER_ROLE_CODES.includes(r.code))?.code || '';
                      return (
                        <Button
                          key={u.id}
                          type="button"
                          size="sm"
                          variant={on ? 'default' : 'outline'}
                          onClick={() => toggleIn(cat, 'userIds', u.id)}
                          title={u.email}
                        >
                          <UserRound className="w-3.5 h-3.5" />
                          {u.fullName || u.name || u.email?.split('@')[0]}
                          {role && <span className="text-[10px] opacity-80">· {role}</span>}
                        </Button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
                  <div>
                    <Label>Invoice wajib sebelum approve</Label>
                    <p className="text-xs text-muted-foreground">
                      {cat === 'PURCHASE_INVOICE'
                        ? 'Wajib — PO tidak bisa di-approve sebelum invoice supplier diunggah.'
                        : '#81 — opsional secara default; aktifkan bila klien meminta.'}
                    </p>
                  </div>
                  <Switch
                    checked={!!s.mandatoryInvoice}
                    onCheckedChange={() => toggleMandatoryInvoice(cat)}
                  />
                </div>
              </div>
            );
          })}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Simpan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
