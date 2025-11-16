import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log('🌱 Starting database seed...');

  // Hash password for all users
  const defaultPassword = await hashPassword('Test@1234');

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
    update: {},
    create: {
      email: 'owner@igdgroup.com',
      username: 'owner',
      passwordHash: defaultPassword,
      fullName: 'Pemilik IGD',
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
    update: {},
    create: {
      email: 'cfo@igdgroup.com',
      username: 'cfo',
      passwordHash: defaultPassword,
      fullName: 'CFO IGD',
      phone: '081234567891',
      isActive: true,
      isVerified: true,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@igdgroup.com' },
    update: {},
    create: {
      email: 'manager@igdgroup.com',
      username: 'manager',
      passwordHash: defaultPassword,
      fullName: 'Manager IGD (Cabang Jember)',
      phone: '081234567892',
      isActive: true,
      isVerified: true,
    },
  });

  const regionalManager = await prisma.user.upsert({
    where: { email: 'regional@igdgroup.com' },
    update: {},
    create: {
      email: 'regional@igdgroup.com',
      username: 'regional',
      passwordHash: defaultPassword,
      fullName: 'Regional Manager IGD (Multi Cabang)',
      phone: '081234567894',
      isActive: true,
      isVerified: true,
    },
  });

  const cs = await prisma.user.upsert({
    where: { email: 'cs@igdgroup.com' },
    update: {},
    create: {
      email: 'cs@igdgroup.com',
      username: 'cs',
      passwordHash: defaultPassword,
      fullName: 'Customer Service',
      phone: '081234567893',
      isActive: true,
      isVerified: true,
    },
  });

  // Additional demo users per PRD roles (single-branch unless noted)
  const csoUser = await prisma.user.upsert({
    where: { email: 'cso@igdgroup.com' },
    update: {},
    create: {
      email: 'cso@igdgroup.com',
      username: 'cso',
      passwordHash: defaultPassword,
      fullName: 'Chief Sales Officer',
      phone: '081234567895',
      isActive: true,
      isVerified: true,
    },
  });

  const cmoUser = await prisma.user.upsert({
    where: { email: 'cmo@igdgroup.com' },
    update: {},
    create: {
      email: 'cmo@igdgroup.com',
      username: 'cmo',
      passwordHash: defaultPassword,
      fullName: 'Chief Marketing Officer',
      phone: '081234567896',
      isActive: true,
      isVerified: true,
    },
  });

  const chrUser = await prisma.user.upsert({
    where: { email: 'hr@igdgroup.com' },
    update: {},
    create: {
      email: 'hr@igdgroup.com',
      username: 'hr',
      passwordHash: defaultPassword,
      fullName: 'HR Manager',
      phone: '081234567897',
      isActive: true,
      isVerified: true,
    },
  });

  const spvUser = await prisma.user.upsert({
    where: { email: 'spv@igdgroup.com' },
    update: {},
    create: {
      email: 'spv@igdgroup.com',
      username: 'spv',
      passwordHash: defaultPassword,
      fullName: 'Supervisor Cabang',
      phone: '081234567898',
      isActive: true,
      isVerified: true,
    },
  });

  const hsUser = await prisma.user.upsert({
    where: { email: 'hs@igdgroup.com' },
    update: {},
    create: {
      email: 'hs@igdgroup.com',
      username: 'hs',
      passwordHash: defaultPassword,
      fullName: 'Head of Store Jember Pusat',
      phone: '081234567899',
      isActive: true,
      isVerified: true,
    },
  });

  const arUser = await prisma.user.upsert({
    where: { email: 'ar@igdgroup.com' },
    update: {},
    create: {
      email: 'ar@igdgroup.com',
      username: 'ar',
      passwordHash: defaultPassword,
      fullName: 'Account Receivable',
      phone: '081234567810',
      isActive: true,
      isVerified: true,
    },
  });

  const tcUser = await prisma.user.upsert({
    where: { email: 'tech@igdgroup.com' },
    update: {},
    create: {
      email: 'tech@igdgroup.com',
      username: 'tech',
      passwordHash: defaultPassword,
      fullName: 'Teknisi Servis',
      phone: '081234567811',
      isActive: true,
      isVerified: true,
    },
  });

  const sodoUser = await prisma.user.upsert({
    where: { email: 'sodo@igdgroup.com' },
    update: {},
    create: {
      email: 'sodo@igdgroup.com',
      username: 'sodo',
      passwordHash: defaultPassword,
      fullName: 'Service & Operations',
      phone: '081234567812',
      isActive: true,
      isVerified: true,
    },
  });

  const asaUser = await prisma.user.upsert({
    where: { email: 'asa@igdgroup.com' },
    update: {},
    create: {
      email: 'asa@igdgroup.com',
      username: 'asa',
      passwordHash: defaultPassword,
      fullName: 'Assistant Store Admin',
      phone: '081234567813',
      isActive: true,
      isVerified: true,
    },
  });

  const smoUser = await prisma.user.upsert({
    where: { email: 'smo@igdgroup.com' },
    update: {},
    create: {
      email: 'smo@igdgroup.com',
      username: 'smo',
      passwordHash: defaultPassword,
      fullName: 'Sales & Marketing Officer',
      phone: '081234567814',
      isActive: true,
      isVerified: true,
    },
  });

  const asUser = await prisma.user.upsert({
    where: { email: 'as@igdgroup.com' },
    update: {},
    create: {
      email: 'as@igdgroup.com',
      username: 'as',
      passwordHash: defaultPassword,
      fullName: 'Accounting Staff',
      phone: '081234567815',
      isActive: true,
      isVerified: true,
    },
  });

  const crUser = await prisma.user.upsert({
    where: { email: 'cashier@igdgroup.com' },
    update: {},
    create: {
      email: 'cashier@igdgroup.com',
      username: 'cashier',
      passwordHash: defaultPassword,
      fullName: 'Kasir POS',
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
    await prisma.productStock.upsert({
      where: {
        productId_branchId: {
          productId: product.id,
          branchId: branch1.id,
        },
      },
      update: {},
      create: {
        productId: product.id,
        branchId: branch1.id,
        quantityAvailable: 50,
        reorderPoint: 10,
        maxStock: 100,
      },
    });
  }

  // 9. Create Customer Tiers
  console.log('👥 Creating customer tiers...');
  await prisma.customerTier.upsert({
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
      address: 'Jl. Merdeka No. 123',
      city: 'Jember',
      province: 'Jawa Timur',
      preferredBranchId: branch1.id,
      isActive: true,
    },
    {
      customerCode: 'CUST-002',
      customerType: 'retail',
      tierId: tierSilver.id,
      name: 'Siti Nurhaliza',
      email: 'siti@example.com',
      phone: '081234567891',
      address: 'Jl. Sudirman No. 456',
      city: 'Jember',
      province: 'Jawa Timur',
      preferredBranchId: branch1.id,
      isActive: true,
    },
    {
      customerCode: 'CUST-003',
      customerType: 'wholesale',
      tierId: tierPlatinum.id,
      name: 'PT Maju Jaya',
      email: 'info@majujaya.com',
      phone: '081234567892',
      address: 'Jl. Gatot Subroto No. 789',
      city: 'Surabaya',
      province: 'Jawa Timur',
      preferredBranchId: branch2.id,
      creditLimit: 50000000,
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
      city: 'Surabaya',
      province: 'Jawa Timur',
      isActive: true,
    },
    {
      customerCode: 'SUP-002',
      customerType: 'wholesale',
      name: 'CV Handphone Jaya',
      phone: '0331-7654321',
      email: 'sales@hpjaya.com',
      address: 'Jl. Sudirman No. 200',
      city: 'Jember',
      province: 'Jawa Timur',
      isActive: true,
    },
    {
      customerCode: 'SUP-003',
      customerType: 'wholesale',
      name: 'PT Laptop Indonesia',
      phone: '021-9876543',
      email: 'order@laptopindo.com',
      address: 'Jl. Thamrin No. 50',
      city: 'Jakarta',
      province: 'DKI Jakarta',
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

  // 13. Create Service Orders
  console.log('🔧 Creating service orders...');
  if (createdCustomers.length > 0 && createdServiceTypes.length > 0) {
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
      },
    ];

    for (const so of serviceOrders) {
      // Use upsert to handle existing service orders
      const created = await prisma.serviceOrder.upsert({
        where: { serviceNumber: so.serviceNumber },
        update: {
          // Update fields if service order already exists
          status: so.status,
          estimatedCost: so.estimatedCost,
          priority: so.priority,
        },
        create: {
          ...so,
          receivedDate: new Date(),
          slaDueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        },
      });

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

  // 14. Create Sales Transactions
  console.log('💰 Creating sales transactions...');
  if (createdProducts.length > 0 && createdCustomers.length > 0) {
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
      },
    ];

    for (const st of salesTransactions) {
      // Use upsert to handle existing transactions
      const created = await prisma.salesTransaction.upsert({
        where: { transactionNumber: st.transactionNumber },
        update: {
          // Update fields if transaction already exists
          status: st.status,
          paymentStatus: st.paymentStatus,
        },
        create: st,
      });

      // Check if transaction item already exists
      const existingItem = await prisma.salesTransactionItem.findFirst({
        where: {
          transactionId: created.id,
          productId: createdProducts[0].id,
        },
      });

      // Create transaction items only if they don't exist
      if (!existingItem && createdProducts.length > 0) {
        await prisma.salesTransactionItem.create({
          data: {
            transactionId: created.id,
            productId: createdProducts[0].id,
            productName: createdProducts[0].name,
            productSku: createdProducts[0].sku,
            quantity: new Decimal(1),
            unitPrice: createdProducts[0].sellingPrice,
            discountAmount: new Decimal(0),
            subtotal: createdProducts[0].sellingPrice,
          },
        });
      }
    }
  }

  console.log('✅ Database seed completed!');
  console.log('\n📋 Demo Credentials:');
  console.log('  Owner (semua cabang)      : owner@igdgroup.com / Test@1234');
  console.log('  CFO (semua cabang)        : cfo@igdgroup.com / Test@1234');
  console.log('  Manager Jember (1 cabang) : manager@igdgroup.com / Test@1234');
  console.log('  Regional (multi cabang)   : regional@igdgroup.com / Test@1234');
  console.log('  CS Jember (1 cabang)      : cs@igdgroup.com / Test@1234');
  console.log('  CSO (sales director)      : cso@igdgroup.com / Test@1234');
  console.log('  CMO (marketing)           : cmo@igdgroup.com / Test@1234');
  console.log('  HR Manager                : hr@igdgroup.com / Test@1234');
  console.log('  Supervisor                : spv@igdgroup.com / Test@1234');
  console.log('  Head of Store             : hs@igdgroup.com / Test@1234');
  console.log('  AR Staff                  : ar@igdgroup.com / Test@1234');
  console.log('  Technician                : tech@igdgroup.com / Test@1234');
  console.log('  Service Ops               : sodo@igdgroup.com / Test@1234');
  console.log('  Assistant Store Admin     : asa@igdgroup.com / Test@1234');
  console.log('  Sales & Marketing Officer : smo@igdgroup.com / Test@1234');
  console.log('  Accounting Staff          : as@igdgroup.com / Test@1234');
  console.log('  Cashier POS               : cashier@igdgroup.com / Test@1234');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

