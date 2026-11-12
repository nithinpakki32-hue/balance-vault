import unittest
import urllib.request
import urllib.error
import json
import time
import hmac
import hashlib
import struct

BASE_URL = 'http://127.0.0.1:8000'

def generate_totp(secret_hex: str) -> str:
    key = bytes.fromhex(secret_hex)
    step = int(time.time() / 30)
    time_buf = struct.pack('>Q', step)
    h = hmac.new(key, time_buf, hashlib.sha1).digest()
    offset = h[-1] & 0x0f
    code = struct.unpack('>I', h[offset:offset+4])[0] & 0x7fffffff
    return str(code % 1000000).zfill(6)

class AccountCreationSecurityTests(unittest.TestCase):
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

    def test_01_admin_creates_escrow_account_with_atomic_ledger(self):
        """Admin can open an ESCROW account and initial balance creates atomic ledger entries."""
        payload = {
            'name': 'nithin pakki',
            'type': 'ESCROW',
            'initialBalance': 2200000.55
        }
        req = urllib.request.Request(
            f'{BASE_URL}/api/accounts',
            data=json.dumps(payload).encode(),
            headers={'Authorization': f'Bearer {self.admin_token}', 'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 201)
            data = json.loads(resp.read().decode())
            self.assertTrue(data['success'])
            account = data['account']
            self.assertEqual(account['name'], 'nithin pakki')
            self.assertEqual(account['type'], 'ESCROW')
            self.assertEqual(account['balance'], 2200000.55)
            self.assertEqual(account['userId'], self.admin_id)
            self.assertTrue(account['accountNumber'].startswith('BV-ESC-'))

        # Verify ledger debits == credits
        ledger_req = urllib.request.Request(f'{BASE_URL}/api/ledger', headers={'Authorization': f'Bearer {self.admin_token}'})
        with urllib.request.urlopen(ledger_req) as resp:
            ledger_data = json.loads(resp.read().decode())
            self.assertTrue(ledger_data['balanced'])
            self.assertAlmostEqual(ledger_data['totalDebits'], ledger_data['totalCredits'], places=2)

    def test_02_account_holder_cannot_open_escrow_account(self):
        """Regular ACCOUNT_HOLDER cannot directly create accounts (HTTP 403)."""
        payload = {
            'name': 'unauthorized escrow',
            'type': 'ESCROW',
            'initialBalance': 50000.00
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

    def test_03_auditor_is_strictly_read_only_and_cannot_open_account(self):
        """Auditor cannot open any account (HTTP 403)."""
        payload = {
            'name': 'auditor test account',
            'type': 'CHECKING',
            'initialBalance': 0
        }
        req = urllib.request.Request(
            f'{BASE_URL}/api/accounts',
            data=json.dumps(payload).encode(),
            headers={'Authorization': f'Bearer {self.auditor_token}', 'Content-Type': 'application/json'}
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req)
        self.assertEqual(ctx.exception.code, 403)
        body = json.loads(ctx.exception.read().decode())
        self.assertIn('Auditor is strictly read-only', body['message'])

    def test_04_unauthenticated_request_is_rejected_with_401(self):
        """Unauthenticated requests are rejected with HTTP 401."""
        req = urllib.request.Request(
            f'{BASE_URL}/api/accounts',
            data=json.dumps({'name': 'no auth', 'type': 'CHECKING', 'initialBalance': 0}).encode(),
            headers={'Content-Type': 'application/json'}
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req)
        self.assertEqual(ctx.exception.code, 401)

    def test_05_forged_or_invalid_jwt_is_rejected_with_401(self):
        """Forged or tampered JWTs are rejected with HTTP 401."""
        req = urllib.request.Request(
            f'{BASE_URL}/api/accounts',
            data=json.dumps({'name': 'forged token', 'type': 'CHECKING', 'initialBalance': 0}).encode(),
            headers={'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJhZG1pbiJ9.invalidsig', 'Content-Type': 'application/json'}
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req)
        self.assertEqual(ctx.exception.code, 401)

    def test_06_account_holder_must_use_account_request_workflow(self):
        """ACCOUNT_HOLDER cannot directly create checking accounts; must submit request via /api/account-requests."""
        payload = {
            'name': "Alex's Travel Vault",
            'type': 'CHECKING',
            'initialBalance': 1500.00
        }
        # Direct creation is blocked with 403
        req_direct = urllib.request.Request(
            f'{BASE_URL}/api/accounts',
            data=json.dumps(payload).encode(),
            headers={'Authorization': f'Bearer {self.user_token}', 'Content-Type': 'application/json'}
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req_direct)
        self.assertEqual(ctx.exception.code, 403)

        # Request workflow succeeds
        req_workflow = urllib.request.Request(
            f'{BASE_URL}/api/account-requests',
            data=json.dumps({
                'accountName': "Alex's Travel Vault",
                'accountType': 'CHECKING',
                'requestedBalance': 1500.00,
                'reason': 'Travel expense allocation.'
            }).encode(),
            headers={'Authorization': f'Bearer {self.user_token}', 'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req_workflow) as resp:
            self.assertEqual(resp.status, 201)
            data = json.loads(resp.read().decode())
            self.assertTrue(data['success'])
            self.assertEqual(data['request']['userId'], self.user_id)
            self.assertEqual(data['request']['status'], 'PENDING')

if __name__ == '__main__':
    unittest.main()
