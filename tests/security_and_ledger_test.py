import urllib.request
import urllib.error
import json
import unittest
import time
import uuid

BASE_URL = "http://localhost:8000"

def request(method, path, data=None, headers=None):
    url = f"{BASE_URL}{path}"
    req_headers = {"Content-Type": "application/json", "X-Test-Runner": "true"}
    if headers:
        req_headers.update(headers)
    
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read().decode("utf-8")
            return resp.status, dict(resp.headers), json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        resp_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(resp_body)
        except Exception:
            parsed = {"raw": resp_body}
        return e.code, dict(e.headers), parsed

class BalanceVaultSecurityAndLedgerTestSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Wait a moment to ensure server is ready
        status, _, data = request("GET", "/api/health")
        assert status == 200, f"Server health check failed: {status}"

    def test_01_security_headers_and_health(self):
        status, headers, data = request("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(data.get("status"), "HEALTHY")
        
        # Verify OWASP Security Headers
        self.assertIn("Strict-Transport-Security", headers)
        self.assertIn("Content-Security-Policy", headers)
        self.assertEqual(headers.get("X-Frame-Options"), "DENY")
        self.assertEqual(headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin")
        self.assertIn("no-store", headers.get("Cache-Control", ""))

    def test_02_first_admin_bootstrap_protection(self):
        # Attempt to run bootstrap when admin already exists -> Must return 409 Conflict
        payload = {
            "email": "intruder_admin@balancevault.com",
            "password": "Password123!",
            "fullName": "Intruder Administrator"
        }
        status, _, data = request("POST", "/api/auth/bootstrap-admin", payload)
        self.assertEqual(status, 409, f"Bootstrap did not prevent duplicate initialization: {data}")
        self.assertIn("forbidden", data.get("message", "").lower())

    def test_03_registration_and_strict_role_enforcement(self):
        # Normal user registration must strictly assign ACCOUNT_HOLDER role
        user_email = f"user_{int(time.time())}@balancevault.com"
        payload = {
            "email": user_email,
            "fullName": "Test Account Holder",
            "password": "SecurePassword123!",
            "role": "ADMIN" # Attacker attempts privilege escalation in payload
        }
        status, _, data = request("POST", "/api/auth/register", payload)
        self.assertEqual(status, 201)
        self.assertEqual(data["user"]["role"], "ACCOUNT_HOLDER", "User registration allowed privilege escalation!")
        self.assertIn("account", data)
        self.assertTrue(data["account"]["accountNumber"].startswith("BV-CHK-"))

    def test_04_brute_force_account_lockout(self):
        test_email = "alex_lockout_test@balancevault.com"
        # Register user
        request("POST", "/api/auth/register", {
            "email": test_email,
            "fullName": "Lockout Test User",
            "password": "CorrectPassword123!"
        })

        # 5 consecutive failed logins
        for i in range(1, 5):
            status, _, data = request("POST", "/api/auth/login", {
                "email": test_email,
                "password": f"WrongPassword_{i}"
            })
            self.assertEqual(status, 401)
            self.assertIn("remaining before temporary lockout", data.get("message", ""))

        # 5th attempt locks the account
        status, _, data = request("POST", "/api/auth/login", {
            "email": test_email,
            "password": "WrongPassword_5"
        })
        self.assertEqual(status, 423) # HTTP 423 Locked
        self.assertIn("locked for 15 minutes", data.get("message", ""))

        # 6th attempt even with correct password is still rejected with 423
        status, _, data = request("POST", "/api/auth/login", {
            "email": test_email,
            "password": "CorrectPassword123!"
        })
        self.assertEqual(status, 423)
        self.assertIn("Account locked", data.get("message", ""))

    def test_05_password_reset_flow(self):
        test_email = "reset_user@balancevault.com"
        request("POST", "/api/auth/register", {
            "email": test_email,
            "fullName": "Reset User",
            "password": "OldPassword123!"
        })

        # Request reset token
        status, _, data = request("POST", "/api/auth/forgot-password", {"email": test_email})
        self.assertEqual(status, 200)
        token = data.get("resetToken")
        self.assertIsNotNone(token)

        # Execute reset
        status, _, data = request("POST", "/api/auth/reset-password", {
            "token": token,
            "newPassword": "BrandNewSecurePassword123!"
        })
        self.assertEqual(status, 200)

        # Authenticate with new password
        status, _, data = request("POST", "/api/auth/login", {
            "email": test_email,
            "password": "BrandNewSecurePassword123!"
        })
        self.assertEqual(status, 200)
        self.assertIn("token", data)

    def test_06_double_entry_ledger_deposit(self):
        # Deposit into Treasury
        deposit_amount = 50000.00
        payload = {
            "accountId": "acc-treasury-001",
            "amount": deposit_amount,
            "description": "Enterprise Liquidity Topup"
        }
        status, _, data = request("POST", "/api/transactions/deposit", payload)
        self.assertEqual(status, 200)
        self.assertEqual(len(data.get("ledgerEntries", [])), 2)
        
        # Verify ledger balance
        status, _, ledger = request("GET", "/api/ledger")
        self.assertEqual(status, 200)
        self.assertTrue(ledger["balanced"], "Ledger invariant violated: Debits != Credits!")
        self.assertEqual(ledger["totalDebits"], ledger["totalCredits"])

    def test_07_double_entry_ledger_transfer_and_overdraft_prevention(self):
        # Overdraft attempt
        overdraft_payload = {
            "sourceAccountId": "acc-chk-002",
            "destinationAccountNumber": "BV-TREASURY-001",
            "amount": 999999999.00
        }
        status, _, data = request("POST", "/api/transactions/transfer", overdraft_payload)
        self.assertEqual(status, 400)
        self.assertIn("Insufficient funds", data.get("message", ""))

        # Negative amount attempt
        negative_payload = {
            "sourceAccountId": "acc-chk-002",
            "destinationAccountNumber": "BV-TREASURY-001",
            "amount": -500.00
        }
        status, _, data = request("POST", "/api/transactions/transfer", negative_payload)
        self.assertEqual(status, 400)

        # Self-transfer attempt
        self_transfer_payload = {
            "sourceAccountId": "acc-chk-002",
            "destinationAccountNumber": "BV-CHK-100293",
            "amount": 100.00
        }
        status, _, data = request("POST", "/api/transactions/transfer", self_transfer_payload)
        self.assertEqual(status, 400)
        self.assertIn("Self-transfer rejected", data.get("message", ""))

        # Valid transfer
        transfer_payload = {
            "sourceAccountId": "acc-treasury-001",
            "destinationAccountNumber": "BV-CHK-100293",
            "amount": 1250.00,
            "description": "Payroll settlement"
        }
        status, _, data = request("POST", "/api/transactions/transfer", transfer_payload)
        self.assertEqual(status, 200)
        self.assertEqual(len(data["ledgerEntries"]), 2)

        # Verify Debits == Credits invariant across entire ledger
        status, _, ledger = request("GET", "/api/ledger")
        self.assertEqual(status, 200)
        self.assertTrue(ledger["balanced"], "Ledger invariant broken after transfer!")

    def test_08_idempotency_protection_and_replay(self):
        idem_key = f"IDEM-{uuid.uuid4()}"
        headers = {"Idempotency-Key": idem_key}
        payload = {
            "accountId": "acc-treasury-001",
            "amount": 100.00,
            "description": "Idempotent payment test"
        }

        # First request
        status1, _, data1 = request("POST", "/api/transactions/deposit", payload, headers=headers)
        self.assertEqual(status1, 200)
        txn1_id = data1["transaction"]["id"]
        bal1 = data1["newBalance"]

        # Duplicate request with same Idempotency-Key and payload
        status2, _, data2 = request("POST", "/api/transactions/deposit", payload, headers=headers)
        self.assertEqual(status2, 200)
        self.assertEqual(data2["transaction"]["id"], txn1_id, "Idempotency replay created duplicate transaction!")
        self.assertEqual(data2["newBalance"], bal1, "Idempotency replay mutated account balance again!")

        # Request with same Idempotency-Key but different payload must return 422 Unprocessable Entity
        payload_tampered = {
            "accountId": "acc-treasury-001",
            "amount": 999.00, # Different amount
            "description": "Idempotent payment test"
        }
        status3, _, data3 = request("POST", "/api/transactions/deposit", payload_tampered, headers=headers)
        self.assertEqual(status3, 422, "Server failed to detect idempotency payload mismatch!")

    def test_09_auditor_read_only_rbac_enforcement(self):
        headers = {"Authorization": "Bearer token-auditor-123"}
        
        # Auditor CAN view accounts
        status, _, data = request("GET", "/api/accounts", headers=headers)
        self.assertEqual(status, 200)

        # Auditor CAN view audit logs
        status, _, data = request("GET", "/api/admin/audit-logs", headers=headers)
        self.assertEqual(status, 200)

        # Auditor CANNOT make deposits (403 Forbidden)
        status, _, data = request("POST", "/api/transactions/deposit", {
            "accountId": "acc-chk-002",
            "amount": 100.00
        }, headers=headers)
        self.assertEqual(status, 403)
        self.assertIn("Auditor is strictly read-only", data.get("message", ""))

        # Auditor CANNOT make withdrawals (403 Forbidden)
        status, _, data = request("POST", "/api/transactions/withdraw", {
            "accountId": "acc-chk-002",
            "amount": 100.00
        }, headers=headers)
        self.assertEqual(status, 403)

        # Auditor CANNOT make transfers (403 Forbidden)
        status, _, data = request("POST", "/api/transactions/transfer", {
            "sourceAccountId": "acc-chk-002",
            "destinationAccountNumber": "BV-TREASURY-001",
            "amount": 100.00
        }, headers=headers)
        self.assertEqual(status, 403)

    def test_10_account_level_permission_revocation(self):
        # Admin revokes canTransfer for user on acc-chk-002
        admin_headers = {"Authorization": "Bearer token-admin-123"}
        status, _, data = request("PATCH", "/api/admin/accounts/acc-chk-002/permissions", {
            "userId": "usr-user-002",
            "canTransfer": False
        }, headers=admin_headers)
        self.assertEqual(status, 200)
        self.assertFalse(data["permission"]["canTransfer"])

        # User attempts transfer from acc-chk-002 -> Must be rejected with 403
        user_headers = {"Authorization": "Bearer token-user-123"}
        status, _, data = request("POST", "/api/transactions/transfer", {
            "sourceAccountId": "acc-chk-002",
            "destinationAccountNumber": "BV-TREASURY-001",
            "amount": 50.00
        }, headers=user_headers)
        self.assertEqual(status, 403)
        self.assertIn("canTransfer privilege revoked", data.get("message", ""))

        # Re-grant permission
        status, _, _ = request("PATCH", "/api/admin/accounts/acc-chk-002/permissions", {
            "userId": "usr-user-002",
            "canTransfer": True
        }, headers=admin_headers)
        self.assertEqual(status, 200)

    def test_11_admin_soc_dashboard_metrics(self):
        status, _, data = request("GET", "/api/admin/security-stats")
        self.assertEqual(status, 200)
        stats = data.get("stats", {})
        self.assertIn("totalFailedLogins", stats)
        self.assertIn("lockedAccounts", stats)
        self.assertIn("unauthorizedAttempts", stats)
        self.assertIn("complianceStatus", stats)
        self.assertEqual(stats["complianceStatus"], "OWASP TOP 10 HARDENED")
        self.assertTrue(len(stats.get("recentSecurityEvents", [])) > 0)

if __name__ == "__main__":
    unittest.main()
