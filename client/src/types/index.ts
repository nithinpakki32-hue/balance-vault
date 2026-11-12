export type Role = 'ADMIN' | 'ACCOUNT_HOLDER' | 'AUDITOR' | 'USER';

export type AccountType = 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'TREASURY' | 'ESCROW' | 'SETTLEMENT_CLEARING';

export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';

export type AccountRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';

export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export type AuditStatus = 'SUCCESS' | 'FAILURE' | 'WARNING';

export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AccountPermission {
  id: string;
  userId: string;
  accountId: string;
  canView: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
  canTransfer: boolean;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  failedLoginAttempts?: number;
  lockoutUntil?: string | null;
  mfaEnabled?: boolean;
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
  permissions?: AccountPermission[];
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

export interface SecurityEvent {
  id: string;
  eventType: string;
  severity: SecuritySeverity;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface SecurityStats {
  totalFailedLogins: number;
  lockedAccounts: number;
  unauthorizedAttempts: number;
  rateLimitViolations: number;
  securityAlerts: Array<{ level: string; message: string }>;
  lastSecurityAuditDate: string;
  complianceStatus: string;
  recentSecurityEvents: SecurityEvent[];
}

export interface AccountRequest {
  id: string;
  userId: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
    role?: Role;
  };
  accountName: string;
  accountType: AccountType;
  requestedBalance: string | number;
  currency: string;
  reason?: string;
  status: AccountRequestStatus;
  adminRemarks?: string | null;
  reviewedById?: string | null;
  reviewedBy?: {
    id: string;
    email: string;
    fullName: string;
  } | null;
  reviewedAt?: string | null;
  createdAccountId?: string | null;
  createdAccount?: Account | null;
  createdAt: string;
  updatedAt: string;
}
