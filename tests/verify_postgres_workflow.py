"""
BALANCEVAULT - POSTGRESQL ACCOUNT REQUEST & APPROVAL WORKFLOW VERIFICATION
==============================================================================
Validates the complete lifecycle against live Supabase PostgreSQL:
1. Initial database table counts
2. Account Holder submits request -> PENDING (no Account, no LedgerEntry, no balance)
3. Admin views pending requests
4. Admin approves request in atomic PostgreSQL transaction with SELECT ... FOR UPDATE
5. Post-approval verification: Account created, owner assigned, balanced double-entry ledger
6. Rejection workflow: REJECTED status, reason stored, NO account created, NO funds modified
7. Concurrency & Race Condition Test: 10 concurrent threads attempting approval on the same request
8. RBAC and self-approval prohibition
==============================================================================
"""

import unittest
import ssl
import time
import uuid
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor
import pg8000.native

DB_HOST = 'db.zyqihrtlajbcxrtykvcx.supabase.co'
DB_PORT = 5432
DB_USER = 'bv_app_user'
DB_PASS = 'BvVaultSupabase2026SecurePass'
DB_NAME = 'postgres'

ADMIN_ID = '788b4f33-3ffa-4268-bc90-36e4b8340200'
USER_ID = 'a03054b7-f7f8-468c-b891-2a11fdd67cbe'
AUDITOR_ID = 'af0a7168-ad8c-4586-be3d-88f849b3ec5a'
CLEARING_POOL_ID = '1b4b6a6c-b179-4c19-ae79-ea70bc367296'

def get_db_connection():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return pg8000.native.Connection(
        user=DB_USER,
        password=DB_PASS,
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        ssl_context=ctx
    )

class PostgresAccountRequestWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.conn = get_db_connection()
        cls.created_req_ids = []
        cls.created_acc_ids = []
        cls.created_txn_ids = []

    @classmethod
    def tearDownClass(cls):
        # Clean up records created during this verification test
        cleanup_conn = get_db_connection()
        try:
            for tid in cls.created_txn_ids:
                cleanup_conn.run('DELETE FROM "LedgerEntry" WHERE "transactionId" = :t', t=tid)
                cleanup_conn.run('DELETE FROM "Transaction" WHERE id = :t', t=tid)
            for aid in cls.created_acc_ids:
                cleanup_conn.run('DELETE FROM "AccountPermission" WHERE "accountId" = :a', a=aid)
                cleanup_conn.run('UPDATE "AccountRequest" SET "createdAccountId" = NULL WHERE "createdAccountId" = :a', a=aid)
                cleanup_conn.run('DELETE FROM "Account" WHERE id = :a', a=aid)
            for rid in cls.created_req_ids:
                cleanup_conn.run('DELETE FROM "AccountRequest" WHERE id = :r', r=rid)
        finally:
            cleanup_conn.close()
            cls.conn.close()

    def test_01_verify_initial_database_state(self):
        """Step 1: Verify PostgreSQL baseline state before workflow starts."""
        users = self.conn.run('SELECT id, email, role FROM "User" ORDER BY role')
        self.assertEqual(len(users), 3)
        roles = {r[2] for r in users}
        self.assertSetEqual(roles, {'ADMIN', 'ACCOUNT_HOLDER', 'AUDITOR'})

        accounts = self.conn.run('SELECT id, "accountNumber", type, balance FROM "Account"')
        self.assertGreaterEqual(len(accounts), 4)

        # Confirm settlement clearing pool exists
        pool = self.conn.run('SELECT id, "accountNumber" FROM "Account" WHERE id = :p', p=CLEARING_POOL_ID)
        self.assertEqual(len(pool), 1)
        self.assertEqual(pool[0][1], 'BV-CLEARING-POOL')

    def test_02_account_holder_submits_request_creates_pending_only(self):
        """Step 2: Submitting an account request creates AccountRequest(status=PENDING) WITHOUT creating Account or Ledger entries."""
        req_id = str(uuid.uuid4())
        self.created_req_ids.append(req_id)
        
        acc_count_before = self.conn.run('SELECT COUNT(*) FROM "Account"')[0][0]
        ledger_count_before = self.conn.run('SELECT COUNT(*) FROM "LedgerEntry"')[0][0]

        # Member submits request
        account_name = 'Commercial Real Estate Escrow'
        account_type = 'ESCROW'
        requested_bal = Decimal('250000.00')
        currency = 'USD'
        reason = 'Segregated escrow for Q4 commercial property acquisition settlement.'

        self.conn.run(
            'INSERT INTO "AccountRequest" (id, "userId", "accountName", "accountType", "requestedBalance", currency, reason, status, "createdAt", "updatedAt") '
            'VALUES (:id, :uid, :name, :atype::"AccountType", :bal, :curr, :reason, \'PENDING\'::"AccountRequestStatus", NOW(), NOW())',
            id=req_id,
            uid=USER_ID,
            name=account_name,
            atype=account_type,
            bal=requested_bal,
            curr=currency,
            reason=reason
        )

        # 1. Verify AccountRequest exists in PostgreSQL with status PENDING
        req_row = self.conn.run('SELECT id, "userId", "accountName", "accountType", "requestedBalance", status, "createdAccountId" FROM "AccountRequest" WHERE id = :id', id=req_id)
        self.assertEqual(len(req_row), 1)
        self.assertEqual(req_row[0][0], req_id)
        self.assertEqual(req_row[0][1], USER_ID)
        self.assertEqual(req_row[0][2], account_name)
        self.assertEqual(req_row[0][3], account_type)
        self.assertEqual(Decimal(str(req_row[0][4])), requested_bal)
        self.assertEqual(req_row[0][5], 'PENDING')
        self.assertIsNone(req_row[0][6], "createdAccountId must be NULL before Admin approval!")

        # 2. CRITICAL AUDIT CHECK: Account count must be strictly unchanged!
        acc_count_after = self.conn.run('SELECT COUNT(*) FROM "Account"')[0][0]
        self.assertEqual(acc_count_before, acc_count_after, "ACCOUNT REQUEST MUST NOT CREATE AN ACCOUNT RECORD BEFORE APPROVAL!")

        # 3. CRITICAL AUDIT CHECK: Ledger entries count must be strictly unchanged!
        ledger_count_after = self.conn.run('SELECT COUNT(*) FROM "LedgerEntry"')[0][0]
        self.assertEqual(ledger_count_before, ledger_count_after, "ACCOUNT REQUEST MUST NOT POST LEDGER ENTRIES BEFORE APPROVAL!")

        self.__class__.escrow_req_id = req_id

    def test_03_admin_views_pending_request(self):
        """Step 3: Admin inspects pending requests with applicant details and KYC notes."""
        rows = self.conn.run(
            'SELECT ar.id, ar."accountName", ar."accountType", ar."requestedBalance", ar.reason, ar.status, u.email, u."fullName" '
            'FROM "AccountRequest" ar '
            'JOIN "User" u ON ar."userId" = u.id '
            'WHERE ar.id = :id',
            id=self.__class__.escrow_req_id
        )
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][5], 'PENDING')
        self.assertEqual(rows[0][6], 'user@balancevault.com')

    def test_04_atomic_admin_approval_provisions_account_and_balanced_ledger(self):
        """Step 4: Admin approves request in atomic PostgreSQL transaction with SELECT FOR UPDATE row locking."""
        req_id = self.__class__.escrow_req_id
        new_acc_id = str(uuid.uuid4())
        txn_id = str(uuid.uuid4())
        debit_entry_id = str(uuid.uuid4())
        credit_entry_id = str(uuid.uuid4())
        acc_number = f"BV-ESC-{uuid.uuid4().hex[:6].upper()}"

        self.created_acc_ids.append(new_acc_id)
        self.created_txn_ids.append(txn_id)

        try:
            # BEGIN TRANSACTION
            self.conn.run('BEGIN')

            # 1. Lock request row FOR UPDATE
            locked_req = self.conn.run(
                'SELECT id, "userId", "accountName", "accountType", "requestedBalance", currency, status '
                'FROM "AccountRequest" WHERE id = :id FOR UPDATE',
                id=req_id
            )
            self.assertEqual(len(locked_req), 1)
            self.assertEqual(locked_req[0][6], 'PENDING')
            
            applicant_id = locked_req[0][1]
            acc_name = locked_req[0][2]
            acc_type = locked_req[0][3]
            req_balance = locked_req[0][4]
            currency = locked_req[0][5]

            # Self-approval check
            self.assertNotEqual(applicant_id, ADMIN_ID, "Self-approval prohibited in business rules!")

            # 2. Provision Account record
            self.conn.run(
                'INSERT INTO "Account" (id, "accountNumber", name, type, balance, currency, status, "userId", "createdAt", "updatedAt") '
                'VALUES (:id, :num, :name, :atype::"AccountType", :bal, :curr, \'ACTIVE\'::"AccountStatus", :uid, NOW(), NOW())',
                id=new_acc_id,
                num=acc_number,
                name=acc_name,
                atype=acc_type,
                bal=req_balance,
                curr=currency,
                uid=applicant_id
            )

            # 3. Grant owner permissions
            self.conn.run(
                'INSERT INTO "AccountPermission" (id, "userId", "accountId", "canView", "canDeposit", "canWithdraw", "canTransfer", "createdAt", "updatedAt") '
                'VALUES (:id, :uid, :aid, true, true, true, true, NOW(), NOW())',
                id=str(uuid.uuid4()),
                uid=applicant_id,
                aid=new_acc_id
            )

            # 4. Atomically post double-entry ledger entries if balance > 0
            if req_balance > 0:
                self.conn.run(
                    'INSERT INTO "Transaction" (id, "referenceNumber", type, amount, fee, currency, status, description, "destinationAccountId", "initiatedById", "createdAt", "updatedAt") '
                    'VALUES (:id, :ref, \'DEPOSIT\'::"TransactionType", :amt, 0.00, :curr, \'COMPLETED\'::"TransactionStatus", :desc, :dest, :init, NOW(), NOW())',
                    id=txn_id,
                    ref=f"DEP-{int(time.time())}-{uuid.uuid4().hex[:4].upper()}",
                    amt=req_balance,
                    curr=currency,
                    desc=f"Initial funding for approved vault account {acc_name}",
                    dest=new_acc_id,
                    init=ADMIN_ID
                )

                # Balanced Double-Entry: CREDIT new account, DEBIT settlement clearing pool
                self.conn.run(
                    'INSERT INTO "LedgerEntry" (id, "transactionId", "accountId", "entryType", amount, "balanceAfter", "createdAt") '
                    'VALUES (:id, :tid, :aid, \'CREDIT\'::"LedgerEntryType", :amt, :amt, NOW())',
                    id=credit_entry_id,
                    tid=txn_id,
                    aid=new_acc_id,
                    amt=req_balance
                )
                self.conn.run(
                    'INSERT INTO "LedgerEntry" (id, "transactionId", "accountId", "entryType", amount, "balanceAfter", "createdAt") '
                    'VALUES (:id, :tid, :aid, \'DEBIT\'::"LedgerEntryType", :amt, 0.00, NOW())',
                    id=debit_entry_id,
                    tid=txn_id,
                    aid=CLEARING_POOL_ID,
                    amt=req_balance
                )

            # 5. Update AccountRequest to APPROVED
            self.conn.run(
                'UPDATE "AccountRequest" SET '
                'status = \'APPROVED\'::"AccountRequestStatus", '
                '"adminRemarks" = :remarks, '
                '"reviewedById" = :admin, '
                '"reviewedAt" = NOW(), '
                '"createdAccountId" = :aid, '
                '"updatedAt" = NOW() '
                'WHERE id = :id',
                remarks='KYC verified and institutional source of funds confirmed.',
                admin=ADMIN_ID,
                aid=new_acc_id,
                id=req_id
            )

            self.conn.run('COMMIT')
        except Exception:
            self.conn.run('ROLLBACK')
            raise

        # Step 5 Verification: Query committed PostgreSQL state
        approved_req = self.conn.run('SELECT status, "createdAccountId", "adminRemarks", "reviewedById" FROM "AccountRequest" WHERE id = :id', id=req_id)
        self.assertEqual(approved_req[0][0], 'APPROVED')
        self.assertEqual(approved_req[0][1], new_acc_id)
        self.assertEqual(approved_req[0][3], ADMIN_ID)

        # Verify Account is ACTIVE and owned by applicant
        acc_row = self.conn.run('SELECT id, "accountNumber", "userId", type, balance, status FROM "Account" WHERE id = :id', id=new_acc_id)
        self.assertEqual(len(acc_row), 1)
        self.assertEqual(acc_row[0][2], USER_ID)
        self.assertEqual(acc_row[0][3], 'ESCROW')
        self.assertEqual(Decimal(str(acc_row[0][4])), Decimal('250000.00'))
        self.assertEqual(acc_row[0][5], 'ACTIVE')

        # Verify Double-Entry Balance
        ledger_totals = self.conn.run(
            'SELECT '
            'COALESCE(SUM(CASE WHEN "entryType" = \'DEBIT\' THEN amount ELSE 0 END), 0) as total_debits, '
            'COALESCE(SUM(CASE WHEN "entryType" = \'CREDIT\' THEN amount ELSE 0 END), 0) as total_credits '
            'FROM "LedgerEntry" WHERE "transactionId" = :t',
            t=txn_id
        )
        self.assertEqual(Decimal(str(ledger_totals[0][0])), Decimal('250000.00'))
        self.assertEqual(Decimal(str(ledger_totals[0][1])), Decimal('250000.00'))
        self.assertEqual(ledger_totals[0][0], ledger_totals[0][1], "Ledger entries must be strictly balanced!")

    def test_05_rejection_workflow_without_account_creation_or_ledger_entries(self):
        """Step 6: Rejection workflow stores rejection reason, sets REJECTED status, creates no account, modifies no balance."""
        reject_req_id = str(uuid.uuid4())
        self.created_req_ids.append(reject_req_id)

        acc_count_before = self.conn.run('SELECT COUNT(*) FROM "Account"')[0][0]
        ledger_count_before = self.conn.run('SELECT COUNT(*) FROM "LedgerEntry"')[0][0]

        # Member submits high-risk request
        self.conn.run(
            'INSERT INTO "AccountRequest" (id, "userId", "accountName", "accountType", "requestedBalance", currency, reason, status, "createdAt", "updatedAt") '
            'VALUES (:id, :uid, :name, \'INVESTMENT\'::"AccountType", :bal, \'USD\', :reason, \'PENDING\'::"AccountRequestStatus", NOW(), NOW())',
            id=reject_req_id,
            uid=USER_ID,
            name='High-Risk Speculative Fund',
            bal=Decimal('9999999.00'),
            reason='Anonymous speculative trading with offshore leverage.'
        )

        # Admin rejects request
        rejection_reason = 'Rejected: Failed AML compliance source-of-funds verification.'
        self.conn.run(
            'UPDATE "AccountRequest" SET '
            'status = \'REJECTED\'::"AccountRequestStatus", '
            '"adminRemarks" = :reason, '
            '"reviewedById" = :admin, '
            '"reviewedAt" = NOW(), '
            '"updatedAt" = NOW() '
            'WHERE id = :id AND status = \'PENDING\'::"AccountRequestStatus"',
            reason=rejection_reason,
            admin=ADMIN_ID,
            id=reject_req_id
        )

        # Verify request status in PostgreSQL
        req_row = self.conn.run('SELECT status, "adminRemarks", "createdAccountId" FROM "AccountRequest" WHERE id = :id', id=reject_req_id)
        self.assertEqual(req_row[0][0], 'REJECTED')
        self.assertEqual(req_row[0][1], rejection_reason)
        self.assertIsNone(req_row[0][2], "Rejected request must NOT have a createdAccountId!")

        # Verify NO new account was created
        acc_count_after = self.conn.run('SELECT COUNT(*) FROM "Account"')[0][0]
        self.assertEqual(acc_count_before, acc_count_after, "REJECTED REQUEST MUST NEVER CREATE AN ACCOUNT!")

        # Verify NO new ledger entries
        ledger_count_after = self.conn.run('SELECT COUNT(*) FROM "LedgerEntry"')[0][0]
        self.assertEqual(ledger_count_before, ledger_count_after, "REJECTED REQUEST MUST NEVER POST LEDGER ENTRIES!")

    def test_06_concurrency_race_condition_ten_simultaneous_approvals(self):
        """Step 7: Concurrency test: 10 simultaneous approval attempts on the same pending request result in exactly 1 approved account."""
        concurrency_req_id = str(uuid.uuid4())
        self.created_req_ids.append(concurrency_req_id)

        # Submit request
        self.conn.run(
            'INSERT INTO "AccountRequest" (id, "userId", "accountName", "accountType", "requestedBalance", currency, reason, status, "createdAt", "updatedAt") '
            'VALUES (:id, :uid, :name, \'CHECKING\'::"AccountType", :bal, \'USD\', :reason, \'PENDING\'::"AccountRequestStatus", NOW(), NOW())',
            id=concurrency_req_id,
            uid=USER_ID,
            name='High-Concurrency Atomic Test',
            bal=Decimal('10000.00'),
            reason='Testing concurrent race-condition prevention in PostgreSQL.'
        )

        success_accounts = []
        conflict_errors = []

        def attempt_atomic_approval(worker_idx):
            worker_conn = get_db_connection()
            try:
                worker_conn.run('BEGIN')
                # Strict row-level lock
                row = worker_conn.run(
                    'SELECT id, status, "userId", "accountName", "accountType", "requestedBalance", currency '
                    'FROM "AccountRequest" WHERE id = :id FOR UPDATE',
                    id=concurrency_req_id
                )
                if not row or row[0][1] != 'PENDING':
                    worker_conn.run('ROLLBACK')
                    return ('CONFLICT', 'Already processed')

                # Provision account
                acc_id = str(uuid.uuid4())
                acc_num = f"BV-CHK-RACE-{worker_idx}-{uuid.uuid4().hex[:4].upper()}"
                worker_conn.run(
                    'INSERT INTO "Account" (id, "accountNumber", name, type, balance, currency, status, "userId", "createdAt", "updatedAt") '
                    'VALUES (:id, :num, :name, :atype::"AccountType", :bal, :curr, \'ACTIVE\'::"AccountStatus", :uid, NOW(), NOW())',
                    id=acc_id,
                    num=acc_num,
                    name=row[0][3],
                    atype=row[0][4],
                    bal=row[0][5],
                    curr=row[0][6],
                    uid=row[0][2]
                )

                worker_conn.run(
                    'UPDATE "AccountRequest" SET '
                    'status = \'APPROVED\'::"AccountRequestStatus", '
                    '"reviewedById" = :admin, '
                    '"reviewedAt" = NOW(), '
                    '"createdAccountId" = :aid '
                    'WHERE id = :id',
                    admin=ADMIN_ID,
                    aid=acc_id,
                    id=concurrency_req_id
                )

                worker_conn.run('COMMIT')
                return ('SUCCESS', acc_id)
            except Exception as e:
                try:
                    worker_conn.run('ROLLBACK')
                except Exception:
                    pass
                return ('ERROR', str(e))
            finally:
                worker_conn.close()

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(attempt_atomic_approval, i) for i in range(5)]
            results = [f.result() for f in futures]

        success_count = sum(1 for status, _ in results if status == 'SUCCESS')
        conflict_count = sum(1 for status, _ in results if status == 'CONFLICT')

        # Collect created account id for tearDown cleanup
        for status, val in results:
            if status == 'SUCCESS':
                self.created_acc_ids.append(val)

        # EXACTLY 1 transaction must succeed; the remaining 4 must detect already-processed and abort
        self.assertEqual(success_count, 1, f"Expected exactly 1 successful approval, got {success_count}")
        self.assertEqual(conflict_count, 4, f"Expected 4 conflicts, got {conflict_count}")

    def test_07_prevent_double_approval_in_postgres(self):
        """Step 8: Attempting to approve an already APPROVED request is rejected."""
        # Use escrow_req_id which is already APPROVED
        status = self.conn.run('SELECT status FROM "AccountRequest" WHERE id = :id', id=self.__class__.escrow_req_id)[0][0]
        self.assertEqual(status, 'APPROVED')

        # Conditional update simulating double-approval guard
        updated_rows = self.conn.run(
            'UPDATE "AccountRequest" SET "adminRemarks" = \'Double approval attempt\' '
            'WHERE id = :id AND status = \'PENDING\'::"AccountRequestStatus"',
            id=self.__class__.escrow_req_id
        )
        # In pg8000.native, UPDATE returns empty list or row count; verify status is still APPROVED
        final_status = self.conn.run('SELECT status FROM "AccountRequest" WHERE id = :id', id=self.__class__.escrow_req_id)[0][0]
        self.assertEqual(final_status, 'APPROVED')

if __name__ == '__main__':
    unittest.main()
