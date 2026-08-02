import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, CheckCircle, XCircle, Loader2, Clock, User, Mail } from 'lucide-react';
import { authService } from '../../services/users.service';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';

export default function PasswordRequests() {
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['password-requests'],
    queryFn: () => authService.getPasswordRequests(),
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => authService.approvePasswordRequest(id),
    onSuccess: () => {
      toast.success('Permintaan perubahan password disetujui');
      queryClient.invalidateQueries({ queryKey: ['password-requests'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyetujui permintaan');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => authService.rejectPasswordRequest(id),
    onSuccess: () => {
      toast.success('Permintaan perubahan password ditolak');
      queryClient.invalidateQueries({ queryKey: ['password-requests'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menolak permintaan');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Persetujuan Password" subtitle="Setujui atau tolak permintaan perubahan password dari karyawan" />

      {/* Requests List */}
      {(!requests || requests.length === 0) ? (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-12 text-center">
          <Shield className="w-16 h-16 text-green-100 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Tidak Ada Permintaan</h3>
          <p className="text-gray-500">Semua permintaan perubahan password telah diproses</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req: any) => (
            <div key={req.id} className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <Clock className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold text-gray-900">{req.user?.fullName || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{req.user?.email || req.userId}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Diminta pada: {new Date(req.requestedAt).toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-green-50 text-green-700 hover:bg-green-100 font-semibold"
                    onClick={() => approveMutation.mutate(req.id)}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Setujui
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="bg-red-50 text-red-700 hover:bg-red-100 font-semibold"
                    onClick={() => rejectMutation.mutate(req.id)}
                    disabled={rejectMutation.isPending}
                  >
                    <XCircle className="w-4 h-4" />
                    Tolak
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
