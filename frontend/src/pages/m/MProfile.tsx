import { useNavigate } from 'react-router-dom';
import { ChevronRight, KeyRound, Loader2, LogOut } from 'lucide-react';
import { useMe } from './MobileShell';

/** IGDERP-276: profil saya + keluar. */
export default function MProfile() {
  const navigate = useNavigate();
  const { data: me, isLoading } = useMe();

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

  const name = me?.employee?.fullName || me?.fullName || me?.email || '-';

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-red-600 text-white text-xl font-bold flex items-center justify-center shrink-0">
          {name[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-gray-800 truncate">{name}</p>
          <p className="text-xs text-gray-500 truncate">{me?.email}</p>
          <p className="text-xs text-gray-500">{me?.employee?.position || 'Karyawan'}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
        <button
          onClick={() => navigate('/m/slip')}
          className="w-full p-4 flex items-center justify-between text-left"
        >
          <span className="flex items-center gap-3 text-sm font-semibold text-gray-700">
            <KeyRound className="w-5 h-5 text-red-600" />
            Slip Gaji & PIN
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
        <button onClick={logout} className="w-full p-4 flex items-center justify-between text-left">
          <span className="flex items-center gap-3 text-sm font-semibold text-red-600">
            <LogOut className="w-5 h-5" />
            Keluar
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      <p className="text-[11px] text-gray-400 text-center">IGD Employee · ORBIT</p>
    </div>
  );
}
