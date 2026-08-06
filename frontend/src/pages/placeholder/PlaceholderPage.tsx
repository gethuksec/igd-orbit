import { Construction,  } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { useNavigate } from 'react-router-dom';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  const navigate = useNavigate();

  return (
    <div className="w-full space-y-3">
      {/* Page Header - Enhanced */}
      <BreadcrumbHeader title={title} subtitle={description} />

      {/* Content */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-12">
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="p-6 bg-gradient-to-br from-primary-100 to-primary-200 text-primary-600 rounded-full mb-6 shadow-lg">
            <Construction className="w-16 h-16" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Halaman Sedang Dalam Pengembangan</h2>
          {description && (
            <p className="text-gray-600 text-center max-w-md mb-4 text-lg">{description}</p>
          )}
          <p className="text-sm text-gray-500 mb-6">
            Fitur ini akan segera hadir untuk meningkatkan pengalaman Anda
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg font-semibold hover:from-primary-700 hover:to-primary-600 shadow-lg hover:shadow-xl transition-all"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
