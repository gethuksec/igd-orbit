/**
 * Script to assign CFO role to test user
 * Run with: npx ts-node scripts/assign-cfo-role.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function assignCFORole() {
  const userEmail = 'cfo@igdgroup.com';

  try {
    console.log('=== Assigning CFO Role to Test User ===\n');

    // Step 1: Find or create CFO role
    console.log('1. Checking CFO role...');
    let cfoRole = await prisma.role.findUnique({
      where: { code: 'CFO' },
    });

    if (!cfoRole) {
      console.log('   Creating CFO role...');
      cfoRole = await prisma.role.create({
        data: {
          code: 'CFO',
          name: 'Chief Financial Officer',
          description: 'Full access to Finance and Accounting module',
          level: 2,
          isSystemRole: false,
          isActive: true,
        },
      });
      console.log('   ✓ CFO role created');
    } else {
      console.log('   ✓ CFO role exists');
    }

    // Step 2: Find user
    console.log('\n2. Finding user...');
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      console.error(`   ✗ User with email ${userEmail} not found`);
      console.error('   Please register the user first');
      process.exit(1);
    }

    console.log(`   ✓ User found: ${user.fullName || user.email} (${user.id})`);

    // Step 3: Check if role is already assigned
    console.log('\n3. Checking existing role assignments...');
    const existingRole = await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        roleId: cfoRole.id,
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
      },
    });

    if (existingRole) {
      console.log('   ✓ CFO role already assigned');
      console.log(`   Role assignment ID: ${existingRole.id}`);
    } else {
      // Step 4: Assign role
      console.log('\n4. Assigning CFO role...');
      const userRole = await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: cfoRole.id,
          branchId: null, // All branches
          isPrimary: true,
          validFrom: new Date(),
        },
      });

      console.log('   ✓ CFO role assigned successfully');
      console.log(`   Role assignment ID: ${userRole.id}`);
    }

    // Step 5: Verify
    console.log('\n5. Verifying assignment...');
    const userWithRoles = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    console.log('\n=== User Roles ===');
    userWithRoles?.userRoles.forEach((ur) => {
      console.log(`  - ${ur.role.code} (${ur.role.name})`);
      if (ur.isPrimary) {
        console.log('    Primary role');
      }
    });

    console.log('\n✓ Role assignment complete!');
    console.log('You can now test the Finance endpoints.');
  } catch (error) {
    console.error('\n✗ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

assignCFORole();

