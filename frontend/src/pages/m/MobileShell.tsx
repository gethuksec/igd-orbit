import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { ClipboardList, Home, Inbox, User, Users } from 'lucide-react';
import { api } from '../../services/api';

export interface MeUser {
  id: string;
  email: string;
  fullName?: string;
  mustChangePassword?: boolean;
  roles?: string[];
  employee?: {
    fullName?: string;
    position?: string;
    employeeCode?: string;
    phone?: string;
  } | null;
  userBranches?: Array<{
    branchId: string;
    branch?: { id: string; name?: string };
    role?: { name?: string };
  }>;
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
    // Never probe the session from the login screen itself — an empty token
    // would 401 and the interceptor would reload-loop.
    enabled: !isLogin,
    staleTime: 60_000,
    retry: false,
  });
}

export function isManagerLike(me?: MeUser | null): boolean {
  const branchRoles = (me?.userBranches ?? []).map((b) => (b.role?.name ?? '').toUpperCase());
  const topRoles = ((me as any)?.roles ?? []).map((r: string) => String(r).toUpperCase());
  return [...branchRoles, ...topRoles].some((r) => ['HS', 'SPV', 'CHR', 'OWNER', 'SUPERADMIN'].includes(r));
}

// IGDERP-276d: mockup-faithful 5-tab nav (English labels, active = red).
const TABS = [
  { to: '/m', label: 'Home', icon: Home, end: true },
  { to: '/m/employee', label: 'Employee', icon: Users, end: false },
  { to: '/m/request', label: 'Request', icon: ClipboardList, end: false },
  { to: '/m/inbox', label: 'Inbox', icon: Inbox, end: false },
  { to: '/m/profile', label: 'Profile', icon: User, end: false },
];

/** IGDERP-276d: phone-first shell. No global header — each screen renders
 *  its own (red beranda banner vs white title headers, per mockup). */
export default function MobileShell() {
  const { data: me, isLoading } = useMe();
  const navigate = useNavigate();
  const location = useLocation();
  const isLogin = location.pathname.startsWith('/m/login');

  useEffect(() => {
    if (!isLogin && !isLoading && !me) {
      navigate('/m/login', { replace: true });
    }
  }, [me, isLoading, isLogin, navigate]);

  if (isLogin) {
    return (
      <div className="min-h-dvh bg-gray-100 flex justify-center">
        <div className="w-full max-w-md bg-white min-h-dvh">
          <Outlet />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-100 flex justify-center">
      <div className="m-shell w-full max-w-md bg-[#F9FAFB] min-h-dvh flex flex-col relative">
        {/* Reused desktop pages have sticky bottom-0 action bars —
            lift them above the fixed tabbar inside the mobile shell. */}
        <style>{`.m-shell .sticky.bottom-0 { bottom: 96px !important; }`}</style>
        <main className="flex-1 px-4 py-3 pb-32">
          <Outlet />
        </main>
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 flex px-1 pt-2 pb-5 z-20">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className="flex-1 flex flex-col items-center gap-0.5 py-1"
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-6 h-6 ${isActive ? 'text-red-600' : 'text-gray-400'}`} />
                  <span
                    className={`text-[11px] font-medium ${isActive ? 'text-red-600' : 'text-gray-500'}`}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
