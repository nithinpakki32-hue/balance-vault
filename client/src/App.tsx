import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { Sidebar } from './components/Sidebar.js';
import { TransactionModal } from './components/TransactionModal.js';
import { CreateAccountModal } from './components/CreateAccountModal.js';
import { OnboardingModal } from './components/OnboardingModal.js';
import { AuthPage } from './pages/AuthPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { AccountsPage } from './pages/AccountsPage.js';
import { TransactionsPage } from './pages/TransactionsPage.js';
import { AccountRequestsPage } from './pages/AccountRequestsPage.js';
import { LedgerPage } from './pages/LedgerPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { SecurityPage } from './pages/SecurityPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { AdminUsersPage } from './pages/AdminUsersPage.js';
import { Account, Transaction } from './types/index.js';
import { api } from './services/api.js';

const VALID_TABS = [
  'dashboard',
  'accounts',
  'transactions',
  'requests',
  'ledger',
  'reports',
  'security',
  'profile',
  'admin-users',
];

const MainLayout: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth();

  const getInitialTab = (): string => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (VALID_TABS.includes(hash)) {
      return hash;
    }
    // Backward compatibility with legacy routes
    if (hash === 'admin-security' || hash === 'admin-audit') return 'security';
    if (hash === 'admin-account-requests') return 'requests';
    return 'dashboard';
  };

  const [currentTab, setCurrentTab] = useState<string>(getInitialTab());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Modals
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Sync hash to state
  const handleSelectTab = (tab: string) => {
    setCurrentTab(tab);
    window.location.hash = tab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Browser back/forward navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (VALID_TABS.includes(hash) && hash !== currentTab) {
        setCurrentTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentTab]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoadingData(true);
    try {
      const [accRes, txnRes, reqRes] = await Promise.all([
        api.getMyAccounts(),
        api.getTransactions(1, 50),
        api.getAccountRequests().catch(() => ({ success: false, requests: [] })),
      ]);

      if (accRes.success) setAccounts(accRes.accounts || []);
      if (txnRes.success) setTransactions(txnRes.transactions || []);
      if (reqRes.success && reqRes.requests) {
        const pending = reqRes.requests.filter((r: any) => r.status === 'PENDING').length;
        setPendingRequestsCount(pending);
      }
    } catch (err) {
      console.error('Failed to load ledger data:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
      const hasSeen = localStorage.getItem('bv_seen_onboarding');
      if (!hasSeen) {
        setIsOnboardingOpen(true);
        localStorage.setItem('bv_seen_onboarding', 'true');
      }
    }
  }, [user, loadData]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono text-cyan-400">Initializing BalanceVault SPA Core...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col text-slate-100 font-sans">
      <Navbar
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        onSelectTab={handleSelectTab}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
        pendingRequestsCount={pendingRequestsCount}
      />

      <div className="flex flex-1">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          pendingRequestsCount={pendingRequestsCount}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full transition-all">
          {currentTab === 'dashboard' && (
            <DashboardPage
              accounts={accounts}
              transactions={transactions}
              onOpenTransfer={() => setIsTransactionModalOpen(true)}
              onOpenCreateAccount={() => setIsCreateAccountOpen(true)}
              onRefresh={loadData}
              isLoading={isLoadingData}
              onNavigateTab={handleSelectTab}
            />
          )}

          {currentTab === 'accounts' && (
            <AccountsPage
              accounts={accounts}
              onOpenCreateAccount={() => setIsCreateAccountOpen(true)}
              onRefresh={loadData}
            />
          )}

          {currentTab === 'transactions' && (
            <TransactionsPage
              transactions={transactions}
              onRefresh={loadData}
              isLoading={isLoadingData}
              onOpenTransactionModal={() => setIsTransactionModalOpen(true)}
            />
          )}

          {currentTab === 'requests' && (
            <AccountRequestsPage onRefreshParent={loadData} />
          )}

          {currentTab === 'ledger' && <LedgerPage />}

          {currentTab === 'reports' && (
            <ReportsPage
              accounts={accounts}
              transactions={transactions}
              onRefresh={loadData}
            />
          )}

          {currentTab === 'security' && (
            <SecurityPage onNavigateProfile={() => handleSelectTab('profile')} />
          )}

          {currentTab === 'profile' && (
            <ProfilePage accounts={accounts} onOpenCreateAccount={() => setIsCreateAccountOpen(true)} />
          )}

          {currentTab === 'admin-users' && <AdminUsersPage />}
        </main>
      </div>

      {/* Modals */}
      <TransactionModal
        accounts={accounts}
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        onSuccess={loadData}
      />

      <CreateAccountModal
        isOpen={isCreateAccountOpen}
        onClose={() => setIsCreateAccountOpen(false)}
        onSuccess={loadData}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
};

export default App;
