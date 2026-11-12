import unittest
import urllib.request
import urllib.error
import json
import time
import hmac
import hashlib
import struct
import threading
from concurrent.futures import ThreadPoolExecutor

BASE_URL = 'http://127.0.0.1:8000'

def generate_totp(secret_hex: str) -> str:
    key = bytes.fromhex(secret_hex)
    step = int(time.time() / 30)
    time_buf = struct.pack('>Q', step)
    h = hmac.new(key, time_buf, hashlib.sha1).digest()
    offset = h[-1] & 0x0f
    code = struct.unpack('>I', h[offset:offset+4])[0] & 0x7fffffff
    return str(code % 1000000).zfill(6)

class AccountRequestWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # 1. Login as Admin
        totp = generate_totp('3132333435363738393031323334353637383930')
        req = urllib.request.Request(
            f'{BASE_URL}/api/auth/login',
            data=json.dumps({'email': 'admin@balancevault.com', 'password': 'Admin@123', 'mfaCode': totp}).encode(),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            cls.admin_token = data['token']
            cls.admin_id = data['user']['id']

        # 2. Login as Account Holder
        req = urllib.request.Request(
            f'{BASE_URL}/api/auth/login',
            data=json.dumps({'email': 'user@balancevault.com', 'password': 'User@123'}).encode(),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            cls.user_token = data['token']
            cls.user_id = data['user']['id']

        # 3. Login as Auditor
        req = urllib.request.Request(
            f'{BASE_URL}/api/auth/login',
            data=json.dumps({'email': 'auditor@balancevault.com', 'password': 'Auditor@123'}).encode(),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            cls.auditor_token = data['token']
            cls.auditor_id = data['user']['id']

    def test_01_account_holder_submits_account_request(self):
        """Scenario 1: Account Holder submits an account opening request; status is PENDING and no account created yet."""
        payload = {
            'accountName': 'Commercial Real Estate Escrow',
            'accountType': 'ESCROW',
            'requestedBalance': 250000.00,
            'currency': 'USD',
            'reason': 'Segregated escrow for Q4 property acquisition settlement.'
        }
        req = urllib.request.Request(
            f'{BASE_URL}/api/account-requests',
            data=json.dumps(payload).encode(),
            headers={'Authorization': f'Bearer {self.user_token}', 'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 201)
            data = json.loads(resp.read().decode())
            self.assertTrue(data['success'])
            self.assertEqual(data['message'], 'Your account request has been submitted successfully. Waiting for Admin approval.')
            self.assertIn('requestId', data)
            request = data['request']
            self.assertEqual(data['requestId'], request['id'])
            self.assertEqual(request['status'], 'PENDING')
            self.assertEqual(request['userId'], self.user_id)
            self.assertEqual(request['accountName'], 'Commercial Real Estate Escrow')
            self.assertEqual(request['accountType'], 'ESCROW')
            self.assertEqual(float(request['requestedBalance']), 250000.00)
            self.assertIsNone(request.get('createdAccountId'))
            self.__class__.created_request_id = request['id']

    def test_02_account_holder_cannot_directly_create_account(self):
        """Scenario 2: Verified that Account Holder cannot directly create an account (HTTP 403 Forbidden)."""
        payload = {
            'name': 'Direct Account Creation Attempt',
            'type': 'CHECKING',
            'initialBalance': 1000.00
        }
        req = urllib.request.Request(
            f'{BASE_URL}/api/accounts',
            data=json.dumps(payload).encode(),
            headers={'Authorization': f'Bearer {self.user_token}', 'Content-Type': 'application/json'}
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req)
        self.assertEqual(ctx.exception.code, 403)
        body = json.loads(ctx.exception.read().decode())
        self.assertIn('Direct account creation is restricted to administrators', body['message'])

    def test_03_viewing_pending_requests_in_admin_dashboard(self):
        """Scenario 3: Viewing pending requests in Admin Dashboard; Admins view all, Account Holders view only their own."""
        # 1. Admin views all requests
        req_admin = urllib.request.Request(
            f'{BASE_URL}/api/account-requests',
            headers={'Authorization': f'Bearer {self.admin_token}'}
        )
        with urllib.request.urlopen(req_admin) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode())
            self.assertTrue(data['success'])
            requests = data['requests']
            self.assertGreaterEqual(len(requests), 1)
            target = next((r for r in requests if r['id'] == self.__class__.created_request_id), None)
            self.assertIsNotNone(target)
            self.assertEqual(target['accountName'], 'Commercial Real Estate Escrow')
            self.assertEqual(target['user']['id'], self.user_id)

        # 2. Account Holder views only their own
        req_user = urllib.request.Request(
            f'{BASE_URL}/api/account-requests',
            headers={'Authorization': f'Bearer {self.user_token}'}
        )
        with urllib.request.urlopen(req_user) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode())
            for r in data['requests']:
                self.assertEqual(r['userId'], self.user_id)

    def test_04_successful_approval_creates_account_and_ledger(self):
        """Scenario 4: Successful approval creates the account with owner permissions and ledger entries."""
        payload = {'remarks': 'KYC documentation and institutional capital verified.'}
        req = urllib.request.Request(
            f'{BASE_URL}/api/account-requests/{self.__class__.created_request_id}/approve',
            data=json.dumps(payload).encode(),
            headers={'Authorization': f'Bearer {self.admin_token}', 'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode())
            self.assertTrue(data['success'])
            req_data = data['request']
            acc_data = data['account']

            self.assertEqual(req_data['status'], 'APPROVED')
            self.assertEqual(req_data['reviewedById'], self.admin_id)
            self.assertEqual(req_data['adminRemarks'], 'KYC documentation and institutional capital verified.')
            self.assertEqual(acc_data['userId'], self.user_id)
            self.assertEqual(float(acc_data['balance']), 250000.00)
            self.assertTrue(acc_data['accountNumber'].startswith('BV-ESC-'))

        # Verify ledger debits equal credits
        ledger_req = urllib.request.Request(
            f'{BASE_URL}/api/ledger',
            headers={'Authorization': f'Bearer {self.admin_token}'}
        )
        with urllib.request.urlopen(ledger_req) as resp:
            ledger_data = json.loads(resp.read().decode())
            self.assertTrue(ledger_data['balanced'])
            self.assertAlmostEqual(ledger_data['totalDebits'], ledger_data['totalCredits'], places=2)

    def test_05_successful_rejection_stores_reason_without_creating_account(self):
        """Scenario 5: Successful rejection stores the reason without creating an account or modifying balances."""
        # Submit a new request
        submit_req = urllib.request.Request(
            f'{BASE_URL}/api/account-requests',
            data=json.dumps({
                'accountName': 'Dubious Offshore Trust',
                'accountType': 'INVESTMENT',
                'requestedBalance': 9999999.00,
                'reason': 'Anonymous speculative trading.'
            }).encode(),
            headers={'Authorization': f'Bearer {self.user_token}', 'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(submit_req) as resp:
            req_id = json.loads(resp.read().decode())['request']['id']

        # Count accounts before rejection
        acc_req = urllib.request.Request(f'{BASE_URL}/api/accounts', headers={'Authorization': f'Bearer {self.admin_token}'})
        with urllib.request.urlopen(acc_req) as resp:
            acc_count_before = len(json.loads(resp.read().decode())['accounts'])

        # Reject the request
        reject_req = urllib.request.Request(
            f'{BASE_URL}/api/account-requests/{req_id}/reject',
            data=json.dumps({'remarks': 'Rejected: Failed AML compliance source-of-funds verification.'}).encode(),
            headers={'Authorization': f'Bearer {self.admin_token}', 'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(reject_req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode())
            self.assertTrue(data['success'])
            self.assertEqual(data['request']['status'], 'REJECTED')
            self.assertEqual(data['request']['adminRemarks'], 'Rejected: Failed AML compliance source-of-funds verification.')

        # Verify no new account was created
        with urllib.request.urlopen(acc_req) as resp:
            acc_count_after = len(json.loads(resp.read().decode())['accounts'])
            self.assertEqual(acc_count_before, acc_count_after)

    def test_06_rejection_of_approval_attempt_by_account_holder(self):
        """Scenario 6: Rejection of approval attempt by an Account Holder (HTTP 403 Forbidden)."""
        # Create a request
        submit_req = urllib.request.Request(
            f'{BASE_URL}/api/account-requests',
            data=json.dumps({'accountName': 'Unauthorized Self-Approval Test', 'accountType': 'SAVINGS', 'requestedBalance': 100}).encode(),
            headers={'Authorization': f'Bearer {self.user_token}', 'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(submit_req) as resp:
            req_id = json.loads(resp.read().decode())['request']['id']

        # Attempt approval with account holder token
        approve_req = urllib.request.Request(
            f'{BASE_URL}/api/account-requests/{req_id}/approve',
            data=json.dumps({'remarks': 'Self approving'}).encode(),
            headers={'Authorization': f'Bearer {self.user_token}', 'Content-Type': 'application/json'}
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(approve_req)
        self.assertEqual(ctx.exception.code, 403)
        body = json.loads(ctx.exception.read().decode())
        self.assertIn('Only administrators can approve account requests', body['message'])

    def test_07_rejection_of_approval_attempt_by_auditor(self):
        """Scenario 7: Rejection of approval attempt by an Auditor (HTTP 403 Forbidden)."""
        # Create a request
        submit_req = urllib.request.Request(
            f'{BASE_URL}/api/account-requests',
            data=json.dumps({'accountName': 'Auditor Approval Block Test', 'accountType': 'CHECKING', 'requestedBalance': 500}).encode(),
            headers={'Authorization': f'Bearer {self.user_token}', 'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(submit_req) as resp:
            req_id = json.loads(resp.read().decode())['request']['id']

        # Attempt approval with auditor token
        approve_req = urllib.request.Request(
            f'{BASE_URL}/api/account-requests/{req_id}/approve',
            data=json.dumps({'remarks': 'Auditor attempting approval'}).encode(),
            headers={'Authorization': f'Bearer {self.auditor_token}', 'Content-Type': 'application/json'}
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(approve_req)
        self.assertEqual(ctx.exception.code, 403)
        body = json.loads(ctx.exception.read().decode())
        self.assertIn('Only administrators can approve account requests', body['message'])

        # Also verify auditor cannot submit requests (strictly read-only)
        auditor_submit = urllib.request.Request(
            f'{BASE_URL}/api/account-requests',
            data=json.dumps({'accountName': 'Auditor Submit Attempt', 'accountType': 'CHECKING', 'requestedBalance': 0}).encode(),
            headers={'Authorization': f'Bearer {self.auditor_token}', 'Content-Type': 'application/json'}
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(auditor_submit)
        self.assertEqual(ctx.exception.code, 403)
        self.assertIn('Auditor', json.loads(ctx.exception.read().decode())['message'])

    def test_08_prevention_of_double_approval(self):
        """Scenario 8: Prevention of double-approval for the same request (HTTP 409 Conflict)."""
        # Submit a fresh request
        submit_req = urllib.request.Request(
            f'{BASE_URL}/api/account-requests',
            data=json.dumps({'accountName': 'Single Approval Guard Test', 'accountType': 'CHECKING', 'requestedBalance': 1000.00}).encode(),
            headers={'Authorization': f'Bearer {self.user_token}', 'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(submit_req) as resp:
            req_id = json.loads(resp.read().decode())['request']['id']

        # First approval must succeed
        approve_req = urllib.request.Request(
            f'{BASE_URL}/api/account-requests/{req_id}/approve',
            data=json.dumps({'remarks': 'First legitimate approval'}).encode(),
            headers={'Authorization': f'Bearer {self.admin_token}', 'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(approve_req) as resp:
            self.assertEqual(resp.status, 200)

        # Second approval attempt must be rejected with 409 Conflict
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(approve_req)
        self.assertEqual(ctx.exception.code, 409)
        body = json.loads(ctx.exception.read().decode())
        self.assertIn('already APPROVED', body['message'])

    def test_09_concurrency_race_condition_ten_simultaneous_approvals(self):
        """Scenario 9: Concurrency test: 10 simultaneous approval attempts for the same request result in exactly 1 approved account."""
        # Submit a fresh request
        submit_req = urllib.request.Request(
            f'{BASE_URL}/api/account-requests',
            data=json.dumps({'accountName': 'High-Concurrency Atomic Test', 'accountType': 'CHECKING', 'requestedBalance': 5000.00}).encode(),
            headers={'Authorization': f'Bearer {self.user_token}', 'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(submit_req) as resp:
            req_id = json.loads(resp.read().decode())['request']['id']

        results = []

        def attempt_approve():
            req = urllib.request.Request(
                f'{BASE_URL}/api/account-requests/{req_id}/approve',
                data=json.dumps({'remarks': 'Concurrent race attempt'}).encode(),
                headers={'Authorization': f'Bearer {self.admin_token}', 'Content-Type': 'application/json'}
            )
            try:
                with urllib.request.urlopen(req) as resp:
                    return ('SUCCESS', resp.status)
            except urllib.error.HTTPError as e:
                return ('ERROR', e.code)

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(attempt_approve) for _ in range(10)]
            results = [f.result() for f in futures]

        success_count = sum(1 for status, code in results if status == 'SUCCESS' and code == 200)
        conflict_count = sum(1 for status, code in results if status == 'ERROR' and code == 409)

        # Exactly 1 approval must succeed, remaining 9 must fail with 409 Conflict
        self.assertEqual(success_count, 1)
        self.assertEqual(conflict_count, 9)

    def test_10_permissions_and_audit_trail_verification(self):
        """Scenario 10: Permissions and audit trail verification (owner permissions, audit logs, and self-approval prevention)."""
        # 1. Audit logs contain the relevant action types
        audit_req = urllib.request.Request(
            f'{BASE_URL}/api/admin/audit-logs',
            headers={'Authorization': f'Bearer {self.admin_token}'}
        )
        with urllib.request.urlopen(audit_req) as resp:
            self.assertEqual(resp.status, 200)
            logs = json.loads(resp.read().decode())['logs']
            actions = [log['action'] for log in logs]
            self.assertIn('ACCOUNT_REQUEST_CREATED', actions)
            self.assertIn('ACCOUNT_REQUEST_APPROVED', actions)
            self.assertIn('ACCOUNT_REQUEST_REJECTED', actions)

        # 2. Self-approval prohibition verification
        # Admin submits a request for their own account
        admin_submit = urllib.request.Request(
            f'{BASE_URL}/api/account-requests',
            data=json.dumps({'accountName': 'Admin Self Account Test', 'accountType': 'SAVINGS', 'requestedBalance': 100}).encode(),
            headers={'Authorization': f'Bearer {self.admin_token}', 'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(admin_submit) as resp:
            admin_req_id = json.loads(resp.read().decode())['request']['id']

        # Admin tries to approve their own request -> 403 Forbidden
        admin_self_approve = urllib.request.Request(
            f'{BASE_URL}/api/account-requests/{admin_req_id}/approve',
            data=json.dumps({'remarks': 'Self approval attempt'}).encode(),
            headers={'Authorization': f'Bearer {self.admin_token}', 'Content-Type': 'application/json'}
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(admin_self_approve)
        self.assertEqual(ctx.exception.code, 403)
        self.assertIn('Self-approval prohibited', json.loads(ctx.exception.read().decode())['message'])

if __name__ == '__main__':
    unittest.main()
