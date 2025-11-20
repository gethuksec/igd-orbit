import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Unauthorized Page
 * 
 * Shown when user tries to access a route they don't have permission for.
 */
export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-6 flex justify-center">
          <div className="p-4 bg-red-100 rounded-full">
            <Shield className="w-16 h-16 text-red-600" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-3">Akses Ditolak</h1>
        <p className="text-gray-600 mb-2">
          Anda tidak memiliki izin untuk mengakses halaman ini.
        </p>
        <p className="text-sm text-gray-500 mb-8">
          Silakan hubungi administrator jika Anda memerlukan akses ke halaman ini.
        </p>

        <div className="flex flex-col gap-3">
          <Button
            onClick={() => navigate(-1)}
            className="w-full"
            variant="outline"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          <Button
            onClick={() => navigate('/dashboard')}
            className="w-full"
          >
            Ke Dashboard
          </Button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <AlertTriangle className="w-4 h-4" />
            <span>Error Code: 403 - Forbidden</span>
          </div>
        </div>
      </div>
    </div>
  );
}

