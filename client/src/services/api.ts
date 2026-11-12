const API_BASE = '/api';

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
    const errorMsg = data?.message || `HTTP Error ${response.status}: ${response.statusText}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  register: (payload: any) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
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

  // Transactions
  transfer: (payload: any) => request('/transactions/transfer', { method: 'POST', body: JSON.stringify(payload) }),
  deposit: (payload: any) => request('/transactions/deposit', { method: 'POST', body: JSON.stringify(payload) }),
  getTransactions: (page = 1, limit = 20) => request(`/transactions?page=${page}&limit=${limit}`),

  // Admin & SOC
  getUsers: (page = 1, limit = 20, search?: string) =>
    request(`/admin/users?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  updateUser: (id: string, payload: any) => request(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getAuditLogs: (page = 1, limit = 25, search?: string) =>
    request(`/admin/audit-logs?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getSecurityStats: () => request('/admin/security-stats'),

  // Health
  getHealth: () => request('/health'),
  getReady: () => request('/ready'),
};
