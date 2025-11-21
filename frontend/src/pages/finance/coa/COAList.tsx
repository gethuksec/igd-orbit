import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Search,
  Filter,
  Loader2,
  ChevronDown,
  ChevronRight,
  Sprout,
  Eye,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Target,
} from 'lucide-react';
import { financeService, type ChartOfAccount } from '../../../services/finance.service';
import { toast } from 'sonner';

export default function COAList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: accounts, isLoading, error } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: () => financeService.getChartOfAccounts(),
  });

  const seedMutation = useMutation({
    mutationFn: () => financeService.seedChartOfAccounts(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      toast.success('Chart of Accounts berhasil di-seed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal seed Chart of Accounts');
    },
  });

  // Build tree structure
  const accountTree = useMemo(() => {
    if (!accounts) return [];

    // Find root accounts (no parent)
    const roots = accounts.filter((acc) => !acc.parentId);
    
    // Build tree recursively
    const buildTree = (parentId: string | null): ChartOfAccount[] => {
      return accounts
        .filter((acc) => acc.parentId === parentId)
        .map((acc) => ({
          ...acc,
          children: buildTree(acc.id),
        }));
    };

    return roots.map((root) => ({
      ...root,
      children: buildTree(root.id),
    }));
  }, [accounts]);

  // Filter accounts
  const filteredTree = useMemo(() => {
    if (!accountTree.length) return [];

    const filterTree = (nodes: ChartOfAccount[]): ChartOfAccount[] => {
      return nodes
        .filter((node) => {
          const matchesSearch =
            !searchTerm ||
            node.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            node.name.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesType = selectedType === 'all' || node.accountType === selectedType;
          return matchesSearch && matchesType;
        })
        .map((node) => ({
          ...node,
          children: node.children ? filterTree(node.children) : [],
        }))
        .filter((node) => {
          // Include parent if it matches or has matching children
          const hasMatchingChildren = node.children && node.children.length > 0;
          const matchesSearch =
            !searchTerm ||
            node.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            node.name.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesType = selectedType === 'all' || node.accountType === selectedType;
          return matchesSearch && matchesType || hasMatchingChildren;
        });
    };

    return filterTree(accountTree);
  }, [accountTree, searchTerm, selectedType]);

  const toggleAccount = (accountId: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedAccounts(newExpanded);
  };

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'ASSET':
        return <Wallet className="w-4 h-4 text-green-600" />;
      case 'LIABILITY':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'EQUITY':
        return <Target className="w-4 h-4 text-blue-600" />;
      case 'REVENUE':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'EXPENSE':
        return <TrendingDown className="w-4 h-4 text-orange-600" />;
      default:
        return <DollarSign className="w-4 h-4 text-gray-600" />;
    }
  };

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'ASSET':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'LIABILITY':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'EQUITY':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'REVENUE':
        return 'bg-green-50 text-green-700 border-green-300';
      case 'EXPENSE':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const renderAccountTree = (nodes: ChartOfAccount[], level: number = 0) => {
    return nodes.map((account) => {
      const hasChildren = account.children && account.children.length > 0;
      const isExpanded = expandedAccounts.has(account.id);
      const indent = level * 24;

      return (
        <div key={account.id}>
          <div
            className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-100 transition-colors ${
              account.isHeader ? 'bg-gray-50 font-semibold' : ''
            }`}
            style={{ paddingLeft: `${16 + indent}px` }}
          >
            {hasChildren ? (
              <button
                onClick={() => toggleAccount(account.id)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                )}
              </button>
            ) : (
              <div className="w-6" />
            )}

            <div className="flex items-center gap-2 flex-1">
              {getAccountTypeIcon(account.accountType)}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-gray-600">{account.code}</span>
                  <Link
                    to={`/finance/coa/${account.id}`}
                    className="font-medium text-gray-900 hover:text-primary-600 hover:underline"
                  >
                    {account.name}
                  </Link>
                  {account.isHeader && (
                    <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                      Header
                    </span>
                  )}
                </div>
                {account.description && (
                  <div className="text-xs text-gray-500 mt-0.5">{account.description}</div>
                )}
              </div>
              <span
                className={`text-xs px-2 py-1 rounded border font-medium ${getAccountTypeColor(
                  account.accountType,
                )}`}
              >
                {account.accountType}
              </span>
              <Link
                to={`/finance/coa/${account.id}`}
                className="p-2 text-gray-600 hover:bg-primary-50 hover:text-primary-600 rounded transition-colors"
              >
                <Eye className="w-4 h-4" />
              </Link>
            </div>
          </div>
          {hasChildren && isExpanded && (
            <div>{renderAccountTree(account.children || [], level + 1)}</div>
          )}
        </div>
      );
    });
  };

  const accountTypeCounts = useMemo(() => {
    if (!accounts) return {};
    const counts: Record<string, number> = {};
    accounts.forEach((acc) => {
      counts[acc.accountType] = (counts[acc.accountType] || 0) + 1;
    });
    return counts;
  }, [accounts]);

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Chart of Accounts</h1>
            <p className="text-primary-100 text-lg">Daftar akun akuntansi</p>
          </div>
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
          >
            {seedMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sprout className="w-4 h-4" />
            )}
            <span>Seed COA</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-primary-600" />
            <span className="text-sm font-medium text-gray-600">Total Accounts</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {isLoading ? '-' : accounts?.length || 0}
          </p>
        </div>
        {['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((type) => (
          <div key={type} className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              {getAccountTypeIcon(type)}
              <span className="text-sm font-medium text-gray-600">{type}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {isLoading ? '-' : accountTypeCounts[type] || 0}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari kode atau nama akun..."
              className="block w-full pl-12 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Filter className="h-5 w-5 text-gray-400" />
            </div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="block w-full pl-12 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white"
            >
              <option value="all">Semua Tipe</option>
              <option value="ASSET">Asset</option>
              <option value="LIABILITY">Liability</option>
              <option value="EQUITY">Equity</option>
              <option value="REVENUE">Revenue</option>
              <option value="EXPENSE">Expense</option>
            </select>
          </div>
        </div>
      </div>

      {/* Accounts Tree */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="px-4 py-16 text-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
              <p className="text-gray-600 font-semibold text-lg">Memuat Chart of Accounts...</p>
            </div>
          </div>
        ) : error ? (
          <div className="px-4 py-16 text-center">
            <div className="flex flex-col items-center gap-4">
              <FileText className="w-16 h-16 text-gray-400" />
              <p className="text-gray-600 font-semibold text-lg">
                {(error as Error).message || 'Terjadi kesalahan'}
              </p>
            </div>
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="flex flex-col items-center gap-4">
              <FileText className="w-16 h-16 text-gray-400" />
              <p className="text-gray-600 font-semibold text-lg">
                {accounts?.length === 0
                  ? 'Chart of Accounts kosong. Klik "Seed COA" untuk mengisi data default.'
                  : 'Tidak ada akun ditemukan'}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            <div className="bg-gradient-to-r from-gray-50 via-gray-50 to-gray-100 px-4 py-3 border-b border-gray-200">
              <div className="grid grid-cols-12 gap-4 text-xs font-bold text-gray-700 uppercase">
                <div className="col-span-1">Expand</div>
                <div className="col-span-7">Account</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
            </div>
            {renderAccountTree(filteredTree)}
          </div>
        )}
      </div>
    </div>
  );
}

