import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Edit, Tag, Loader2, Package, FolderTree, Calendar } from 'lucide-react';
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
    <div className="w-full space-y-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Informasi Kategori */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary-600" />
              Informasi Kategori
            </h2>
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Nama Kategori</p>
                <p className="text-sm font-semibold text-gray-900">{category.name}</p>
              </div>

              {category.code && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Kode Kategori</p>
                  <p className="text-sm font-semibold text-gray-900 font-mono">{category.code}</p>
                </div>
              )}

              {category.description && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Deskripsi</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{category.description}</p>
                </div>
              )}

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    category.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {category.isActive ? 'Aktif' : 'Tidak Aktif'}
                </span>
              </div>
            </div>
          </div>

          {/* Parent Category */}
          {category.parentCategory && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-primary-600" />
                Kategori Induk
              </h2>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-600 mb-1">Nama Kategori Induk</p>
                <p className="text-sm font-semibold text-blue-900">{category.parentCategory.name}</p>
                {category.parentCategory.code && (
                  <p className="text-xs text-blue-600 mt-1 font-mono">{category.parentCategory.code}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Statistics & Info */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary-600" />
              Statistik
            </h2>
            <div className="space-y-3">
              <div className="p-3 bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg border border-primary-200">
                <p className="text-xs text-primary-600 mb-1">Total Produk</p>
                <p className="text-2xl font-bold text-primary-900">{category.productCount || 0}</p>
                <p className="text-xs text-primary-600 mt-1">Produk dalam kategori ini</p>
              </div>

              {category.childCategories && category.childCategories.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Sub Kategori</p>
                  <p className="text-2xl font-bold text-gray-900">{category.childCategories.length}</p>
                  <p className="text-xs text-gray-500 mt-1">Kategori di bawah ini</p>
                </div>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              Informasi Tambahan
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Dibuat</span>
                <span className="font-semibold text-gray-900">
                  {new Date(category.createdAt).toLocaleDateString('id-ID', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Diupdate</span>
                <span className="font-semibold text-gray-900">
                  {new Date(category.updatedAt).toLocaleDateString('id-ID', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
