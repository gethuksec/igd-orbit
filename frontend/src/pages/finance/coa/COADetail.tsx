import { useParams, Link } from 'react-router-dom';
import { BreadcrumbHeader } from '@/components/shared';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  FileText,
  DollarSign,
  Wallet,
  TrendingUp,
  TrendingDown,
  Target,
  Building2,
  Eye,
} from 'lucide-react';
import { financeService } from '../../../services/finance.service';

export default function COADetail() {
  const { id } = useParams<{ id: string }>();

  const { data: account, isLoading, error } = useQuery({
    queryKey: ['chart-of-account', id],
    queryFn: () => financeService.getChartOfAccountById(id!),
    enabled: !!id,
  });

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'ASSET':
        return <Wallet className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'LIABILITY':
        return <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />;
      case 'EQUITY':
        return <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'REVENUE':
        return <TrendingUp className="w-5 h-5 text-green-500 dark:text-green-400" />;
      case 'EXPENSE':
        return <TrendingDown className="w-5 h-5 text-orange-600 dark:text-orange-400" />;
      default:
        return <DollarSign className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'ASSET':
        return 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800';
      case 'LIABILITY':
        return 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800';
      case 'EQUITY':
        return 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800';
      case 'REVENUE':
        return 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700';
      case 'EXPENSE':
        return 'bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="w-full space-y-3">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-16 text-center">
          <Loader2 className="w-16 h-16 text-primary-600 dark:text-primary-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-semibold text-lg">Memuat detail akun...</p>
        </div>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="w-full space-y-3">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-16 text-center">
          <FileText className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-semibold text-lg">
            {(error as Error)?.message || 'Akun tidak ditemukan'}
          </p>
          <Link
            to="/finance/coa"
            className="mt-4 inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Chart of Accounts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <BreadcrumbHeader title="Detail Akun" subtitle="Informasi lengkap akun akuntansi" />

      {/* Account Information */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            {getAccountTypeIcon(account.accountType)}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{account.name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">{account.code}</p>
            </div>
          </div>
          <span
            className={`text-sm px-3 py-1.5 rounded border font-semibold ${getAccountTypeColor(
              account.accountType,
            )}`}
          >
            {account.accountType}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Kode Akun</label>
            <div className="text-base font-mono text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
              {account.code}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nama Akun</label>
            <div className="text-base text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
              {account.name}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipe Akun</label>
            <div className="text-base text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
              {account.accountType}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
            <div className="text-base text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
              {account.isHeader ? (
                <span className="inline-flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Header Account
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Transaction Account
                </span>
              )}
            </div>
          </div>

          {account.parent && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Parent Account</label>
              <Link
                to={`/finance/coa/${account.parent.id}`}
                className="text-base text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline bg-gray-50 dark:bg-gray-950 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 block"
              >
                {account.parent.code} - {account.parent.name}
              </Link>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status Aktif</label>
            <div className="text-base text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
              {account.isActive ? (
                <span className="text-green-600 dark:text-green-400 font-semibold">Aktif</span>
              ) : (
                <span className="text-red-600 dark:text-red-400 font-semibold">Tidak Aktif</span>
              )}
            </div>
          </div>

          {account.description && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Deskripsi</label>
              <div className="text-base text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                {account.description}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Children Accounts */}
      {account.children && account.children.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            Sub Accounts ({account.children.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gradient-to-r from-gray-50 dark:from-gray-900 via-gray-50 dark:via-gray-900 to-gray-100 dark:to-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Kode
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Nama
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Tipe
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                {account.children.map((child) => (
                  <tr
                    key={child.id}
                    className="hover:bg-gradient-to-r hover:from-gray-50 dark:hover:from-gray-900 hover:to-white dark:hover:to-gray-900 transition-all duration-200"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{child.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/finance/coa/${child.id}`}
                        className="font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 hover:underline"
                      >
                        {child.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-xs px-2 py-1 rounded border font-medium ${getAccountTypeColor(
                          child.accountType,
                        )}`}
                      >
                        {child.accountType}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {child.isHeader ? (
                        <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                          Header
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded">
                          Transaction
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <Link
                        to={`/finance/coa/${child.id}`}
                        className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Detail</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Metadata</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Dibuat:</span>
            <span className="ml-2 text-gray-900 dark:text-gray-100">
              {new Date(account.createdAt).toLocaleString('id-ID')}
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Diperbarui:</span>
            <span className="ml-2 text-gray-900 dark:text-gray-100">
              {new Date(account.updatedAt).toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

