import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  LogOut,
  Settings,
  User,
} from 'lucide-react';
import type { Branch } from '@/services/public.service';
import { publicService } from '@/services/public.service';
import { useBranchStore } from '@/stores/branchStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface POSLayoutProps {
  children: React.ReactNode;
}

const getUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) return JSON.parse(userStr);
  } catch {
    // Ignore
  }
  return { fullName: 'Admin', role: { name: 'Administrator', code: 'ADMIN' } };
};

export default function POSLayout({ children }: POSLayoutProps) {
  const user = getUser();
  const { availableBranches, currentBranchId, setBranches, setCurrentBranchId } = useBranchStore();
  const navigate = useNavigate();

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const data = await publicService.getBranches();
        let branches: Branch[] = data || [];
        if (user?.branchIds && Array.isArray(user.branchIds) && user.branchIds.length > 0) {
          const filtered = branches.filter((b: Branch) => user.branchIds.includes(b.id));
          branches = filtered.length > 0 ? filtered : branches;
        }
        setBranches(branches);
        if (branches.length === 1) {
          setCurrentBranchId(branches[0].id);
        }
      } catch (error) {
        console.error('Failed to load branches:', error);
      }
    };
    loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const initial = user?.fullName?.charAt(0).toUpperCase() || 'A';

  return (
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden flex flex-col">
      {/* Minimal Header — logo left, account right */}
      <header className="sticky top-0 z-30 bg-white border-b border-border shadow-sm">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <img src="/logo/igd-1.jpg" alt="IGD Ponsel Logo" className="h-9 w-9 object-contain flex-shrink-0" />
            <span className="text-sm font-semibold text-foreground hidden sm:inline">IGD Ponsel</span>
          </div>

          {/* Right: Branch selector + Notifications + Account */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Branch selector */}
            {availableBranches.length > 0 && (
              <div className="hidden md:flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Cabang:</span>
                <select
                  value={currentBranchId || ''}
                  onChange={(e) => setCurrentBranchId(e.target.value === '' ? null : e.target.value)}
                  className="border border-input rounded-lg px-2 py-1 text-xs bg-background focus:ring-2 focus:ring-primary-500"
                >
                  {availableBranches.length > 1 && <option value="">Semua Cabang</option>}
                  {availableBranches.map((branch: Branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-600 rounded-full" />
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-3 py-2 h-auto">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-to-r from-primary-600 to-primary-500 text-white text-sm">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-semibold text-foreground">
                      {user?.fullName || 'Admin'}
                      {user?.role?.name && (
                        <span className="text-xs font-normal text-muted-foreground ml-1">({user.role.name})</span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">{user?.role?.code || 'ADMIN'}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground hidden md:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="w-4 h-4 mr-2" />
                  Profil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Pengaturan
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Full-width page content — no sidebar */}
      <main className="flex-1 w-full">
        {children}
      </main>
    </div>
  );
}
