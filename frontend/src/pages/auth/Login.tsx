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

  if (roles.includes('HS') || roles.includes('SPV')) {
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
            src="/logo/igd-1.jpg"
            alt="IGD Ponsel"
            className="h-16 w-auto mx-auto mb-4 object-contain"
          />
          <h1 className="text-3xl font-display font-bold text-gray-900">IGD Ponsel</h1>
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

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Atau gunakan kredensial demo</span>
            </div>
          </div>

          {/* Demo Credentials - Organized by Tier */}
          <div className="space-y-4">
            {/* Tier 0 - Super Admin */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-300">
              <p className="text-xs font-bold text-purple-900 uppercase mb-3 flex items-center gap-2">
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
              <p className="text-xs font-bold text-red-800 uppercase mb-3 flex items-center gap-2">
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

            {/* Tier 2 - Management */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
              <p className="text-xs font-bold text-orange-800 uppercase mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                🟠 TIER 2 - MANAGEMENT (Password: Manager@1234)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('cfo@igdgroup.com');
                    setPassword('Manager@1234');
                  }}
                  className="text-left px-3 py-2 bg-white hover:bg-orange-50 border border-orange-200 rounded-lg transition-all"
                >
                  <p className="font-semibold text-orange-700">💼 CFO (Keuangan & Laporan)</p>
                  <p className="text-gray-600">cfo@igdgroup.com</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('manager@igdgroup.com');
                    setPassword('Manager@1234');
                  }}
                  className="text-left px-3 py-2 bg-white hover:bg-orange-50 border border-orange-200 rounded-lg transition-all"
                >
                  <p className="font-semibold text-orange-700">📊 Manager Operasional</p>
                  <p className="text-gray-600">manager@igdgroup.com</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('regional@igdgroup.com');
                    setPassword('Manager@1234');
                  }}
                  className="text-left px-3 py-2 bg-white hover:bg-orange-50 border border-orange-200 rounded-lg transition-all"
                >
                  <p className="font-semibold text-orange-700">🌐 Regional Manager (Multi Cabang)</p>
                  <p className="text-gray-600">regional@igdgroup.com</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('cso@igdgroup.com');
                    setPassword('Manager@1234');
                  }}
                  className="text-left px-3 py-2 bg-white hover:bg-orange-50 border border-orange-200 rounded-lg transition-all"
                >
                  <p className="font-semibold text-orange-700">📈 CSO (Chief Sales Officer)</p>
                  <p className="text-gray-600">cso@igdgroup.com</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('cmo@igdgroup.com');
                    setPassword('Manager@1234');
                  }}
                  className="text-left px-3 py-2 bg-white hover:bg-orange-50 border border-orange-200 rounded-lg transition-all"
                >
                  <p className="font-semibold text-orange-700">📣 CMO (Marketing)</p>
                  <p className="text-gray-600">cmo@igdgroup.com</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('hr@igdgroup.com');
                    setPassword('Manager@1234');
                  }}
                  className="text-left px-3 py-2 bg-white hover:bg-orange-50 border border-orange-200 rounded-lg transition-all"
                >
                  <p className="font-semibold text-orange-700">🧑‍💼 HR Manager (CHR)</p>
                  <p className="text-gray-600">hr@igdgroup.com</p>
                </button>
              </div>
            </div>

            {/* Tier 3 - Supervisor */}
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border border-yellow-200">
              <p className="text-xs font-bold text-yellow-800 uppercase mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                🟡 TIER 3 - SUPERVISOR (Password: Supervisor@1234)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('spv@igdgroup.com');
                    setPassword('Supervisor@1234');
                  }}
                  className="text-left px-3 py-2 bg-white hover:bg-yellow-50 border border-yellow-200 rounded-lg transition-all"
                >
                  <p className="font-semibold text-yellow-700">🧭 Supervisor (SPV)</p>
                  <p className="text-gray-600">spv@igdgroup.com</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('hs@igdgroup.com');
                    setPassword('Supervisor@1234');
                  }}
                  className="text-left px-3 py-2 bg-white hover:bg-yellow-50 border border-yellow-200 rounded-lg transition-all"
                >
                  <p className="font-semibold text-yellow-700">🏬 Head of Store (HS)</p>
                  <p className="text-gray-600">hs@igdgroup.com</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('sodo@igdgroup.com');
                    setPassword('Supervisor@1234');
                  }}
                  className="text-left px-3 py-2 bg-white hover:bg-yellow-50 border border-yellow-200 rounded-lg transition-all"
                >
                  <p className="font-semibold text-yellow-700">🔧 Service & Operations</p>
                  <p className="text-gray-600">sodo@igdgroup.com</p>
                </button>
              </div>
            </div>

            {/* Tier 4 - Staff */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <p className="text-xs font-bold text-green-800 uppercase mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                🟢 TIER 4 - STAFF (Password: Staff@1234)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('cs@igdgroup.com');
                    setPassword('Staff@1234');
                  }}
                  className="text-left px-3 py-2 bg-white hover:bg-green-50 border border-green-200 rounded-lg transition-all"
                >
                  <p className="font-semibold text-green-700">🎧 Customer Service</p>
                  <p className="text-gray-600">cs@igdgroup.com</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('ar@igdgroup.com');
                    setPassword('Staff@1234');
                  }}
                  className="text-left px-3 py-2 bg-white hover:bg-green-50 border border-green-200 rounded-lg transition-all"
                >
                  <p className="font-semibold text-green-700">💰 AR Staff</p>
                  <p className="text-gray-600">ar@igdgroup.com</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('tech@igdgroup.com');
                    setPassword('Staff@1234');
                  }}
                  className="text-left px-3 py-2 bg-white hover:bg-green-50 border border-green-200 rounded-lg transition-all"
                >
                  <p className="font-semibold text-green-700">🔨 Technician</p>
                  <p className="text-gray-600">tech@igdgroup.com</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('asa@igdgroup.com');
                    setPassword('Staff@1234');
                  }}
                  className="text-left px-3 py-2 bg-white hover:bg-green-50 border border-green-200 rounded-lg transition-all"
                >
                  <p className="font-semibold text-green-700">📦 Assistant Store Admin</p>
                  <p className="text-gray-600">asa@igdgroup.com</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('smo@igdgroup.com');
                    setPassword('Staff@1234');
                  }}
                  className="text-left px-3 py-2 bg-white hover:bg-green-50 border border-green-200 rounded-lg transition-all"
                >
                  <p className="font-semibold text-green-700">📊 Sales & Marketing Officer</p>
                  <p className="text-gray-600">smo@igdgroup.com</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('as@igdgroup.com');
                    setPassword('Staff@1234');
                  }}
                  className="text-left px-3 py-2 bg-white hover:bg-green-50 border border-green-200 rounded-lg transition-all"
                >
                  <p className="font-semibold text-green-700">📝 Accounting Staff</p>
                  <p className="text-gray-600">as@igdgroup.com</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('cashier@igdgroup.com');
                    setPassword('Staff@1234');
                  }}
                  className="text-left px-3 py-2 bg-white hover:bg-green-50 border border-green-200 rounded-lg transition-all"
                >
                  <p className="font-semibold text-green-700">💵 Cashier POS</p>
                  <p className="text-gray-600">cashier@igdgroup.com</p>
                </button>
              </div>
            </div>
          </div>
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
            © {new Date().getFullYear()} IGD Ponsel.
          </p>
        </div>
      </div>
    </div>
  );
}

