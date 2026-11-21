import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Eye,
  Loader2,
  CreditCard,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { financeService, type PettyCashFund } from '../../../services/finance.service';
import { useBranchFilter } from '@/components/branch/BranchFilter';
import { BreadcrumbHeader, FilterToolbar } from '@/components/shared';

export default function PettyCashList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const { branchId, setBranchId } = useBranchFilter();

  useEffect(() => {
    setSearchTerm('');
  }, [selectedStatus, branchId]);

  const { data: funds, isLoading } = useQuery({
    queryKey: ['petty-cash-funds', branchId, selectedStatus],
    queryFn: () =>
      financeService.getPettyCashFunds({
        branchId: branchId || undefined,
        isActive: selectedStatus === 'all' ? undefined : selectedStatus === 'active',
      }),
  });

  const filteredFunds = (funds || []).filter((fund: PettyCashFund) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      fund.fundNumber.toLowerCase().includes(search) ||
      fund.branch?.name.toLowerCase().includes(search)
    );
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <BreadcrumbHeader title="Petty Cash" subtitle="Kelola kas kecil per cabang">
        <Link
            to="/finance/petty-cash/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Fund</span>
          </Link>
      </BreadcrumbHeader>

      {/* Filters */}
      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nomor fund atau cabang..."
        branchFilter={{ value: branchId, onChange: setBranchId, allowAll: true }}
        fields={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'active', label: 'Aktif' },
              { value: 'inactive', label: 'Tidak Aktif' },
            ],
          },
        ]}
        values={{ status: selectedStatus === 'all' ? '' : selectedStatus }}
        onFieldChange={(key, v) => {
          if (key === 'status') {
            setSelectedStatus((v || 'all') as any);
          }
        }}
        onReset={() => {
          setSelectedStatus('all');
        }}
      />

      {/* Funds Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gradient-to-r from-gray-50 dark:from-gray-900 via-gray-50 dark:via-gray-900 to-gray-100 dark:to-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                  Nomor Fund
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                  Cabang
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                  Custodian
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                  Opening Balance
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                  Current Balance
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                  Periode
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
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-16 h-16 text-primary-600 dark:text-primary-400 animate-spin" />
                      <p className="text-gray-600 dark:text-gray-400 font-semibold text-lg">Memuat petty cash funds...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredFunds.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <CreditCard className="w-16 h-16 text-gray-400 dark:text-gray-500" />
                      <p className="text-gray-600 dark:text-gray-400 font-semibold text-lg">
                        Tidak ada petty cash fund ditemukan
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredFunds.map((fund: PettyCashFund) => (
                  <tr
                    key={fund.id}
                    className="hover:bg-gradient-to-r hover:from-gray-50 dark:hover:from-gray-900 hover:to-white dark:hover:to-gray-900 transition-all duration-200 border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {fund.fundNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">{fund.branch?.name || '-'}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">{fund.custodian?.name || '-'}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(fund.openingBalance)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div
                        className={`text-sm font-bold ${
                          fund.currentBalance < fund.openingBalance * 0.2
                            ? 'text-red-600 dark:text-red-400'
                            : fund.currentBalance < fund.openingBalance * 0.5
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-green-600 dark:text-green-400'
                        }`}
                      >
                        {formatCurrency(fund.currentBalance)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {new Date(fund.periodStart).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {fund.periodEnd && (
                          <>
                            {' - '}
                            {new Date(fund.periodEnd).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {fund.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800">
                          <CheckCircle className="w-4 h-4" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                          <XCircle className="w-4 h-4" />
                          Tidak Aktif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <Link
                        to={`/finance/petty-cash/${fund.id}`}
                        className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Detail</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

