import { PrismaClient, Role, AccountType, AccountStatus, TransactionType, TransactionStatus, AuditStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  log: ['info', 'warn', 'error'],
});

async function main() {
  console.log('🚀 Starting BalanceVault database bootstrap and seeding...');

  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@balancevault.com';
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123';
  const adminName = process.env.DEFAULT_ADMIN_NAME || 'System Administrator';

  try {
    // 1. Hash Admin Password securely
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const adminPasswordHash = await bcrypt.hash(adminPassword, saltRounds);

    console.log(`🔐 Bootstrapping primary administrator [${adminEmail}]...`);

    // 2. Safe, idempotent User upsert (avoids raw SQL / DDL that triggers SQLSTATE 42501)
    const adminUser = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        fullName: adminName,
        role: Role.ADMIN,
        isActive: true,
      },
      create: {
        email: adminEmail,
        passwordHash: adminPasswordHash,
        fullName: adminName,
        role: Role.ADMIN,
        isActive: true,
      },
    });

    console.log(`✅ Administrator ready: ${adminUser.email} (ID: ${adminUser.id})`);

    // 3. Create or ensure Treasury Settlement Account for the Admin
    const treasuryAccount = await prisma.account.upsert({
      where: { accountNumber: 'BV-TREASURY-001' },
      update: {
        userId: adminUser.id,
        status: AccountStatus.ACTIVE,
      },
      create: {
        accountNumber: 'BV-TREASURY-001',
        name: 'Master Vault Treasury',
        type: AccountType.TREASURY,
        balance: 1000000.0000,
        currency: 'USD',
        status: AccountStatus.ACTIVE,
        userId: adminUser.id,
      },
    });

    console.log(`🏦 Treasury Account initialized: ${treasuryAccount.accountNumber} with Balance: $${treasuryAccount.balance}`);

    // 4. Create a Demo Member User for testing & hackathon demonstration
    const demoUserEmail = 'user@balancevault.com';
    const demoPasswordHash = await bcrypt.hash('User@123', saltRounds);

    const demoUser = await prisma.user.upsert({
      where: { email: demoUserEmail },
      update: {
        fullName: 'Alex Vance',
        role: Role.USER,
        isActive: true,
      },
      create: {
        email: demoUserEmail,
        passwordHash: demoPasswordHash,
        fullName: 'Alex Vance',
        role: Role.USER,
        isActive: true,
      },
    });

    // 5. Create Demo Accounts
    const demoChecking = await prisma.account.upsert({
      where: { accountNumber: 'BV-CHK-100293' },
      update: { userId: demoUser.id },
      create: {
        accountNumber: 'BV-CHK-100293',
        name: 'Primary Checking',
        type: AccountType.CHECKING,
        balance: 15420.5000,
        currency: 'USD',
        status: AccountStatus.ACTIVE,
        userId: demoUser.id,
      },
    });

    const demoSavings = await prisma.account.upsert({
      where: { accountNumber: 'BV-SAV-883012' },
      update: { userId: demoUser.id },
      create: {
        accountNumber: 'BV-SAV-883012',
        name: 'High-Yield Reserve',
        type: AccountType.SAVINGS,
        balance: 45000.0000,
        currency: 'USD',
        status: AccountStatus.ACTIVE,
        userId: demoUser.id,
      },
    });

    console.log(`👤 Demo accounts initialized for ${demoUser.email} (Checking: ${demoChecking.accountNumber}, Savings: ${demoSavings.accountNumber})`);

    // 6. Safe Audit Event Logging
    // PostgreSQL permission safe: Pure INSERT through client ORM, wrapped in safety block
    try {
      await prisma.auditLog.create({
        data: {
          action: 'SYSTEM_BOOTSTRAP',
          resource: 'SYSTEM',
          resourceId: adminUser.id,
          userId: adminUser.id,
          ipAddress: '127.0.0.1',
          userAgent: 'BalanceVault-Bootstrapper/1.0',
          status: AuditStatus.SUCCESS,
          metadata: {
            message: 'Database seeded with administrator and initial treasury accounts',
            adminEmail: adminUser.email,
            timestamp: new Date().toISOString(),
          },
        },
      });

      console.log('📜 Initial audit event recorded safely.');
    } catch (auditError: any) {
      // Gracefully handle any role/grant limitation (e.g., SQLSTATE 42501)
      if (auditError?.code === 'P2010' || auditError?.message?.includes('42501')) {
        console.warn('⚠️ [SQLSTATE 42501 Safety Notice] Audit table write was restricted by PostgreSQL role policies. Continuing bootstrap without blocking.');
      } else {
        console.warn('⚠️ Non-fatal audit log warning:', auditError?.message || auditError);
      }
    }

    console.log('\n======================================================');
    console.log('🎉 BalanceVault database bootstrap completed successfully!');
    console.log('Default Administrator Credentials:');
    console.log(`   Email:    ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log('Demo Member Credentials:');
    console.log(`   Email:    ${demoUserEmail}`);
    console.log(`   Password: User@123`);
    console.log('======================================================\n');
  } catch (error: any) {
    if (error?.message?.includes('42501') || error?.code === '42501') {
      console.error('❌ PostgreSQL Permission Error (SQLSTATE 42501): The database user lacks sufficient privileges.');
      console.error('Please ensure the DATABASE_URL user has GRANT ALL on schema public or table ownership.');
    } else {
      console.error('❌ Bootstrap failed with error:', error);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
