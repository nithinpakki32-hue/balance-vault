import { Prisma, LedgerEntryType, TransactionType, AccountType } from '@prisma/client';

export interface LedgerPostingInstruction {
  accountId: string;
  entryType: LedgerEntryType;
  amount: Prisma.Decimal;
}

export class LedgerService {
  /**
   * Verify mathematical balance: Total Debits MUST strictly equal Total Credits
   */
  static verifyDoubleEntryBalance(entries: LedgerPostingInstruction[]): boolean {
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    for (const entry of entries) {
      if (entry.entryType === LedgerEntryType.DEBIT) {
        totalDebit = totalDebit.plus(entry.amount);
      } else if (entry.entryType === LedgerEntryType.CREDIT) {
        totalCredit = totalCredit.plus(entry.amount);
      }
    }

    return totalDebit.equals(totalCredit);
  }

  /**
   * Post double-entry records inside a Prisma transaction
   */
  static async postDoubleEntry(
    tx: Prisma.TransactionClient,
    transactionId: string,
    transactionType: TransactionType,
    amount: Prisma.Decimal,
    sourceAccountId?: string | null,
    destinationAccountId?: string | null,
    clearingAccountId?: string
  ): Promise<void> {
    const instructions: LedgerPostingInstruction[] = [];

    // Helper to resolve or fallback to central settlement clearing account
    const getClearingAccount = async (): Promise<string> => {
      if (clearingAccountId) return clearingAccountId;
      const treasury = await tx.account.findFirst({
        where: {
          OR: [
            { type: AccountType.SETTLEMENT_CLEARING },
            { type: AccountType.TREASURY },
            { accountNumber: 'BV-TREASURY-001' },
          ],
        },
      });
      if (treasury) return treasury.id;
      // If none exists, create a designated settlement pool
      const newClearing = await tx.account.create({
        data: {
          accountNumber: 'BV-CLEARING-POOL',
          name: 'Central Settlement Clearing Pool',
          type: AccountType.SETTLEMENT_CLEARING,
          balance: new Prisma.Decimal(0),
          userId: (await tx.user.findFirstOrThrow({ where: { role: 'ADMIN' } })).id,
        },
      });
      return newClearing.id;
    };

    if (transactionType === TransactionType.TRANSFER) {
      if (!sourceAccountId || !destinationAccountId) {
        throw new Error('Transfer requires both source and destination account IDs for double-entry posting.');
      }
      if (sourceAccountId === destinationAccountId) {
        throw new Error('Transfer source and destination accounts cannot be identical.');
      }
      instructions.push(
        { accountId: sourceAccountId, entryType: LedgerEntryType.DEBIT, amount },
        { accountId: destinationAccountId, entryType: LedgerEntryType.CREDIT, amount }
      );
    } else if (transactionType === TransactionType.DEPOSIT) {
      if (!destinationAccountId) {
        throw new Error('Deposit requires a valid destination account ID.');
      }
      const clearingId = await getClearingAccount();
      // Clearing account is debited, customer account is credited
      instructions.push(
        { accountId: clearingId, entryType: LedgerEntryType.DEBIT, amount },
        { accountId: destinationAccountId, entryType: LedgerEntryType.CREDIT, amount }
      );
    } else if (transactionType === TransactionType.WITHDRAWAL) {
      if (!sourceAccountId) {
        throw new Error('Withdrawal requires a valid source account ID.');
      }
      const clearingId = await getClearingAccount();
      // Customer account is debited, clearing account is credited
      instructions.push(
        { accountId: sourceAccountId, entryType: LedgerEntryType.DEBIT, amount },
        { accountId: clearingId, entryType: LedgerEntryType.CREDIT, amount }
      );
    }

    // Invariant Check: Total Debits == Total Credits
    if (!this.verifyDoubleEntryBalance(instructions)) {
      throw new Error('Ledger Invariant Violation: Total Debits do not equal Total Credits.');
    }

    // Persist immutable ledger entries
    for (const inst of instructions) {
      const account = await tx.account.findUnique({ where: { id: inst.accountId } });
      const currentBalance = account?.balance || new Prisma.Decimal(0);

      await tx.ledgerEntry.create({
        data: {
          transactionId,
          accountId: inst.accountId,
          entryType: inst.entryType,
          amount: inst.amount,
          balanceAfter: currentBalance,
        },
      });
    }
  }
}
