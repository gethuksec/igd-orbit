import { useState } from 'react';
import { usePOSStore, type Customer } from '@/stores/posStore';
import { salesService, type CustomerSearchResult } from '@/services/sales.service';
import { customersService } from '@/services/customers.service';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatPhone } from '@/utils/format';
import { toast } from 'sonner';
import kecamatanJember from '@/data/kecamatan-jember.json';

/**
 * POS Customer Panel Component
 */
export function POSCustomer() {
  const { customer, setCustomer, clearCustomer } = usePOSStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Customer search query
  const { data: searchResults = [] } = useQuery({
    queryKey: ['customers', 'search', searchQuery],
    queryFn: () => salesService.searchCustomers(searchQuery),
    enabled: searchQuery.length >= 2,
  });

  const handleSelectCustomer = (customerData: CustomerSearchResult) => {
    setCustomer({
      id: customerData.id,
      customerCode: customerData.customerCode,
      name: customerData.name,
      phone: customerData.phone,
      email: customerData.email,
      tier:
        typeof customerData.tier === 'string'
          ? { code: customerData.tier, name: customerData.tier, discountPercentage: 0 }
          : customerData.tier
          ? {
              code: customerData.tier.code,
              name: customerData.tier.name,
              discountPercentage:
                (customerData.tier as any).discountPercentage ?? 0,
            }
          : undefined,
      creditLimit: customerData.creditLimit,
      creditUsed: customerData.creditUsed,
    });
    setSearchQuery('');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search Section */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex gap-2 mb-2">
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="Cari customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-24"
            />
            <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
              <div className="px-2 py-1 rounded-md bg-gray-100 border text-[10px] md:text-xs text-gray-500">
                F2 · Cari
              </div>
            </div>

            {/* Search Results */}
            {searchQuery.length >= 2 && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    Tidak ada customer ditemukan.
                  </div>
                ) : (
                  searchResults.map((customerData: CustomerSearchResult) => (
                    <button
                      key={customerData.id}
                      type="button"
                      onClick={() => handleSelectCustomer(customerData)}
                      className="w-full px-3 py-2.5 text-left hover:bg-gray-50 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{customerData.name}</div>
                          <div className="text-[11px] md:text-xs text-gray-500">
                            {formatPhone(customerData.phone)}
                          </div>
                        </div>
                        {customerData.tier && (
                          <Badge variant="secondary" className="text-[10px] md:text-xs">
                            {typeof customerData.tier === 'string'
                              ? customerData.tier
                              : customerData.tier.name}
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <Button onClick={() => setShowCreateModal(true)} size="sm" variant="outline">
            + Customer
          </Button>
        </div>
      </div>

      {/* Selected Customer Display */}
      {customer ? (
        <div className="flex-1 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold shrink-0">
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-gray-900 truncate">{customer.name}</div>
                <div className="text-xs text-gray-500">{formatPhone(customer.phone)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {customer.tier && (
                <span className="text-[10px] bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                  {customer.tier.name}
                </span>
              )}
              <button onClick={clearCustomer} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                ✕
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <div className="text-4xl mb-2">👤</div>
            <div>No customer selected</div>
            <div className="text-sm mt-1">Search or create new customer</div>
          </div>
        </div>
      )}

      {/* Create Customer Modal */}
      {showCreateModal && (
        <CreateCustomerModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(newCustomer) => {
            setCustomer(newCustomer);
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * Create Customer Modal Component
 */
interface CreateCustomerModalProps {
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}

function CreateCustomerModal({ onClose, onCreated }: CreateCustomerModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    subdistrict: '',
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; phone: string; subdistrict: string }) => {
      return await customersService.create({
        customerType: 'retail',
        name: data.name,
        phone: data.phone,
        subdistrict: data.subdistrict,
        city: 'Jember',
        province: 'Jawa Timur',
      });
    },
    onSuccess: (newCustomer) => {
      // Invalidate customer search queries
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      
      // Transform to POS Customer format
      const posCustomer: Customer = {
        id: newCustomer.id,
        customerCode: newCustomer.customerCode,
        name: newCustomer.name,
        phone: newCustomer.phone,
        email: newCustomer.email,
        tier: newCustomer.tier
          ? {
              code: newCustomer.tier.code,
              name: newCustomer.tier.name,
              discountPercentage: newCustomer.tier.discountPercentage || 0,
            }
          : undefined,
        creditLimit: newCustomer.creditLimit || 0,
        creditUsed: newCustomer.creditUsed || 0,
      };
      
      toast.success('Customer berhasil dibuat');
      onCreated(posCustomer);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Gagal membuat customer';
      toast.error(errorMessage);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name.trim()) {
      toast.error('Nama customer wajib diisi');
      return;
    }
    
    if (!formData.phone.trim()) {
      toast.error('Nomor telepon wajib diisi');
      return;
    }

    if (!formData.subdistrict) {
      toast.error('Kecamatan wajib dipilih');
      return;
    }

    createMutation.mutate({
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      subdistrict: formData.subdistrict,
    });
  };

  return (
    <Modal open={true} onClose={onClose} title="Tambah Customer Baru" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Nama <span className="text-red-500">*</span>
          </label>
          <Input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Masukkan nama customer"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Nomor Telepon <span className="text-red-500">*</span>
          </label>
          <Input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="081234567890"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Format: 0XXXXXXXXX atau +62XXXXXXXXX</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Kecamatan <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.subdistrict}
            onChange={(e) => setFormData({ ...formData, subdistrict: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            required
          >
            <option value="">Pilih Kecamatan</option>
            {kecamatanJember.map((kec: string) => (
              <option key={kec} value={kec}>
                {kec}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="button" onClick={onClose} variant="outline" className="flex-1">
            Batal
          </Button>
          <Button 
            type="submit" 
            disabled={createMutation.isPending} 
            className="flex-1"
          >
            {createMutation.isPending ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

