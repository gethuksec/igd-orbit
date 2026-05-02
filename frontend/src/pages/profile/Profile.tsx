import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Mail, Phone, Calendar, Edit, Save, Loader2, Shield } from 'lucide-react';
import { usersService } from '../../services/users.service';
import { toast } from 'sonner';

export default function Profile() {
  const queryClient = useQueryClient();
  
  // Get current user from localStorage
  const getUser = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) return JSON.parse(userStr);
    } catch {
      // Ignore
    }
    return null;
  };

  const currentUser = getUser();
  const userId = currentUser?.id;

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersService.getById(userId!),
    enabled: !!userId,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
  });

  // Update form data when user loads
  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        phone: user.phone || '',
        email: user.email || '',
      });
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: (data: { fullName?: string; phone?: string }) => 
      usersService.update(userId!, data),
    onSuccess: () => {
      toast.success('Profile berhasil diupdate');
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      setIsEditing(false);
      // Update localStorage
      if (user) {
        const updatedUser = { ...currentUser, ...formData };
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal mengupdate profile');
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      fullName: formData.fullName,
      phone: formData.phone || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">User tidak ditemukan</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Profile Saya</h1>
        <p className="text-gray-600 mt-1">Kelola informasi profile Anda</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-5 h-5" />
            Informasi Pribadi
          </h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>

        <div className="space-y-4">
          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              disabled
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-600 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Email tidak dapat diubah</p>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                placeholder="Masukkan nama lengkap"
              />
            ) : (
              <div className="px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50">
                {user.fullName || '-'}
              </div>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Nomor Telepon
            </label>
            {isEditing ? (
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                placeholder="081234567890"
              />
            ) : (
              <div className="px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50">
                {user.phone || '-'}
              </div>
            )}
          </div>

          {/* Roles */}
          {user.roles && user.roles.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Roles
              </label>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(user.roles) && user.roles.length > 0 && 
                  user.roles.map((userRoleOrCode: any) => {
                    // Handle both formats: UserRole object or string (role code)
                    const roleCode = typeof userRoleOrCode === 'string' 
                      ? userRoleOrCode 
                      : userRoleOrCode?.role?.code || userRoleOrCode?.code;
                    const roleName = typeof userRoleOrCode === 'string'
                      ? userRoleOrCode
                      : userRoleOrCode?.role?.name || userRoleOrCode?.name || roleCode;
                    
                    return (
                      <span
                        key={roleCode || userRoleOrCode}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium"
                      >
                        {roleName}
                      </span>
                    );
                  })
                }
                {(!user.roles || (Array.isArray(user.roles) && user.roles.length === 0)) && (
                  <span className="text-sm text-gray-500 italic">Tidak ada role</span>
                )}
              </div>
            </div>
          )}

          {/* Created At */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Tanggal Bergabung
            </label>
            <div className="px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50">
              {new Date(user.createdAt).toLocaleDateString('id-ID', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        </div>

        {/* Save/Cancel Buttons */}
        {isEditing && (
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setIsEditing(false);
                setFormData({
                  fullName: user.fullName || '',
                  phone: user.phone || '',
                  email: user.email || '',
                });
              }}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-700 hover:to-red-600 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Simpan Perubahan
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

