import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Loader2 } from 'lucide-react';
import { authService } from '../../services/users.service';
import { useMe } from './MobileShell';

/** IGDERP-276d: mockup-faithful Profile — red banner, Data diri + Ubah
 *  (phone via real API), Ganti password (real API), Keluar. */
export default function MProfile() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me, isLoading } = useMe();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [pw, setPw] = useState({ cur: '', next: '' });
  const [msg, setMsg] = useState('');
  const [showPw, setShowPw] = useState(false);

  const name = me?.employee?.fullName || me?.fullName || me?.email || '-';
  const outlet = me?.userBranches?.[0]?.branch?.name || '';
  const nik = me?.employee?.employeeCode || '';

  const savePhone = useMutation({
    mutationFn: () => usersService.update(me!.id, { phone }),
    onSuccess: () => {
      setEditing(false);
      setMsg('Nomor telepon tersimpan');
      qc.invalidateQueries({ queryKey: ['m-me'] });
    },
    onError: (e: any) => setMsg(e?.response?.data?.message || 'Gagal menyimpan'),
  });

  const changePw = useMutation({
    mutationFn: () =>
      authService.changePassword({ currentPassword: pw.cur, newPassword: pw.next }),
    onSuccess: () => {
      setPw({ cur: '', next: '' });
      setShowPw(false);
      setMsg('Password berhasil diganti');
    },
    onError: (e: any) => setMsg(e?.response?.data?.message || 'Gagal ganti password'),
  });

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    navigate('/m/login', { replace: true });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="-mx-4 -mt-3">
      {/* Red banner */}
      <div className="mx-4 mt-3 bg-[#F04438] rounded-2xl p-5 text-white flex items-center justify-between">
        <div>
          <p className="text-xs opacity-80">Profil karyawan</p>
          <h1 className="text-xl font-bold leading-tight">{name}</h1>
          <p className="text-xs opacity-90 mt-1">
            {[me?.employee?.position, outlet, nik ? `NIK ${nik}` : ''].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="w-12 h-12 rounded-full bg-pink-200 text-red-700 font-bold flex items-center justify-center shrink-0">
          {name[0].toUpperCase()}
        </div>
      </div>

      <div className="px-4 mt-3 space-y-3">
        {!!msg && (
          <p className="text-sm text-gray-700 bg-gray-100 rounded-xl px-3 py-2">{msg}</p>
        )}

        {/* Data diri */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-gray-900">Data diri</h2>
            <button
              onClick={() => {
                setPhone(me?.employee?.phone || '');
                setEditing(!editing);
              }}
              className="text-xs font-bold text-gray-700 border border-gray-300 rounded-full px-3 py-1"
            >
              Ubah
            </button>
          </div>
          {[
            ['Nama lengkap', name],
            ['Telepon', me?.employee?.phone || '-'],
            ['Email', me?.email || '-'],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex items-center justify-between py-2.5 border-b border-dashed border-gray-200 last:border-0"
            >
              <span className="text-sm text-gray-500">{k}</span>
              <span className="text-sm font-semibold text-gray-900">{v}</span>
            </div>
          ))}
          {editing && (
            <div className="pt-2 flex gap-2">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Nomor telepon baru"
                inputMode="tel"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm"
              />
              <button
                onClick={() => savePhone.mutate()}
                disabled={savePhone.isPending}
                className="px-4 py-2 bg-[#F04438] text-white rounded-xl text-sm font-bold disabled:opacity-50"
              >
                Simpan
              </button>
            </div>
          )}
        </div>

        {/* Ganti password */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <button
            onClick={() => setShowPw(!showPw)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="font-bold text-gray-900">Ganti password</h2>
            <ChevronRight className={`w-5 h-5 text-gray-400 transition ${showPw ? 'rotate-90' : ''}`} />
          </button>
          {showPw && (
            <div className="pt-3 space-y-2">
              <input
                type="password"
                value={pw.cur}
                onChange={(e) => setPw({ ...pw, cur: e.target.value })}
                placeholder="Password lama"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
              />
              <input
                type="password"
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
                placeholder="Password baru (min. 6 karakter)"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
              />
              <button
                onClick={() => changePw.mutate()}
                disabled={changePw.isPending || pw.next.length < 6}
                className="w-full py-2.5 border border-gray-300 rounded-xl text-sm font-bold text-gray-800 disabled:opacity-50"
              >
                Ganti password
              </button>
            </div>
          )}
        </div>

        {/* Keluar */}
        <button
          onClick={logout}
          className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-red-600 font-bold text-center"
        >
          Keluar
        </button>
      </div>
    </div>
  );
}
