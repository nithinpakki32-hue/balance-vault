import { PrismaClient, Role, AccountType, AccountStatus, AuditStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

async function main() {
  console.log('🚀 BalanceVault Seeding & Initialization...');

  // 1. Guard against running demo seeds in production
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ [Production Safeguard]: Routine development seeding is prohibited in production.');
    console.warn('⚠️ Use the secure, controlled endpoint POST /api/auth/bootstrap-admin with ADMIN_BOOTSTRAP_SECRET.');
    process.exit(0);
  }

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

  // 2. Local Development Seed: Admin (Only if no admin exists)
  const existingAdminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
  if (existingAdminCount === 0) {
    console.log('🌱 Seeding local development administrator...');
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@balancevault.com';
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123';
    const adminPasswordHash = await bcrypt.hash(adminPassword, saltRounds);

    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail.toLowerCase(),
        passwordHash: adminPasswordHash,
        fullName: 'Development Administrator',
        role: Role.ADMIN,
        isActive: true,
      },
    });

    const treasuryAccount = await prisma.account.create({
      data: {
        accountNumber: 'BV-TREASURY-001',
        name: 'Master Vault Treasury',
        type: AccountType.TREASURY,
        balance: 1000000.0000,
        currency: 'USD',
        status: AccountStatus.ACTIVE,
        userId: adminUser.id,
      },
    });

    await prisma.accountPermission.create({
      data: {
        userId: adminUser.id,
        accountId: treasuryAccount.id,
        canView: true,
        canDeposit: true,
        canWithdraw: true,
        canTransfer: true,
      },
    });

    console.log(`✅ Development Administrator initialized: ${adminUser.email}`);
  } else {
    console.log('ℹ️ Administrator already exists. Preserving existing admin credentials and permissions.');
  }

  // 3. Local Development Seed: Demo Member User (Role: ACCOUNT_HOLDER)
  const demoEmail = 'user@balancevault.com';
  const existingDemoUser = await prisma.user.findUnique({ where: { email: demoEmail } });

  if (!existingDemoUser) {
    console.log('🌱 Seeding local development demo member account...');
    const demoPasswordHash = await bcrypt.hash('User@123', saltRounds);

    const demoUser = await prisma.user.create({
      data: {
        email: demoEmail,
        passwordHash: demoPasswordHash,
        fullName: 'Alex Vance',
        role: Role.ACCOUNT_HOLDER, // Role matches Prisma enum
        isActive: true,
      },
    });

    const demoChecking = await prisma.account.create({
      data: {
        accountNumber: 'BV-CHK-100293',
        name: 'Primary Checking',
        type: AccountType.CHECKING,
        balance: 15420.5000,
        currency: 'USD',
        status: AccountStatus.ACTIVE,
        userId: demoUser.id,
      },
    });

    const demoSavings = await prisma.account.create({
      data: {
        accountNumber: 'BV-SAV-883012',
        name: 'High-Yield Reserve',
        type: AccountType.SAVINGS,
        balance: 45000.0000,
        currency: 'USD',
        status: AccountStatus.ACTIVE,
        userId: demoUser.id,
      },
    });

    await prisma.accountPermission.createMany({
      data: [
        {
          userId: demoUser.id,
          accountId: demoChecking.id,
          canView: true,
          canDeposit: true,
          canWithdraw: true,
          canTransfer: true,
        },
        {
          userId: demoUser.id,
          accountId: demoSavings.id,
          canView: true,
          canDeposit: true,
          canWithdraw: true,
          canTransfer: true,
        },
      ],
    });

    console.log(`✅ Demo Member account created: ${demoUser.email}`);
  } else {
    console.log('ℹ️ Demo Member account already exists. Preserving balances and passwords.');
  }

  // 4. Local Development Seed: Compliance Auditor User (Role: AUDITOR)
  const auditorEmail = 'auditor@balancevault.com';
  const existingAuditor = await prisma.user.findUnique({ where: { email: auditorEmail } });

  if (!existingAuditor) {
    console.log('🌱 Seeding local compliance auditor account...');
    const auditorPasswordHash = await bcrypt.hash('Auditor@123', saltRounds);

    const auditorUser = await prisma.user.create({
      data: {
        email: auditorEmail,
        passwordHash: auditorPasswordHash,
        fullName: 'Internal Auditor',
        role: Role.AUDITOR,
        isActive: true,
      },
    });

    console.log(`✅ Compliance Auditor created: ${auditorUser.email}`);
  }

  console.log('✨ BalanceVault development database seeding completed cleanly.');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
