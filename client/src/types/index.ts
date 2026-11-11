export type Role = 'ADMIN' | 'USER' | 'AUDITOR' | 'OPERATOR';

export type AccountType = 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'TREASURY' | 'ESCROW';

export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';

export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';

export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export type AuditStatus = 'SUCCESS' | 'FAILURE' | 'WARNING';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  createdAt?: string;
  _count?: {
    accounts: number;
    initiatedTransactions: number;
  };
}

export interface Account {
  id: string;
  accountNumber: string;
  name: string;
  type: AccountType;
  balance: string | number;
  currency: string;
  status: AccountStatus;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  referenceNumber: string;
  type: TransactionType;
  amount: string | number;
  fee: string | number;
  currency: string;
  status: TransactionStatus;
  description?: string;
  sourceAccountId?: string;
  sourceAccount?: { accountNumber: string; name: string };
  destinationAccountId?: string;
  destinationAccount?: { accountNumber: string; name: string };
  initiatedById: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
  };
  ipAddress?: string;
  userAgent?: string;
  status: AuditStatus;
  metadata?: any;
  createdAt: string;
}
