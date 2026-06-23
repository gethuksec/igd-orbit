import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get category
  const cat = await prisma.category.findFirst({ where: { name: 'Test Tier' } });
  if (!cat) { console.error('Category not found'); process.exit(1); }
  
  // Get active tiers
  const tiers = await prisma.customerTier.findMany({ where: { isActive: true } });
  if (!tiers.length) { console.error('No active tiers'); process.exit(1); }
  
  // Build memberPricing from margins: sellingPrice(100000) + margin
  const tierMargins = (cat.tierMargins as Record<string, number>) || {};
  const memberPricing: Record<string, number> = {};
  for (const tier of tiers) {
    const margin = tierMargins[tier.id] || 0;
    memberPricing[tier.id] = 100000 + margin;
  }
  
  // Create product with memberPricing
  const product = await prisma.product.create({
    data: {
      name: 'Test Tier Product',
      sku: 'TTP-001',
      barcode: 'TTP001',
      unit: 'pcs',
      categoryId: cat.id,
      costPrice: 50000,
      sellingPrice: 100000,
      minSellingPrice: 90000,
      stock: 50,
      trackStock: true,
      isActive: true,
      isVerified: true,
      memberPricing: memberPricing,
    },
  });
  
  console.log(JSON.stringify({ id: product.id, name: product.name, sellingPrice: Number(product.sellingPrice), memberPricing }));
  await prisma.$disconnect();
}

main();
