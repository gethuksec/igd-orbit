import { BreadcrumbHeader } from "@/components/shared";
import { AlarmClock } from "lucide-react";

export default function LemburPage() {
  return (
    <div className="space-y-4">
      <BreadcrumbHeader title="Lembur" subtitle="Pengajuan dan riwayat lembur karyawan" />
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-12 text-center">
        <AlarmClock className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
        <p className="font-medium">Halaman placeholder</p>
        <p className="text-sm text-muted-foreground mt-1">
          Modul lembur belum tersedia — pengajuan lembur yang disetujui dapat dilihat di Approval presensi.
        </p>
      </div>
    </div>
  );
}
