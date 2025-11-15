import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { usePOSStore } from '@/stores/posStore';
import { salesService } from '@/services/sales.service';
import { useQuery } from '@tanstack/react-query';

/**
 * POS Actions Component
 */
interface POSActionsProps {
  onShowPayment?: () => void;
  branchId: string;
  transactionId?: string;
}

export function POSActions({ branchId, transactionId }: POSActionsProps) {
  const { cart, discount, notes, setNotes, applyTransactionDiscount, clearCart } = usePOSStore();
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdReference, setHoldReference] = useState('');

  // Get held transactions
  const { data: heldTransactions = [] } = useQuery({
    queryKey: ['held-transactions', branchId],
    queryFn: () => salesService.getHeldTransactions(branchId),
  });

  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (confirm('Clear all items from cart?')) {
      clearCart();
    }
  };

  const handleHoldTransaction = async () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    try {
      if (transactionId) {
        await salesService.holdTransaction(transactionId, holdReference || undefined);
      }
      // TODO: Handle hold for new transaction
      setShowHoldModal(false);
      setHoldReference('');
      clearCart();
    } catch (error) {
      console.error('Failed to hold transaction:', error);
      alert('Failed to hold transaction');
    }
  };

  return (
    <div className="space-y-2">
      <Button onClick={() => setShowNoteModal(true)} variant="outline" className="w-full" size="lg">
        📝 Add Note
      </Button>
      <Button onClick={() => setShowDiscountModal(true)} variant="outline" className="w-full" size="lg">
        🎟️ Apply Discount
      </Button>
      <Button onClick={() => setShowHoldModal(true)} variant="outline" className="w-full" size="lg">
        💾 Hold Transaction
      </Button>
      {heldTransactions.length > 0 && (
        <div className="mt-4">
          <div className="text-sm font-medium mb-2">Held Transactions</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {heldTransactions.map((held) => (
              <HeldTransactionItem key={held.id} held={held} />
            ))}
          </div>
        </div>
      )}
      <Button onClick={handleClearCart} variant="destructive" className="w-full" size="lg" disabled={cart.length === 0}>
        🗑️ Clear Cart
      </Button>

      {/* Note Modal */}
      <Modal open={showNoteModal} onClose={() => setShowNoteModal(false)} title="Add Note" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Transaction Notes</label>
            <textarea
              value={notes || ''}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full min-h-24 px-3 py-2 border rounded-md"
              placeholder="Add notes for this transaction..."
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowNoteModal(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={() => setShowNoteModal(false)} className="flex-1">
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Discount Modal */}
      <Modal open={showDiscountModal} onClose={() => setShowDiscountModal(false)} title="Apply Discount" size="md">
        <DiscountModalContent
          currentDiscount={discount}
          onApply={(newDiscount) => {
            applyTransactionDiscount(newDiscount);
            setShowDiscountModal(false);
          }}
          onRemove={() => {
            applyTransactionDiscount(null);
            setShowDiscountModal(false);
          }}
        />
      </Modal>

      {/* Hold Modal */}
      <Modal open={showHoldModal} onClose={() => setShowHoldModal(false)} title="Hold Transaction" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Reference (Optional)</label>
            <Input
              type="text"
              value={holdReference}
              onChange={(e) => setHoldReference(e.target.value)}
              placeholder="e.g., Customer name, order number"
            />
          </div>
          <div className="text-sm text-gray-500">
            Transaction will be held for 24 hours. You can resume it later.
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowHoldModal(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleHoldTransaction} className="flex-1">
              Hold
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/**
 * Discount Modal Content
 */
interface DiscountModalContentProps {
  currentDiscount: { type: 'percentage' | 'amount'; value: number } | null;
  onApply: (discount: { type: 'percentage' | 'amount'; value: number } | null) => void;
  onRemove: () => void;
}

function DiscountModalContent({ currentDiscount, onApply, onRemove }: DiscountModalContentProps) {
  const [type, setType] = useState<'percentage' | 'amount'>(currentDiscount?.type || 'percentage');
  const [value, setValue] = useState(currentDiscount?.value.toString() || '');

  const handleApply = () => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;
    if (type === 'percentage' && numValue > 100) return;
    onApply({ type, value: numValue });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Discount Type</label>
        <div className="flex gap-2">
          <button
            onClick={() => setType('percentage')}
            className={`flex-1 px-4 py-2 rounded ${
              type === 'percentage' ? 'bg-primary text-white' : 'bg-gray-200'
            }`}
          >
            Percentage
          </button>
          <button
            onClick={() => setType('amount')}
            className={`flex-1 px-4 py-2 rounded ${
              type === 'amount' ? 'bg-primary text-white' : 'bg-gray-200'
            }`}
          >
            Amount
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">
          {type === 'percentage' ? 'Percentage (%)' : 'Amount (Rp)'}
        </label>
        <Input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={type === 'percentage' ? '0-100' : '0'}
          min="0"
          max={type === 'percentage' ? '100' : undefined}
        />
      </div>
      {currentDiscount && (
        <div className="p-3 bg-yellow-50 rounded-lg text-sm">
          Current discount: {currentDiscount.type === 'percentage' ? `${currentDiscount.value}%` : `Rp ${currentDiscount.value.toLocaleString()}`}
        </div>
      )}
      <div className="flex gap-2">
        {currentDiscount && (
          <Button onClick={onRemove} variant="destructive" className="flex-1">
            Remove
          </Button>
        )}
        <Button onClick={handleApply} className="flex-1">
          Apply
        </Button>
      </div>
    </div>
  );
}

/**
 * Held Transaction Item Component
 */
interface HeldTransactionItemProps {
  held: {
    id: string;
    reference?: string;
    createdAt: string;
    expiresAt: string;
  };
}

function HeldTransactionItem({ held }: HeldTransactionItemProps) {
  const { clearCart } = usePOSStore();
  const [isResuming, setIsResuming] = useState(false);

  const handleResume = async () => {
    setIsResuming(true);
    try {
      await salesService.resumeTransaction(held.id);
      // TODO: Restore cart and customer from held transaction data
      // For now, just clear and show message
      clearCart();
      alert('Held transaction resumed. Please add items again.');
    } catch (error) {
      console.error('Failed to resume transaction:', error);
      alert('Failed to resume transaction');
    } finally {
      setIsResuming(false);
    }
  };

  return (
    <div className="p-2 bg-gray-50 rounded border text-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{held.reference || 'No reference'}</div>
          <div className="text-xs text-gray-500">
            {new Date(held.createdAt).toLocaleString()}
          </div>
        </div>
        <Button onClick={handleResume} size="sm" disabled={isResuming}>
          Resume
        </Button>
      </div>
    </div>
  );
}

