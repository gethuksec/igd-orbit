import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2, ArrowLeft, Warehouse as WarehouseIcon } from "lucide-react";
import { warehousesService } from "../../services/warehouses.service";
import { branchesService } from "../../services/branches.service";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface WarehouseFormData {
  name: string;
  code: string;
  outletId: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  contactPerson: string;
  mobilePhone: string;
  isActive: boolean;
}

const defaultForm: WarehouseFormData = {
  name: "",
  code: "",
  outletId: "",
  city: "",
  address: "",
  phone: "",
  email: "",
  contactPerson: "",
  mobilePhone: "",
  isActive: true,
};

export default function WarehouseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<WarehouseFormData>({ ...defaultForm });
  const [loaded, setLoaded] = useState(false);

  const { data: warehouse, isLoading: loadingWarehouse } = useQuery({
    queryKey: ["warehouse", id],
    queryFn: () => warehousesService.getById(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (warehouse && !loaded) {
      setForm({
        name: warehouse.name || "",
        code: warehouse.code || "",
        outletId: warehouse.outletId || "",
        city: warehouse.city || "",
        address: warehouse.address || "",
        phone: warehouse.phone || "",
        email: warehouse.email || "",
        contactPerson: warehouse.contactPerson || "",
        mobilePhone: warehouse.mobilePhone || "",
        isActive: warehouse.isActive !== false,
      });
      setLoaded(true);
    }
  }, [warehouse, loaded]);

  const { data: outletsData } = useQuery({
    queryKey: ["branches-active"],
    queryFn: () => branchesService.getActive(),
  });
  const outlets = outletsData || [];

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      const submitData = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== "")
      );
      if (isEdit) {
        return warehousesService.update(id!, submitData);
      }
      return warehousesService.create(submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["pos-warehouses"] });
      toast.success(isEdit ? "Gudang berhasil diupdate" : "Gudang berhasil ditambahkan");
      navigate("/warehouses");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Terjadi kesalahan");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const inputCls =
    "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  if (isEdit && loadingWarehouse) {
    return (
      <div className="w-full flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <PageHeader
        title={isEdit ? "Edit Gudang" : "Tambah Gudang"}
        subtitle={isEdit ? `Kode: ${warehouse?.code || "-"}` : "Kelola gudang per outlet"}
      >
        <Button
          variant="outline"
          onClick={() => navigate("/warehouses")}
          className="flex items-center gap-2 bg-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </Button>
      </PageHeader>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WarehouseIcon className="w-5 h-5 text-primary-600" />
              Informasi Gudang
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>
                  Nama Gudang <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputCls}
                  placeholder="Nama gudang"
                />
              </div>
              <div>
                <label className={labelCls}>Kode</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className={inputCls}
                  placeholder="Kosongkan untuk otomatis (WH-XXXXXXXX)"
                />
              </div>
              <div>
                <label className={labelCls}>
                  Outlet <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={form.outletId}
                  onChange={(e) => setForm({ ...form, outletId: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Pilih outlet...</option>
                  {outlets.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Kota</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className={inputCls}
                    placeholder="Kota"
                  />
                </div>
                <div>
                  <label className={labelCls}>Telepon</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={inputCls}
                    placeholder="Telepon gudang"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Alamat</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={2}
                  className={inputCls}
                  placeholder="Alamat gudang (opsional)"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={inputCls}
                    placeholder="Email (opsional)"
                  />
                </div>
                <div>
                  <label className={labelCls}>Contact Person</label>
                  <input
                    type="text"
                    value={form.contactPerson}
                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                    className={inputCls}
                    placeholder="Nama contact person"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>No. HP</label>
                <input
                  type="text"
                  value={form.mobilePhone}
                  onChange={(e) => setForm({ ...form, mobilePhone: e.target.value })}
                  className={inputCls}
                  placeholder="No. HP contact person"
                />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      form.isActive ? "bg-green-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        form.isActive ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-600">
                    {form.isActive ? "Aktif" : "Tidak Aktif"}
                  </span>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/warehouses")}
                  disabled={saveMutation.isPending}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
