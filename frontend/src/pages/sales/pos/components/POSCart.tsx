import { useState, useRef, useEffect } from 'react';
import { usePOSStore, type CartItem } from '@/stores/posStore';
import { salesService, type ProductSearchResult } from '@/services/sales.service';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@/utils/format';

/**
 * POS Cart Component
 */
export function POSCart() {
  const { cart, addItem, updateQuantity, removeItem, applyItemDiscount, subtotal, discountAmount, taxAmount, total } = usePOSStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDiscountModal, setShowDiscountModal] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Product search query
  const { data: searchResults = [] } = useQuery({
    queryKey: ['products', 'search', searchQuery],
    queryFn: () => salesService.searchProducts(searchQuery),
    enabled: searchQuery.length >= 2,
  });

  // Handle barcode scan (rapid input)
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const barcodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (barcodeBuffer.length > 0) {
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
      barcodeTimeoutRef.current = setTimeout(async () => {
        if (barcodeBuffer.length >= 8) {
          // Likely a barcode
          const product = await salesService.getProductByBarcode(barcodeBuffer);
          if (product) {
            handleAddProduct(product);
            setBarcodeBuffer('');
            setSearchQuery('');
          }
        }
        setBarcodeBuffer('');
      }, 100);
    }
  }, [barcodeBuffer]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setBarcodeBuffer((prev) => prev + value.slice(-1));
  };

  const handleAddProduct = (product: ProductSearchResult) => {
    const stock = product.stock?.quantityAvailable || 0;
    const reserved = product.stock?.quantityReserved || 0;
    const availableStock = stock - reserved;

    if (availableStock <= 0) {
      alert('Product out of stock');
      return;
    }

    addItem({
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      image: product.images?.[0],
      quantity: 1,
      unitPrice: product.sellingPrice,
      availableStock,
    });

    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  const handleQuantityChange = (index: number, newQuantity: number) => {
    updateQuantity(index, newQuantity);
  };

  const handleRemoveItem = (index: number) => {
    removeItem(index);
  };

  const handleApplyItemDiscount = (index: number, type: 'percentage' | 'amount', value: number) => {
    applyItemDiscount(index, { type, value });
    setShowDiscountModal(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-4 border-b bg-gray-50">
        <div className="relative">
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Scan barcode atau cari produk..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full text-base md:text-lg h-11 md:h-12 pl-3 pr-28"
            autoFocus
          />
          <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
            <div className="px-2 py-1 rounded-md bg-gray-100 border text-[10px] md:text-xs text-gray-500">
              F1 · Scan / Cari
            </div>
          </div>

          {/* Search Results Dropdown */}
          {searchQuery.length >= 2 && (
            <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto z-10">
              {searchResults.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">Tidak ada produk ditemukan.</div>
              ) : (
                searchResults.map((product: ProductSearchResult) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleAddProduct(product)}
                    className="w-full px-3 py-2.5 text-left hover:bg-gray-50 flex items-center gap-3 text-sm"
                  >
                    {product.images?.[0] && (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-10 h-10 md:w-12 md:h-12 object-cover rounded-md border"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{product.name}</div>
                      <div className="text-[11px] md:text-xs text-gray-500 flex flex-wrap gap-2">
                        <span>SKU: {product.sku}</span>
                        <span>·</span>
                        <span>Stock: {product.stock?.quantityAvailable || 0}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs md:text-sm font-semibold text-primary">
                        {formatCurrency(product.sellingPrice)}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4">
        {cart.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">🛒</div>
              <div>Cart is empty</div>
              <div className="text-sm mt-1">Scan or search for products</div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map((item, index) => (
              <CartItemRow
                key={index}
                item={item}
                index={index}
                onQuantityChange={handleQuantityChange}
                onRemove={handleRemoveItem}
                onApplyDiscount={handleApplyItemDiscount}
                showDiscountModal={showDiscountModal === index}
                onShowDiscountModal={() => setShowDiscountModal(index)}
                onCloseDiscountModal={() => setShowDiscountModal(null)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Cart Summary */}
      <div className="border-t p-4 bg-gray-50">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount:</span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span>Tax (11%):</span>
            <span>{formatCurrency(taxAmount)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>Total:</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Cart Item Row Component
 */
interface CartItemRowProps {
  item: CartItem;
  index: number;
  onQuantityChange: (index: number, quantity: number) => void;
  onRemove: (index: number) => void;
  onApplyDiscount: (index: number, type: 'percentage' | 'amount', value: number) => void;
  showDiscountModal: boolean;
  onShowDiscountModal: () => void;
  onCloseDiscountModal: () => void;
}

function CartItemRow({
  item,
  index,
  onQuantityChange,
  onRemove,
  onApplyDiscount,
  showDiscountModal,
  onShowDiscountModal,
  onCloseDiscountModal,
}: CartItemRowProps) {
  const [isEditingQuantity, setIsEditingQuantity] = useState(false);
  const [quantityInput, setQuantityInput] = useState(item.quantity.toString());

  const handleQuantitySubmit = () => {
    const newQuantity = parseInt(quantityInput) || 1;
    onQuantityChange(index, newQuantity);
    setIsEditingQuantity(false);
  };

  return (
    <div className="bg-white border rounded-lg p-3">
      <div className="flex items-start gap-3">
        {item.image && (
          <img src={item.image} alt={item.productName} className="w-16 h-16 object-cover rounded" />
        )}
        <div className="flex-1">
                <div className="font-medium">{item.productName}</div>
                <div className="text-sm text-gray-500">SKU: {item.productSku}</div>

          <div className="flex items-center gap-4 mt-2">
            {/* Quantity */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Qty:</span>
              {isEditingQuantity ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(e.target.value)}
                    onBlur={handleQuantitySubmit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleQuantitySubmit();
                      if (e.key === 'Escape') {
                        setQuantityInput(item.quantity.toString());
                        setIsEditingQuantity(false);
                      }
                    }}
                    className="w-16 px-2 py-1 border rounded text-sm"
                    autoFocus
                    min="1"
                    max={item.availableStock}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingQuantity(true)}
                  className="px-2 py-1 border rounded hover:bg-gray-100"
                >
                  {item.quantity}
                </button>
              )}
              <div className="flex flex-col">
                <button
                  onClick={() => onQuantityChange(index, item.quantity + 1)}
                  disabled={item.quantity >= item.availableStock}
                  className="text-xs px-1 disabled:opacity-50"
                >
                  ▲
                </button>
                <button
                  onClick={() => onQuantityChange(index, item.quantity - 1)}
                  className="text-xs px-1"
                >
                  ▼
                </button>
              </div>
            </div>

            {/* Price */}
            <div className="text-sm">
              <span className="text-gray-500">Price: </span>
              <span>{formatCurrency(item.unitPrice)}</span>
            </div>

            {/* Discount */}
            {(item.discountPercentage || item.discountAmount) && (
              <div className="text-sm text-green-600">
                Disc: {item.discountPercentage ? `${item.discountPercentage}%` : formatCurrency(item.discountAmount || 0)}
              </div>
            )}
            <button
              onClick={onShowDiscountModal}
              className="text-xs text-blue-600 hover:underline"
            >
              Add Disc
            </button>
          </div>

          <div className="mt-2 flex justify-between items-center">
            <div className="text-sm text-gray-500">Stock: {item.availableStock}</div>
            <div className="font-semibold">{formatCurrency(item.subtotal)}</div>
          </div>
        </div>

        <button
          onClick={() => onRemove(index)}
          className="text-red-500 hover:text-red-700 px-2"
          aria-label="Remove item"
        >
          ✕
        </button>
      </div>

      {/* Discount Modal */}
      {showDiscountModal && (
        <DiscountModal
          onApply={(type, value) => onApplyDiscount(index, type, value)}
          onClose={onCloseDiscountModal}
        />
      )}
    </div>
  );
}

/**
 * Discount Modal Component
 */
interface DiscountModalProps {
  onApply: (type: 'percentage' | 'amount', value: number) => void;
  onClose: () => void;
}

function DiscountModal({ onApply, onClose }: DiscountModalProps) {
  const [type, setType] = useState<'percentage' | 'amount'>('percentage');
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;
    if (type === 'percentage' && numValue > 100) return;
    onApply(type, numValue);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Apply Discount</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Discount Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setType('percentage')}
                className={`flex-1 px-4 py-2 rounded ${type === 'percentage' ? 'bg-primary text-white' : 'bg-gray-200'}`}
              >
                Percentage
              </button>
              <button
                onClick={() => setType('amount')}
                className={`flex-1 px-4 py-2 rounded ${type === 'amount' ? 'bg-primary text-white' : 'bg-gray-200'}`}
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
          <div className="flex gap-2">
            <Button onClick={onClose} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="flex-1">
              Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

