import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowRightLeft, Clock3, FileText, Loader2 } from 'lucide-react';
import { hrService } from '../../services/hr.service';

/** IGDERP-276d: mockup-faithful "Request Baru" — jenis selector (Cuti /
 *  Tukar Shift / Lembur). Cuti & shift reuse the proven full forms;
 *  lembur files inline against today's attendance record. */
const JENIS = [
  { id: 'cuti', label: 'Cuti', icon: FileText, desc: 'Cuti tahunan, sakit, darurat' },
  { id: 'shift', label: 'Tukar Shift', icon: ArrowRightLeft, desc: 'Tukar jadwal dengan rekan' },
  { id: 'lembur', label: 'Lembur', icon: Clock3, desc: 'Pengajuan jam lembur' },
] as const;

export default function MRequestForm() {
  const navigate = useNavigate();
  const [jenis, setJenis] = useState<'cuti' | 'shift' | 'lembur'>('cuti');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState('2');
  const [reason, setReason] = useState('');
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  const lembur = useMutation({
    mutationFn: async () => {
      const att: any = await hrService.getAttendances({ startDate: date, endDate: date });
      const rec = att?.data?.[0];
      if (!rec?.id) throw new Error('Belum ada absensi pada tanggal tersebut');
      return hrService.requestOvertime({
        attendance_id: rec.id,
        requested_hours: Number(hours) || 0,
        reason,
        requested_date: date,
      });
    },
    onSuccess: () => {
      setDone('Pengajuan lembur terkirim');
      setReason('');
    },
    onError: (e: any) => setError(e?.message || 'Gagal mengirim pengajuan'),
  });

  const submit = () => {
    setError('');
    setDone('');
    if (jenis === 'cuti') return navigate('/m/cuti/new');
    if (jenis === 'shift') return navigate('/m/shift/new');
    if (!reason.trim()) return setError('Isi alasan lembur');
    lembur.mutate();
  };

  return (
    <div className="-mx-4 -mt-3">
      <div className="bg-white px-5 pt-12 pb-3 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Request Baru</h1>
      </div>
      <div className="px-4 mt-3 space-y-3">
        <div className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100 space-y-1">
          {JENIS.map((j) => (
            <button
              key={j.id}
              onClick={() => setJenis(j.id)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left ${
                jenis === j.id ? 'bg-red-50 border border-red-200' : 'border border-transparent'
              }`}
            >
              <j.icon className={`w-6 h-6 ${jenis === j.id ? 'text-red-600' : 'text-gray-400'}`} />
              <span className="flex-1">
                <span className="block text-sm font-bold text-gray-900">{j.label}</span>
                <span className="block text-xs text-gray-500">{j.desc}</span>
              </span>
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  jenis === j.id ? 'border-red-600' : 'border-gray-300'
                }`}
              >
                {jenis === j.id && <span className="w-2.5 h-2.5 rounded-full bg-red-600" />}
              </span>
            </button>
          ))}
        </div>

        {jenis === 'lembur' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">TANGGAL</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">JAM LEMBUR</label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">ALASAN</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Contoh: lembur stock opname"
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm"
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        {done && (
          <p className="text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2">{done}</p>
        )}

        <button
          onClick={submit}
          disabled={lembur.isPending}
          className="w-full py-3 bg-[#F04438] text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {lembur.isPending && <Loader2 className="w-5 h-5 animate-spin" />}
          Kirim pengajuan
        </button>
      </div>
    </div>
  );
}
