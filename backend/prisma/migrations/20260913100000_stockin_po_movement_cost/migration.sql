-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "unit_cost" DECIMAL(15,2);

-- AlterTable
ALTER TABLE "stock_ins" ADD COLUMN     "po_number" TEXT;

