import { api } from './api';

export interface LabelSettings {
  id: string | null;
  configured: boolean;
  name: string;
  labelWidthMm: number;
  labelHeightMm: number;
  columns: number;
  symbology: string; // 'BARCODE' | 'QR'
  paperType: string; // 'THERMAL' | 'A4'
  showPrintedName: boolean;
  showPrice: boolean;
  showSku: boolean;
  autoPrint: boolean;
}

export interface LabelJobPayload {
  barcode: string;
  sku: string;
  name: string;
  printedName: string;
  price: number;
  grNumber: string;
  batchNumber?: string | null;
  serialNumber?: string | null;
  expiryDate?: string | null;
}

export interface LabelPrintJob {
  id: string;
  jobNumber: string;
  goodsReceiptId?: string | null;
  productId: string;
  copies: number;
  payload: LabelJobPayload;
  status: 'pending' | 'printed' | 'cancelled';
  printedAt?: string | null;
  createdAt: string;
  product?: { id: string; name: string; sku: string; printedName?: string | null; barcode?: string | null };
  goodsReceipt?: { id: string; grNumber: string } | null;
  printedByUser?: { id: string; fullName: string } | null;
}

export const labelPrintingService = {
  async getSettings(): Promise<LabelSettings> {
    const response = await api.get('/label-printing/settings');
    return response.data.data || response.data;
  },

  async updateSettings(data: Partial<LabelSettings>): Promise<LabelSettings> {
    const response = await api.put('/label-printing/settings', data);
    return response.data.data || response.data;
  },

  async getJobs(params?: {
    status?: string;
    goods_receipt_id?: string;
    ids?: string;
  }): Promise<{ data: LabelPrintJob[]; total: number; pendingCount: number }> {
    const response = await api.get('/label-printing/jobs', { params });
    const body = response.data.data || response.data;
    const jobs: LabelPrintJob[] = body.data ?? body;
    return {
      data: jobs,
      total: body.total ?? jobs.length,
      pendingCount: body.pendingCount ?? 0,
    };
  },

  async markPrinted(ids: string[]): Promise<{ updated: number }> {
    const response = await api.post('/label-printing/jobs/mark-printed', { ids });
    return response.data.data || response.data;
  },
};
