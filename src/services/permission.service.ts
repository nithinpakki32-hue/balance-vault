import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export class PermissionService {
  /**
   * Verify if a user is permitted to perform a financial action on an account.
   * Default-Deny: Access is denied unless an active, explicit authorization allows it.
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

    // 3. ACCOUNT_HOLDER: Look up account and specific permissions
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

    // Deactivated, frozen, or closed accounts cannot process transactions
    if (account.status !== 'ACTIVE' && action !== 'view') {
      return {
        allowed: false,
        reason: `Account status is ${account.status.toLowerCase()} and cannot process financial mutations.`,
      };
    }

    const explicitPerm = account.permissions[0];
    if (!explicitPerm) {
      // Default Deny: If no permission record exists for this user on this account, deny access.
      return { allowed: false, reason: 'Permission denied: no account privileges granted.' };
    }

    if (action === 'view') {
      return explicitPerm.canView
        ? { allowed: true }
        : { allowed: false, reason: 'Permission denied: cannot view this account.' };
    }

    if (action === 'deposit') {
      return explicitPerm.canDeposit
        ? { allowed: true }
        : { allowed: false, reason: 'Permission denied: deposit privilege not granted on this account.' };
    }

    if (action === 'withdraw') {
      return explicitPerm.canWithdraw
        ? { allowed: true }
        : { allowed: false, reason: 'Permission denied: withdrawal privilege not granted on this account.' };
    }

    if (action === 'transfer') {
      return explicitPerm.canTransfer
        ? { allowed: true }
        : { allowed: false, reason: 'Permission denied: transfer privilege not granted on this account.' };
    }

    return { allowed: false, reason: 'Unauthorized operation.' };
  }
}
