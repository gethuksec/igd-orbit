import { useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  LogOut,
  Settings,
  User,
} from 'lucide-react';
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
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const initial = user?.fullName?.charAt(0).toUpperCase() || 'A';

  return (
    <div className="h-dvh bg-gray-50 w-full overflow-x-hidden flex flex-col">
      {/* Minimal Header — logo left, account right */}
      <header className="sticky top-0 z-30 bg-white border-b border-border shadow-sm">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <img src="/logo/igd-1.jpg" alt="IGD Ponsel Logo" className="h-9 w-9 object-contain flex-shrink-0" />
            <span className="text-sm font-semibold text-foreground hidden sm:inline">IGD Ponsel</span>
          </div>

          {/* Right: Notifications + Account */}
          <div className="flex items-center gap-3 flex-shrink-0">
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
      <main className="flex-1 min-h-0 w-full flex flex-col">
        {children}
      </main>
    </div>
  );
}
