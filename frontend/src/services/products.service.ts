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
  category?: { id: string; name: string };
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
};

