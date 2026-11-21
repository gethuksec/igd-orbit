import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ClipboardList, Home, Inbox, User } from 'lucide-react';
import { useEffect } from 'react';
import { api } from '../../services/api';

export interface MeUser {
  id: string;
  email: string;
  fullName?: string;
  employee?: { id: string; fullName?: string; position?: string; photoUrl?: string | null } | null;
  userBranches?: { role?: { name?: string } }[];
}

export function useMe() {
  const location = useLocation();
  const isLogin = location.pathname.startsWith('/m/login');
  return useQuery({
    queryKey: ['m-me'],
    queryFn: async (): Promise<MeUser | null> => {
      try {
        const res = await api.get('/auth/me');
        return res.data as MeUser;
      } catch {
        return null;
      }
    },
    // IGDERP-276: never probe the session from the login screen itself —
    // an empty token would 401 and the interceptor would reload-loop.
    enabled: !isLogin,
    staleTime: 60_000,
    retry: false,
  });
}

export function isManagerLike(me?: MeUser | null): boolean {
  const branchRoles = (me?.userBranches ?? []).map((b) => (b.role?.name ?? '').toUpperCase());
  // /auth/me also returns top-level role codes (e.g. SUPERADMIN without branch rows)
  const topRoles = ((me as any)?.roles ?? []).map((r: string) => String(r).toUpperCase());
  return [...branchRoles, ...topRoles].some((r) => ['HS', 'SPV', 'CHR', 'OWNER', 'SUPERADMIN'].includes(r));
}

const TABS = [
  { to: '/m', label: 'Beranda', icon: Home, end: true },
  { to: '/m/cuti', label: 'Cuti', icon: ClipboardList, end: false },
  { to: '/m/masuk', label: 'Masuk', icon: Inbox, end: false },
  { to: '/m/saya', label: 'Saya', icon: User, end: false },
];

function NotifBell() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const { data: inbox } = useQuery({
    queryKey: ['m-inbox-count'],
    queryFn: async (): Promise<number> => {
      if (!isManagerLike(me)) return 0;
      try {
        const res = await api.get('/approvals/pending');
        return res.data?.awaitingDecision ?? res.data?.data?.length ?? 0;
      } catch {
        return 0;
      }
    },
    enabled: isManagerLike(me),
    staleTime: 60_000,
  });
  return (
    <button
      onClick={() => navigate('/m/masuk')}
      className="relative p-2 rounded-full bg-white/20"
      aria-label="Notifikasi"
    >
      <Bell className="w-5 h-5" />
      {!!inbox && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-amber-400 text-red-800 text-[11px] font-bold flex items-center justify-center">
          {inbox > 9 ? '9+' : inbox}
        </span>
      )}
    </button>
  );
}

/** IGDERP-276: phone-first shell for the employee app (mockup → real). */
export default function MobileShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: me, isLoading } = useMe();

  useEffect(() => {
    if (!isLoading && !me && !location.pathname.startsWith('/m/login')) {
      navigate('/m/login', { replace: true });
    }
  }, [isLoading, me, location.pathname, navigate]);

  if (location.pathname.startsWith('/m/login')) {
    return (
      <div className="min-h-dvh bg-gray-50 flex justify-center">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    );
  }

  const name = me?.employee?.fullName || me?.fullName || me?.email || 'Karyawan';
  const first = name.split(' ')[0];

  return (
    <div className="min-h-dvh bg-gray-100 flex justify-center">
      <div className="m-shell w-full max-w-md bg-gray-50 min-h-dvh flex flex-col relative">
        {/* IGDERP-276: reused desktop pages have sticky bottom-0 action bars —
            lift them above the fixed tabbar inside the mobile shell. */}
        <style>{`.m-shell .sticky.bottom-0 { bottom: 96px !important; }`}</style>
        <header className="bg-red-600 text-white px-4 pt-12 pb-4 rounded-b-3xl shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs opacity-80">Halo,</p>
              <h1 className="text-lg font-bold leading-tight">{first}</h1>
            </div>
            <NotifBell />
          </div>
        </header>
        <main className="flex-1 px-4 py-3 pb-32">
          <Outlet />
        </main>
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 flex px-2 pt-2 pb-5 z-20">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-1 py-1 text-[11px] font-semibold ${
                  isActive ? 'text-red-600' : 'text-gray-400'
                }`
              }
            >
              <t.icon className="w-5 h-5" />
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
