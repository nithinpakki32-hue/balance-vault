import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { Sidebar } from './components/Sidebar.js';
import { TransferModal } from './components/TransferModal.js';
import { CreateAccountModal } from './components/CreateAccountModal.js';
import { OnboardingModal } from './components/OnboardingModal.js';
import { AuthPage } from './pages/AuthPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { AccountsPage } from './pages/AccountsPage.js';
import { TransactionsPage } from './pages/TransactionsPage.js';
import { AdminAuditPage } from './pages/AdminAuditPage.js';
import { AdminUsersPage } from './pages/AdminUsersPage.js';
import { Account, Transaction } from './types/index.js';
import { api } from './services/api.js';

const MainLayout: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoadingData(true);
    try {
      const [accRes, txnRes] = await Promise.all([
        api.getMyAccounts(),
        api.getTransactions(1, 30),
      ]);

      if (accRes.success) setAccounts(accRes.accounts);
      if (txnRes.success) setTransactions(txnRes.transactions);
    } catch (err) {
      console.error('Failed to load ledger data:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
      // Show onboarding if first visit
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
          <p className="text-xs font-mono text-cyan-400">Initializing BalanceVault Core...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col text-slate-100 font-sans">
      <Navbar onOpenOnboarding={() => setIsOnboardingOpen(true)} />

      <div className="flex flex-1">
        <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />

        <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {currentTab === 'dashboard' && (
            <DashboardPage
              accounts={accounts}
              transactions={transactions}
              onOpenTransfer={() => setIsTransferModalOpen(true)}
              onOpenCreateAccount={() => setIsCreateAccountOpen(true)}
              onRefresh={loadData}
              isLoading={isLoadingData}
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
            />
          )}

          {currentTab === 'admin-audit' && <AdminAuditPage />}

          {currentTab === 'admin-users' && <AdminUsersPage />}
        </main>
      </div>

      {/* Modals */}
      <TransferModal
        accounts={accounts}
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
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
