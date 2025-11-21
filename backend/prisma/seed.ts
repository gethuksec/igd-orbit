import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log('🌱 Starting database seed...');

  // Hash passwords based on tier/level
  // Tier 1 (Highest): Owner, CFO
  const tier1Password = await hashPassword('Owner@1234');
  // Tier 2: Manager, Regional Manager, CSO, CMO, CHR
  const tier2Password = await hashPassword('Manager@1234');
  // Tier 3: Supervisor, Head of Store
  const tier3Password = await hashPassword('Supervisor@1234');
  // Tier 4: Staff level (CS, AR, SODO, ASA, SMO, AS, CR, TC)
  const tier4Password = await hashPassword('Staff@1234');

  // 1. Create Branches
  console.log('📦 Creating branches...');
  const branch1 = await prisma.branch.upsert({
    where: { code: 'BR-001' },
    update: {
      name: 'IGD Jember Pusat',
      type: 'store',
      phone: '0331-123456',
      email: 'jember.pusat@igdgroup.com',
      address: 'Jl. Sudirman No. 123',
      city: 'Jember',
      province: 'Jawa Timur',
      isActive: true,
      isWarehouse: true,
    },
    create: {
      code: 'BR-001',
      name: 'IGD Jember Pusat',
      type: 'store',
      phone: '0331-123456',
      email: 'jember.pusat@igdgroup.com',
      address: 'Jl. Sudirman No. 123',
      city: 'Jember',
      province: 'Jawa Timur',
      isActive: true,
      isWarehouse: true,
    },
  });

  const branch2 = await prisma.branch.upsert({
    where: { code: 'BR-002' },
    update: {
      name: 'IGD Jember Kalisat',
      type: 'store',
      phone: '0331-234567',
      email: 'jember.kalisat@igdgroup.com',
      address: 'Jl. PB. Sudirman No. 2, Kalisat',
      city: 'Jember',
      province: 'Jawa Timur',
      isActive: true,
      isWarehouse: false,
    },
    create: {
      code: 'BR-002',
      name: 'IGD Jember Kalisat',
      type: 'store',
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
      type: 'store',
      phone: '0331-345678',
      email: 'jember.isaid@igdgroup.com',
      address: 'Jl. Imam Bonjol No. 10, Jember',
      city: 'Jember',
      province: 'Jawa Timur',
      isActive: true,
      isWarehouse: false,
    },
    create: {
      code: 'BR-003',
      name: 'IGD Jember iSaid',
      type: 'store',
      phone: '0331-345678',
      email: 'jember.isaid@igdgroup.com',
      address: 'Jl. Imam Bonjol No. 10, Jember',
      city: 'Jember',
      province: 'Jawa Timur',
      isActive: true,
    },
  });

  // 2. Create Roles
  console.log('👥 Creating roles...');
  const ownerRole = await prisma.role.upsert({
    where: { code: 'OWNER' },
    update: {},
    create: {
      code: 'OWNER',
      name: 'Pemilik',
      description: 'Full access to all modules',
      level: 1,
      isActive: true,
    },
  });

  const cfoRole = await prisma.role.upsert({
    where: { code: 'CFO' },
    update: {},
    create: {
      code: 'CFO',
      name: 'Chief Financial Officer',
      description: 'Finance and reporting access',
      level: 2,
      isActive: true,
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { code: 'MGR' },
    update: {},
    create: {
      code: 'MGR',
      name: 'Manager',
      description: 'Management access',
      level: 3,
      isActive: true,
    },
  });

  const csRole = await prisma.role.upsert({
    where: { code: 'CS' },
    update: {},
    create: {
      code: 'CS',
      name: 'Customer Service',
      description: 'Customer service and POS access',
      level: 4,
      isActive: true,
    },
  });

  // 3. Create Users
  console.log('👤 Creating users...');
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

  // Additional roles based on PRD matrix
  const csoRole = await prisma.role.upsert({
    where: { code: 'CSO' },
    update: {},
    create: {
      code: 'CSO',
      name: 'Chief Sales Officer',
      description: 'Sales & commercial leadership',
      level: 2,
      isActive: true,
    },
  });

  const cmoRole = await prisma.role.upsert({
    where: { code: 'CMO' },
    update: {},
    create: {
      code: 'CMO',
      name: 'Chief Marketing Officer',
      description: 'Marketing & customer strategy',
      level: 2,
      isActive: true,
    },
  });

  const chrRole = await prisma.role.upsert({
    where: { code: 'CHR' },
    update: {},
    create: {
      code: 'CHR',
      name: 'HR Manager',
      description: 'Human resources & payroll',
      level: 3,
      isActive: true,
    },
  });

  const spvRole = await prisma.role.upsert({
    where: { code: 'SPV' },
    update: {},
    create: {
      code: 'SPV',
      name: 'Supervisor',
      description: 'Store / area supervisor',
      level: 3,
      isActive: true,
    },
  });

  const hsRole = await prisma.role.upsert({
    where: { code: 'HS' },
    update: {},
    create: {
      code: 'HS',
      name: 'Head of Store',
      description: 'Kepala toko per cabang',
      level: 4,
      isActive: true,
    },
  });

  const arRole = await prisma.role.upsert({
    where: { code: 'AR' },
    update: {},
    create: {
      code: 'AR',
      name: 'Account Receivable',
      description: 'Pengelolaan piutang',
      level: 4,
      isActive: true,
    },
  });

  const tcRole = await prisma.role.upsert({
    where: { code: 'TC' },
    update: {},
    create: {
      code: 'TC',
      name: 'Technician',
      description: 'Teknisi servis',
      level: 5,
      isActive: true,
    },
  });

  const sodoRole = await prisma.role.upsert({
    where: { code: 'SODO' },
    update: {},
    create: {
      code: 'SODO',
      name: 'Service & Operations',
      description: 'Koordinator service & operasional',
      level: 4,
      isActive: true,
    },
  });

  const asaRole = await prisma.role.upsert({
    where: { code: 'ASA' },
    update: {},
    create: {
      code: 'ASA',
      name: 'Assistant Store Admin',
      description: 'Admin produk & stok',
      level: 5,
      isActive: true,
    },
  });

  const smoRole = await prisma.role.upsert({
    where: { code: 'SMO' },
    update: {},
    create: {
      code: 'SMO',
      name: 'Sales & Marketing Officer',
      description: 'Promosi & campaign',
      level: 5,
      isActive: true,
    },
  });

  const asRole = await prisma.role.upsert({
    where: { code: 'AS' },
    update: {},
    create: {
      code: 'AS',
      name: 'Accounting Staff',
      description: 'Pembukuan & jurnal',
      level: 5,
      isActive: true,
    },
  });

  const crRole = await prisma.role.upsert({
    where: { code: 'CR' },
    update: {},
    create: {
      code: 'CR',
      name: 'Cashier',
      description: 'Kasir POS',
      level: 5,
      isActive: true,
    },
  });

  const cfo = await prisma.user.upsert({
    where: { email: 'cfo@igdgroup.com' },
    update: {
      passwordHash: tier2Password,
      fullName: 'Siti Nurhaliza',
    },
    create: {
      email: 'cfo@igdgroup.com',
      username: 'cfo',
      passwordHash: tier2Password,
      fullName: 'Siti Nurhaliza',
      phone: '081234567891',
      isActive: true,
      isVerified: true,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@igdgroup.com' },
    update: {
      passwordHash: tier2Password,
      fullName: 'Ahmad Wijaya',
    },
    create: {
      email: 'manager@igdgroup.com',
      username: 'manager',
      passwordHash: tier2Password,
      fullName: 'Ahmad Wijaya',
      phone: '081234567892',
      isActive: true,
      isVerified: true,
    },
  });

  const regionalManager = await prisma.user.upsert({
    where: { email: 'regional@igdgroup.com' },
    update: {
      passwordHash: tier2Password,
      fullName: 'Dewi Sartika',
    },
    create: {
      email: 'regional@igdgroup.com',
      username: 'regional',
      passwordHash: tier2Password,
      fullName: 'Dewi Sartika',
      phone: '081234567894',
      isActive: true,
      isVerified: true,
    },
  });

  const cs = await prisma.user.upsert({
    where: { email: 'cs@igdgroup.com' },
    update: {
      passwordHash: tier4Password,
      fullName: 'Rina Wati',
    },
    create: {
      email: 'cs@igdgroup.com',
      username: 'cs',
      passwordHash: tier4Password,
      fullName: 'Rina Wati',
      phone: '081234567893',
      isActive: true,
      isVerified: true,
    },
  });

  // Additional demo users per PRD roles (single-branch unless noted)
  const csoUser = await prisma.user.upsert({
    where: { email: 'cso@igdgroup.com' },
    update: {
      passwordHash: tier2Password,
      fullName: 'Rudi Hartono',
    },
    create: {
      email: 'cso@igdgroup.com',
      username: 'cso',
      passwordHash: tier2Password,
      fullName: 'Rudi Hartono',
      phone: '081234567895',
      isActive: true,
      isVerified: true,
    },
  });

  const cmoUser = await prisma.user.upsert({
    where: { email: 'cmo@igdgroup.com' },
    update: {
      passwordHash: tier2Password,
      fullName: 'Maya Sari',
    },
    create: {
      email: 'cmo@igdgroup.com',
      username: 'cmo',
      passwordHash: tier2Password,
      fullName: 'Maya Sari',
      phone: '081234567896',
      isActive: true,
      isVerified: true,
    },
  });

  const chrUser = await prisma.user.upsert({
    where: { email: 'hr@igdgroup.com' },
    update: {
      passwordHash: tier2Password,
      fullName: 'Indah Permata',
    },
    create: {
      email: 'hr@igdgroup.com',
      username: 'hr',
      passwordHash: tier2Password,
      fullName: 'Indah Permata',
      phone: '081234567897',
      isActive: true,
      isVerified: true,
    },
  });

  const spvUser = await prisma.user.upsert({
    where: { email: 'spv@igdgroup.com' },
    update: {
      passwordHash: tier3Password,
      fullName: 'Bambang Setiawan',
    },
    create: {
      email: 'spv@igdgroup.com',
      username: 'spv',
      passwordHash: tier3Password,
      fullName: 'Bambang Setiawan',
      phone: '081234567898',
      isActive: true,
      isVerified: true,
    },
  });

  const hsUser = await prisma.user.upsert({
    where: { email: 'hs@igdgroup.com' },
    update: {
      passwordHash: tier3Password,
      fullName: 'Eko Prasetyo',
    },
    create: {
      email: 'hs@igdgroup.com',
      username: 'hs',
      passwordHash: tier3Password,
      fullName: 'Eko Prasetyo',
      phone: '081234567899',
      isActive: true,
      isVerified: true,
    },
  });

  const arUser = await prisma.user.upsert({
    where: { email: 'ar@igdgroup.com' },
    update: {
      passwordHash: tier4Password,
      fullName: 'Lina Kurniawan',
    },
    create: {
      email: 'ar@igdgroup.com',
      username: 'ar',
      passwordHash: tier4Password,
      fullName: 'Lina Kurniawan',
      phone: '081234567810',
      isActive: true,
      isVerified: true,
    },
  });

  const tcUser = await prisma.user.upsert({
    where: { email: 'tech@igdgroup.com' },
    update: {
      passwordHash: tier4Password,
      fullName: 'Agus Supriyadi',
    },
    create: {
      email: 'tech@igdgroup.com',
      username: 'tech',
      passwordHash: tier4Password,
      fullName: 'Agus Supriyadi',
      phone: '081234567811',
      isActive: true,
      isVerified: true,
    },
  });

  const sodoUser = await prisma.user.upsert({
    where: { email: 'sodo@igdgroup.com' },
    update: {
      passwordHash: tier3Password,
      fullName: 'Yanto Gunawan',
    },
    create: {
      email: 'sodo@igdgroup.com',
      username: 'sodo',
      passwordHash: tier3Password,
      fullName: 'Yanto Gunawan',
      phone: '081234567812',
      isActive: true,
      isVerified: true,
    },
  });

  const asaUser = await prisma.user.upsert({
    where: { email: 'asa@igdgroup.com' },
    update: {
      passwordHash: tier4Password,
      fullName: 'Sari Indrawati',
    },
    create: {
      email: 'asa@igdgroup.com',
      username: 'asa',
      passwordHash: tier4Password,
      fullName: 'Sari Indrawati',
      phone: '081234567813',
      isActive: true,
      isVerified: true,
    },
  });

  const smoUser = await prisma.user.upsert({
    where: { email: 'smo@igdgroup.com' },
    update: {
      passwordHash: tier4Password,
      fullName: 'Dedi Kurniawan',
    },
    create: {
      email: 'smo@igdgroup.com',
      username: 'smo',
      passwordHash: tier4Password,
      fullName: 'Dedi Kurniawan',
      phone: '081234567814',
      isActive: true,
      isVerified: true,
    },
  });

  const asUser = await prisma.user.upsert({
    where: { email: 'as@igdgroup.com' },
    update: {
      passwordHash: tier4Password,
      fullName: 'Fitri Handayani',
    },
    create: {
      email: 'as@igdgroup.com',
      username: 'as',
      passwordHash: tier4Password,
      fullName: 'Fitri Handayani',
      phone: '081234567815',
      isActive: true,
      isVerified: true,
    },
  });

  const crUser = await prisma.user.upsert({
    where: { email: 'cashier@igdgroup.com' },
    update: {
      passwordHash: tier4Password,
      fullName: 'Andi Saputra',
    },
    create: {
      email: 'cashier@igdgroup.com',
      username: 'cashier',
      passwordHash: tier4Password,
      fullName: 'Andi Saputra',
      phone: '081234567816',
      isActive: true,
      isVerified: true,
    },
  });

  // 4. Assign User Roles
  console.log('🔗 Assigning user roles...');
  // For null branchId, we need to use a different approach
  const ownerUserRole = await prisma.userRole.findFirst({
    where: {
      userId: owner.id,
      roleId: ownerRole.id,
      branchId: null,
    },
  });

  if (!ownerUserRole) {
    await prisma.userRole.create({
      data: {
        userId: owner.id,
        roleId: ownerRole.id,
        branchId: null, // All branches
        isPrimary: true,
      },
    });
  } else {
    // Update to ensure it's primary
    await prisma.userRole.update({
      where: { id: ownerUserRole.id },
      data: { isPrimary: true },
    });
  }

  const cfoUserRole = await prisma.userRole.findFirst({
    where: {
      userId: cfo.id,
      roleId: cfoRole.id,
      branchId: null,
    },
  });

  if (!cfoUserRole) {
    await prisma.userRole.create({
      data: {
        userId: cfo.id,
        roleId: cfoRole.id,
        branchId: null,
        isPrimary: true,
      },
    });
  } else {
    // Update to ensure it's primary
    await prisma.userRole.update({
      where: { id: cfoUserRole.id },
      data: { isPrimary: true },
    });
  }

  // Manager cabang tunggal (hanya Jember)
  await prisma.userRole.upsert({
    where: {
      userId_roleId_branchId: {
        userId: manager.id,
        roleId: managerRole.id,
        branchId: branch1.id,
      },
    },
    update: {},
    create: {
      userId: manager.id,
      roleId: managerRole.id,
      branchId: branch1.id,
      isPrimary: true,
    },
  });

  // Regional manager dengan akses multi cabang (Jember + Surabaya)
  await prisma.userRole.upsert({
    where: {
      userId_roleId_branchId: {
        userId: regionalManager.id,
        roleId: managerRole.id,
        branchId: branch1.id,
      },
    },
    update: {},
    create: {
      userId: regionalManager.id,
      roleId: managerRole.id,
      branchId: branch1.id,
      isPrimary: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId_branchId: {
        userId: regionalManager.id,
        roleId: managerRole.id,
        branchId: branch2.id,
      },
    },
    update: {},
    create: {
      userId: regionalManager.id,
      roleId: managerRole.id,
      branchId: branch2.id,
      isPrimary: false,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId_branchId: {
        userId: cs.id,
        roleId: csRole.id,
        branchId: branch1.id,
      },
    },
    update: {},
    create: {
      userId: cs.id,
      roleId: csRole.id,
      branchId: branch1.id,
      isPrimary: true,
    },
  });

  // Map additional demo users to roles & branches
  const singleBranchUsers: Array<{ userId: string; roleId: string }> = [
    { userId: csoUser.id, roleId: csoRole.id },
    { userId: cmoUser.id, roleId: cmoRole.id },
    { userId: chrUser.id, roleId: chrRole.id },
    { userId: spvUser.id, roleId: spvRole.id },
    { userId: hsUser.id, roleId: hsRole.id },
    { userId: arUser.id, roleId: arRole.id },
    { userId: tcUser.id, roleId: tcRole.id },
    { userId: sodoUser.id, roleId: sodoRole.id },
    { userId: asaUser.id, roleId: asaRole.id },
    { userId: smoUser.id, roleId: smoRole.id },
    { userId: asUser.id, roleId: asRole.id },
    { userId: crUser.id, roleId: crRole.id },
  ];

  for (const entry of singleBranchUsers) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId_branchId: {
          userId: entry.userId,
          roleId: entry.roleId,
          branchId: branch1.id,
        },
      },
      update: {},
      create: {
        userId: entry.userId,
        roleId: entry.roleId,
        branchId: branch1.id,
        isPrimary: true,
      },
    });
  }

  // 5. Create Categories
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'pcs',
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
      unit: 'service',
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
      unit: 'service',
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
      unit: 'service',
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
      unit: 'service',
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

    // Create stock for all branches
    for (const branch of [branch1, branch2]) {
      await prisma.productStock.upsert({
        where: {
          productId_branchId: {
            productId: product.id,
            branchId: branch.id,
          },
        },
        update: {},
        create: {
          productId: product.id,
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
      code: 'SVC-SCREEN',
      name: 'Ganti LCD/Layar',
      description: 'Penggantian LCD atau layar perangkat',
      basePrice: 500000,
      slaHours: 24,
      isActive: true,
    },
    {
      code: 'SVC-BATTERY',
      name: 'Ganti Baterai',
      description: 'Penggantian baterai perangkat',
      basePrice: 300000,
      slaHours: 12,
      isActive: true,
    },
    {
      code: 'SVC-SOFTWARE',
      name: 'Service Software',
      description: 'Perbaikan software, install ulang, dll',
      basePrice: 200000,
      slaHours: 6,
      isActive: true,
    },
    {
      code: 'SVC-HARDWARE',
      name: 'Service Hardware',
      description: 'Perbaikan komponen hardware',
      basePrice: 800000,
      slaHours: 48,
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
        deviceBrand: 'Samsung',
        deviceModel: 'Galaxy S24',
        deviceSerial: 'SN123456789',
        complaint: 'LCD pecah, touchscreen tidak responsif',
        estimatedCost: new Decimal(1500000),
        priority: 'urgent',
        status: 'pending',
        createdBy: cs.id,
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
        deviceBrand: 'ASUS',
        deviceModel: 'ROG Strix G15',
        deviceSerial: 'SN987654321',
        complaint: 'Baterai cepat habis, perlu ganti baterai',
        estimatedCost: new Decimal(500000),
        priority: 'normal',
        status: 'in_progress',
        createdBy: cs.id,
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
        deviceBrand: 'Apple',
        deviceModel: 'iPhone 15 Pro',
        deviceSerial: 'SN456789123',
        complaint: 'Software error, perlu install ulang',
        estimatedCost: new Decimal(300000),
        priority: 'normal',
        status: 'completed',
        createdBy: cs.id,
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
        deviceBrand: 'Samsung',
        deviceModel: 'Galaxy S21',
        deviceSerial: 'SN111222333',
        complaint: 'LCD retak, perlu ganti LCD original',
        estimatedCost: new Decimal(1200000),
        priority: 'normal',
        status: 'completed',
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        deliveredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        createdBy: cs.id,
        parts: sparepartProducts.length > 2 ? [
          { productId: sparepartProducts[2].id, qty: 1, price: Number(sparepartProducts[2].sellingPrice) },
        ] : [],
      },
      {
        serviceNumber: 'SRV-20250119-0005',
        branchId: branch1.id,
        customerId: createdCustomers[1].id,
        serviceTypeId: createdServiceTypes[3].id,
        customerName: createdCustomers[1].name,
        customerPhone: createdCustomers[1].phone,
        customerEmail: createdCustomers[1].email,
        deviceType: 'handphone',
        deviceBrand: 'Apple',
        deviceModel: 'iPhone 12 Pro',
        deviceSerial: 'SN444555666',
        complaint: 'Camera tidak berfungsi, perlu ganti camera module',
        estimatedCost: new Decimal(2500000),
        priority: 'normal',
        status: 'delivered',
        completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        deliveredAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
        createdBy: cs.id,
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
            changedBy: cs.id,
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
        cashierId: cs.id,
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
        cashierId: cs.id,
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
        cashierId: cs.id,
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
        cashierId: cs.id,
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
        cashierId: cs.id,
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

  // 16. Create Departments (if not exists)
  console.log('🏢 Creating departments...');
  const salesDept = await prisma.department.upsert({
    where: { code: 'DEPT-SALES' },
    update: {},
    create: {
      code: 'DEPT-SALES',
      name: 'Sales & Marketing',
      isActive: true,
    },
  });

  const serviceDept = await prisma.department.upsert({
    where: { code: 'DEPT-SERVICE' },
    update: {},
    create: {
      code: 'DEPT-SERVICE',
      name: 'Service & Operations',
      isActive: true,
    },
  });

  const financeDept = await prisma.department.upsert({
    where: { code: 'DEPT-FINANCE' },
    update: {},
    create: {
      code: 'DEPT-FINANCE',
      name: 'Finance & Accounting',
      isActive: true,
    },
  });

  const hrDept = await prisma.department.upsert({
    where: { code: 'DEPT-HR' },
    update: {},
    create: {
      code: 'DEPT-HR',
      name: 'Human Resources',
      isActive: true,
    },
  });

  const warehouseDept = await prisma.department.upsert({
    where: { code: 'DEPT-WAREHOUSE' },
    update: {},
    create: {
      code: 'DEPT-WAREHOUSE',
      name: 'Warehouse & Inventory',
      isActive: true,
    },
  });

  // 16. Create Employee Data
  console.log('👔 Creating employee data...');
  
  // Helper function to generate employee code
  let employeeCounter = 1;
  const generateEmployeeCode = () => `EMP-${String(employeeCounter++).padStart(4, '0')}`;

  // Calculate hire dates (various dates in the past)
  const now = new Date();
  const hireDates = {
    old: new Date(now.getFullYear() - 3, 0, 15), // 3 years ago
    mid: new Date(now.getFullYear() - 2, 5, 1), // 2 years ago
    recent: new Date(now.getFullYear() - 1, 2, 10), // 1 year ago
    veryRecent: new Date(now.getFullYear() - 0, 8, 1), // 9 months ago
  };

  // CFO Employee
  await prisma.employee.upsert({
    where: { userId: cfo.id },
    update: {},
    create: {
      userId: cfo.id,
      employeeCode: generateEmployeeCode(),
      branchId: null, // Global access
      departmentId: financeDept.id,
      position: 'Chief Financial Officer',
      hireDate: hireDates.old,
      employmentType: 'full-time',
      basicSalary: new Decimal(25000000),
      bankAccount: '1234567890',
      bankName: 'Bank BCA',
      taxId: '12.345.678.9-000.000',
      bpjsNumber: '1234567890123456',
      isActive: true,
    },
  });

  // Manager Employee
  await prisma.employee.upsert({
    where: { userId: manager.id },
    update: {},
    create: {
      userId: manager.id,
      employeeCode: generateEmployeeCode(),
      branchId: branch1.id,
      departmentId: salesDept.id,
      position: 'Branch Manager',
      hireDate: hireDates.mid,
      employmentType: 'full-time',
      basicSalary: new Decimal(15000000),
      bankAccount: '2345678901',
      bankName: 'Bank Mandiri',
      taxId: '23.456.789.0-000.000',
      bpjsNumber: '2345678901234567',
      isActive: true,
    },
  });

  // CSO Employee
  await prisma.employee.upsert({
    where: { userId: csoUser.id },
    update: {},
    create: {
      userId: csoUser.id,
      employeeCode: generateEmployeeCode(),
      branchId: null, // Global
      departmentId: salesDept.id,
      position: 'Chief Sales Officer',
      hireDate: hireDates.old,
      employmentType: 'full-time',
      basicSalary: new Decimal(20000000),
      bankAccount: '3456789012',
      bankName: 'Bank BNI',
      taxId: '34.567.890.1-000.000',
      bpjsNumber: '3456789012345678',
      isActive: true,
    },
  });

  // CMO Employee
  await prisma.employee.upsert({
    where: { userId: cmoUser.id },
    update: {},
    create: {
      userId: cmoUser.id,
      employeeCode: generateEmployeeCode(),
      branchId: null, // Global
      departmentId: salesDept.id,
      position: 'Chief Marketing Officer',
      hireDate: hireDates.mid,
      employmentType: 'full-time',
      basicSalary: new Decimal(18000000),
      bankAccount: '4567890123',
      bankName: 'Bank BRI',
      taxId: '45.678.901.2-000.000',
      bpjsNumber: '4567890123456789',
      isActive: true,
    },
  });

  // HR Manager Employee
  await prisma.employee.upsert({
    where: { userId: chrUser.id },
    update: {},
    create: {
      userId: chrUser.id,
      employeeCode: generateEmployeeCode(),
      branchId: null, // Global
      departmentId: hrDept.id,
      position: 'HR Manager',
      hireDate: hireDates.mid,
      employmentType: 'full-time',
      basicSalary: new Decimal(12000000),
      bankAccount: '5678901234',
      bankName: 'Bank BCA',
      taxId: '56.789.012.3-000.000',
      bpjsNumber: '5678901234567890',
      isActive: true,
    },
  });

  // Supervisor Employee
  await prisma.employee.upsert({
    where: { userId: spvUser.id },
    update: {},
    create: {
      userId: spvUser.id,
      employeeCode: generateEmployeeCode(),
      branchId: branch1.id,
      departmentId: salesDept.id,
      position: 'Supervisor',
      hireDate: hireDates.recent,
      employmentType: 'full-time',
      basicSalary: new Decimal(8000000),
      bankAccount: '6789012345',
      bankName: 'Bank Mandiri',
      taxId: '67.890.123.4-000.000',
      bpjsNumber: '6789012345678901',
      isActive: true,
    },
  });

  // Head of Store Employee
  await prisma.employee.upsert({
    where: { userId: hsUser.id },
    update: {},
    create: {
      userId: hsUser.id,
      employeeCode: generateEmployeeCode(),
      branchId: branch1.id,
      departmentId: salesDept.id,
      position: 'Head of Store',
      hireDate: hireDates.recent,
      employmentType: 'full-time',
      basicSalary: new Decimal(10000000),
      bankAccount: '7890123456',
      bankName: 'Bank BNI',
      taxId: '78.901.234.5-000.000',
      bpjsNumber: '7890123456789012',
      isActive: true,
    },
  });

  // AR Staff Employee
  await prisma.employee.upsert({
    where: { userId: arUser.id },
    update: {},
    create: {
      userId: arUser.id,
      employeeCode: generateEmployeeCode(),
      branchId: branch1.id,
      departmentId: financeDept.id,
      position: 'Account Receivable Staff',
      hireDate: hireDates.veryRecent,
      employmentType: 'full-time',
      basicSalary: new Decimal(5000000),
      hourlyRate: new Decimal(25000),
      bankAccount: '8901234567',
      bankName: 'Bank BRI',
      taxId: '89.012.345.6-000.000',
      bpjsNumber: '8901234567890123',
      isActive: true,
    },
  });

  // Technician Employee
  await prisma.employee.upsert({
    where: { userId: tcUser.id },
    update: {},
    create: {
      userId: tcUser.id,
      employeeCode: generateEmployeeCode(),
      branchId: branch1.id,
      departmentId: serviceDept.id,
      position: 'Service Technician',
      hireDate: hireDates.recent,
      employmentType: 'full-time',
      basicSalary: new Decimal(6000000),
      hourlyRate: new Decimal(30000),
      bankAccount: '9012345678',
      bankName: 'Bank BCA',
      taxId: '90.123.456.7-000.000',
      bpjsNumber: '9012345678901234',
      isActive: true,
    },
  });

  // SODO Employee
  await prisma.employee.upsert({
    where: { userId: sodoUser.id },
    update: {},
    create: {
      userId: sodoUser.id,
      employeeCode: generateEmployeeCode(),
      branchId: branch1.id,
      departmentId: serviceDept.id,
      position: 'Service & Operations Coordinator',
      hireDate: hireDates.recent,
      employmentType: 'full-time',
      basicSalary: new Decimal(7500000),
      bankAccount: '0123456789',
      bankName: 'Bank Mandiri',
      taxId: '01.234.567.8-000.000',
      bpjsNumber: '0123456789012345',
      isActive: true,
    },
  });

  // ASA Employee
  await prisma.employee.upsert({
    where: { userId: asaUser.id },
    update: {},
    create: {
      userId: asaUser.id,
      employeeCode: generateEmployeeCode(),
      branchId: branch1.id,
      departmentId: warehouseDept.id,
      position: 'Assistant Store Admin',
      hireDate: hireDates.veryRecent,
      employmentType: 'full-time',
      basicSalary: new Decimal(5500000),
      hourlyRate: new Decimal(27500),
      bankAccount: '1234509876',
      bankName: 'Bank BNI',
      taxId: '12.345.098.7-000.000',
      bpjsNumber: '1234509876543210',
      isActive: true,
    },
  });

  // SMO Employee
  await prisma.employee.upsert({
    where: { userId: smoUser.id },
    update: {},
    create: {
      userId: smoUser.id,
      employeeCode: generateEmployeeCode(),
      branchId: branch1.id,
      departmentId: salesDept.id,
      position: 'Sales & Marketing Officer',
      hireDate: hireDates.veryRecent,
      employmentType: 'full-time',
      basicSalary: new Decimal(6000000),
      hourlyRate: new Decimal(30000),
      bankAccount: '2345610987',
      bankName: 'Bank BRI',
      taxId: '23.456.109.8-000.000',
      bpjsNumber: '2345610987654321',
      isActive: true,
    },
  });

  // Accounting Staff Employee
  await prisma.employee.upsert({
    where: { userId: asUser.id },
    update: {},
    create: {
      userId: asUser.id,
      employeeCode: generateEmployeeCode(),
      branchId: branch1.id,
      departmentId: financeDept.id,
      position: 'Accounting Staff',
      hireDate: hireDates.veryRecent,
      employmentType: 'full-time',
      basicSalary: new Decimal(5500000),
      hourlyRate: new Decimal(27500),
      bankAccount: '3456721098',
      bankName: 'Bank BCA',
      taxId: '34.567.210.9-000.000',
      bpjsNumber: '3456721098765432',
      isActive: true,
    },
  });

  // Cashier Employee
  await prisma.employee.upsert({
    where: { userId: crUser.id },
    update: {},
    create: {
      userId: crUser.id,
      employeeCode: generateEmployeeCode(),
      branchId: branch1.id,
      departmentId: salesDept.id,
      position: 'Cashier',
      hireDate: hireDates.veryRecent,
      employmentType: 'full-time',
      basicSalary: new Decimal(5000000),
      hourlyRate: new Decimal(25000),
      bankAccount: '4567832109',
      bankName: 'Bank Mandiri',
      taxId: '45.678.321.0-000.000',
      bpjsNumber: '4567832109876543',
      isActive: true,
    },
  });

  // CS Employee
  await prisma.employee.upsert({
    where: { userId: cs.id },
    update: {},
    create: {
      userId: cs.id,
      employeeCode: generateEmployeeCode(),
      branchId: branch1.id,
      departmentId: salesDept.id,
      position: 'Customer Service',
      hireDate: hireDates.recent,
      employmentType: 'full-time',
      basicSalary: new Decimal(5500000),
      hourlyRate: new Decimal(27500),
      bankAccount: '5678943210',
      bankName: 'Bank BNI',
      taxId: '56.789.432.1-000.000',
      bpjsNumber: '5678943210987654',
      isActive: true,
    },
  });

  // Regional Manager Employee (multi-branch)
  await prisma.employee.upsert({
    where: { userId: regionalManager.id },
    update: {},
    create: {
      userId: regionalManager.id,
      employeeCode: generateEmployeeCode(),
      branchId: branch1.id, // Primary branch
      departmentId: salesDept.id,
      position: 'Regional Manager',
      hireDate: hireDates.old,
      employmentType: 'full-time',
      basicSalary: new Decimal(18000000),
      bankAccount: '6789054321',
      bankName: 'Bank BRI',
      taxId: '67.890.543.2-000.000',
      bpjsNumber: '6789054321098765',
      isActive: true,
    },
  });

  // 17. Create Service Returns
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
          createdBy: cs.id,
        },
      });
    }
  }

  console.log('✅ Database seed completed!');
  console.log('\n📋 Demo Credentials (Organized by Tier):');
  console.log('\n🔴 TIER 1 - EXECUTIVE (Password: Owner@1234)');
  console.log('  👑 Owner (semua cabang)      : owner@igdgroup.com / Owner@1234');
  console.log('\n🟠 TIER 2 - MANAGEMENT (Password: Manager@1234)');
  console.log('  💼 CFO (semua cabang)        : cfo@igdgroup.com / Manager@1234');
  console.log('  📊 Manager Jember (1 cabang): manager@igdgroup.com / Manager@1234');
  console.log('  🌐 Regional (multi cabang)   : regional@igdgroup.com / Manager@1234');
  console.log('  📈 CSO (sales director)      : cso@igdgroup.com / Manager@1234');
  console.log('  📣 CMO (marketing)           : cmo@igdgroup.com / Manager@1234');
  console.log('  🧑‍💼 HR Manager                : hr@igdgroup.com / Manager@1234');
  console.log('\n🟡 TIER 3 - SUPERVISOR (Password: Supervisor@1234)');
  console.log('  🧭 Supervisor                : spv@igdgroup.com / Supervisor@1234');
  console.log('  🏬 Head of Store             : hs@igdgroup.com / Supervisor@1234');
  console.log('  🔧 Service Ops               : sodo@igdgroup.com / Supervisor@1234');
  console.log('\n🟢 TIER 4 - STAFF (Password: Staff@1234)');
  console.log('  🎧 CS Jember (1 cabang)      : cs@igdgroup.com / Staff@1234');
  console.log('  💰 AR Staff                  : ar@igdgroup.com / Staff@1234');
  console.log('  🔨 Technician                : tech@igdgroup.com / Staff@1234');
  console.log('  📦 Assistant Store Admin     : asa@igdgroup.com / Staff@1234');
  console.log('  📊 Sales & Marketing Officer  : smo@igdgroup.com / Staff@1234');
  console.log('  📝 Accounting Staff          : as@igdgroup.com / Staff@1234');
  console.log('  💵 Cashier POS               : cashier@igdgroup.com / Staff@1234');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

