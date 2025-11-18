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
  Crown,
  Building2,
  FileText,
  ShoppingCart,
  Wrench,
  Plus,
  MessageCircle,
  TrendingUp,
  Package,
} from 'lucide-react';
import { customersService } from '../../services/customers.service';
import { api } from '../../services/api';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: customer, isLoading, error } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersService.getById(id!),
    enabled: !!id,
    retry: 1,
  });

  const { data: transactions } = useQuery({
    queryKey: ['customer-transactions', id],
    queryFn: async () => {
      try {
        const response = await api.get(`/customers/${id}/transactions?page=1&limit=10`);
        return response.data;
      } catch {
        return { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } };
      }
    },
    enabled: !!id,
  });

  const getTierColor = (tier: { code: string; name: string } | null | string) => {
    if (!tier) return 'bg-gray-100 text-gray-700 border-gray-300';
    const tierCode = typeof tier === 'string' ? tier : tier.code?.toUpperCase();
    switch (tierCode) {
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

  const getTierIcon = (tier: { code: string; name: string } | null | string) => {
    if (!tier) return null;
    const tierCode = typeof tier === 'string' ? tier : tier.code?.toUpperCase();
    switch (tierCode) {
      case 'PLATINUM':
        return <Crown className="w-4 h-4" />;
      case 'GOLD':
        return <Award className="w-4 h-4" />;
      case 'SILVER':
        return <Award className="w-4 h-4" />;
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

  if (error) {
    return (
      <div className="w-full text-center py-12">
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm max-w-md mx-auto">
          <p className="text-red-800 font-medium">
            {(error as Error).message || 'Terjadi kesalahan saat memuat data pelanggan'}
          </p>
        </div>
        <button
          onClick={() => navigate('/customers')}
          className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
        >
          Kembali ke daftar pelanggan
        </button>
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

  const customerData = customer as any;

  return (
    <div className="w-full space-y-4">
      {/* Compact Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/customers')}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md">
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-gray-500 font-mono">{customer.customerCode}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                    {customer.customerType === 'retail' ? 'Retail' : customer.customerType === 'wholesale' ? 'Wholesale' : 'Corporate'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${getTierColor(
                      customer.tier,
                    )}`}
                  >
                    {getTierIcon(customer.tier)}
                    {typeof customer.tier === 'object' && customer.tier !== null
                      ? customer.tier.name
                      : customer.tier || 'No Tier'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <Link to={`/customers/${id}/edit`}>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-all shadow-sm">
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content - Compact Cards */}
        <div className="lg:col-span-2 space-y-4">
          {/* Statistics Cards - Estetik */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Pembelian */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-5 text-white">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <ShoppingCart className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs text-blue-100 mb-1">Pembelian</p>
              <p className="text-2xl font-bold">
                {transactions?.data?.filter((t: any) => t.type === 'sales').length || 0}
              </p>
              <p className="text-xs text-blue-100 mt-1">
                {(() => {
                  const salesTotal = transactions?.data
                    ?.filter((t: any) => t.type === 'sales')
                    .reduce((sum: number, t: any) => sum + (t.totalAmount || 0), 0) || 0;
                  return `Rp ${salesTotal.toLocaleString('id-ID')}`;
                })()}
              </p>
            </div>

            {/* Service */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-5 text-white">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Wrench className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs text-green-100 mb-1">Service</p>
              <p className="text-2xl font-bold">
                {transactions?.data?.filter((t: any) => t.type === 'service').length || 0}
              </p>
              <p className="text-xs text-green-100 mt-1">
                {(() => {
                  const serviceTotal = transactions?.data
                    ?.filter((t: any) => t.type === 'service')
                    .reduce((sum: number, t: any) => sum + (t.totalAmount || 0), 0) || 0;
                  return `Rp ${serviceTotal.toLocaleString('id-ID')}`;
                })()}
              </p>
            </div>

            {/* Riwayat Transaksi */}
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-5 text-white">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Package className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs text-purple-100 mb-1">Riwayat Transaksi</p>
              <p className="text-2xl font-bold">
                {transactions?.meta?.total || 0}
              </p>
              <p className="text-xs text-purple-100 mt-1">
                {transactions?.data?.filter((t: any) => t.type === 'sales').length || 0} penjualan,{' '}
                {transactions?.data?.filter((t: any) => t.type === 'service').length || 0} service
              </p>
            </div>

            {/* Total Transaksi */}
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-5 text-white">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs text-orange-100 mb-1">Total Transaksi</p>
              <p className="text-2xl font-bold">
                {transactions?.meta?.total || customerData.statistics?.totalOrders || 0}
              </p>
              <p className="text-xs text-orange-100 mt-1">
                {(() => {
                  const totalAmount = transactions?.data?.reduce((sum: number, t: any) => sum + (t.totalAmount || 0), 0) || 0;
                  return `Rp ${totalAmount.toLocaleString('id-ID')}`;
                })()}
              </p>
            </div>
          </div>

          {/* Contact Info - Compact with Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-600" />
              Kontak
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Phone className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500 mb-1">Telepon</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{customer.phone}</p>
                    <button
                      onClick={() => {
                        const phoneNumber = customer.phone.replace(/[^0-9]/g, '');
                        const message = encodeURIComponent(`Halo ${customer.name}, ada yang bisa kami bantu?`);
                        window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
                      }}
                      className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      title="Kirim WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {customerData.alternatePhone && (
                    <p className="text-xs text-gray-600 mt-1">Alt: {customerData.alternatePhone}</p>
                  )}
                </div>
              </div>
              {customer.email && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Mail className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 mb-1">Email</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 break-all">{customer.email}</p>
                      <a
                        href={`mailto:${customer.email}?subject=Halo ${customer.name}`}
                        className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        title="Kirim Email"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
              {customer.address && (
                <div className="md:col-span-2 flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 mb-1">Alamat</p>
                    <p className="text-sm font-semibold text-gray-900">{customer.address}</p>
                    {(customerData.city || customerData.province) && (
                      <p className="text-xs text-gray-600 mt-1">
                        {[customerData.city, customerData.province, customerData.postalCode].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="border-t pt-4 mt-4">
              <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Quick Actions</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/service-orders/new?customerId=${id}`)}
                  className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100 transition-all border border-green-200 text-sm"
                  title="Buat Service Order dengan data customer ini"
                >
                  <Wrench className="w-4 h-4" />
                  <span>Service Order</span>
                </button>
                <button
                  onClick={() => navigate(`/sales/pos?customerId=${id}`)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition-all border border-blue-200 text-sm"
                  title="Buat Penjualan dengan data customer ini"
                >
                  <Plus className="w-4 h-4" />
                  <span>Penjualan</span>
                </button>
              </div>
            </div>
          </div>

          {/* Personal & Identity - Compact */}
          {(customerData.dateOfBirth || customerData.gender || customerData.religion || customerData.idType || customerData.idNumber) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                Data Pribadi & Identitas
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {customerData.dateOfBirth && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Tanggal Lahir</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(customerData.dateOfBirth).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                )}
                {customerData.gender && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Jenis Kelamin</p>
                    <p className="text-sm font-semibold text-gray-900">{customerData.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
                  </div>
                )}
                {customerData.religion && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Agama</p>
                    <p className="text-sm font-semibold text-gray-900">{customerData.religion}</p>
                  </div>
                )}
                {customerData.idType && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Jenis Identitas</p>
                    <p className="text-sm font-semibold text-gray-900">{customerData.idType}</p>
                    {customerData.idNumber && (
                      <p className="text-xs text-gray-600 mt-1 font-mono">{customerData.idNumber}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tax Info - Compact */}
          {(customerData.taxId || customerData.taxName || customerData.taxIdType) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary-600" />
                Data Pajak
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {customerData.taxName && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Nama (Pajak)</p>
                    <p className="text-sm font-semibold text-gray-900">{customerData.taxName}</p>
                  </div>
                )}
                {customerData.taxIdType && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Jenis Identitas Pajak</p>
                    <p className="text-sm font-semibold text-gray-900">{customerData.taxIdType}</p>
                  </div>
                )}
                {customerData.taxId && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">No NPWP/KTP</p>
                    <p className="text-sm font-semibold text-gray-900 font-mono">{customerData.taxId}</p>
                  </div>
                )}
                {customerData.idTKU && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">IDTKU</p>
                    <p className="text-sm font-semibold text-gray-900">{customerData.idTKU}</p>
                  </div>
                )}
                {customerData.taxAddress && (
                  <div className="md:col-span-2 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Alamat (Pajak)</p>
                    <p className="text-sm font-semibold text-gray-900">{customerData.taxAddress}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transaction History - Compact */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary-600" />
              Riwayat Transaksi
            </h2>
            {transactions?.data && transactions.data.length > 0 ? (
              <div className="space-y-2">
                {transactions.data.map((transaction: any) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {transaction.type === 'sales' ? (
                          <Link
                            to={`/sales/${transaction.id}`}
                            className="text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline transition-colors"
                            title="Lihat detail transaksi penjualan"
                          >
                            {transaction.referenceNumber || '-'}
                          </Link>
                        ) : (
                          <Link
                            to={`/service-orders/${transaction.id}`}
                            className="text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline transition-colors"
                            title="Lihat detail service order"
                          >
                            {transaction.referenceNumber || '-'}
                          </Link>
                        )}
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          transaction.type === 'sales' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {transaction.type === 'sales' ? 'Penjualan' : 'Service'}
                        </span>
                        {transaction.branch && (
                          <span className="text-xs text-gray-500">({transaction.branch.name})</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {transaction.createdAt ? new Date(transaction.createdAt).toLocaleDateString('id-ID', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }) : '-'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          transaction.paymentStatus === 'paid' 
                            ? 'bg-green-100 text-green-700' 
                            : transaction.paymentStatus === 'partial'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {transaction.paymentStatus === 'paid' ? 'Lunas' : transaction.paymentStatus === 'partial' ? 'Cicilan' : 'Belum Bayar'}
                        </span>
                        <span className="text-xs text-gray-500">
                          Status: {transaction.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-bold text-primary-600">
                        Rp {transaction.totalAmount ? transaction.totalAmount.toLocaleString('id-ID') : '0'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Belum ada transaksi</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Compact */}
        <div className="space-y-4">
          {/* Customer Stats - More Interesting */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-600" />
              Informasi
            </h2>
            <div className="space-y-3">
              <div className="p-3 bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg border border-primary-200">
                <p className="text-xs text-primary-600 mb-1">Kode Pelanggan</p>
                <p className="text-base font-bold text-primary-900 font-mono">
                  {customer.customerCode || '-'}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Jenis Pelanggan</p>
                <p className="text-sm font-semibold text-gray-900">
                  {customer.customerType === 'retail' ? 'Retail' : customer.customerType === 'wholesale' ? 'Wholesale' : 'Corporate'}
                </p>
              </div>
              {customerData.preferredBranch && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Cabang Preferensi</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {customerData.preferredBranch.name || '-'}
                  </p>
                </div>
              )}
              {customerData.createdAt && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Terdaftar Sejak</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {new Date(customerData.createdAt).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notes - Compact */}
          {customerData.notes && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                Keterangan
              </h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-200">
                {customerData.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
