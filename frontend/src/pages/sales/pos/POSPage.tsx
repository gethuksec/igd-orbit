import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { POSCart } from './components/POSCart';
import { POSCustomer } from './components/POSCustomer';
import { POSActions } from './components/POSActions';
import { PaymentModal } from './components/PaymentModal';
import { Button } from '@/components/ui/button';
import { usePOSStore } from '@/stores/posStore';
import { useBranchStore } from '@/stores/branchStore';
import { formatCurrency } from '@/utils/format';
import { Toaster, toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { customersService } from '@/services/customers.service';

/**
 * POS Page Component
 * Main Point of Sale interface
 */
export default function POSPage() {
  const [searchParams] = useSearchParams();
  const customerIdFromUrl = searchParams.get('customerId');
  const { cart, total, clearCart, setCustomer, receiptNotes, setReceiptNotes, internalNotes, setInternalNotes } = usePOSStore();
  const { currentBranchId } = useBranchStore();
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Fetch customer data if customerId is provided in URL
  const { data: customerFromUrl } = useQuery({
    queryKey: ['customer', customerIdFromUrl],
    queryFn: () => customersService.getById(customerIdFromUrl!),
    enabled: !!customerIdFromUrl,
  });

  // Auto-set customer from URL parameter
  useEffect(() => {
    if (customerFromUrl) {
      setCustomer({
        id: customerFromUrl.id,
        customerCode: customerFromUrl.customerCode,
        name: customerFromUrl.name,
        phone: customerFromUrl.phone,
        email: customerFromUrl.email || '',
        tier: customerFromUrl.tier
          ? {
              code: customerFromUrl.tier.code,
              name: customerFromUrl.tier.name,
              discountPercentage: customerFromUrl.tier.discountPercentage || 0,
            }
          : undefined,
        creditLimit: customerFromUrl.creditLimit || 0,
        creditUsed: customerFromUrl.creditUsed || 0,
      });
    }
  }, [customerFromUrl, setCustomer]);

  const canCheckout = cart.length > 0 && !!currentBranchId;

  const handleOpenPayment = () => {
    if (!currentBranchId) {
      toast.error('Silakan pilih cabang terlebih dahulu sebelum memproses transaksi.');
      return;
    }
    if (cart.length === 0) return;
    setShowPaymentModal(true);
  };

  // Keyboard shortcuts
  useHotkeys(
    'f1',
    () => {
      const searchInput = document.querySelector(
        'input[placeholder*="barcode"]',
      ) as HTMLInputElement | null;
      searchInput?.focus();
    },
    {
      enableOnFormTags: true,
      preventDefault: true,
    },
    [setShowPaymentModal],
  );

  useHotkeys(
    'f2',
    () => {
      const customerInput = document.querySelector(
        'input[placeholder*="customer"]',
      ) as HTMLInputElement | null;
      customerInput?.focus();
    },
    {
      enableOnFormTags: true,
      preventDefault: true,
    },
    [],
  );

  useHotkeys(
    'f12',
    () => {
      handleOpenPayment();
    },
    {
      enableOnFormTags: true,
      preventDefault: true,
    },
    [handleOpenPayment, canCheckout],
  );


  useHotkeys(
    'escape',
    () => {
      setShowPaymentModal(false);
    },
    {
      enableOnFormTags: true,
      preventDefault: true,
    },
    [setShowPaymentModal],
  );

  const handlePaymentSuccess = () => {
    toast.success('Transaction completed successfully!');
    clearCart();
  };

  return (
    <div className="w-full space-y-4">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg px-6 py-5 flex items-center justify-between text-white">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">Point of Sale</h1>
          <div className="text-xs md:text-sm text-primary-100/90">
            Transaksi hari ini · No. sementara{' '}
            <span className="font-semibold text-white">
              {new Date().toISOString().slice(0, 10).replace(/-/g, '')}
            </span>
          </div>
          {!currentBranchId && (
            <div className="mt-2 text-xs bg-red-500/20 backdrop-blur-sm border border-red-300/60 text-red-50 px-3 py-1.5 rounded-lg inline-flex items-center gap-2 shadow-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-red-300 animate-pulse" />
              <span>Pilih cabang di kanan atas dulu sebelum memulai transaksi.</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-primary-100/90 mb-1">Grand Total</div>
            <div className="text-2xl md:text-3xl font-extrabold drop-shadow-sm">
              {formatCurrency(total)}
            </div>
          </div>
          <Button
            onClick={handleOpenPayment}
            disabled={!canCheckout}
            size="lg"
            className="h-12 md:h-14 px-6 md:px-8 text-sm md:text-lg bg-white text-primary-600 hover:bg-primary-50 disabled:opacity-60 shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
          >
            💰 Bayar
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-4 items-start">
        {/* Left Panel - Cart */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden transition-shadow hover:shadow-lg">
          <div className="border-b px-4 py-3.5 flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100/50">
            <div>
              <h2 className="font-semibold text-sm md:text-base text-gray-900 mb-0.5">Daftar Item</h2>
              <p className="text-xs text-gray-600">
                Scan barcode atau cari produk untuk menambahkan ke keranjang
              </p>
            </div>
            <div className="text-xs text-gray-500 hidden md:block font-mono">
              F1: Produk · F12: Pembayaran
            </div>
          </div>
          <div className="h-[420px] md:h-[520px]">
            <POSCart />
          </div>
        </div>

        {/* Right Panel - Customer & Actions */}
        <div className="space-y-4">
          {/* Customer Section */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden transition-shadow hover:shadow-lg">
            <div className="px-4 py-3 border-b bg-gradient-to-r from-gray-50 to-gray-100/50 flex items-center justify-between">
              <h2 className="font-semibold text-sm md:text-base text-gray-900">Customer</h2>
              <span className="text-[10px] md:text-xs text-gray-500 font-mono">
                F2: Cari customer
              </span>
            </div>
            <div className="h-[220px] md:h-[260px]">
              <POSCustomer />
            </div>
          </div>

          {/* Notes Section — inline textareas, no modal */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden transition-shadow hover:shadow-lg">
            <div className="px-4 py-3 border-b bg-gradient-to-r from-gray-50 to-gray-100/50 flex items-center justify-between">
              <h2 className="font-semibold text-sm md:text-base text-gray-900">Catatan</h2>
              <span className="text-[10px] md:text-xs text-gray-500">Keduanya tercetak di export</span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Catatan untuk Pembeli <span className="text-gray-400">(tercetak di resi)</span>
                </label>
                <textarea
                  value={receiptNotes || ''}
                  onChange={(e) => setReceiptNotes(e.target.value)}
                  className="w-full min-h-[72px] px-3 py-2 border rounded-lg text-sm resize-y focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition"
                  placeholder="Contoh: klaim garansi, permintaan khusus, dll."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Catatan Internal <span className="text-gray-400">(tidak tercetak di resi)</span>
                </label>
                <textarea
                  value={internalNotes || ''}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  className="w-full min-h-[72px] px-3 py-2 border rounded-lg text-sm resize-y focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition"
                  placeholder="Contoh: diskon khusus, info stok, dll."
                />
              </div>
            </div>
          </div>

          {/* Actions Section */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden transition-shadow hover:shadow-lg">
            <div className="px-4 py-3 border-b bg-gradient-to-r from-gray-50 to-gray-100/50 flex items-center justify-between">
              <h2 className="font-semibold text-sm md:text-base text-gray-900">Aksi Cepat</h2>
              <span className="text-[10px] md:text-xs text-gray-500">
                Diskon dan hold transaksi
              </span>
            </div>
            <div className="p-4">
              <POSActions
                onShowPayment={handleOpenPayment}
                branchId={currentBranchId || undefined}
              />
            </div>
          </div>

          {/* Bottom Summary */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 transition-shadow hover:shadow-lg">
            <div className="flex items-center gap-4 text-xs md:text-sm">
              <div>
                <span className="text-gray-500">Items: </span>
                <span className="font-semibold">{cart.length}</span>
              </div>
              <div>
                <span className="text-gray-500">Subtotal: </span>
                <span className="font-semibold">
                  {formatCurrency(usePOSStore.getState().subtotal)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-gray-500 uppercase tracking-wide">
                  Grand Total
                </div>
                <div className="text-lg md:text-xl font-bold text-primary-600">
                  {formatCurrency(total)}
                </div>
              </div>
              <Button
                onClick={handleOpenPayment}
                disabled={!canCheckout}
                size="sm"
                className="h-10 px-4 md:h-11 md:px-6"
              >
                Selesaikan Pembayaran
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={handlePaymentSuccess}
        branchId={currentBranchId || ''}
      />
    </div>
  );
}

