const envApiUrl = (((import.meta as any).env?.VITE_API_URL as string | undefined)?.replace(/\/$/, '')) || '';
const API_BASE = envApiUrl ? `${envApiUrl}/api` : '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('bv_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('bv_token', token);
}

export function clearAuthToken(): void {
  localStorage.removeItem('bv_token');
}

export async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    let errorMsg = data?.message;
    if (!errorMsg) {
      if (response.status === 401) {
        errorMsg = 'Unauthorized: Your session has expired or is invalid. Please sign in again.';
      } else if (response.status === 403) {
        errorMsg = 'Forbidden: You do not have permission to perform this action.';
      } else {
        errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
      }
    }
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  register: (payload: any) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  bootstrapAdmin: (payload: any) => request('/auth/bootstrap-admin', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload: any) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  forgotPassword: (email: string) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (payload: any) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) }),
  setupMfa: () => request('/auth/mfa/setup', { method: 'POST' }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getMe: () => request('/auth/me'),

  // Accounts
  getMyAccounts: () => request('/accounts'),
  createAccount: (payload: any) => request('/accounts', { method: 'POST', body: JSON.stringify(payload) }),
  getAccount: (id: string) => request(`/accounts/${id}`),

  // Account Requests Workflow
  requestAccount: (payload: { accountName: string; accountType: string; requestedBalance: number; currency?: string; reason?: string }) =>
    request('/account-requests', { method: 'POST', body: JSON.stringify(payload) }),
  getAccountRequests: () => request('/account-requests'),
  getAdminAccountRequests: () => request('/admin/account-requests'),
  getAccountRequestById: (id: string) => request(`/account-requests/${id}`),
  approveAccountRequest: (id: string, payload?: { remarks?: string }) =>
    request(`/admin/account-requests/${id}/approve`, { method: 'POST', body: JSON.stringify(payload || {}) }),
  rejectAccountRequest: (id: string, payload: { remarks?: string; reason?: string }) =>
    request(`/admin/account-requests/${id}/reject`, { method: 'POST', body: JSON.stringify(payload) }),

  // Transactions with Idempotency Key support
  transfer: (payload: any, idempotencyKey?: string) =>
    request('/transactions/transfer', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
  deposit: (payload: any, idempotencyKey?: string) =>
    request('/transactions/deposit', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
  withdraw: (payload: any, idempotencyKey?: string) =>
    request('/transactions/withdraw', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
  getTransactions: (page = 1, limit = 20) => request(`/transactions?page=${page}&limit=${limit}`),

  // Double-Entry Ledger Verification
  getLedger: () => request('/ledger'),

  // Password Management
  changePassword: (payload: { currentPassword?: string; newPassword: string }) =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) }),

  // Admin & SOC
  getUsers: (page = 1, limit = 20, search?: string) =>
    request(`/admin/users?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  updateUser: (id: string, payload: any) => request(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  updateAccountPermissions: (accountId: string, payload: any) =>
    request(`/admin/accounts/${accountId}/permissions`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getAuditLogs: (page = 1, limit = 25, search?: string) =>
    request(`/admin/audit-logs?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getSecurityStats: () => request('/admin/security-stats'),

  // Health
  getHealth: () => request('/health'),
  getReady: () => request('/ready'),
};
