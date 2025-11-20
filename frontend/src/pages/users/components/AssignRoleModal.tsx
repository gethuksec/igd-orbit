import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, Shield } from 'lucide-react';
import { usersService } from '../../../services/users.service';
import type { AssignRoleDto } from '../../../services/users.service';
import { rolesService } from '../../../services/roles.service';
import { publicService } from '../../../services/public.service';
import { toast } from 'sonner';
import { Modal } from '../../../components/ui/modal';

interface AssignRoleModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AssignRoleModal({ userId, onClose, onSuccess }: AssignRoleModalProps) {
  const [formData, setFormData] = useState<AssignRoleDto>({
    roleId: '',
    branchId: null,
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: null,
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesService.getAll({ limit: 100 }),
  });

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => publicService.getBranches(),
  });

  const mutation = useMutation({
    mutationFn: (data: AssignRoleDto) => usersService.assignRole(userId, data),
    onSuccess: () => {
      toast.success('Role berhasil ditetapkan');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menetapkan role');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.roleId) {
      toast.error('Pilih role terlebih dahulu');
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <Modal open={true} onClose={onClose} title="Assign Role">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Role <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.roleId}
            onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
            required
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white"
          >
            <option value="">Pilih Role</option>
            {roles?.data.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name} ({role.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Cabang</label>
          <select
            value={formData.branchId || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                branchId: e.target.value === '' ? null : e.target.value,
              })
            }
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white"
          >
            <option value="">Semua Cabang (Global)</option>
            {branches?.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Kosongkan untuk akses global ke semua cabang
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Berlaku Dari</label>
            <input
              type="date"
              value={formData.validFrom || ''}
              onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Berlaku Hingga</label>
            <input
              type="date"
              value={formData.validUntil || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  validUntil: e.target.value || null,
                })
              }
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            />
            <p className="text-xs text-gray-500 mt-1">Kosongkan untuk tidak ada batas waktu</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                Assign Role
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

