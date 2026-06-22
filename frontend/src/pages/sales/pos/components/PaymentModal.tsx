import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/format';
import { usePOSStore } from '@/stores/posStore';
import { salesService } from '@/services/sales.service';

/**
 * Payment Modal Component
 */
interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branchId: string;
}

export function PaymentModal({ open, onClose, onSuccess, branchId }: PaymentModalProps) {
  const { cart, customer, discount, receiptNotes, internalNotes, total, clearCart } = usePOSStore();
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'e-wallet' | 'credit'>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [paymentDetails, setPaymentDetails] = useState<Record<string, any>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const change = paymentMethod === 'cash' && amountReceived
    ? parseFloat(amountReceived) - total
    : 0;

  const handleQuickAmount = (amount: number) => {
    if (paymentMethod === 'cash') {
      setAmountReceived(amount.toString());
    }
  };

  const handleProcessPayment = async () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    // Validate payment amount
    if (paymentMethod === 'cash') {
      const received = parseFloat(amountReceived);
      if (isNaN(received) || received < total) {
        alert('Amount received must be greater than or equal to total');
        return;
      }
    }

    if (paymentMethod === 'credit' && !customer) {
      alert('Customer is required for credit payment');
      return;
    }

    setIsProcessing(true);

    try {
      // Prepare transaction items
      const items = cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercentage: item.discountPercentage,
        discountAmount: item.discountAmount,
        batchNumber: item.batchNumber,
        serialNumber: item.serialNumber,
        notes: item.notes,
      }));

      // Prepare payment data
      const payment = {
        method: paymentMethod,
        amount: total,
        details: paymentMethod !== 'cash' ? paymentDetails : undefined,
      };

      // Create transaction
      const transaction = await salesService.createTransaction({
        transactionType: 'pos',
        customerId: customer?.id,
        branchId,
        items,
        discountPercentage: discount?.type === 'percentage' ? discount.value : undefined,
        discountAmount: discount?.type === 'amount' ? discount.value : undefined,
        taxPercentage: 11,
        payment,
        receiptNotes: receiptNotes || undefined,
        internalNotes: internalNotes || undefined,
      });

      // Clear cart and close
      clearCart();
      onSuccess();
      onClose();
      
      // Open print page in new window
      if (transaction.id) {
        window.open(`/sales/transactions/${transaction.id}/print`, '_blank');
      }
    } catch (error: any) {
      console.error('Payment failed:', error);
      alert(error.response?.data?.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Payment" size="lg">
      <div className="space-y-6">
        {/* Total Amount */}
        <div className="text-center p-4 bg-primary/10 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Total Amount</div>
          <div className="text-3xl font-bold text-primary">{formatCurrency(total)}</div>
        </div>

        {/* Payment Method Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Payment Method</label>
          <div className="grid grid-cols-2 gap-2">
            {(['cash', 'card', 'transfer', 'e-wallet', 'credit'] as const).map((method) => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`px-4 py-3 rounded-lg border-2 transition-colors ${
                  paymentMethod === method
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {method.charAt(0).toUpperCase() + method.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Payment Method Specific Inputs */}
        {paymentMethod === 'cash' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Amount Received</label>
              <Input
                type="number"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                placeholder="Enter amount"
                min={total}
                step="1000"
              />
            </div>
            {change > 0 && (
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-sm text-gray-600">Change</div>
                <div className="text-xl font-semibold text-green-600">{formatCurrency(change)}</div>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => handleQuickAmount(50000)} variant="outline" size="sm">
                +50K
              </Button>
              <Button onClick={() => handleQuickAmount(100000)} variant="outline" size="sm">
                +100K
              </Button>
              <Button onClick={() => handleQuickAmount(250000)} variant="outline" size="sm">
                +250K
              </Button>
              <Button onClick={() => handleQuickAmount(total)} variant="outline" size="sm">
                Exact
              </Button>
            </div>
          </div>
        )}

        {paymentMethod === 'card' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Last 4 Digits</label>
              <Input
                type="text"
                maxLength={4}
                value={paymentDetails.cardLast4 || ''}
                onChange={(e) => setPaymentDetails({ ...paymentDetails, cardLast4: e.target.value })}
                placeholder="1234"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Reference Number</label>
              <Input
                type="text"
                value={paymentDetails.reference || ''}
                onChange={(e) => setPaymentDetails({ ...paymentDetails, reference: e.target.value })}
                placeholder="Transaction reference"
              />
            </div>
          </div>
        )}

        {paymentMethod === 'transfer' && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Bank Account Details</div>
              <div className="font-semibold">BCA: 1234567890</div>
              <div className="text-sm text-gray-500">a.n. IGD Group</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Transfer Reference</label>
              <Input
                type="text"
                value={paymentDetails.transferRef || ''}
                onChange={(e) => setPaymentDetails({ ...paymentDetails, transferRef: e.target.value })}
                placeholder="Transfer reference number"
              />
            </div>
          </div>
        )}

        {paymentMethod === 'e-wallet' && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <div className="text-sm text-gray-600 mb-2">Scan QR Code</div>
              <div className="w-48 h-48 bg-gray-200 mx-auto rounded flex items-center justify-center">
                QR Code Placeholder
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Transaction ID</label>
              <Input
                type="text"
                value={paymentDetails.transactionId || ''}
                onChange={(e) => setPaymentDetails({ ...paymentDetails, transactionId: e.target.value })}
                placeholder="E-wallet transaction ID"
              />
            </div>
          </div>
        )}

        {paymentMethod === 'credit' && (
          <div className="space-y-4">
            {customer ? (
              <>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600">Customer Credit</div>
                  <div className="font-semibold">
                    Available: {formatCurrency((customer.creditLimit || 0) - (customer.creditUsed || 0))}
                  </div>
                </div>
                {total > (customer.creditLimit || 0) - (customer.creditUsed || 0) && (
                  <div className="p-3 bg-red-50 rounded-lg text-red-600">
                    Insufficient credit limit
                  </div>
                )}
              </>
            ) : (
              <div className="p-3 bg-yellow-50 rounded-lg text-yellow-600">
                Customer is required for credit payment
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={onClose} variant="outline" className="flex-1" disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleProcessPayment}
            className="flex-1"
            disabled={isProcessing || (paymentMethod === 'credit' && !customer)}
          >
            {isProcessing ? 'Processing...' : 'Complete Payment'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

