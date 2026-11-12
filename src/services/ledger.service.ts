import { Prisma, LedgerEntryType, TransactionType } from '@prisma/client';

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

    if (transactionType === TransactionType.TRANSFER) {
      if (!sourceAccountId || !destinationAccountId) {
        throw new Error('Transfer requires both source and destination account IDs for double-entry posting.');
      }
      instructions.push(
        { accountId: sourceAccountId, entryType: LedgerEntryType.DEBIT, amount },
        { accountId: destinationAccountId, entryType: LedgerEntryType.CREDIT, amount }
      );
    } else if (transactionType === TransactionType.DEPOSIT) {
      if (!destinationAccountId) {
        throw new Error('Deposit requires a valid destination account ID.');
      }
      // Central clearing account is debited, customer account is credited
      const settlementId = clearingAccountId || destinationAccountId;
      instructions.push(
        { accountId: settlementId, entryType: LedgerEntryType.DEBIT, amount },
        { accountId: destinationAccountId, entryType: LedgerEntryType.CREDIT, amount }
      );
    } else if (transactionType === TransactionType.WITHDRAWAL) {
      if (!sourceAccountId) {
        throw new Error('Withdrawal requires a valid source account ID.');
      }
      // Customer account is debited, settlement/cash clearing account is credited
      const settlementId = clearingAccountId || sourceAccountId;
      instructions.push(
        { accountId: sourceAccountId, entryType: LedgerEntryType.DEBIT, amount },
        { accountId: settlementId, entryType: LedgerEntryType.CREDIT, amount }
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
