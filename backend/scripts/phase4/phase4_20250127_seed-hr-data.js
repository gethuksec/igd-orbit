const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function seedHRData() {
  console.log('🌱 Seeding HR data...\n');

  try {
    // 1. Get or create test branches
    let branch1 = await prisma.branch.findFirst({
      where: { code: 'JMB' },
    });
    if (!branch1) {
      branch1 = await prisma.branch.create({
        data: {
          code: 'JMB',
          name: 'Jember Pusat',
          type: 'store',
          phone: '0331-123456',
          address: 'Jl. Sudirman No. 123',
          city: 'Jember',
          province: 'Jawa Timur',
          isActive: true,
          operatingHours: {
            monday: { open: '08:00', close: '22:00' },
            tuesday: { open: '08:00', close: '22:00' },
            wednesday: { open: '08:00', close: '22:00' },
            thursday: { open: '08:00', close: '22:00' },
            friday: { open: '08:00', close: '22:00' },
            saturday: { open: '08:00', close: '22:00' },
            sunday: { open: '09:00', close: '21:00' },
          },
        },
      });
      console.log('✅ Created branch: Jember Pusat');
    }

    let branch2 = await prisma.branch.findFirst({
      where: { code: 'KLS' },
    });
    if (!branch2) {
      branch2 = await prisma.branch.create({
        data: {
          code: 'KLS',
          name: 'Kalisat',
          type: 'store',
          phone: '0331-654321',
          address: 'Jl. Raya Kalisat No. 456',
          city: 'Jember',
          province: 'Jawa Timur',
          isActive: true,
          operatingHours: {
            monday: { open: '08:00', close: '22:00' },
            tuesday: { open: '08:00', close: '22:00' },
            wednesday: { open: '08:00', close: '22:00' },
            thursday: { open: '08:00', close: '22:00' },
            friday: { open: '08:00', close: '22:00' },
            saturday: { open: '08:00', close: '22:00' },
            sunday: { open: '09:00', close: '21:00' },
          },
        },
      });
      console.log('✅ Created branch: Kalisat');
    }

    // 2. Get or create departments
    let deptSales = await prisma.department.findFirst({
      where: { code: 'SALES' },
    });
    if (!deptSales) {
      deptSales = await prisma.department.create({
        data: {
          code: 'SALES',
          name: 'Sales',
          branchId: branch1.id,
          isActive: true,
        },
      });
      console.log('✅ Created department: Sales');
    }

    let deptService = await prisma.department.findFirst({
      where: { code: 'SERVICE' },
    });
    if (!deptService) {
      deptService = await prisma.department.create({
        data: {
          code: 'SERVICE',
          name: 'Service',
          branchId: branch1.id,
          isActive: true,
        },
      });
      console.log('✅ Created department: Service');
    }

    // 3. Get or create roles
    const roles = ['HS', 'SPV', 'CHR', 'CFO'];
    const roleMap = {};
    for (const roleCode of roles) {
      let role = await prisma.role.findUnique({
        where: { code: roleCode },
      });
      if (!role) {
        role = await prisma.role.create({
          data: {
            code: roleCode,
            name: roleCode,
            description: `${roleCode} role`,
            level: 5,
            isSystemRole: false,
            isActive: true,
          },
        });
        console.log(`✅ Created role: ${roleCode}`);
      }
      roleMap[roleCode] = role;
    }

    // 4. Create test employees with users
    const employees = [
      {
        email: 'hr@igdgroup.com',
        fullName: 'HR Manager',
        employeeCode: 'EMP001',
        position: 'HR Manager',
        branchId: branch1.id,
        departmentId: deptSales.id,
        basicSalary: 8000000,
        hourlyRate: 50000,
        bankAccount: '1234567890',
        bankName: 'BCA',
        roles: ['CHR'],
      },
      {
        email: 'employee1@igdgroup.com',
        fullName: 'Employee One',
        employeeCode: 'EMP002',
        position: 'Sales Staff',
        branchId: branch1.id,
        departmentId: deptSales.id,
        basicSalary: 5000000,
        hourlyRate: 30000,
        bankAccount: '2345678901',
        bankName: 'Mandiri',
        roles: ['HS'],
      },
      {
        email: 'employee2@igdgroup.com',
        fullName: 'Employee Two',
        employeeCode: 'EMP003',
        position: 'Service Technician',
        branchId: branch1.id,
        departmentId: deptService.id,
        basicSalary: 5500000,
        hourlyRate: 35000,
        bankAccount: '3456789012',
        bankName: 'BCA',
        roles: ['HS'],
      },
    ];

    const passwordHash = await bcrypt.hash('Admin123!', 10);

    for (const empData of employees) {
      // Check if user exists
      let user = await prisma.user.findUnique({
        where: { email: empData.email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: empData.email,
            username: empData.email.split('@')[0],
            passwordHash,
            fullName: empData.fullName,
            isActive: true,
            isVerified: true,
          },
        });
        console.log(`✅ Created user: ${empData.email}`);
      }

      // Assign roles
      for (const roleCode of empData.roles) {
        const role = roleMap[roleCode];
        const existingUserRole = await prisma.userRole.findFirst({
          where: {
            userId: user.id,
            roleId: role.id,
          },
        });

        if (!existingUserRole) {
          await prisma.userRole.create({
            data: {
              userId: user.id,
              roleId: role.id,
              branchId: empData.branchId,
              isPrimary: true,
            },
          });
          console.log(`  ✅ Assigned role ${roleCode} to ${empData.email}`);
        }
      }

      // Create or update employee
      const { roles, ...employeeData } = empData;
      let employee = await prisma.employee.findUnique({
        where: { userId: user.id },
      });

      if (!employee) {
        employee = await prisma.employee.create({
          data: {
            userId: user.id,
            employeeCode: employeeData.employeeCode,
            branchId: employeeData.branchId,
            departmentId: employeeData.departmentId,
            position: employeeData.position,
            hireDate: new Date('2024-01-01'),
            employmentType: 'full-time',
            basicSalary: employeeData.basicSalary,
            hourlyRate: employeeData.hourlyRate,
            bankAccount: employeeData.bankAccount,
            bankName: employeeData.bankName,
            isActive: true,
          },
        });
        console.log(`✅ Created employee: ${employeeData.employeeCode} - ${empData.fullName}`);
      } else {
        // Update employee data
        await prisma.employee.update({
          where: { id: employee.id },
          data: {
            employeeCode: employeeData.employeeCode,
            branchId: employeeData.branchId,
            departmentId: employeeData.departmentId,
            position: employeeData.position,
            basicSalary: employeeData.basicSalary,
            hourlyRate: employeeData.hourlyRate,
            bankAccount: employeeData.bankAccount,
            bankName: employeeData.bankName,
          },
        });
        console.log(`✅ Updated employee: ${employeeData.employeeCode} - ${empData.fullName}`);
      }
    }

    console.log('\n✅ HR data seeding completed!');
    console.log('\nTest users:');
    console.log('  - hr@igdgroup.com / Admin123! (CHR role)');
    console.log('  - employee1@igdgroup.com / Admin123! (HS role)');
    console.log('  - employee2@igdgroup.com / Admin123! (HS role)');
  } catch (error) {
    console.error('❌ Error seeding HR data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedHRData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

