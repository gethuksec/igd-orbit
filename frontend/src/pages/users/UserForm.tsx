import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, ArrowLeft, User, Phone, Mail, KeyRound } from 'lucide-react';
import { usersService } from '../../services/users.service';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function UserForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    isActive: true,
    canChangePassword: true,
  });

  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ['user', id],
    queryFn: () => usersService.getById(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        password: '', // Don't prefill password
        fullName: user.fullName || '',
        phone: user.phone || '',
        isActive: user.isActive ?? true,
        canChangePassword: user.canChangePassword ?? true,
      });
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const submitData: any = {
        email: data.email,
        fullName: data.fullName,
        phone: data.phone || undefined,
        isActive: data.isActive,
        canChangePassword: data.canChangePassword,
      };

      if (!isEdit && data.password) {
        submitData.password = data.password;
      }

      return isEdit ? usersService.update(id!, submitData) : usersService.create(submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(isEdit ? 'Pengguna berhasil diupdate' : 'Pengguna berhasil ditambahkan');
      navigate('/users');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || `Gagal ${isEdit ? 'mengupdate' : 'menambahkan'} pengguna`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEdit && !formData.password) {
      toast.error('Password wajib diisi untuk pengguna baru');
      return;
    }

    mutation.mutate(formData);
  };

  if (loadingUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}
        subtitle={isEdit ? 'Ubah informasi pengguna' : 'Tambahkan pengguna baru ke sistem'}
      >
        <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/20">
          <Link to="/users">
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Link>
        </Button>
      </PageHeader>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-5 h-5 text-primary-600" />
            Informasi Dasar
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="font-semibold">
                Nama Lengkap <span className="text-red-500">*</span>
              </Label>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
                placeholder="Masukkan nama lengkap"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-semibold">
                Email <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="pl-9"
                  placeholder="user@example.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="font-semibold">
                Telepon
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="pl-9"
                  placeholder="081234567890"
                />
              </div>
            </div>

            {!isEdit && (
              <div className="space-y-1.5">
                <Label htmlFor="password" className="font-semibold">
                  Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!isEdit}
                    minLength={6}
                    className="pl-9"
                    placeholder="Minimal 6 karakter"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Password minimal 6 karakter</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="status" className="font-semibold">
                Status
              </Label>
              <select
                id="status"
                value={formData.isActive ? 'active' : 'inactive'}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="active">Aktif</option>
                <option value="inactive">Non-Aktif</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="canChangePassword"
                checked={formData.canChangePassword}
                onChange={(e) => setFormData({ ...formData, canChangePassword: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="canChangePassword" className="text-sm font-semibold text-gray-700 cursor-pointer">
                Izinkan user mengubah password sendiri
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button asChild variant="outline">
            <Link to="/users">Batal</Link>
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Simpan
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
