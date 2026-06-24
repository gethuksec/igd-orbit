import { create } from 'zustand';

/**
 * Cart item interface
 */
export interface CartItem {
  productId: string;
  productName: string;
  productSku: string;
  image?: string;
  quantity: number;
  unitPrice: number;
  discountPercentage?: number;
  discountAmount?: number;
  subtotal: number;
  availableStock: number;
  batchNumber?: string;
  serialNumber?: string;
  notes?: string;
}

/**
 * Customer interface
 */
export interface Customer {
  id: string;
  customerCode: string;
  name: string;
  phone: string;
  email?: string;
  tier?: {
    code: string;
    name: string;
    discountPercentage: number;
  };
  creditLimit?: number;
  creditUsed?: number;
  depositBalance?: number;
}

/**
 * Discount interface
 */
export interface Discount {
  type: 'percentage' | 'amount';
  value: number;
}

/**
 * POS Store State
 */
interface POSStoreState {
  // State
  cart: CartItem[];
  customer: Customer | null;
  discount: Discount | null;
  paymentMethod: string | null;
  receiptNotes: string | null;
  internalNotes: string | null;

  // Computed values
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;

  // Actions
  addItem: (item: Omit<CartItem, 'subtotal'>) => void;
  updateQuantity: (index: number, quantity: number) => void;
  removeItem: (index: number) => void;
  applyItemDiscount: (index: number, discount: { type: 'percentage' | 'amount'; value: number }) => void;
  setCustomer: (customer: Customer | null) => void;
  clearCustomer: () => void;
  applyTransactionDiscount: (discount: Discount | null) => void;
  clearCart: () => void;
  calculateTotals: () => void;
  setReceiptNotes: (notes: string | null) => void;
  setInternalNotes: (notes: string | null) => void;
}

/**
 * Calculate item subtotal
 */
function calculateItemSubtotal(
  quantity: number,
  unitPrice: number,
  discountPercentage?: number,
  discountAmount?: number,
): number {
  const itemSubtotal = quantity * unitPrice;
  const itemDiscount = discountAmount || itemSubtotal * ((discountPercentage || 0) / 100);
  return itemSubtotal - itemDiscount;
}

/**
 * POS Store
 */
export const usePOSStore = create<POSStoreState>((set, get) => ({
  // Initial state
  cart: [],
  customer: null,
  discount: null,
  paymentMethod: null,
  receiptNotes: null,
  internalNotes: null,
  subtotal: 0,
  discountAmount: 0,
  taxAmount: 0,
  total: 0,

  // Add item to cart
  addItem: (item) => {
    const subtotal = calculateItemSubtotal(
      item.quantity,
      item.unitPrice,
      item.discountPercentage,
      item.discountAmount,
    );

    set((state) => {
      // Check if product already in cart
      const existingIndex = state.cart.findIndex((cartItem) => cartItem.productId === item.productId);
      let newCart: CartItem[];

      if (existingIndex >= 0) {
        // Update existing item quantity
        const existing = state.cart[existingIndex];
        const newQuantity = existing.quantity + item.quantity;
        const newSubtotal = calculateItemSubtotal(
          newQuantity,
          existing.unitPrice,
          existing.discountPercentage,
          existing.discountAmount,
        );

        newCart = [...state.cart];
        newCart[existingIndex] = {
          ...existing,
          quantity: newQuantity,
          subtotal: newSubtotal,
        };
      } else {
        // Add new item
        newCart = [...state.cart, { ...item, subtotal }];
      }

      return { cart: newCart };
    });

    get().calculateTotals();
  },

  // Update item quantity
  updateQuantity: (index, quantity) => {
    if (quantity <= 0) {
      get().removeItem(index);
      return;
    }

    set((state) => {
      const item = state.cart[index];
      if (!item) return state;

      // Check stock limit
      if (quantity > item.availableStock) {
        return state; // Don't update if exceeds stock
      }

      const newSubtotal = calculateItemSubtotal(
        quantity,
        item.unitPrice,
        item.discountPercentage,
        item.discountAmount,
      );

      const newCart = [...state.cart];
      newCart[index] = {
        ...item,
        quantity,
        subtotal: newSubtotal,
      };

      return { cart: newCart };
    });

    get().calculateTotals();
  },

  // Remove item from cart
  removeItem: (index) => {
    set((state) => {
      const newCart = state.cart.filter((_, i) => i !== index);
      return { cart: newCart };
    });
    get().calculateTotals();
  },

  // Apply item discount
  applyItemDiscount: (index, discount) => {
    set((state) => {
      const item = state.cart[index];
      if (!item) return state;

      const discountPercentage = discount.type === 'percentage' ? discount.value : undefined;
      const discountAmount = discount.type === 'amount' ? discount.value : undefined;

      const newSubtotal = calculateItemSubtotal(
        item.quantity,
        item.unitPrice,
        discountPercentage,
        discountAmount,
      );

      const newCart = [...state.cart];
      newCart[index] = {
        ...item,
        discountPercentage,
        discountAmount,
        subtotal: newSubtotal,
      };

      return { cart: newCart };
    });
    get().calculateTotals();
  },

  // Set customer
  setCustomer: (customer) => {
    set({ customer });
    get().calculateTotals();
  },

  // Clear customer
  clearCustomer: () => {
    set({ customer: null });
  },

  // Apply transaction discount
  applyTransactionDiscount: (discount) => {
    set({ discount });
    get().calculateTotals();
  },

  // Clear cart
  clearCart: () => {
    set({
      cart: [],
      customer: null,
      discount: null,
      receiptNotes: null,
  internalNotes: null,
    });
    get().calculateTotals();
  },

  // Set notes
  // Set receipt notes
  setReceiptNotes: (notes) => {
    set({ receiptNotes: notes });
  },

  // Set internal notes
  setInternalNotes: (notes) => {
    set({ internalNotes: notes });
  },

  // Calculate totals
  calculateTotals: () => {
    const state = get();
    const subtotal = state.cart.reduce((sum, item) => sum + item.subtotal, 0);

    // Apply transaction discount
    let discountAmount = 0;
    if (state.discount) {
      if (state.discount.type === 'amount') {
        discountAmount = state.discount.value;
      } else {
        discountAmount = subtotal * (state.discount.value / 100);
      }
    }

    // Apply customer tier discount if customer has tier
    if (state.customer?.tier?.discountPercentage) {
      const tierDiscount = subtotal * (state.customer.tier.discountPercentage / 100);
      discountAmount = Math.max(discountAmount, tierDiscount);
    }

    const subtotalAfterDiscount = subtotal - discountAmount;
    const taxAmount = subtotalAfterDiscount * 0.11; // 11% tax
    const total = subtotalAfterDiscount + taxAmount;

    set({
      subtotal,
      discountAmount,
      taxAmount,
      total,
    });
  },
}));

