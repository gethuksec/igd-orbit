import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

const getDefaultRouteForUser = (user: any): string => {
  const roles: string[] =
    user?.roles || (user?.role?.code ? [user.role.code] : []);

  if (roles.includes('TC')) {
    return '/service-orders/my';
  }

  if (roles.includes('HS') || roles.some((r) => r.startsWith('SPV'))) {
    return '/service-orders';
  }

  // Default executive / other roles -> dashboard
  return '/dashboard';
};

// T22 — a safe destination from the ?next= query param (local paths only)
const getNextPath = (search: string): string | null => {
  const next = new URLSearchParams(search).get('next');
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    return next;
  }
  return null;
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // T22 — session expired banner (?expired=1 set by the 401 interceptor)
  const sessionExpired = new URLSearchParams(location.search).get('expired') === '1';

  // If already logged in, redirect away from /login (honoring ?next= if present)
  useEffect(() => {
    try {
      const token = localStorage.getItem('access_token');
      const rawUser = localStorage.getItem('user');
      const user = rawUser ? JSON.parse(rawUser) : null;

      if (token && user) {
        const target = getNextPath(location.search) || getDefaultRouteForUser(user);
        navigate(target, { replace: true });
      }
    } catch {
      // ignore parse errors, treat as not logged in
    }
  }, [navigate, location.search]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      const data = response.data.data || response.data;
      
      // Store token and user info
      const token = data.accessToken || data.access_token;
      if (token) {
        localStorage.setItem('access_token', token);
      }
      if (data.refreshToken) {
        localStorage.setItem('refresh_token', data.refreshToken);
      }
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      const target = getNextPath(location.search) || getDefaultRouteForUser(data.user);
      navigate(target, { replace: true });
    } catch (err: any) {
      console.error('Login error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Email atau password salah';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <img
            src="/logo/igd-group.png"
            alt="IGD Group"
            className="h-24 w-auto mx-auto mb-4 object-contain"
          />
          <h1 className="text-3xl font-display font-bold text-gray-900">ORBIT</h1>
          <p className="text-gray-600 mt-2">Login karyawan untuk mengakses dashboard internal</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {/* Session expired banner (from ?expired=1 set by the 401 interceptor) */}
          {sessionExpired && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">
                  Sesi berakhir, silakan login kembali
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="admin@igd.com"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Remember (no forgot password for internal login) */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-600">Ingat saya</span>
              </label>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg font-semibold hover:from-primary-700 hover:to-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 shadow-lg transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Masuk</span>
                </>
              )}
            </button>
          </form>

          {/* Demo credentials (ORG-REAL, IGDERP-237) — bootstrap accounts only.
              Rendered only when VITE_SHOW_DEMO_LOGIN=true. Never enable in production. */}
          {import.meta.env.VITE_SHOW_DEMO_LOGIN === 'true' && (
            <>
              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Atau gunakan kredensial demo</span>
                </div>
              </div>

              {/* Demo Credentials - bootstrap accounts only */}
              <div className="space-y-4">
                {/* Tier 0 - Super Admin */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-300">
                  <p className="text-xs font-bold text-purple-900 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></span>
                    🟣 TIER 0 - SUPER ADMIN (Password: SuperAdmin@1234)
                  </p>
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('superadmin@igdgroup.com');
                        setPassword('SuperAdmin@1234');
                      }}
                      className="text-left px-3 py-2 bg-white hover:bg-purple-50 border border-purple-300 rounded-lg transition-all"
                    >
                      <p className="font-semibold text-purple-800">👑 Super Administrator (Full Access)</p>
                      <p className="text-gray-600">superadmin@igdgroup.com</p>
                    </button>
                  </div>
                </div>

                {/* Tier 1 - Executive */}
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
                  <p className="text-xs font-bold text-red-800 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    🔴 TIER 1 - EXECUTIVE (Password: Owner@1234)
                  </p>
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('owner@igdgroup.com');
                        setPassword('Owner@1234');
                      }}
                      className="text-left px-3 py-2 bg-white hover:bg-red-50 border border-red-200 rounded-lg transition-all"
                    >
                      <p className="font-semibold text-red-700">👑 Owner (Semua Cabang)</p>
                      <p className="text-gray-600">owner@igdgroup.com</p>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-col items-center gap-3 text-xs text-gray-500">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center text-primary-600 hover:text-primary-700 font-semibold"
          >
            ← Kembali ke halaman utama
          </button>
          <p className="text-center text-[11px] md:text-xs">
            © {new Date().getFullYear()} ORBIT.
          </p>
        </div>
      </div>
    </div>
  );
}

