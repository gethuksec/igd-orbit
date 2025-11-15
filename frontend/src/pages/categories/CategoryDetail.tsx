import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Edit, Tag, Package, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

export default function CategoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: category, isLoading } = useQuery({
    queryKey: ['category', id],
    queryFn: async () => {
      const res = await api.get(`/categories/${id}`);
      return res.data.data || res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Kategori tidak ditemukan</p>
        <button
          onClick={() => navigate('/categories')}
          className="mt-4 text-primary-600 hover:text-primary-700"
        >
          Kembali ke daftar kategori
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/categories')}
              className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold mb-1">{category.name}</h1>
              <p className="text-primary-100">Detail Kategori</p>
            </div>
          </div>
          <Link
            to={`/categories/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all"
          >
            <Edit className="w-4 h-4" />
            <span>Edit</span>
          </Link>
        </div>
      </div>

      {/* Detail Card */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
            <Tag className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Informasi Kategori</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-500">Nama Kategori</label>
            <p className="text-base font-semibold text-gray-900">{category.name}</p>
          </div>
          {category.code && (
            <div>
              <label className="text-sm text-gray-500">Kode Kategori</label>
              <p className="text-base font-semibold text-gray-900">{category.code}</p>
            </div>
          )}
          {category.description && (
            <div>
              <label className="text-sm text-gray-500">Deskripsi</label>
              <p className="text-base text-gray-900">{category.description}</p>
            </div>
          )}
          <div>
            <label className="text-sm text-gray-500">Status</label>
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                category.isActive
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {category.isActive ? 'Aktif' : 'Tidak Aktif'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

