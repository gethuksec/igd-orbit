// Opt-1 multi-PWA host detection: one React build is served on several
// single-level subdomains; each host gets its own install identity (manifest)
// and landing route. All routes stay reachable on every host (no hard guards
// in Opt-1 — entry point + install identity differ, the app is the same).
export type HostApp = 'admin' | 'employee' | 'pos' | 'repair';

export function getHostApp(hostname: string = window.location.hostname): HostApp {
  const h = hostname.toLowerCase();
  if (h.startsWith('pos-igd')) return 'pos';
  if (h.startsWith('sr-igd')) return 'repair';
  if (h.startsWith('employee-igd') || h.startsWith('employee.')) return 'employee';
  return 'admin';
}

export const HOST_DEFAULT_ROUTE: Record<HostApp, string> = {
  admin: '/',
  employee: '/employees',
  pos: '/pos',
  repair: '/services/smart-repair',
};
