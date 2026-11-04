import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';
import { RETIRED_ROLE_CODES, ROLE_TREE } from './org-tree';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log('🌱 Starting database seed...');

  // Hash passwords based on tier/level
  // Tier 1 (Highest): Owner
  const tier1Password = await hashPassword('Owner@1234');

  // 1. Create Branches
  console.log('📦 Creating branches...');
  const branch1 = await prisma.branch.upsert({
    where: { code: 'BR-001' },
    update: {
      name: 'IGD Jember Pusat',
      phone: '0331-123456',
      email: 'jember.pusat@igdgroup.com',
      address: 'Jl. Sudirman No. 123',
      city: 'Jember',
      province: 'Jawa Timur',
      isActive: true,
    },
    create: {
      code: 'BR-001',
      name: 'IGD Jember Pusat',
      phone: '0331-123456',
      email: 'jember.pusat@igdgroup.com',
      address: 'Jl. Sudirman No. 123',
      city: 'Jember',
      province: 'Jawa Timur',
      isActive: true,
    },
  });

  const branch2 = await prisma.branch.upsert({
    where: { code: 'BR-002' },
    update: {
      name: 'IGD Jember Kalisat',
      phone: '0331-234567',
      email: 'jember.kalisat@igdgroup.com',
      address: 'Jl. PB. Sudirman No. 2, Kalisat',
      city: 'Jember',
      province: 'Jawa Timur',
      isActive: true,
    },
    create: {
      code: 'BR-002',
      name: 'IGD Jember Kalisat',
      phone: '0331-234567',
      email: 'jember.kalisat@igdgroup.com',
      address: 'Jl. PB. Sudirman No. 2, Kalisat',
      city: 'Jember',
      province: 'Jawa Timur',
      isActive: true,
    },
  });

  await prisma.branch.upsert({
    where: { code: 'BR-003' },
    update: {
      name: 'IGD Jember iSaid',
      phone: '0331-345678',
      email: 'jember.isaid@igdgroup.com',
      address: 'Jl. Imam Bonjol No. 10, Jember',
      city: 'Jember',
      province: 'Jawa Timur',
      isActive: true,
    },
    create: {
      code: 'BR-003',
      name: 'IGD Jember iSaid',
      phone: '0331-345678',
      email: 'jember.isaid@igdgroup.com',
      address: 'Jl. Imam Bonjol No. 10, Jember',
      city: 'Jember',
      province: 'Jawa Timur',
      isActive: true,
    },
  });

  // 1b. Create Warehouse (D1: warehouse is a separate table, owned by an outlet)
  console.log('🏭 Creating warehouse...');
  const warehouse1 = await prisma.warehouse.upsert({
    where: { code: 'GUDANG-001' },
    update: {
      name: 'Gudang Pusat',
      outletId: branch1.id,
      isActive: true,
    },
    create: {
      code: 'GUDANG-001',
      name: 'Gudang Pusat',
      city: 'Jember',
      address: 'Jl. Sudirman No. 123',
      phone: '0331-123456',
      email: 'jember.pusat@igdgroup.com',
      isActive: true,
      outletId: branch1.id,
    },
  });

  const warehouse2 = await prisma.warehouse.upsert({
    where: { code: 'GUDANG-002' },
    update: {
      name: 'Gudang Cabang Jember',
      outletId: branch2.id,
      isActive: true,
    },
    create: {
      code: 'GUDANG-002',
      name: 'Gudang Cabang Jember',
      city: 'Jember',
      address: 'Jl. Hayam Wuruk No. 45',
      phone: '0331-654321',
      email: 'jember.cabang@igdgroup.com',
      isActive: true,
      outletId: branch2.id,
    },
  });

  // 2. Create Roles — ORG-REAL tree (IGDERP-237, chart locked 2026-11-04)
  // L0 SUPERADMIN (system) > L1 OWNER > L2 MU > L3 MM/MO/MS >
  // L4 SPV-MKT / HS / SPV-SC / SPV-FO / SPV-HRD > L5 AS-SE / AS-SRV > L6 staff (15)
  console.log('👥 Creating roles (ORG-REAL tree)...');
  const roleByCode = new Map<string, { id: string }>();
  for (const r of ROLE_TREE) {
    const saved = await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description, level: r.level, defaultPermissions: r.permissions, isActive: true },
      create: { code: r.code, name: r.name, description: r.description, level: r.level, defaultPermissions: r.permissions, isSystemRole: r.code === 'SUPERADMIN', isActive: true },
    });
    roleByCode.set(r.code, saved);
  }
  // Second pass: wire parentRoleId (parents guaranteed to exist now)
  for (const r of ROLE_TREE) {
    if (!r.parent) continue;
    const parent = roleByCode.get(r.parent);
    const child = roleByCode.get(r.code);
    if (parent && child) {
      await prisma.role.update({ where: { id: child.id }, data: { parentRoleId: parent.id } });
    }
  }
  const superadminRole = roleByCode.get('SUPERADMIN')!;
  const ownerRole = roleByCode.get('OWNER')!;

  // Retired legacy codes (ORG-REAL): deactivated in place so history never breaks
  for (const code of RETIRED_ROLE_CODES) {
    await prisma.role.updateMany({ where: { code }, data: { isActive: false } });
  }
  console.log('🚫 Retired legacy role codes:', RETIRED_ROLE_CODES.join(', '));

  // 2.5. Module wildcard keys — D1: legacy junction dropped; wildcards now live in defaultPermissions
  console.log('🔐 Applying module wildcard keys to roles...');
  const moduleWildcards = [
    'dashboard.*.view', 'master_data.*.view', 'sales.*.view', 'service.*.view',
    'inventory.*.view', 'finance.*.view', 'hr.*.view', 'purchasing.*.view',
    'users.*.view', 'roles.*.view',
  ];
  const moduleAccessByRole: Record<string, string[]> = {
    SUPERADMIN: moduleWildcards,
    OWNER: moduleWildcards,
    MU: ['dashboard.*.view', 'master_data.*.view', 'sales.*.view', 'service.*.view', 'inventory.*.view', 'finance.*.view', 'hr.*.view', 'purchasing.*.view'],
    MM: ['dashboard.*.view', 'master_data.*.view', 'sales.*.view', 'service.*.view'],
    MO: ['dashboard.*.view', 'master_data.*.view', 'sales.*.view', 'service.*.view', 'inventory.*.view', 'purchasing.*.view'],
    MS: ['dashboard.*.view', 'master_data.*.view', 'finance.*.view', 'hr.*.view', 'purchasing.*.view'],
    'SPV-MKT': ['dashboard.*.view', 'master_data.*.view', 'sales.*.view', 'service.*.view'],
    HS: ['dashboard.*.view', 'master_data.*.view', 'sales.*.view', 'service.*.view', 'inventory.*.view'],
    'SPV-SC': ['dashboard.*.view', 'master_data.*.view', 'sales.*.view', 'inventory.*.view', 'purchasing.*.view'],
    'SPV-FO': ['dashboard.*.view', 'master_data.*.view', 'sales.*.view', 'finance.*.view'],
    'SPV-HRD': ['dashboard.*.view', 'master_data.*.view', 'hr.*.view', 'users.*.view', 'roles.*.view'],
    'AS-SE': ['dashboard.*.view', 'sales.*.view'],
    'AS-SRV': ['dashboard.*.view', 'service.*.view'],
    SMO: ['dashboard.*.view', 'master_data.*.view', 'sales.*.view'],
    ADV: ['dashboard.*.view', 'sales.*.view'],
    SM: ['dashboard.*.view', 'master_data.*.view', 'sales.*.view'],
    CRM: ['dashboard.*.view', 'sales.*.view'],
    SE: ['dashboard.*.view', 'sales.*.view'],
    CR: ['dashboard.*.view', 'sales.*.view'],
    FL: ['dashboard.*.view', 'service.*.view'],
    CS: ['dashboard.*.view', 'master_data.*.view', 'sales.*.view', 'service.*.view'],
    TC: ['dashboard.*.view', 'service.*.view'],
    SODO: ['dashboard.*.view', 'service.*.view', 'inventory.*.view'],
    MP: ['dashboard.*.view', 'master_data.*.view', 'sales.*.view', 'inventory.*.view'],
    AO: ['dashboard.*.view', 'finance.*.view'],
    HR: ['dashboard.*.view', 'hr.*.view'],
    MT: ['dashboard.*.view', 'sales.*.view', 'service.*.view'],
    IT: ['dashboard.*.view', 'users.*.view'],
  };
  for (const [roleCode, keys] of Object.entries(moduleAccessByRole)) {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) continue;
    const merged = [...new Set([...role.defaultPermissions, ...keys])];
    if (merged.length !== role.defaultPermissions.length) {
      await prisma.role.update({
        where: { id: role.id },
        data: { defaultPermissions: merged },
      });
    }
  }
  console.log('✅ Module wildcard keys applied to roles');

  // Stock Request approvals (ORG-REAL): MU/MO replace MGR, SODO keeps its key.
  console.log('📝 Applying stock-request approval keys to roles...');
  const requestApproveByRole: Record<string, string[]> = {
    SUPERADMIN: ['inventory.request.approve'],
    OWNER: ['inventory.request.approve'],
    MU: ['inventory.request.approve'],
    MO: ['inventory.request.approve'],
    SODO: ['inventory.request.approve'],
  };
  for (const [roleCode, keys] of Object.entries(requestApproveByRole)) {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) continue;
    const merged = [...new Set([...role.defaultPermissions, ...keys])];
    if (merged.length !== role.defaultPermissions.length) {
      await prisma.role.update({
        where: { id: role.id },
        data: { defaultPermissions: merged },
      });
    }
  }
  console.log('✅ Stock-request approval keys applied to roles');

  // 3. Bootstrap users (ORG-REAL, empty-first: only the two login accounts)
  console.log('👤 Creating bootstrap users...');
  const superadminPassword = await hashPassword('SuperAdmin@1234');
  const existingSuperadmin = await prisma.user.findUnique({
    where: { email: 'superadmin@igdgroup.com' },
  });
  const superadmin = existingSuperadmin
    ? await prisma.user.update({
        where: { email: 'superadmin@igdgroup.com' },
        data: {
          passwordHash: superadminPassword, // Force update password
          fullName: 'Super Administrator',
          isActive: true,
          isVerified: true,
        },
      })
    : await prisma.user.create({
        data: {
          email: 'superadmin@igdgroup.com',
          username: 'superadmin',
          passwordHash: superadminPassword,
          fullName: 'Super Administrator',
          phone: '08000000000',
          isActive: true,
          isVerified: true,
        },
      });

  // OWNER user (Tier 1)
  const owner = await prisma.user.upsert({
    where: { email: 'owner@igdgroup.com' },
    update: {
      passwordHash: tier1Password,
      fullName: 'Budi Santoso',
    },
    create: {
      email: 'owner@igdgroup.com',
      username: 'owner',
      passwordHash: tier1Password,
      fullName: 'Budi Santoso',
      phone: '081234567890',
      isActive: true,
      isVerified: true,
    },
  });

  // 4. Assign bootstrap roles (superadmin + owner only)
  console.log('🔗 Assigning user roles...');
  
  // SUPERADMIN user role
  const superadminUserRole = await prisma.userBranch.findFirst({
    where: {
      userId: superadmin.id,
      roleId: superadminRole.id,
      branchId: branch1.id,
    },
  });

  if (!superadminUserRole) {
    await prisma.userBranch.create({
      data: {
        userId: superadmin.id,
        roleId: superadminRole.id,
        branchId: branch1.id,
        isPrimary: true,
      },
    });
  } else {
    await prisma.userBranch.update({
      where: { id: superadminUserRole.id },
      data: { isPrimary: true },
    });
  }

  // OWNER user role
  // For null branchId, we need to use a different approach
  const ownerUserRole = await prisma.userBranch.findFirst({
    where: {
      userId: owner.id,
      roleId: ownerRole.id,
      branchId: branch1.id,
    },
  });

  if (!ownerUserRole) {
    await prisma.userBranch.create({
      data: {
        userId: owner.id,
        roleId: ownerRole.id,
        branchId: branch1.id,
        isPrimary: true,
      },
    });
  } else {
    // Update to ensure it's primary
    await prisma.userBranch.update({
      where: { id: ownerUserRole.id },
      data: { isPrimary: true },
    });
  }

  console.log('📁 Creating categories...');
  await prisma.category.upsert({
    where: { code: 'CAT-ELEC' },
    update: {},
    create: {
      code: 'CAT-ELEC',
      name: 'Elektronik',
      description: 'Produk elektronik umum',
      isActive: true,
    },
  });

  const catPhone = await prisma.category.upsert({
    where: { code: 'CAT-PHONE' },
    update: {},
    create: {
      code: 'CAT-PHONE',
      name: 'Handphone',
      description: 'Smartphone dan aksesoris',
      isActive: true,
    },
  });

  const catLaptop = await prisma.category.upsert({
    where: { code: 'CAT-LAPTOP' },
    update: {},
    create: {
      code: 'CAT-LAPTOP',
      name: 'Laptop',
      description: 'Laptop dan komputer',
      isActive: true,
    },
  });

  const catSparepart = await prisma.category.upsert({
    where: { code: 'CAT-SPAREPART' },
    update: {},
    create: {
      code: 'CAT-SPAREPART',
      name: 'Sparepart',
      description: 'Sparepart untuk perbaikan handphone dan laptop',
      isActive: true,
    },
  });

  const catAccessories = await prisma.category.upsert({
    where: { code: 'CAT-ACCESSORIES' },
    update: {},
    create: {
      code: 'CAT-ACCESSORIES',
      name: 'Accessories',
      description: 'Aksesoris handphone dan laptop',
      isActive: true,
    },
  });

  // 6. Create Brands
  console.log('🏷️ Creating brands...');
  const brandSamsung = await prisma.brand.upsert({
    where: { code: 'BRAND-SAMSUNG' },
    update: {},
    create: {
      code: 'BRAND-SAMSUNG',
      name: 'Samsung',
      description: 'Samsung Electronics',
      isActive: true,
    },
  });

  const brandApple = await prisma.brand.upsert({
    where: { code: 'BRAND-APPLE' },
    update: {},
    create: {
      code: 'BRAND-APPLE',
      name: 'Apple',
      description: 'Apple Inc.',
      isActive: true,
    },
  });

  const brandAsus = await prisma.brand.upsert({
    where: { code: 'BRAND-ASUS' },
    update: {},
    create: {
      code: 'BRAND-ASUS',
      name: 'ASUS',
      description: 'ASUS Computer',
      isActive: true,
    },
  });

  const brandGeneric = await prisma.brand.upsert({
    where: { code: 'BRAND-GENERIC' },
    update: {},
    create: {
      code: 'BRAND-GENERIC',
      name: 'Generic',
      description: 'Brand generic untuk sparepart dan accessories',
      isActive: true,
    },
  });

  const brandXiaomi = await prisma.brand.upsert({
    where: { code: 'BRAND-XIAOMI' },
    update: {},
    create: {
      code: 'BRAND-XIAOMI',
      name: 'Xiaomi',
      description: 'Xiaomi Electronics',
      isActive: true,
    },
  });

  // 7. Create Units
  console.log('📦 Creating units...');
  const unitPcs = await prisma.unit.upsert({
    where: { code: 'PCS' },
    update: {},
    create: { code: 'PCS', name: 'pcs', isActive: true },
  });
  const unitService = await prisma.unit.upsert({
    where: { code: 'SERVICE' },
    update: {},
    create: { code: 'SERVICE', name: 'service', isActive: true },
  });

  // 7. Create Products
  console.log('📦 Creating products...');
  const products = [
    {
      sku: 'PROD-001',
      barcode: '8999999012345',
      name: 'Samsung Galaxy S24',
      categoryId: catPhone.id,
      brandId: brandSamsung.id,
      costPrice: 8000000,
      sellingPrice: 12000000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'Samsung Galaxy S24 256GB',
    },
    {
      sku: 'PROD-002',
      barcode: '8999999012346',
      name: 'iPhone 15 Pro',
      categoryId: catPhone.id,
      brandId: brandApple.id,
      costPrice: 15000000,
      sellingPrice: 20000000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'iPhone 15 Pro 256GB',
    },
    {
      sku: 'PROD-003',
      barcode: '8999999012347',
      name: 'ASUS ROG Strix G15',
      categoryId: catLaptop.id,
      brandId: brandAsus.id,
      costPrice: 12000000,
      sellingPrice: 18000000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'ASUS ROG Strix G15 Gaming Laptop',
    },
    {
      sku: 'PROD-004',
      barcode: '8999999012348',
      name: 'MacBook Pro M3',
      categoryId: catLaptop.id,
      brandId: brandApple.id,
      costPrice: 25000000,
      sellingPrice: 32000000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'MacBook Pro 14" M3 512GB',
    },
    // Spareparts
    {
      sku: 'SPR-001',
      barcode: '8999999013001',
      name: 'LCD iPhone 12/13/14 Original',
      categoryId: catSparepart.id,
      brandId: brandApple.id,
      costPrice: 800000,
      sellingPrice: 1500000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'LCD replacement untuk iPhone 12, 13, 14 - Original quality',
    },
    {
      sku: 'SPR-002',
      barcode: '8999999013002',
      name: 'Baterai Samsung Galaxy A Series',
      categoryId: catSparepart.id,
      brandId: brandSamsung.id,
      costPrice: 150000,
      sellingPrice: 300000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'Baterai replacement untuk Samsung Galaxy A51, A52, A53',
    },
    {
      sku: 'SPR-003',
      barcode: '8999999013003',
      name: 'Touchscreen Samsung S21/S22',
      categoryId: catSparepart.id,
      brandId: brandSamsung.id,
      costPrice: 600000,
      sellingPrice: 1200000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'Touchscreen digitizer untuk Samsung Galaxy S21 dan S22',
    },
    {
      sku: 'SPR-004',
      barcode: '8999999013004',
      name: 'Charging Port iPhone Universal',
      categoryId: catSparepart.id,
      brandId: brandGeneric.id,
      costPrice: 50000,
      sellingPrice: 150000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'Charging port replacement untuk iPhone berbagai model',
    },
    {
      sku: 'SPR-005',
      barcode: '8999999013005',
      name: 'Camera Module iPhone 12 Pro',
      categoryId: catSparepart.id,
      brandId: brandApple.id,
      costPrice: 1200000,
      sellingPrice: 2500000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'Camera module replacement untuk iPhone 12 Pro - Triple camera',
    },
    {
      sku: 'SPR-006',
      barcode: '8999999013006',
      name: 'Laptop Keyboard ASUS ROG',
      categoryId: catSparepart.id,
      brandId: brandAsus.id,
      costPrice: 400000,
      sellingPrice: 800000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'Keyboard replacement untuk ASUS ROG Strix series',
    },
    {
      sku: 'SPR-007',
      barcode: '8999999013007',
      name: 'Laptop Fan ASUS/TUF',
      categoryId: catSparepart.id,
      brandId: brandAsus.id,
      costPrice: 200000,
      sellingPrice: 450000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'Cooling fan untuk laptop ASUS TUF dan ROG series',
    },
    {
      sku: 'SPR-008',
      barcode: '8999999013008',
      name: 'Power IC Samsung A Series',
      categoryId: catSparepart.id,
      brandId: brandSamsung.id,
      costPrice: 100000,
      sellingPrice: 250000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'Power IC chip untuk Samsung Galaxy A51, A52, A53',
    },
    // Accessories
    {
      sku: 'ACC-001',
      barcode: '8999999014001',
      name: 'Case iPhone 14 Pro Max Premium',
      categoryId: catAccessories.id,
      brandId: brandGeneric.id,
      costPrice: 50000,
      sellingPrice: 150000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'Case premium dengan tempered glass untuk iPhone 14 Pro Max',
    },
    {
      sku: 'ACC-002',
      barcode: '8999999014002',
      name: 'Tempered Glass iPhone 12-15',
      categoryId: catAccessories.id,
      brandId: brandGeneric.id,
      costPrice: 15000,
      sellingPrice: 50000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'Tempered glass 9H untuk iPhone 12, 13, 14, 15 series',
    },
    {
      sku: 'ACC-003',
      barcode: '8999999014003',
      name: 'Charger Fast Charging 25W Samsung',
      categoryId: catAccessories.id,
      brandId: brandSamsung.id,
      costPrice: 80000,
      sellingPrice: 200000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'Fast charger 25W original Samsung dengan kabel USB-C',
    },
    {
      sku: 'ACC-004',
      barcode: '8999999014004',
      name: 'Wireless Charger Qi 15W',
      categoryId: catAccessories.id,
      brandId: brandGeneric.id,
      costPrice: 100000,
      sellingPrice: 250000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'Wireless charger Qi 15W universal untuk semua smartphone',
    },
    {
      sku: 'ACC-005',
      barcode: '8999999014005',
      name: 'Power Bank 20000mAh Fast Charge',
      categoryId: catAccessories.id,
      brandId: brandXiaomi.id,
      costPrice: 200000,
      sellingPrice: 450000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'Power bank 20000mAh dengan fast charging dan USB-C',
    },
    {
      sku: 'ACC-006',
      barcode: '8999999014006',
      name: 'Earbuds TWS Bluetooth 5.0',
      categoryId: catAccessories.id,
      brandId: brandGeneric.id,
      costPrice: 150000,
      sellingPrice: 350000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'True Wireless Earbuds dengan Bluetooth 5.0 dan charging case',
    },
    {
      sku: 'ACC-007',
      barcode: '8999999014007',
      name: 'Laptop Stand Aluminium',
      categoryId: catAccessories.id,
      brandId: brandGeneric.id,
      costPrice: 80000,
      sellingPrice: 180000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'Laptop stand aluminium adjustable untuk ergonomi',
    },
    {
      sku: 'ACC-008',
      barcode: '8999999014008',
      name: 'Laptop Cooling Pad RGB',
      categoryId: catAccessories.id,
      brandId: brandGeneric.id,
      costPrice: 120000,
      sellingPrice: 280000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'Cooling pad laptop dengan 5 fan dan RGB lighting',
    },
    {
      sku: 'ACC-009',
      barcode: '8999999014009',
      name: 'USB-C Hub 7 in 1',
      categoryId: catAccessories.id,
      brandId: brandGeneric.id,
      costPrice: 150000,
      sellingPrice: 350000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'USB-C hub dengan HDMI, USB 3.0, SD card reader, dan charging',
    },
    {
      sku: 'ACC-010',
      barcode: '8999999014010',
      name: 'Screen Protector Laptop 15.6"',
      categoryId: catAccessories.id,
      brandId: brandGeneric.id,
      costPrice: 50000,
      sellingPrice: 120000,
      unitId: unitPcs.id,
      isActive: true,
      description: 'Screen protector anti-glare untuk laptop 15.6 inch',
    },
    // Service Products (Jasa)
    {
      sku: 'SVC-001',
      barcode: null,
      name: 'Jasa Ganti LCD/Layar',
      categoryId: catSparepart.id,
      brandId: brandGeneric.id,
      costPrice: 0,
      sellingPrice: 500000,
      unitId: unitService.id,
      isService: true,
      isActive: true,
      description: 'Jasa penggantian LCD atau layar perangkat',
    },
    {
      sku: 'SVC-002',
      barcode: null,
      name: 'Jasa Ganti Baterai',
      categoryId: catSparepart.id,
      brandId: brandGeneric.id,
      costPrice: 0,
      sellingPrice: 300000,
      unitId: unitService.id,
      isService: true,
      isActive: true,
      description: 'Jasa penggantian baterai perangkat',
    },
    {
      sku: 'SVC-003',
      barcode: null,
      name: 'Jasa Service Software',
      categoryId: catSparepart.id,
      brandId: brandGeneric.id,
      costPrice: 0,
      sellingPrice: 200000,
      unitId: unitService.id,
      isService: true,
      isActive: true,
      description: 'Jasa perbaikan software, install ulang, dll',
    },
    {
      sku: 'SVC-004',
      barcode: null,
      name: 'Jasa Service Hardware',
      categoryId: catSparepart.id,
      brandId: brandGeneric.id,
      costPrice: 0,
      sellingPrice: 800000,
      unitId: unitService.id,
      isService: true,
      isActive: true,
      description: 'Jasa perbaikan komponen hardware',
    },
  ];

  const createdProducts = [];
  for (const product of products) {
    const created = await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    });
    createdProducts.push(created);
  }

  // 8. Create Product Stocks
  console.log('📊 Creating product stocks...');
  for (const product of createdProducts) {
    // Determine stock based on product type
    let stockQty = 50;
    let reorderPoint = 10;
    
    // Spareparts usually have lower stock
    if (product.sku.startsWith('SPR-')) {
      stockQty = 15;
      reorderPoint = 5;
    }
    // Accessories have higher stock
    else if (product.sku.startsWith('ACC-')) {
      stockQty = 30;
      reorderPoint = 10;
    }

    // Create stock for all branch warehouses
    for (const [branch, warehouse] of [
      [branch1, warehouse1],
      [branch2, warehouse2],
    ] as const) {
      await prisma.productStock.upsert({
        where: {
          productId_warehouseId: {
            productId: product.id,
            warehouseId: warehouse.id,
          },
        },
        update: {},
        create: {
          productId: product.id,
          warehouseId: warehouse.id,
          branchId: branch.id,
          quantityAvailable: stockQty,
          reorderPoint: reorderPoint,
          maxStock: stockQty * 2,
        },
      });
    }
  }

  // 9. Create Customer Tiers
  console.log('👥 Creating customer tiers...');
  const tierRegular = await prisma.customerTier.upsert({
    where: { code: 'REGULAR' },
    update: {},
    create: {
      code: 'REGULAR',
      name: 'Regular',
      description: 'Pelanggan regular',
      discountPercentage: 0,
      creditLimit: 0,
      isActive: true,
    },
  });

  const tierSilver = await prisma.customerTier.upsert({
    where: { code: 'SILVER' },
    update: {},
    create: {
      code: 'SILVER',
      name: 'Silver',
      description: 'Pelanggan silver',
      discountPercentage: 5,
      creditLimit: 5000000,
      isActive: true,
    },
  });

  const tierGold = await prisma.customerTier.upsert({
    where: { code: 'GOLD' },
    update: {},
    create: {
      code: 'GOLD',
      name: 'Gold',
      description: 'Pelanggan gold',
      discountPercentage: 10,
      creditLimit: 10000000,
      isActive: true,
    },
  });

  const tierPlatinum = await prisma.customerTier.upsert({
    where: { code: 'PLATINUM' },
    update: {},
    create: {
      code: 'PLATINUM',
      name: 'Platinum',
      description: 'Pelanggan platinum',
      discountPercentage: 15,
      creditLimit: 20000000,
      isActive: true,
    },
  });

  // 10. Create Customers
  console.log('👤 Creating customers...');
  const customers = [
    {
      customerCode: 'CUST-001',
      customerType: 'retail',
      tierId: tierGold.id,
      name: 'Budi Santoso',
      email: 'budi@example.com',
      phone: '081234567890',
      alternatePhone: '081234567891',
      dateOfBirth: new Date('1990-05-15'),
      gender: 'L',
      address: 'Jl. Merdeka No. 123',
      subdistrict: 'Kaliwates',
      city: 'Jember',
      province: 'Jawa Timur',
      postalCode: '68131',
      country: 'Indonesia',
      religion: 'Islam',
      idType: 'KTP',
      idNumber: '3509123456789012',
      taxId: '12.345.678.9-012.000',
      taxName: 'Budi Santoso',
      taxIdType: 'NPWP',
      taxAddress: 'Jl. Merdeka No. 123, Kaliwates, Jember',
      idTKU: 'TKU-001',
      taxTransactionDetail: '01',
      creditLimit: new Decimal(10000000),
      creditLimitNoteCount: 5,
      paymentTermDays: 30,
      preferredBranchId: branch1.id,
      notes: 'Pelanggan setia, sering belanja aksesoris',
      isActive: true,
    },
    {
      customerCode: 'CUST-002',
      customerType: 'retail',
      tierId: tierSilver.id,
      name: 'Siti Nurhaliza',
      email: 'siti@example.com',
      phone: '081234567891',
      alternatePhone: '081234567892',
      dateOfBirth: new Date('1992-08-20'),
      gender: 'P',
      address: 'Jl. Sudirman No. 456',
      subdistrict: 'Patrang',
      city: 'Jember',
      province: 'Jawa Timur',
      postalCode: '68118',
      country: 'Indonesia',
      religion: 'Islam',
      idType: 'KTP',
      idNumber: '3509123456789013',
      taxId: '12.345.678.9-013.000',
      taxName: 'Siti Nurhaliza',
      taxIdType: 'NPWP',
      taxAddress: 'Jl. Sudirman No. 456, Patrang, Jember',
      idTKU: 'TKU-002',
      taxTransactionDetail: '01',
      creditLimit: new Decimal(5000000),
      creditLimitNoteCount: 3,
      paymentTermDays: 15,
      preferredBranchId: branch1.id,
      notes: 'Suka produk premium',
      isActive: true,
    },
    {
      customerCode: 'CUST-003',
      customerType: 'wholesale',
      tierId: tierPlatinum.id,
      name: 'PT Maju Jaya',
      email: 'info@majujaya.com',
      phone: '081234567892',
      alternatePhone: '081234567893',
      address: 'Jl. Gatot Subroto No. 789',
      subdistrict: 'Gubeng',
      city: 'Surabaya',
      province: 'Jawa Timur',
      postalCode: '60281',
      country: 'Indonesia',
      taxId: '01.234.567.8-901.000',
      taxName: 'PT Maju Jaya',
      taxIdType: 'NPWP',
      taxAddress: 'Jl. Gatot Subroto No. 789, Gubeng, Surabaya',
      idTKU: 'TKU-003',
      taxTransactionDetail: '01',
      creditLimit: new Decimal(50000000),
      creditLimitNoteCount: 10,
      paymentTermDays: 60,
      preferredBranchId: branch2.id,
      notes: 'Distributor besar, order rutin bulanan',
      isActive: true,
    },
    {
      customerCode: 'CUST-004',
      customerType: 'retail',
      tierId: tierRegular.id,
      name: 'Ahmad Fauzi',
      email: 'ahmad@example.com',
      phone: '081234567894',
      dateOfBirth: new Date('1988-03-10'),
      gender: 'L',
      address: 'Jl. Diponegoro No. 321',
      subdistrict: 'Sumbersari',
      city: 'Jember',
      province: 'Jawa Timur',
      postalCode: '68124',
      country: 'Indonesia',
      religion: 'Islam',
      idType: 'KTP',
      idNumber: '3509123456789014',
      preferredBranchId: branch1.id,
      isActive: true,
    },
    {
      customerCode: 'CUST-005',
      customerType: 'retail',
      tierId: tierGold.id,
      name: 'Dewi Sartika',
      email: 'dewi@example.com',
      phone: '081234567895',
      alternatePhone: '081234567896',
      dateOfBirth: new Date('1995-11-25'),
      gender: 'P',
      address: 'Jl. Hayam Wuruk No. 654',
      subdistrict: 'Kaliwates',
      city: 'Jember',
      province: 'Jawa Timur',
      postalCode: '68131',
      country: 'Indonesia',
      religion: 'Islam',
      idType: 'KTP',
      idNumber: '3509123456789015',
      creditLimit: new Decimal(15000000),
      creditLimitNoteCount: 7,
      paymentTermDays: 30,
      preferredBranchId: branch1.id,
      notes: 'VIP customer, sering belanja gadget baru',
      isActive: true,
    },
  ];

  const createdCustomers = [];
  for (const customer of customers) {
    const created = await prisma.customer.upsert({
      where: { customerCode: customer.customerCode },
      update: {},
      create: customer,
    });
    createdCustomers.push(created);
  }

  // 11. Create Suppliers (using Customer model with customerType='wholesale')
  console.log('🏢 Creating suppliers...');
  const suppliers = [
    {
      customerCode: 'SUP-001',
      customerType: 'wholesale',
      name: 'PT Distributor Elektronik',
      phone: '031-1234567',
      email: 'info@distelektronik.com',
      address: 'Jl. Raya Surabaya No. 100',
      subdistrict: 'Gubeng',
      city: 'Surabaya',
      province: 'Jawa Timur',
      postalCode: '60281',
      country: 'Indonesia',
      taxId: '01.234.567.8-900.000',
      taxName: 'PT Distributor Elektronik',
      taxIdType: 'NPWP',
      taxAddress: 'Jl. Raya Surabaya No. 100, Gubeng, Surabaya',
      idTKU: 'TKU-SUP-001',
      taxTransactionDetail: '01',
      creditLimit: new Decimal(100000000),
      creditLimitNoteCount: 20,
      paymentTermDays: 90,
      preferredBranchId: branch1.id,
      notes: 'Supplier utama untuk produk elektronik',
      isActive: true,
    },
    {
      customerCode: 'SUP-002',
      customerType: 'wholesale',
      name: 'CV Handphone Jaya',
      phone: '0331-7654321',
      email: 'sales@hpjaya.com',
      address: 'Jl. Sudirman No. 200',
      subdistrict: 'Kaliwates',
      city: 'Jember',
      province: 'Jawa Timur',
      postalCode: '68131',
      country: 'Indonesia',
      taxId: '12.345.678.9-900.000',
      taxName: 'CV Handphone Jaya',
      taxIdType: 'NPWP',
      taxAddress: 'Jl. Sudirman No. 200, Kaliwates, Jember',
      idTKU: 'TKU-SUP-002',
      taxTransactionDetail: '01',
      creditLimit: new Decimal(50000000),
      creditLimitNoteCount: 15,
      paymentTermDays: 60,
      preferredBranchId: branch1.id,
      notes: 'Supplier handphone lokal',
      isActive: true,
    },
    {
      customerCode: 'SUP-003',
      customerType: 'wholesale',
      name: 'PT Laptop Indonesia',
      phone: '021-9876543',
      email: 'order@laptopindo.com',
      address: 'Jl. Thamrin No. 50',
      subdistrict: 'Menteng',
      city: 'Jakarta',
      province: 'DKI Jakarta',
      postalCode: '10310',
      country: 'Indonesia',
      taxId: '01.234.567.8-901.000',
      taxName: 'PT Laptop Indonesia',
      taxIdType: 'NPWP',
      taxAddress: 'Jl. Thamrin No. 50, Menteng, Jakarta',
      idTKU: 'TKU-SUP-003',
      taxTransactionDetail: '01',
      creditLimit: new Decimal(200000000),
      creditLimitNoteCount: 30,
      paymentTermDays: 90,
      preferredBranchId: branch1.id,
      notes: 'Supplier laptop dan komputer',
      isActive: true,
    },
  ];

  for (const supplier of suppliers) {
    await prisma.customer.upsert({
      where: { customerCode: supplier.customerCode },
      update: {},
      create: supplier,
    });
  }

  // 12. Create Service Types
  console.log('🔧 Creating service types...');
  const serviceTypes = [
    {
      code: 'SVC-INTERFACE',
      name: 'Interface',
      description: 'Perbaikan interface dan konektivitas perangkat',
      basePrice: 400000,
      slaHours: 24,
      isActive: true,
    },
    {
      code: 'SVC-HARDWARE',
      name: 'Hardware',
      description: 'Perbaikan komponen hardware perangkat',
      basePrice: 800000,
      slaHours: 48,
      isActive: true,
    },
    {
      code: 'SVC-SOFTWARE',
      name: 'Software',
      description: 'Perbaikan software, install ulang, dan optimasi sistem',
      basePrice: 200000,
      slaHours: 6,
      isActive: true,
    },
  ];

  const createdServiceTypes = [];
  for (const st of serviceTypes) {
    const created = await prisma.serviceType.upsert({
      where: { code: st.code },
      update: {},
      create: st,
    });
    createdServiceTypes.push(created);
  }

  // 13. Create Service Orders with Parts Usage
  console.log('🔧 Creating service orders with parts usage...');
  const createdServiceOrders = [];
  if (createdCustomers.length > 0 && createdServiceTypes.length > 0 && createdProducts.length > 0) {
    // Find sparepart products for service usage
    const sparepartProducts = createdProducts.filter(p => p.sku.startsWith('SPR-'));
    
    const serviceOrders = [
      {
        serviceNumber: 'SRV-20250115-0001',
        branchId: branch1.id,
        customerId: createdCustomers[0].id,
        serviceTypeId: createdServiceTypes[0].id,
        customerName: createdCustomers[0].name,
        customerPhone: createdCustomers[0].phone,
        customerEmail: createdCustomers[0].email,
        deviceType: 'handphone',
        deviceUnit: 'Samsung Galaxy S24',
        deviceSerial: 'SN123456789',
        complaint: 'LCD pecah, touchscreen tidak responsif',
        estimatedCost: new Decimal(1500000),
        priority: 'urgent',
        status: 'pending',
        createdBy: owner.id,
        parts: [] as any[],
      },
      {
        serviceNumber: 'SRV-20250116-0002',
        branchId: branch1.id,
        customerId: createdCustomers[1].id,
        serviceTypeId: createdServiceTypes[1].id,
        customerName: createdCustomers[1].name,
        customerPhone: createdCustomers[1].phone,
        customerEmail: createdCustomers[1].email,
        deviceType: 'laptop',
        deviceUnit: 'ASUS ROG Strix G15',
        deviceSerial: 'SN987654321',
        complaint: 'Baterai cepat habis, perlu ganti baterai',
        estimatedCost: new Decimal(500000),
        priority: 'normal',
        status: 'in_progress',
        createdBy: owner.id,
        parts: sparepartProducts.length > 0 ? [{ productId: sparepartProducts[0].id, qty: 1, price: Number(sparepartProducts[0].sellingPrice) }] : [],
      },
      {
        serviceNumber: 'SRV-20250117-0003',
        branchId: branch1.id,
        customerId: createdCustomers[0].id,
        serviceTypeId: createdServiceTypes[2].id,
        customerName: createdCustomers[0].name,
        customerPhone: createdCustomers[0].phone,
        customerEmail: createdCustomers[0].email,
        deviceType: 'handphone',
        deviceUnit: 'Apple iPhone 15 Pro',
        deviceSerial: 'SN456789123',
        complaint: 'Software error, perlu install ulang',
        estimatedCost: new Decimal(300000),
        priority: 'normal',
        status: 'completed',
        createdBy: owner.id,
        parts: [] as any[],
      },
      {
        serviceNumber: 'SRV-20250118-0004',
        branchId: branch1.id,
        customerId: createdCustomers[2].id,
        serviceTypeId: createdServiceTypes[0].id,
        customerName: createdCustomers[2].name,
        customerPhone: createdCustomers[2].phone,
        customerEmail: createdCustomers[2].email,
        deviceType: 'handphone',
        deviceUnit: 'Samsung Galaxy S21',
        deviceSerial: 'SN111222333',
        complaint: 'LCD retak, perlu ganti LCD original',
        estimatedCost: new Decimal(1200000),
        priority: 'normal',
        status: 'completed',
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        deliveredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        createdBy: owner.id,
        parts: sparepartProducts.length > 2 ? [
          { productId: sparepartProducts[2].id, qty: 1, price: Number(sparepartProducts[2].sellingPrice) },
        ] : [],
      },
      {
        serviceNumber: 'SRV-20250119-0005',
        branchId: branch1.id,
        customerId: createdCustomers[1].id,
        serviceTypeId: createdServiceTypes[1].id,
        customerName: createdCustomers[1].name,
        customerPhone: createdCustomers[1].phone,
        customerEmail: createdCustomers[1].email,
        deviceType: 'handphone',
        deviceUnit: 'Apple iPhone 12 Pro',
        deviceSerial: 'SN444555666',
        complaint: 'Camera tidak berfungsi, perlu ganti camera module',
        estimatedCost: new Decimal(2500000),
        priority: 'normal',
        status: 'delivered',
        completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        deliveredAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
        createdBy: owner.id,
        parts: sparepartProducts.length > 4 ? [
          { productId: sparepartProducts[4].id, qty: 1, price: Number(sparepartProducts[4].sellingPrice) },
        ] : [],
      },
    ];

    for (const so of serviceOrders) {
      const { parts, ...soData } = so;
      
      // Use upsert to handle existing service orders
      const created = await prisma.serviceOrder.upsert({
        where: { serviceNumber: so.serviceNumber },
        update: {
          status: so.status,
          estimatedCost: so.estimatedCost,
          priority: so.priority,
        },
        create: {
          ...soData,
          receivedDate: so.completedAt ? new Date(so.completedAt.getTime() - 3 * 24 * 60 * 60 * 1000) : new Date(),
          slaDueDate: so.completedAt ? new Date(so.completedAt.getTime() - 1 * 24 * 60 * 60 * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      createdServiceOrders.push(created);

      // Create service parts used
      if (parts && parts.length > 0) {
        for (const part of parts) {
          const existingPart = await prisma.servicePartsUsed.findFirst({
            where: {
              serviceOrderId: created.id,
              productId: part.productId,
            },
          });

          if (!existingPart) {
            const product = sparepartProducts.find(p => p.id === part.productId);
            const unitCost = product ? Number(product.costPrice) : 0;
            const unitPrice = Number(part.price);
            const totalCost = unitCost * part.qty;
            const totalPrice = unitPrice * part.qty;
            
            await prisma.servicePartsUsed.create({
              data: {
                serviceOrderId: created.id,
                productId: part.productId,
                purchaseType: 'internal',
                quantity: new Decimal(part.qty),
                unitCost: new Decimal(unitCost),
                unitPrice: new Decimal(unitPrice),
                totalCost: new Decimal(totalCost),
                totalPrice: new Decimal(totalPrice),
                notes: 'Parts used for service',
              },
            });
          }
        }
      }

      // Check if status history already exists
      const existingHistory = await prisma.serviceStatusHistory.findFirst({
        where: {
          serviceOrderId: created.id,
          status: so.status,
        },
      });

      // Create status history only if it doesn't exist
      if (!existingHistory) {
        await prisma.serviceStatusHistory.create({
          data: {
            serviceOrderId: created.id,
            status: so.status,
            notes: 'Service order created',
            changedBy: owner.id,
          },
        });
      }
    }
  }

  // 14. Create Sales Transactions with Multiple Products
  console.log('💰 Creating sales transactions...');
  const createdTransactions = [];
  if (createdProducts.length > 0 && createdCustomers.length > 0) {
    // Filter non-service products for sales
    const salesProducts = createdProducts.filter(p => !p.isService);
    
    const salesTransactions = [
      {
        transactionNumber: 'TRX-20250115-0001',
        transactionType: 'pos',
        branchId: branch1.id,
        customerId: createdCustomers[0].id,
        cashierId: owner.id,
        status: 'completed',
        subtotal: new Decimal(12000000),
        discountAmount: new Decimal(0),
        taxAmount: new Decimal(1320000),
        taxPercentage: new Decimal(11),
        total: new Decimal(13320000),
        paymentStatus: 'paid',
        items: salesProducts.length > 0 ? [
          { productId: salesProducts[0].id, qty: 1, price: Number(salesProducts[0].sellingPrice) },
        ] : [],
      },
      {
        transactionNumber: 'TRX-20250116-0002',
        transactionType: 'pos',
        branchId: branch1.id,
        customerId: createdCustomers[1].id,
        cashierId: owner.id,
        status: 'completed',
        subtotal: new Decimal(20000000),
        discountAmount: new Decimal(2000000),
        taxAmount: new Decimal(1980000),
        taxPercentage: new Decimal(11),
        total: new Decimal(19980000),
        paymentStatus: 'paid',
        items: salesProducts.length > 1 ? [
          { productId: salesProducts[1].id, qty: 1, price: Number(salesProducts[1].sellingPrice) },
        ] : [],
      },
      {
        transactionNumber: 'TRX-20250117-0003',
        transactionType: 'pos',
        branchId: branch1.id,
        customerId: createdCustomers[0].id,
        cashierId: owner.id,
        status: 'completed',
        subtotal: new Decimal(18000000),
        discountAmount: new Decimal(0),
        taxAmount: new Decimal(1980000),
        taxPercentage: new Decimal(11),
        total: new Decimal(19980000),
        paymentStatus: 'paid',
        items: salesProducts.length > 2 ? [
          { productId: salesProducts[2].id, qty: 1, price: Number(salesProducts[2].sellingPrice) },
        ] : [],
      },
      {
        transactionNumber: 'TRX-20250118-0004',
        transactionType: 'pos',
        branchId: branch1.id,
        customerId: createdCustomers[2].id,
        cashierId: owner.id,
        status: 'completed',
        subtotal: new Decimal(350000),
        discountAmount: new Decimal(0),
        taxAmount: new Decimal(38500),
        taxPercentage: new Decimal(11),
        total: new Decimal(388500),
        paymentStatus: 'paid',
        items: salesProducts.length > 5 ? [
          { productId: salesProducts[5].id, qty: 1, price: Number(salesProducts[5].sellingPrice) },
        ] : [],
      },
      {
        transactionNumber: 'TRX-20250119-0005',
        transactionType: 'pos',
        branchId: branch1.id,
        customerId: createdCustomers[3].id,
        cashierId: owner.id,
        status: 'completed',
        subtotal: new Decimal(1500000),
        discountAmount: new Decimal(0),
        taxAmount: new Decimal(165000),
        taxPercentage: new Decimal(11),
        total: new Decimal(1665000),
        paymentStatus: 'paid',
        items: salesProducts.length > 6 ? [
          { productId: salesProducts[6].id, qty: 1, price: Number(salesProducts[6].sellingPrice) },
        ] : [],
      },
    ];

    for (const st of salesTransactions) {
      const { items, ...stData } = st;
      
      // Use upsert to handle existing transactions
      const created = await prisma.salesTransaction.upsert({
        where: { transactionNumber: st.transactionNumber },
        update: {
          status: st.status,
          paymentStatus: st.paymentStatus,
        },
        create: stData,
      });
      createdTransactions.push(created);

      // Create transaction items
      if (items && items.length > 0) {
        for (const item of items) {
          const existingItem = await prisma.salesTransactionItem.findFirst({
            where: {
              transactionId: created.id,
              productId: item.productId,
            },
          });

          if (!existingItem) {
            const product = salesProducts.find(p => p.id === item.productId);
            if (product) {
              await prisma.salesTransactionItem.create({
                data: {
                  transactionId: created.id,
                  productId: item.productId,
                  productName: product.name,
                  productSku: product.sku,
                  quantity: new Decimal(item.qty),
                  unitPrice: new Decimal(item.price),
                  discountAmount: new Decimal(0),
                  subtotal: new Decimal(Number(item.price) * item.qty),
                },
              });
            }
          }
        }
      }
    }
  }

  // 15. Seed Chart of Accounts
  console.log('💰 Seeding Chart of Accounts...');
  const coaStructure = [
    // ASSETS (1xxxx)
    { code: '10000', name: 'Current Assets', accountType: 'ASSET', parentCode: null, isHeader: true },
    { code: '10100', name: 'Cash', accountType: 'ASSET', parentCode: '10000', isHeader: true },
    { code: '10101', name: 'Cash - Jember', accountType: 'ASSET', parentCode: '10100', isHeader: false },
    { code: '10102', name: 'Cash - Kalisat', accountType: 'ASSET', parentCode: '10100', isHeader: false },
    { code: '10200', name: 'Bank', accountType: 'ASSET', parentCode: '10000', isHeader: true },
    { code: '10201', name: 'Bank BCA', accountType: 'ASSET', parentCode: '10200', isHeader: false },
    { code: '10202', name: 'Bank Mandiri', accountType: 'ASSET', parentCode: '10200', isHeader: false },
    { code: '10300', name: 'Accounts Receivable', accountType: 'ASSET', parentCode: '10000', isHeader: false },
    { code: '10400', name: 'Inventory', accountType: 'ASSET', parentCode: '10000', isHeader: false },
    { code: '12000', name: 'Fixed Assets', accountType: 'ASSET', parentCode: null, isHeader: true },
    { code: '12100', name: 'Equipment', accountType: 'ASSET', parentCode: '12000', isHeader: false },
    { code: '12200', name: 'Furniture', accountType: 'ASSET', parentCode: '12000', isHeader: false },

    // LIABILITIES (2xxxx)
    { code: '20000', name: 'Current Liabilities', accountType: 'LIABILITY', parentCode: null, isHeader: true },
    { code: '20100', name: 'Accounts Payable', accountType: 'LIABILITY', parentCode: '20000', isHeader: false },
    { code: '20200', name: 'Accrued Expenses', accountType: 'LIABILITY', parentCode: '20000', isHeader: false },
    { code: '21000', name: 'Long-term Liabilities', accountType: 'LIABILITY', parentCode: null, isHeader: true },

    // EQUITY (3xxxx)
    { code: '30000', name: "Owner's Equity", accountType: 'EQUITY', parentCode: null, isHeader: false },
    { code: '31000', name: 'Retained Earnings', accountType: 'EQUITY', parentCode: null, isHeader: false },

    // REVENUE (4xxxx)
    { code: '40000', name: 'Sales Revenue', accountType: 'REVENUE', parentCode: null, isHeader: true },
    { code: '40100', name: 'Product Sales', accountType: 'REVENUE', parentCode: '40000', isHeader: false },
    { code: '40200', name: 'Service Revenue', accountType: 'REVENUE', parentCode: '40000', isHeader: false },
    { code: '41000', name: 'Other Income', accountType: 'REVENUE', parentCode: null, isHeader: false },

    // EXPENSES (5xxxx)
    { code: '50000', name: 'Cost of Goods Sold', accountType: 'EXPENSE', parentCode: null, isHeader: false },
    { code: '51000', name: 'Operating Expenses', accountType: 'EXPENSE', parentCode: null, isHeader: true },
    { code: '51100', name: 'Salaries', accountType: 'EXPENSE', parentCode: '51000', isHeader: false },
    { code: '51200', name: 'Rent', accountType: 'EXPENSE', parentCode: '51000', isHeader: false },
    { code: '51300', name: 'Utilities', accountType: 'EXPENSE', parentCode: '51000', isHeader: false },
    { code: '51400', name: 'Marketing', accountType: 'EXPENSE', parentCode: '51000', isHeader: false },
    { code: '51500', name: 'Maintenance', accountType: 'EXPENSE', parentCode: '51000', isHeader: false },
    { code: '52000', name: 'Other Expenses', accountType: 'EXPENSE', parentCode: null, isHeader: false },
  ];

  for (const item of coaStructure) {
    const existing = await prisma.chartOfAccount.findUnique({
      where: { code: item.code },
    });

    if (!existing) {
      let parentId = null;
      if (item.parentCode) {
        const parent = await prisma.chartOfAccount.findUnique({
          where: { code: item.parentCode },
        });
        if (parent) {
          parentId = parent.id;
        }
      }

      await prisma.chartOfAccount.create({
        data: {
          code: item.code,
          name: item.name,
          accountType: item.accountType,
          parentId,
          isHeader: item.isHeader,
          isActive: true,
        },
      });
    }
  }
  console.log('✅ Chart of Accounts seeded');

  // 16. Create Departments — ORG-REAL (IGDERP-237)
  console.log('🏢 Creating departments...');
  await prisma.department.upsert({
    where: { code: 'DEPT-MKT' },
    update: { name: 'Marketing', isActive: true },
    create: { code: 'DEPT-MKT', name: 'Marketing', isActive: true },
  });
  await prisma.department.upsert({
    where: { code: 'DEPT-OPS' },
    update: { name: 'Operasional & Toko', isActive: true },
    create: { code: 'DEPT-OPS', name: 'Operasional & Toko', isActive: true },
  });
  await prisma.department.upsert({
    where: { code: 'DEPT-SC' },
    update: { name: 'Supply Chain', isActive: true },
    create: { code: 'DEPT-SC', name: 'Supply Chain', isActive: true },
  });
  await prisma.department.upsert({
    where: { code: 'DEPT-FIN' },
    update: { name: 'Finance & Accounting', isActive: true },
    create: { code: 'DEPT-FIN', name: 'Finance & Accounting', isActive: true },
  });
  await prisma.department.upsert({
    where: { code: 'DEPT-HRD' },
    update: { name: 'Human Resource Development', isActive: true },
    create: { code: 'DEPT-HRD', name: 'Human Resource Development', isActive: true },
  });
  console.log('🔄 Creating service returns...');
  if (createdServiceOrders.length > 0) {
    // Find a completed/delivered service order for return
    const completedServiceOrder = createdServiceOrders.find(so => 
      so.status === 'completed' || so.status === 'delivered'
    );

    if (completedServiceOrder) {
      await prisma.serviceReturn.upsert({
        where: { returnNumber: 'RET-SRV-20250120-0001' },
        update: {},
        create: {
          returnNumber: 'RET-SRV-20250120-0001',
          serviceOrderId: completedServiceOrder.id,
          returnType: 'complaint',
          returnReason: 'Service tidak sesuai ekspektasi, hasil perbaikan kurang memuaskan',
          customerComplaint: 'Setelah service, masih ada masalah dengan layar yang diganti',
          isWithinWarranty: true,
          isWithinReturnPeriod: true,
          status: 'pending',
          returnedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          createdBy: owner.id,
        },
      });
    }
  }

  // ============================================
  // SERVICE CHECKPOINTS (Kelengkapan)
  // ============================================
  console.log('☑️ Creating service checkpoints (Kelengkapan)...');

  const defaultCheckpoints = [
    'Slot SIM',
    'Speaker Atas',
    'Tombol',
    'Back casing',
    'SIM',
    'Memory Card',
    'LCD',
    'Kamera',
    'Mic Speaker',
    'Buzzer',
  ];

  for (let i = 0; i < defaultCheckpoints.length; i++) {
    const name = defaultCheckpoints[i];
    const existing = await prisma.serviceCheckpoint.findFirst({
      where: { name },
    });
    if (!existing) {
      await prisma.serviceCheckpoint.create({
        data: {
          name,
          isActive: true,
          sortOrder: i,
        },
      });
    }
  }

  console.log('✅ Service checkpoints created');

  // IGDERP-169: device type master (strict source for intake — codes stay stable)
  console.log('📱 Creating device types...');
  const defaultDeviceTypes = [
    { code: 'handphone', name: 'Handphone', sortOrder: 0 },
    { code: 'tablet', name: 'Tablet', sortOrder: 1 },
    { code: 'laptop', name: 'Laptop', sortOrder: 2 },
    { code: 'smartwatch', name: 'Smartwatch', sortOrder: 3 },
  ];
  for (const dt of defaultDeviceTypes) {
    const existing = await prisma.deviceType.findFirst({ where: { code: dt.code } });
    if (!existing) {
      await prisma.deviceType.create({ data: { ...dt, isActive: true } });
    }
  }
  console.log('✅ Device types created');

  console.log('✅ Database seed completed!');
  console.log('✅ Database seed completed!');
  console.log('\n📋 Seed accounts (ORG-REAL, empty-first):');
  console.log('  👑 Super Administrator : superadmin@igdgroup.com / SuperAdmin@1234');
  console.log('  👑 Owner               : owner@igdgroup.com / Owner@1234');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

