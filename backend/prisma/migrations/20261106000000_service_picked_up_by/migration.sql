-- List filters: nama penerima/pengambil perangkat, diisi saat serah terima (ready -> done).
ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "picked_up_by" TEXT;
