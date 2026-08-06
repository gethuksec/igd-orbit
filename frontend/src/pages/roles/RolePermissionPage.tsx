import { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Lock, Search } from 'lucide-react';
import { rolesService } from '../../services/roles.service';
import { toast } from 'sonner';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { usePermissions } from '../../hooks/usePermissions';
import {
  PERMISSION_CATALOG_KEYS,
  PERMISSION_GROUP_ORDER,
  labelForPermission,
  groupForPermission,
} from '../../utils/permissionLabels';

export default function RolePermissionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [selected, setSelected] = useState<string[] | null>(null);
  const [search, setSearch] = useState('');

  const { data: role, isLoading, error } = useQuery({
    queryKey: ['role', id],
    queryFn: () => rolesService.getById(id!),
    enabled: !!id,
  });

  // Init selected from role once loaded
  const effectiveSelected = selected ?? role?.defaultPermissions ?? [];

  const isSuperAdminRole = role?.code === 'SUPERADMIN';
  const canEdit = !!role && !isSuperAdminRole && hasPermission('roles.role.edit');

  const mutation = useMutation({
    mutationFn: (keys: string[]) => rolesService.update(id!, { defaultPermissions: keys }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role', id] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Hak default role berhasil disimpan');
      navigate(`/roles/${id}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Gagal menyimpan hak default');
    },
  });

  const toggle = (key: string) => {
    if (!canEdit) return;
    setSelected((prev) => {
      const cur = prev ?? role?.defaultPermissions ?? [];
      return cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    });
  };

  // Group keys
  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const key of PERMISSION_CATALOG_KEYS) {
      const g = groupForPermission(key);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(key);
    }
    const ordered = PERMISSION_GROUP_ORDER.filter((g) => map.has(g));
    const extra = [...map.keys()].filter((g) => !PERMISSION_GROUP_ORDER.includes(g)).sort();
    return [...ordered, ...extra].map((g) => ({ group: g, keys: map.get(g)! }));
  }, []);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        keys: g.keys.filter(
          (k) => k.toLowerCase().includes(q) || labelForPermission(k).toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.keys.length > 0);
  }, [groups, search]);

  const selectedCount = effectiveSelected.filter((k) => PERMISSION_CATALOG_KEYS.includes(k)).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error || !role) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground mb-4">Role tidak ditemukan</p>
        <Button asChild>
          <Link to="/roles">Kembali ke Daftar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BreadcrumbHeader title={`Kelola Hak Default — ${role.name}`} subtitle={`${role.code} · ${selectedCount} dari ${PERMISSION_CATALOG_KEYS.length} hak dipilih`}>
        <Button
          size="sm"
          disabled={!canEdit || mutation.isPending}
          onClick={() => mutation.mutate(effectiveSelected)}
        >
          {mutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Simpan Perubahan
        </Button>
      </BreadcrumbHeader>

      {isSuperAdminRole && (
        <div className="rounded-xl border-2 border-yellow-200 bg-yellow-50 p-5">
          <div className="flex items-start gap-3">
            <Lock className="w-6 h-6 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-700">Hak SUPERADMIN Terkunci</h3>
              <p className="text-sm text-yellow-600 mt-1">
                SUPERADMIN memiliki akses penuh ke seluruh sistem. Hak defaultnya tidak dapat diubah —
                daftar di bawah hanya untuk referensi.
              </p>
            </div>
          </div>
        </div>
      )}

      {!canEdit && !isSuperAdminRole && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          Anda memiliki akses lihat saja — hubungi SUPERADMIN untuk mengubah hak default role ini.
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari hak akses… (nama atau kode)"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Grouped permission cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredGroups.map(({ group, keys }) => {
          const groupSelected = keys.filter((k) => effectiveSelected.includes(k)).length;
          return (
            <div key={group} className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-gray-500">{group}</span>
                <span className="text-[11px] text-gray-400">
                  {groupSelected} dipilih
                </span>
              </div>
              <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
                {keys.map((key) => {
                  const checked = effectiveSelected.includes(key);
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-2.5 py-1.5 px-2 rounded-md ${
                        canEdit ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!canEdit}
                        onCheckedChange={() => toggle(key)}
                        className="data-[state=checked]:bg-primary-600 shrink-0"
                      />
                      <span className="flex flex-col leading-tight min-w-0">
                        <span className="text-sm text-gray-700 truncate">{labelForPermission(key)}</span>
                        <span className="text-[10px] font-mono text-gray-400 truncate">{key}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
        {filteredGroups.length === 0 && (
          <div className="col-span-full text-center py-10 text-sm text-gray-400">
            Tidak ada hak yang cocok dengan pencarian "{search}"
          </div>
        )}
      </div>

      {!isSuperAdminRole && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 max-w-2xl">
          <span className="text-blue-600 text-xs mt-0.5">ℹ️</span>
          <p className="text-xs text-blue-800">
            <b>Alur saat membuat role baru:</b> tombol di modal menjadi <b>"Simpan &amp; Kelola Hak Default →"</b> — role
            disimpan dulu (kode/nama/level), lalu otomatis diarahkan ke halaman ini. Perubahan hak hanya bisa dilakukan
            setelah role tersimpan.
          </p>
        </div>
      )}
    </div>
  );
}
