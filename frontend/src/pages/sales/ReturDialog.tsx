import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { salesService } from '@/services/sales.service';
import { financeService } from '@/services/finance.service';

interface ReturDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: any;
  onSuccess?: () => void;
}

/**
 * Retur Penjualan popup (IGDERP-85) — full-invoice return.
 * Fields: Alasan (required) · Penyelesaian (Tunai / Tukar Barang; Deposit menunggu IGDERP-102)
 * · Akun COA (manual pick untuk v1).
 */
export default function ReturDialog({
  open,
  onOpenChange,
  transaction,
  onSuccess,
}: ReturDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [settlementType, setSettlementType] = useState<'cash' | 'exchange'>('cash');
  const [coaId, setCoaId] = useState('');

  const { data: coas } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: () => financeService.getChartOfAccounts(),
    enabled: open,
  });

  // Reset per open
  useEffect(() => {
    if (open) {
      setReason('');
      setSettlementType('cash');
      setCoaId('');
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      salesService.createReturn({
        transactionId: transaction?.id,
        reason,
        settlementType,
        coaId: coaId || undefined,
      }),
    onSuccess: () => {
      toast.success('Retur penjualan berhasil dibuat');
      queryClient.invalidateQueries({ queryKey: ['sales-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membuat retur');
    },
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount || 0);

  const total = Number(transaction?.total ?? transaction?.totalPrice ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Retur Penjualan
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invoice summary */}
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
              <span className="text-muted-foreground">No. Faktur</span>
              <span className="font-semibold">{transaction?.transactionNumber || '-'}</span>
              <span className="text-muted-foreground">Tanggal</span>
              <span className="font-semibold">
                {transaction?.createdAt
                  ? new Date(transaction.createdAt).toLocaleString('id-ID')
                  : '-'}
              </span>
              <span className="text-muted-foreground">Pelanggan</span>
              <span className="font-semibold">{transaction?.customer?.name || '-'}</span>
              <span className="text-muted-foreground">Outlet</span>
              <span className="font-semibold">{transaction?.branch?.name || '-'}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-dashed pt-2 text-sm">
              <span>Total faktur</span>
              <span className="font-bold text-primary-600">{formatCurrency(total)}</span>
            </div>
            <div className="mt-2 rounded-md bg-green-50 border border-green-200 px-2 py-1.5 text-xs text-green-700">
              Retur penuh — seluruh item pada faktur ini diretur (v1)
            </div>
          </div>

          {/* Alasan */}
          <div className="grid gap-2">
            <Label htmlFor="retur-reason">
              Alasan Retur <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="retur-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="cth: barang cacat / retak, salah ukuran, tidak sesuai pesanan..."
              maxLength={255}
            />
            <p className="text-xs text-muted-foreground">Wajib diisi.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Penyelesaian */}
            <div className="grid gap-2">
              <Label>Penyelesaian</Label>
              <Select
                value={settlementType}
                onValueChange={(v) => setSettlementType(v as 'cash' | 'exchange')}
              >
                <option value="cash">Tunai (kembalikan uang)</option>
                <option value="exchange">Tukar Barang</option>
                <option value="deposit" disabled>
                  Deposit customer — segera (IGDERP-102)
                </option>
              </Select>
              {settlementType === 'exchange' && (
                <p className="text-xs text-muted-foreground">
                  Refund + catatan "buat transaksi baru, alasan = retur no. X"
                </p>
              )}
            </div>

            {/* Akun COA (manual v1) */}
            <div className="grid gap-2">
              <Label>Akun (COA)</Label>
              <Select value={coaId} onValueChange={setCoaId}>
                <option value="">
                  — Pilih akun (opsional) —
                </option>
                {coas
                  ?.filter((c: any) => !c.isHeader && c.isActive !== false)
                  .map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Manual untuk v1 · pengaturan akun retur di IGDERP-117
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            disabled={!reason.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Simpan Retur
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
