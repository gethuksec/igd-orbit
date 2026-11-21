import { useState } from 'react';
import { BreadcrumbHeader } from '@/components/shared';
import { useMutation } from '@tanstack/react-query';
import { Lock, Banknote, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { hrService, type Payroll } from '@/services/hr.service';
import { formatCurrency } from '@/utils/format';
import { toast } from 'sonner';

const MONTHS = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function MySlips() {
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [slips, setSlips] = useState<Payroll[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Payroll>>({});
  const [setMode, setSetMode] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [oldPin, setOldPin] = useState('');

  const pinMutation = useMutation({
    mutationFn: () => hrService.getMySlips(pin),
    onSuccess: (res: any) => {
      setSlips(res.data || []);
      setUnlocked(true);
    },
    onError: (error: any) => {
      const msg: string = error.response?.data?.message || '';
      if (/not set/i.test(msg)) {
        setSetMode(true);
      } else {
        toast.error(msg || 'PIN salah');
      }
    },
  });

  const setPinMutation = useMutation({
    mutationFn: () => hrService.setPayslipPin({ pin: newPin, oldPin: oldPin || undefined }),
    onSuccess: () => {
      toast.success('PIN tersimpan. Masukkan PIN untuk membuka slip.');
      setSetMode(false);
      setNewPin('');
      setOldPin('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyimpan PIN');
    },
  });

  const unlockMutation = useMutation({
    mutationFn: (id: string) => hrService.unlockSlip(id, pin),
    onSuccess: (res, id) => {
      setDetails((d) => ({ ...d, [id]: res }));
      setOpenId(id);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membuka slip');
    },
  });

  if (!unlocked) {
    return (
      <div className="w-full space-y-4 max-w-md mx-auto">
        <BreadcrumbHeader title="Slip Gaji Saya" subtitle="Masukkan PIN untuk membuka" />
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
          {setMode ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Belum ada PIN. Buat PIN 4–12 digit untuk melindungi slip gaji Anda.
              </p>
              {!!pin && (
                <div>
                  <label className="block text-sm font-semibold mb-2">PIN lama (ganti PIN)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    value={oldPin}
                    onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3 border rounded-lg text-center text-xl tracking-widest"
                    placeholder="••••"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold mb-2">PIN baru</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  className="w-full px-4 py-3 border rounded-lg text-center text-xl tracking-widest"
                  placeholder="••••"
                />
              </div>
              <button
                onClick={() => setPinMutation.mutate()}
                disabled={newPin.length < 4 || setPinMutation.isPending}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {setPinMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                Simpan PIN
              </button>
              <button onClick={() => setSetMode(false)} className="w-full py-2 text-sm text-gray-500 underline">
                Kembali
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="p-4 bg-primary-50 dark:bg-primary-950 rounded-full">
                  <Lock className="w-8 h-8 text-primary-600" />
                </div>
              </div>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
                onKeyDown={(e) => e.key === 'Enter' && pin.length >= 4 && pinMutation.mutate()}
                className="w-full px-4 py-3 border rounded-lg text-center text-2xl tracking-[0.5em]"
                placeholder="••••"
                autoFocus
              />
              <button
                onClick={() => pinMutation.mutate()}
                disabled={pin.length < 4 || pinMutation.isPending}
                className="w-full py-3 bg-primary-600 text-white rounded-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {pinMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                Buka Slip Gaji
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 max-w-2xl mx-auto">
      <BreadcrumbHeader title="Slip Gaji Saya" subtitle={`${slips.length} periode`} />
      {slips.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center text-gray-500">
          <Banknote className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          Belum ada slip gaji
        </div>
      )}
      {slips.map((s) => {
        const open = openId === s.id;
        const detail = details[s.id];
        return (
          <div key={s.id} className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 overflow-hidden">
            <button
              onClick={() => (open ? setOpenId(null) : unlockMutation.mutate(s.id))}
              className="w-full p-4 flex items-center gap-3 text-left active:bg-gray-50 dark:active:bg-gray-800"
            >
              <div className="p-2 bg-primary-50 dark:bg-primary-950 rounded-lg">
                <Banknote className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 dark:text-gray-100">
                  {MONTHS[s.periodMonth]} {s.periodYear}
                </p>
                <p className="text-xs text-gray-500">{s.payrollNumber} · {s.status}</p>
              </div>
              <p className="font-bold text-primary-600">{formatCurrency(s.nettSalary)}</p>
              <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>
            {open && (
              <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-2">
                {!detail ? (
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Membuka slip...
                  </p>
                ) : (
                  <>
                    {(detail.components || []).map((c) => (
                      <div key={c.id} className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">{c.componentName}</span>
                        <span className={`font-semibold ${c.componentType === 'deduction' ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
                          {c.componentType === 'deduction' ? '-' : ''}{formatCurrency(c.amount)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t font-bold">
                      <span>Gaji Bersih</span>
                      <span className="text-primary-600">{formatCurrency(detail.nettSalary)}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Hadir {detail.attendanceDays} hari · Terlambat {detail.lateCount}x · Lembur {detail.overtimeHours} jam
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
      {unlockMutation.isError && (
        <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Gagal membuka slip</p>
      )}
    </div>
  );
}
