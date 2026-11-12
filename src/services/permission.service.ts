import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export class PermissionService {
  /**
   * Verify if a user is permitted to perform a financial action on an account
   */
  static async checkAccountPermission(
    userId: string,
    role: Role,
    accountId: string,
    action: 'view' | 'deposit' | 'withdraw' | 'transfer'
  ): Promise<{ allowed: boolean; reason?: string }> {
    // 1. AUDITOR role is strictly read-only
    if (role === Role.AUDITOR) {
      if (action === 'view') {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Auditors are strictly restricted to read-only access and cannot perform financial mutations.',
      };
    }

    // 2. ADMIN has oversight authority
    if (role === Role.ADMIN) {
      return { allowed: true };
    }

    // 3. ACCOUNT_HOLDER: Check account ownership & permissions
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        permissions: {
          where: { userId },
        },
      },
    });

    if (!account) {
      return { allowed: false, reason: 'Target account not found.' };
    }

    const isOwner = account.userId === userId;
    const explicitPerm = account.permissions[0];

    if (action === 'view') {
      const allowed = isOwner || (explicitPerm && explicitPerm.canView);
      return { allowed: !!allowed, reason: allowed ? undefined : 'Permission denied: cannot view this account.' };
    }

    if (action === 'deposit') {
      const allowed = isOwner || (explicitPerm && explicitPerm.canDeposit);
      return { allowed: !!allowed, reason: allowed ? undefined : 'Permission denied: deposit privilege not granted on this account.' };
    }

    if (action === 'withdraw') {
      const allowed = isOwner || (explicitPerm && explicitPerm.canWithdraw);
      return { allowed: !!allowed, reason: allowed ? undefined : 'Permission denied: withdrawal privilege not granted on this account.' };
    }

    if (action === 'transfer') {
      const allowed = isOwner || (explicitPerm && explicitPerm.canTransfer);
      return { allowed: !!allowed, reason: allowed ? undefined : 'Permission denied: transfer privilege not granted on this account.' };
    }

    return { allowed: false, reason: 'Unauthorized operation.' };
  }
}
