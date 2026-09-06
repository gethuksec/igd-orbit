import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Image as ImageIcon, Trash2, Paperclip, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { purchasingService } from '@/services/purchasing.service';

const DOC_TYPES = ['INVOICE', 'DELIVERY_NOTE', 'ORDER_CONFIRM', 'OTHER'];
const DOC_TYPE_LABEL: Record<string, string> = {
  INVOICE: 'Invoice',
  DELIVERY_NOTE: 'Surat Jalan / DO',
  ORDER_CONFIRM: 'Order Confirmation',
  OTHER: 'Lainnya',
};

interface Attachment {
  id: string;
  entityType: 'PURCHASE_ORDER' | 'GOODS_RECEIPT';
  entityId: string;
  documentType: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: string;
}

/**
 * IGDERP-81: supplier invoice / delivery-note documents.
 * Reused on PurchaseOrder detail + GoodsReceipt detail.
 */
export default function AttachmentPanel({
  entityType,
  entityId,
  title = 'Lampiran Dokumen',
}: {
  entityType: 'PURCHASE_ORDER' | 'GOODS_RECEIPT';
  entityId: string;
  title?: string;
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState('INVOICE');

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ['attachments', entityType, entityId],
    queryFn: () => purchasingService.getAttachments(entityType, entityId),
    enabled: !!entityId,
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) =>
      purchasingService.uploadAttachments(entityType, entityId, docType, files),
    onSuccess: () => {
      toast.success('Lampiran berhasil diunggah');
      queryClient.invalidateQueries({ queryKey: ['attachments', entityType, entityId] });
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: () => toast.error('Gagal mengunggah lampiran'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => purchasingService.deleteAttachment(id),
    onSuccess: () => {
      toast.success('Lampiran dihapus');
      queryClient.invalidateQueries({ queryKey: ['attachments', entityType, entityId] });
    },
    onError: () => toast.error('Gagal menghapus lampiran'),
  });

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const valid = Array.from(files).filter((f) =>
      ['application/pdf', 'image/jpeg', 'image/png'].includes(f.type),
    );
    if (valid.length !== Array.from(files).length) {
      toast.error('Hanya PDF/JPG/PNG yang diizinkan');
    }
    if (valid.length > 0) uploadMutation.mutate(valid);
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Paperclip className="w-5 h-5 text-gray-600" />
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
        >
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {DOC_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="px-4 py-2 bg-white text-primary-600 border border-gray-200 rounded-lg font-semibold hover:bg-primary-50 transition-colors disabled:opacity-50"
        >
          + Unggah (PDF/JPG/PNG, ≤10MB)
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">Belum ada lampiran.</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((att: Attachment) => (
            <div
              key={att.id}
              className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg bg-gray-50"
            >
              {att.mimeType === 'application/pdf' ? (
                <FileText className="w-5 h-5 text-red-500 flex-none" />
              ) : (
                <ImageIcon className="w-5 h-5 text-gray-600 flex-none" />
              )}
              <div className="flex-1 min-w-0">
                <a
                  href={att.filePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm font-semibold text-gray-900 truncate hover:text-primary-600"
                >
                  {att.fileName}
                </a>
                <div className="text-xs text-gray-500">
                  {DOC_TYPE_LABEL[att.documentType] || att.documentType} ·{' '}
                  {(att.fileSize / 1024 / 1024).toFixed(2)} MB ·{' '}
                  {new Date(att.createdAt).toLocaleDateString('id-ID')}
                </div>
              </div>
              <button
                onClick={() => deleteMutation.mutate(att.id)}
                disabled={deleteMutation.isPending}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Hapus lampiran"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
