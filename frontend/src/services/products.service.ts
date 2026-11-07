import { api, handleApiError } from './api';

export interface Product {
  id: string;
  name: string;
  printedName?: string;
  sku: string;
  barcode?: string;
  categoryId: string;
  subCategoryId?: string;
  brandId?: string;
  supplierId?: string;
  costPrice: number;
  sellingPrice: number;
  minSellingPrice?: number;
  unit?: string;
  size?: string;
  color?: string;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  weightGrams?: number;
  packageWeightGrams?: number;
  stock?: number;
  minStock?: number;
  status?: string;
  isActive?: boolean;
  isService?: boolean;
  trackSerial?: boolean;
  trackBatch?: boolean;
  trackExpiry?: boolean;
  expiryReturnLimitDays?: number;
  description?: string;
  memberPricing?: Record<string, any>;
  category?: { id: string; name: string; tierMargins?: Record<string, number> };
  subCategory?: { id: string; name: string };
  brand?: { id: string; name: string };
  supplier?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface ProductListResponse {
  data: Product[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ── XLSX import (3-step: template → preview → confirm). Files are parsed
// in memory server-side and never stored. ──
export type ProductDuplicateMode = 'overwrite' | 'skip';

export interface ProductImportPreviewRow {
  rowNumbers: number[];
  barcode?: string;
  name: string;
  action?: 'create' | 'update';
  errors: string[];
  [key: string]: any;
}

export interface ProductImportPreview {
  rows: ProductImportPreviewRow[];
  validCount: number;
  errorCount: number;
}

export interface ProductImportResult {
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ row: string; error: string }>;
  productIds: string[];
}

export const productsService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    'filter[status]'?: string;
    'filter[category]'?: string;
    'filter[brand]'?: string;
  }): Promise<ProductListResponse> {
    try {
      const response = await api.get('/products', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: {
          page: params?.page || 1,
          limit: params?.limit || 20,
          total: 0,
          totalPages: 0,
        },
      });
    }
  },

  async getById(id: string): Promise<Product> {
    const response = await api.get(`/products/${id}`);
    return response.data.data || response.data;
  },

  async create(data: any): Promise<Product> {
    const response = await api.post('/products', data);
    return response.data.data || response.data;
  },

  async update(id: string, data: any): Promise<Product> {
    const response = await api.put(`/products/${id}`, data);
    return response.data.data || response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/products/${id}`);
  },

  async getStatistics(): Promise<{
    total: number;
    totalStockValue: number;
    lowStockCount: number;
    activeCount: number;
  }> {
    const response = await api.get('/products/statistics');
    return response.data;
  },

  // ── XLSX import: template → preview (read-only) → confirm (writes) ──
  async downloadProductImportTemplate(): Promise<Blob> {
    const response = await api.get('/products/import/template', { responseType: 'blob' });
    return response.data;
  },

  async previewProductImport(file: File): Promise<ProductImportPreview> {
    const form = new FormData();
    form.append('file', file);
    const response = await api.post('/products/import/preview', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async confirmProductImport(payload: {
    fileName: string;
    rows: any[];
    duplicateMode: ProductDuplicateMode;
  }): Promise<ProductImportResult> {
    const response = await api.post('/products/import/confirm', payload);
    return response.data;
  },
};

