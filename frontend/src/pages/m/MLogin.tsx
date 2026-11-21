import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Lock, Mail } from 'lucide-react';
import { api } from '../../services/api';

/** IGDERP-276: mobile login (email only), same JWT flow as desktop. */
export default function MLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const expired = params.get('expired') === '1';

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const data = res.data?.data ?? res.data;
      const token = data.accessToken || data.access_token;
      if (token) {
        localStorage.setItem('access_token', token);
        if (data.refreshToken || data.refresh_token) {
          localStorage.setItem('refresh_token', data.refreshToken || data.refresh_token);
        }
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
      }
      navigate(params.get('next') || '/m', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Email atau kata sandi salah');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-red-600 flex flex-col px-6 pt-16 pb-8">
      <div className="text-white mb-8">
        <img src="/logo/igd-mark-512.png" alt="IGD" className="w-16 h-16 rounded-2xl bg-white p-1 mb-4" />
        <h1 className="text-2xl font-bold">IGD Employee</h1>
        <p className="text-sm opacity-80">Masuk untuk absensi, cuti & slip gaji</p>
      </div>
      <form onSubmit={handleLogin} className="bg-white rounded-2xl p-5 space-y-4 shadow-lg">
        {expired && (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            Sesi berakhir — masuk kembali
          </p>
        )}
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-9 pr-3 py-3 border rounded-xl text-base"
              placeholder="nama@igd.com"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Kata sandi</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-9 pr-3 py-3 border rounded-xl text-base"
              placeholder="••••••••"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 bg-red-600 text-white rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-5 h-5 animate-spin" />}
          Masuk
        </button>
        <p className="text-xs text-gray-500 text-center">PIN slip gaji awal: 123456</p>
      </form>
    </div>
  );
}
