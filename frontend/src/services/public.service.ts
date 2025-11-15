import api from './api';

export interface ServiceTrackingData {
  serviceNumber: string;
  deviceType: string;
  deviceBrand?: string;
  deviceModel?: string;
  status: string;
  statusHistory: Array<{
    status: string;
    createdAt: string;
    notes?: string;
  }>;
  receivedDate: string;
  promisedDate?: string;
  estimatedCompletion?: string;
}

export interface FeaturedProduct {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  images?: string[];
  category?: {
    name: string;
  };
  brand?: {
    name: string;
  };
}

export interface ServiceType {
  id: string;
  code: string;
  name: string;
  description?: string;
  basePrice: number;
  minPrice?: number;
  maxPrice?: number;
  slaHours: number;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  province?: string;
  operatingHours?: Record<string, any>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

class PublicService {
  /**
   * Track service by service number (public endpoint - no auth)
   */
  async trackService(serviceNumber: string): Promise<ServiceTrackingData> {
    const response = await api.get(`/service-orders/track/${serviceNumber}`);
    return response.data;
  }

  /**
   * Get featured products for homepage
   */
  async getFeaturedProducts(limit = 8): Promise<FeaturedProduct[]> {
    try {
      const response = await api.get('/products', {
        params: {
          limit,
          page: 1,
          include: 'category,brand',
          sort: 'createdAt',
          order: 'desc',
        },
      });
      return response.data.data || [];
    } catch (error) {
      // If endpoint doesn't exist or fails, return empty array
      return [];
    }
  }

  /**
   * Get all service types
   */
  async getServiceTypes(): Promise<ServiceType[]> {
    // This endpoint needs to be created in backend
    // For now, return empty array or mock data
    try {
      const response = await api.get('/service-types');
      return response.data || [];
    } catch (error) {
      // If endpoint doesn't exist yet, return empty
      return [];
    }
  }

  /**
   * Get all branches
   */
  async getBranches(): Promise<Branch[]> {
    // This endpoint needs to be created in backend
    // For now, return empty array or mock data
    try {
      const response = await api.get('/branches');
      return response.data || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Chat with AI assistant (public endpoint)
   */
  async chatWithAI(message: string, context?: any): Promise<string> {
    // This endpoint needs to be created in backend
    // For now, return placeholder response
    try {
      const response = await api.post('/ai/chat', {
        message,
        context,
      });
      return response.data.response || 'I apologize, but I cannot process your request at the moment.';
    } catch (error) {
      return 'I apologize, but the AI service is currently unavailable. Please contact our support team.';
    }
  }
}

export const publicService = new PublicService();

