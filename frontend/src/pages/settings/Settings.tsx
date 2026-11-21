import { Bell, Shield, Globe, Moon, Sun, Monitor } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { useThemeStore, type ThemeMode } from '@/stores/themeStore';
import { cn } from '@/lib/utils';

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Terang', Icon: Sun },
  { value: 'dark', label: 'Gelap', Icon: Moon },
  { value: 'auto', label: 'Otomatis', Icon: Monitor },
];

export default function Settings() {
  const { mode, setMode } = useThemeStore();
  return (
    <div className="space-y-6">
      <BreadcrumbHeader title="Pengaturan" subtitle="Kelola preferensi dan pengaturan akun Anda" />

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Notification Settings */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Notifikasi</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Notifikasi Email</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Terima notifikasi via email</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Notifikasi Push</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Terima notifikasi push di browser</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Keamanan</h2>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
              <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">Ubah Password</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Ubah password akun Anda untuk keamanan yang lebih baik</p>
              <button
                disabled
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg cursor-not-allowed"
              >
                Fitur ini akan segera tersedia
              </button>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
              <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">Sesi Aktif</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Kelola sesi aktif Anda di berbagai perangkat</p>
              <button
                disabled
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg mt-2 cursor-not-allowed"
              >
                Fitur ini akan segera tersedia
              </button>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Preferensi</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Bahasa</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pilih bahasa untuk antarmuka</p>
              </div>
              <select
                defaultValue="id"
                className="px-4 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Tema</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pilih tema tampilan</p>
              </div>
              <div className="flex items-center gap-2">
                {THEME_OPTIONS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => setMode(value)}
                    title={label}
                    aria-pressed={mode === value}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      mode === value
                        ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
