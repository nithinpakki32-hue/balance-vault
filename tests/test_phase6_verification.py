import urllib.request
import urllib.error
import json
import ssl
import time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

base = 'https://balance-vault-lac.vercel.app'

print("=" * 70)
print("PHASE 6: COMPREHENSIVE PRODUCTION VERIFICATION SUITE")
print("=" * 70)

# Helper function with retry
def http_call(path, method='GET', data=None, token=None, retries=3):
    url = f"{base}{path}"
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f"Bearer {token}"
    body = json.dumps(data).encode('utf-8') if data is not None else None
    
    for attempt in range(retries):
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=25) as res:
                return res.status, json.loads(res.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read().decode('utf-8'))
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2)
                continue
            raise e

# Step 0: Register a fresh separate Account Holder test account
fresh_email = f"verified_holder_{int(time.time())}@balancevault.com"
print(f"\n[Setup] Registering fresh Account Holder: {fresh_email}...")
st, res = http_call('/api/auth/register', method='POST', data={
    'email': fresh_email,
    'password': 'User@123',
    'fullName': 'Verification Test Holder'
})
assert st == 201, f"Registration failed: {st} {res}"
holder_token = res['token']
holder_id = res['user']['id']
print(f" -> Registered! User ID: {holder_id}, Role: {res['user']['role']}")

# Test A: Submit a new account request
print("\n[Test A] Submitting new account opening proposal...")
proposal_payload = {
    'accountName': 'Verified Escrow Proposal',
    'accountType': 'ESCROW',
    'requestedBalance': 1500000.00,
    'currency': 'USD',
    'reason': 'Segregated client escrow operations'
}
st, res = http_call('/api/account-requests', method='POST', data=proposal_payload, token=holder_token)
print(f" -> Status: {st}, Response: {res}")
assert st == 201, f"Expected 201 Created, got {st}"
req_obj = res['request']
req_id = req_obj['id']

print("\n[Test A Database State Verification]")
print(f" -> Request ID: {req_obj['id']}")
print(f" -> Status: {req_obj['status']}")
print(f" -> reviewedBy: {req_obj['reviewedById']}")
print(f" -> reviewedAt: {req_obj['reviewedAt']}")
print(f" -> adminRemarks: {req_obj['adminRemarks']}")
print(f" -> createdAccountId: {req_obj['createdAccountId']}")

assert req_obj['status'] == 'PENDING', f"Expected PENDING, got {req_obj['status']}"
assert req_obj['reviewedById'] is None, f"Expected reviewedById to be None, got {req_obj['reviewedById']}"
assert req_obj['reviewedAt'] is None, f"Expected reviewedAt to be None, got {req_obj['reviewedAt']}"
assert req_obj['adminRemarks'] is None, f"Expected adminRemarks to be None, got {req_obj['adminRemarks']}"
assert req_obj['createdAccountId'] is None, f"Expected createdAccountId to be None, got {req_obj['createdAccountId']}"
print(" -> VERIFIED: Request created strictly as PENDING with zero approval fields populated!")

# Verify NO account was created
st, acc_res = http_call('/api/accounts', token=holder_token)
user_accounts = acc_res.get('accounts', [])
print(f" -> User active accounts count: {len(user_accounts)}")
assert len(user_accounts) == 0, f"Expected 0 accounts for new user, got: {user_accounts}"
print(" -> VERIFIED: Zero accounts created for this request!")

# Test B: Admin views dashboard
print("\n[Test B] Logging in as Admin to inspect pending dashboard view...")
st, admin_login = http_call('/api/auth/login', method='POST', data={
    'email': 'admin@balancevault.com',
    'password': 'Admin@123',
    'mfaCode': '123456'
})
assert st == 200, f"Admin login failed: {st} {admin_login}"
admin_token = admin_login['token']
admin_id = admin_login['user']['id']
print(f" -> Admin logged in! User ID: {admin_id}, Role: {admin_login['user']['role']}")

st, admin_reqs = http_call('/api/account-requests', token=admin_token)
all_reqs = admin_reqs.get('requests', [])
pending_count = sum(1 for r in all_reqs if r['status'] == 'PENDING')
approved_count = sum(1 for r in all_reqs if r['status'] == 'APPROVED')
print(f" -> Pending Review count: {pending_count}")
print(f" -> Approved Accounts count: {approved_count}")
assert pending_count >= 1, f"Expected pending count >= 1, got {pending_count}"
assert approved_count == 0, f"Expected approved count == 0, got {approved_count}"

found_req = next((r for r in all_reqs if r['id'] == req_id), None)
assert found_req is not None, f"Request {req_id} not found in admin view"
assert found_req['status'] == 'PENDING', f"Expected PENDING in admin view, got {found_req['status']}"
print(f" -> Found Request in Admin queue: id={found_req['id']}, status={found_req['status']}, applicant={found_req.get('user', {}).get('email')}")

# Test C: Multiple refreshes without approval
print("\n[Test C] Refreshing Admin view 3 times without clicking approve...")
for i in range(3):
    time.sleep(1)
    st, r_check = http_call(f'/api/account-requests', token=admin_token)
    r_item = next(r for r in r_check['requests'] if r['id'] == req_id)
    assert r_item['status'] == 'PENDING', f"Status changed unexpectedly on refresh {i+1}: {r_item['status']}"
    assert r_item['createdAccountId'] is None
print(" -> VERIFIED: Request remains PENDING indefinitely without admin action!")

# Test E: Attempt direct approval as ACCOUNT_HOLDER and AUDITOR
print("\n[Test E] Testing unauthorized approval attempts (RBAC Security)...")
# E1: Account Holder attempt
st, res = http_call(f'/api/admin/account-requests/{req_id}/approve', method='POST', data={'remarks': 'Holder bypass'}, token=holder_token)
print(f" -> Account Holder approval attempt: HTTP {st}, Response: {res}")
assert st == 403, f"Expected 403 Forbidden, got {st}"
print(" -> SUCCESS: Account Holder direct approval strictly rejected with HTTP 403 Forbidden!")

# E2: Auditor attempt
st, aud_login = http_call('/api/auth/login', method='POST', data={
    'email': 'auditor@balancevault.com',
    'password': 'Auditor@123'
})
aud_token = aud_login['token']
st, res = http_call(f'/api/admin/account-requests/{req_id}/approve', method='POST', data={'remarks': 'Auditor bypass'}, token=aud_token)
print(f" -> Auditor approval attempt: HTTP {st}, Response: {res}")
assert st == 403, f"Expected 403 Forbidden, got {st}"
print(" -> SUCCESS: Auditor approval strictly rejected with HTTP 403 Forbidden!")

# Test D: Explicit Admin Approval
print("\n[Test D] Admin explicitly clicking Approve with remarks...")
approval_remarks = "Verified client legal registration and funds source."
st, res = http_call(f'/api/admin/account-requests/{req_id}/approve', method='POST', data={'remarks': approval_remarks}, token=admin_token)
print(f" -> Admin approval response: HTTP {st}")
print(f"    Message: {res.get('message')}")
print(f"    Approved Account: {res.get('account')}")
print(f"    Updated Request: {res.get('request')}")

assert st == 200, f"Approval failed: {st} {res}"
approved_req = res['request']
prov_account = res['account']

assert approved_req['status'] == 'APPROVED', f"Expected APPROVED, got {approved_req['status']}"
assert approved_req['reviewedById'] == admin_id, f"Expected reviewer ID {admin_id}, got {approved_req['reviewedById']}"
assert approved_req['adminRemarks'] == approval_remarks, f"Expected remarks '{approval_remarks}', got '{approved_req['adminRemarks']}'"
assert approved_req['reviewedAt'] is not None, "Expected reviewedAt timestamp to be populated"
assert prov_account['id'] == approved_req['createdAccountId'], "Account ID mismatch"

print(f" -> VERIFIED: Status changed to APPROVED, reviewer recorded as {admin_id}, account provisioned: {prov_account['accountNumber']} (Balance: ${prov_account['balance']:,.2f})")

# Verify Concurrency Defense
print("\n[Concurrency Defense] Testing duplicate approval attempt on already approved request...")
st, res = http_call(f'/api/admin/account-requests/{req_id}/approve', method='POST', data={'remarks': 'Duplicate attempt'}, token=admin_token)
print(f" -> Duplicate approval attempt: HTTP {st}, Response: {res}")
assert st == 409, f"Expected 409 Conflict, got {st}"
print(" -> SUCCESS: Duplicate approval prevented with HTTP 409 Conflict!")

print("\n" + "=" * 70)
print("ALL PHASE 6 PRODUCTION TESTS COMPLETED WITH ZERO DEFECTS!")
print("=" * 70)
