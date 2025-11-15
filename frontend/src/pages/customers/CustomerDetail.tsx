import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Edit,
  ArrowLeft,
  Users,
  Phone,
  Mail,
  MapPin,
  Loader2,
  Award,
  Calendar,
  Crown,
  Sparkles,
} from 'lucide-react';
import { customersService } from '../../services/customers.service';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersService.getById(id!),
    enabled: !!id,
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'PLATINUM':
        return 'bg-gradient-to-r from-purple-500 to-purple-600 text-white border-purple-600';
      case 'GOLD':
        return 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white border-yellow-500';
      case 'SILVER':
        return 'bg-gradient-to-r from-gray-300 to-gray-400 text-white border-gray-400';
      default:
        return 'bg-gradient-to-r from-blue-400 to-blue-500 text-white border-blue-500';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'PLATINUM':
        return <Crown className="w-5 h-5" />;
      case 'GOLD':
        return <Award className="w-5 h-5" />;
      case 'SILVER':
        return <Award className="w-5 h-5" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="w-full text-center py-12">
        <p className="text-gray-600 text-lg">Pelanggan tidak ditemukan</p>
        <button
          onClick={() => navigate('/customers')}
          className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
        >
          Kembali ke daftar pelanggan
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Page Header - Enhanced */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/customers')}
              className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-4xl font-bold mb-2">{customer.name}</h1>
              <p className="text-primary-100 text-lg">Detail pelanggan dan riwayat transaksi</p>
            </div>
          </div>
          <Link to={`/customers/${id}/edit`}>
            <button className="flex items-center gap-2 px-6 py-3 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-all shadow-lg hover:shadow-xl">
              <Edit className="w-5 h-5" />
              <span>Edit Pelanggan</span>
            </button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info - Enhanced */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-200">
              <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-md">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Informasi Kontak</h2>
                <p className="text-sm text-gray-600 mt-1">Data kontak pelanggan</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Telepon</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{customer.phone}</p>
              </div>
              {customer.email && (
                <div className="p-5 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-green-500 rounded-lg">
                      <Mail className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">Email</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{customer.email}</p>
                </div>
              )}
              {customer.address && (
                <div className="md:col-span-2 p-5 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-purple-500 rounded-lg">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">Alamat</span>
                  </div>
                  <p className="text-base font-semibold text-gray-900">{customer.address}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar - Enhanced */}
        <div className="space-y-6">
          {/* Tier Card */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
              <div className="p-2 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl">
                <Award className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Tier Pelanggan</h2>
            </div>
            <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200">
              <span
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base font-bold border shadow-lg ${getTierColor(
                  customer.tier,
                )}`}
              >
                {getTierIcon(customer.tier)}
                {customer.tier}
              </span>
              {customer.tier === 'PLATINUM' || customer.tier === 'GOLD' ? (
                <div className="flex items-center gap-1 mt-3">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs font-semibold text-gray-600">Pelanggan Premium</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Customer Code Card */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
              <div className="p-2 bg-gradient-to-br from-gray-400 to-gray-500 rounded-xl">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Kode Pelanggan</h2>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
              <p className="text-2xl font-bold text-gray-900 font-mono text-center">{customer.code}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
