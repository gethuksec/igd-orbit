const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  try {
    const cat = await p.category.findFirst({ where: { name: "Test Tier" } });
    if (!cat) { console.log("ERR: Category not found"); return; }
    const tiers = await p.customerTier.findMany({ where: { isActive: true } });
    const margins = cat.tierMargins || {};
    const mp = {};
    for (const t of tiers) { mp[t.id] = 100000 + (margins[t.id] || 0); }
    const prod = await p.product.create({
      data: {
        name: "Test Tier Product",
        sku: "TTP-" + Date.now(),
        barcode: "TTP" + Date.now(),
        unit: "pcs",
        categoryId: cat.id,
        costPrice: 50000,
        sellingPrice: 100000,
        minSellingPrice: 90000,
        isActive: true,
        memberPricing: mp,
      },
    });
    console.log(JSON.stringify({ id: prod.id, name: prod.name, memberPricing: prod.memberPricing }));
  } catch (e) { console.log("ERR:", e.message); }
  await p.$disconnect();
})();
