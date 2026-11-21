import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../../services/api';

/** IGDERP-276d: mockup-faithful login — centered IG mark, IGD Employee,
 *  EMAIL/PASSWORD labels, full-width Masuk, "Lupa password? Hubungi HRD". */
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
    <div className="min-h-dvh bg-[#FAFAFA] flex flex-col items-center px-9 pt-14 pb-8">
      <div className="w-[90px] h-[90px] rounded-[22px] bg-[#F04438] flex items-center justify-center shadow-[0_0_36px_rgba(240,68,56,0.45)]">
        <span className="text-white font-bold text-4xl tracking-tight">IG</span>
      </div>
      <h1 className="mt-5 text-[27px] font-bold text-gray-900">IGD Employee</h1>
      <p className="mt-1 text-sm text-gray-500">Masuk dengan akun IGD-ERP kamu</p>

      <form onSubmit={handleLogin} className="w-full mt-8">
        {expired && (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3">
            Sesi berakhir — masuk kembali
          </p>
        )}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>
        )}
        <div>
          <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5">
            EMAIL
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-[10px] text-base text-gray-900"
            required
          />
        </div>
        <div className="mt-4">
          <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5">
            PASSWORD
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-[10px] text-base text-gray-900"
            required
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full mt-6 py-3 bg-[#F04438] text-white rounded-[10px] font-semibold text-base disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-5 h-5 animate-spin" />}
          Masuk
        </button>
        <p className="mt-5 text-sm text-gray-500 text-center">Lupa password? Hubungi HRD</p>
      </form>
    </div>
  );
}
