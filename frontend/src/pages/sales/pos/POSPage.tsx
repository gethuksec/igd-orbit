import { useState, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { POSCart } from './components/POSCart';
import { POSCustomer } from './components/POSCustomer';
import { POSActions } from './components/POSActions';
import { PaymentModal } from './components/PaymentModal';
import { Button } from '@/components/ui/button';
import { usePOSStore } from '@/stores/posStore';
import { formatCurrency } from '@/utils/format';
import { Toaster, toast } from 'sonner';

/**
 * POS Page Component
 * Main Point of Sale interface
 */
export default function POSPage() {
  const { cart, total, clearCart } = usePOSStore();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [branchId, setBranchId] = useState(''); // TODO: Get from user context

  // Get branch ID from user context or localStorage
  useEffect(() => {
    // TODO: Get from auth context
    const storedBranchId = localStorage.getItem('branchId');
    if (storedBranchId) {
      setBranchId(storedBranchId);
    }
  }, []);

  // Keyboard shortcuts
  useHotkeys('f1', () => {
    const searchInput = document.querySelector('input[placeholder*="barcode"]') as HTMLInputElement;
    searchInput?.focus();
  });

  useHotkeys('f2', () => {
    const customerInput = document.querySelector('input[placeholder*="customer"]') as HTMLInputElement;
    customerInput?.focus();
  });

  useHotkeys('f12', () => {
    if (cart.length > 0) {
      setShowPaymentModal(true);
    }
  });

  useHotkeys('ctrl+n', (e) => {
    e.preventDefault();
    if (confirm('Start new transaction? Current cart will be cleared.')) {
      clearCart();
      toast.success('New transaction started');
    }
  });

  useHotkeys('escape', () => {
    setShowPaymentModal(false);
  });

  const handlePaymentSuccess = () => {
    toast.success('Transaction completed successfully!');
    clearCart();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Point of Sale</h1>
          <div className="text-sm text-gray-500">
            Transaction #{new Date().toISOString().slice(0, 10).replace(/-/g, '')}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-2xl font-bold text-primary">{formatCurrency(total)}</div>
          </div>
          <Button
            onClick={() => setShowPaymentModal(true)}
            disabled={cart.length === 0}
            size="lg"
            className="h-14 px-8 text-lg"
          >
            💰 Pay Now
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Cart (60%) */}
        <div className="w-[60%] bg-white border-r flex flex-col">
          <POSCart />
        </div>

        {/* Right Panel - Customer & Actions (40%) */}
        <div className="w-[40%] bg-white flex flex-col">
          {/* Customer Section */}
          <div className="flex-1 border-b overflow-y-auto">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="font-semibold">Customer</h2>
            </div>
            <POSCustomer />
          </div>

          {/* Actions Section */}
          <div className="p-4 border-t bg-gray-50">
            <h2 className="font-semibold mb-3">Quick Actions</h2>
            <POSActions
              onShowPayment={() => setShowPaymentModal(true)}
              branchId={branchId}
            />
          </div>
        </div>
      </div>

      {/* Bottom Bar - Total & Payment */}
      <div className="bg-white border-t px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-sm text-gray-500">Items: </span>
            <span className="font-semibold">{cart.length}</span>
          </div>
          <div>
            <span className="text-sm text-gray-500">Subtotal: </span>
            <span className="font-semibold">{formatCurrency(usePOSStore.getState().subtotal)}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm text-gray-500">Grand Total</div>
            <div className="text-xl font-bold">{formatCurrency(total)}</div>
          </div>
          <Button
            onClick={() => setShowPaymentModal(true)}
            disabled={cart.length === 0}
            size="lg"
            className="h-12 px-8"
          >
            Complete Payment
          </Button>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={handlePaymentSuccess}
        branchId={branchId}
      />

      {/* Keyboard Shortcuts Help */}
      <div className="fixed bottom-4 right-4 bg-white border rounded-lg shadow-lg p-3 text-xs text-gray-500">
        <div className="font-semibold mb-1">Keyboard Shortcuts</div>
        <div>F1: Focus search</div>
        <div>F2: Search customer</div>
        <div>F12: Open payment</div>
        <div>Ctrl+N: New transaction</div>
        <div>Esc: Close modal</div>
      </div>
    </div>
  );
}

