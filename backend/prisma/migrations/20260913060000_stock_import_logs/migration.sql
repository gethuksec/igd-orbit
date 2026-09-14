-- CreateTable
CREATE TABLE "stock_import_logs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "outlet_id" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "total_rows" INTEGER NOT NULL,
    "success_rows" INTEGER NOT NULL,
    "skipped_rows" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "error_summary" TEXT,
    "reference_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_import_logs_warehouse_id_idx" ON "stock_import_logs"("warehouse_id");

-- CreateIndex
CREATE INDEX "stock_import_logs_created_at_idx" ON "stock_import_logs"("created_at");

