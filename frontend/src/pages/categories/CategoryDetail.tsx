import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Edit, Tag, Package, FolderTree, Calendar, Loader2, Award, Plus, Pencil, Ban } from "lucide-react";
import { api } from "../../services/api";
import { categoriesService } from "../../services/categories.service";
import { BreadcrumbHeader } from "@/components/shared";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function CategoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: category, isLoading } = useQuery({
    queryKey: ["category", id],
    queryFn: async () => {
      const res = await api.get(`/categories/${id}`);
      return res.data.data || res.data;
    },
  });

  // IGDERP-317 — grades scoped to this category
  const { data: grades = [], isLoading: gradesLoading } = useQuery({
    queryKey: ["category-grades", id],
    queryFn: () => categoriesService.listGrades(id as string),
    enabled: !!id,
  });

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<any>(null);
  const [formData, setFormData] = useState({ code: "", name: "", isActive: true });
  const [generatingCode, setGeneratingCode] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<any>(null);

  const invalidateGrades = () => {
    queryClient.invalidateQueries({ queryKey: ["category-grades", id] });
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

  const handleGenerateCode = async () => {
    setGeneratingCode(true);
    try {
      const { code } = await categoriesService.generateGradeCode();
      setFormData((prev) => ({ ...prev, code }));
    } catch {
      toast.error("Gagal generate kode");
    } finally {
      setGeneratingCode(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      const submitData = { ...data };
      if (!submitData.code) delete submitData.code;
      if (editingGrade) {
        return categoriesService.updateGrade(id as string, editingGrade.id, submitData);
      }
      return categoriesService.createGrade(id as string, submitData);
    },
    onSuccess: () => {
      invalidateGrades();
      toast.success(editingGrade ? "Grade berhasil diupdate" : "Grade berhasil ditambahkan");
      setFormModalOpen(false);
      setEditingGrade(null);
      setFormData({ code: "", name: "", isActive: true });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Terjadi kesalahan");
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (gradeId: string) =>
      categoriesService.updateGrade(id as string, gradeId, { isActive: false }),
    onSuccess: () => {
      invalidateGrades();
      toast.success("Grade dinonaktifkan");
      setDeactivateTarget(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Terjadi kesalahan");
      setDeactivateTarget(null);
    },
  });

  const openCreateModal = () => {
    setEditingGrade(null);
    setFormData({ code: "", name: "", isActive: true });
    setFormModalOpen(true);
  };

  const openEditModal = (grade: any) => {
    setEditingGrade(grade);
    setFormData({ code: grade.code || "", name: grade.name || "", isActive: grade.isActive !== false });
    setFormModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Nama grade wajib diisi");
      return;
    }
    saveMutation.mutate({ ...formData, name: formData.name.trim() });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 dark:text-primary-400 animate-spin" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Kategori tidak ditemukan</p>
        <button
          onClick={() => navigate("/categories")}
          className="mt-4 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
        >
          Kembali ke daftar kategori
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/categories")}
          className="flex-shrink-0 p-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg shadow-lg hover:from-primary-500 hover:to-primary-400 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <BreadcrumbHeader title={category.name} subtitle="Detail Kategori">
            <Link
              to={`/categories/${id}/edit`}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all"
            >
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </Link>
          </BreadcrumbHeader>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Informasi Kategori */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Tag className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <CardTitle>Informasi Kategori</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Nama Kategori</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{category.name}</p>
              </div>

              {category.code && (
                <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Kode Kategori</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">{category.code}</p>
                </div>
              )}

              {category.description && (
                <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Deskripsi</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{category.description}</p>
                </div>
              )}

              <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    category.isActive
                      ? "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  }`}
                >
                  {category.isActive ? "Aktif" : "Tidak Aktif"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Parent Category */}
          {category.parentCategory && (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <FolderTree className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <CardTitle>Kategori Induk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Nama Kategori Induk</p>
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">{category.parentCategory.name}</p>
                  {category.parentCategory.code && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-mono">{category.parentCategory.code}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* IGDERP-317 — Grade scoped to this category */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Award className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <CardTitle>Grade</CardTitle>
              <div className="ml-auto">
                <Button size="sm" onClick={openCreateModal}>
                  <Plus className="w-4 h-4 mr-1" />
                  Tambah Grade
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {gradesLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : grades.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
                  Belum ada grade. Tambahkan grade khusus untuk kategori ini (mis. ORI, KW, OEM).
                </p>
              ) : (
                <div className="space-y-2">
                  {grades.map((grade: any) => (
                    <div
                      key={grade.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{grade.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{grade.code}</p>
                      </div>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                          grade.isActive
                            ? "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                        }`}
                      >
                        {grade.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                      <button
                        onClick={() => openEditModal(grade)}
                        className="shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors"
                        title="Edit grade"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {grade.isActive && (
                        <button
                          onClick={() => setDeactivateTarget(grade)}
                          className="shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                          title="Nonaktifkan grade"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Statistics & Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Package className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <CardTitle>Statistik</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-gradient-to-br from-primary-50 dark:from-primary-950 to-primary-100 dark:to-primary-950 rounded-lg border border-primary-200 dark:border-primary-800">
                <p className="text-xs text-primary-600 dark:text-primary-400 mb-1">Total Produk</p>
                <p className="text-2xl font-bold text-primary-900 dark:text-primary-100">{category.productCount || 0}</p>
                <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">Produk dalam kategori ini</p>
              </div>

              {category.childCategories && category.childCategories.length > 0 && (
                <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Sub Kategori</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{category.childCategories.length}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Kategori di bawah ini</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <CardTitle>Informasi Tambahan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Dibuat</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {new Date(category.createdAt).toLocaleDateString("id-ID", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Diupdate</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {new Date(category.updatedAt).toLocaleDateString("id-ID", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Grade form modal */}
      <Dialog open={formModalOpen} onOpenChange={(open) => { if (!open) { setFormModalOpen(false); setEditingGrade(null); setFormData({ code: "", name: "", isActive: true }); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGrade ? "Edit Grade" : "Tambah Grade"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Kode
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  maxLength={10}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono uppercase"
                  placeholder="Otomatis jika kosong"
                />
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  disabled={generatingCode}
                  className="shrink-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors disabled:opacity-50 text-sm"
                >
                  {generatingCode ? "..." : "Generate"}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nama Grade <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="cth: ORI, KW, OEM"
                required
              />
            </div>
            {editingGrade && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="grade-active"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="grade-active" className="text-sm text-gray-700 dark:text-gray-300">
                  Aktif
                </label>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Menyimpan..." : editingGrade ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deactivate confirm modal */}
      <Dialog open={!!deactivateTarget} onOpenChange={(open) => { if (!open) setDeactivateTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nonaktifkan Grade</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Nonaktifkan grade <span className="font-semibold">"{deactivateTarget?.name}"</span>?
            {deactivateTarget && " Grade yang masih dipakai produk tidak bisa dinonaktifkan."}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeactivateTarget(null)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deactivateMutation.isPending}
              onClick={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)}
            >
              {deactivateMutation.isPending ? "Memproses..." : "Nonaktifkan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
