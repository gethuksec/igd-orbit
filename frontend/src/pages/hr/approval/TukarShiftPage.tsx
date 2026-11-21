import { BreadcrumbHeader } from "@/components/shared";
import { ArrowRightLeft } from "lucide-react";

export default function TukarShiftPage() {
  return (
    <div className="space-y-4">
      <BreadcrumbHeader title="Tukar shift" subtitle="Pengajuan pertukaran shift antar karyawan" />
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-12 text-center">
        <ArrowRightLeft className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
        <p className="font-medium">Halaman placeholder</p>
        <p className="text-sm text-muted-foreground mt-1">
          Modul tukar shift belum tersedia — pengajuan pertukaran shift akan dikelola di sini.
        </p>
      </div>
    </div>
  );
}
