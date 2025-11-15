import { useState } from 'react';
import { usePOSStore, type Customer } from '@/stores/posStore';
import { salesService, type CustomerSearchResult } from '@/services/sales.service';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { formatPhone, formatCurrency } from '@/utils/format';

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
      tier: customerData.tier,
      creditLimit: customerData.creditLimit,
      creditUsed: customerData.creditUsed,
    });
    setSearchQuery('');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search Section */}
      <div className="p-4 border-b">
        <div className="flex gap-2 mb-2">
          <Input
            type="text"
            placeholder="Search customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Button onClick={() => setShowCreateModal(true)} size="sm">
            + New
          </Button>
        </div>

        {/* Search Results */}
        {searchQuery.length >= 2 && searchResults.length > 0 && (
          <div className="absolute z-10 mt-1 w-full max-w-sm bg-white border rounded-md shadow-lg max-h-64 overflow-y-auto">
            {searchResults.map((customerData) => (
              <button
                key={customerData.id}
                onClick={() => handleSelectCustomer(customerData)}
                className="w-full p-3 text-left hover:bg-gray-100"
              >
                <div className="font-medium">{customerData.name}</div>
                <div className="text-sm text-gray-500">{formatPhone(customerData.phone)}</div>
                {customerData.tier && (
                  <Badge variant="secondary" className="mt-1">
                    {customerData.tier.name}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Customer Display */}
      {customer ? (
        <div className="flex-1 p-4 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold text-lg">{customer.name}</div>
                <div className="text-sm text-gray-500">{formatPhone(customer.phone)}</div>
                {customer.email && (
                  <div className="text-sm text-gray-500">{customer.email}</div>
                )}
              </div>
              <Button onClick={clearCustomer} variant="ghost" size="sm">
                Clear
              </Button>
            </div>

            {customer.tier && (
              <div className="mt-3">
                <Badge variant="default" className="mb-2">
                  {customer.tier.name} Member
                </Badge>
                <div className="text-sm text-gray-600">
                  Discount: {customer.tier.discountPercentage}%
                </div>
              </div>
            )}

            {customer.creditLimit !== undefined && customer.creditLimit > 0 && (
              <div className="mt-3 pt-3 border-t">
                <div className="text-sm text-gray-600">
                  Credit Limit: {formatCurrency(customer.creditLimit)}
                </div>
                {customer.creditUsed !== undefined && (
                  <div className="text-sm text-gray-600">
                    Credit Used: {formatCurrency(customer.creditUsed)}
                  </div>
                )}
                {customer.creditLimit !== undefined && customer.creditUsed !== undefined && (
                  <div className="text-sm font-semibold text-green-600 mt-1">
                    Available: {formatCurrency(customer.creditLimit - customer.creditUsed)}
                  </div>
                )}
              </div>
            )}
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
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      // TODO: Call create customer API
      // For now, create a mock customer
      const newCustomer: Customer = {
        id: `temp-${Date.now()}`,
        customerCode: `CUST-${Date.now()}`,
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
      };
      onCreated(newCustomer);
    } catch (error) {
      console.error('Failed to create customer:', error);
      alert('Failed to create customer');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Create New Customer</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Name *</label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Phone *</label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={onClose} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating} className="flex-1">
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

