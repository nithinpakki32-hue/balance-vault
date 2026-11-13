import urllib.request
import urllib.error
import json
import time
import ssl
import hmac
import hashlib
import pg8000.native

BASE_URL = 'http://127.0.0.1:8000'
DB_HOST = 'db.zyqihrtlajbcxrtykvcx.supabase.co'
DB_PORT = 5432
DB_USER = 'bv_app_user'
DB_PASS = 'BvVaultSupabase2026SecurePass'
DB_NAME = 'postgres'

def generate_totp_code(secret_hex: str, time_step: int) -> str:
    key = bytes.fromhex(secret_hex)
    time_bytes = time_step.to_bytes(8, byteorder='big')
    hmac_digest = hmac.new(key, time_bytes, hashlib.sha1).digest()
    offset = hmac_digest[-1] & 0x0F
    code = ((hmac_digest[offset] & 0x7F) << 24 |
            (hmac_digest[offset + 1] & 0xFF) << 16 |
            (hmac_digest[offset + 2] & 0xFF) << 8 |
            (hmac_digest[offset + 3] & 0xFF))
    otp = code % 1000000
    return str(otp).zfill(6)

def get_db():
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

def make_req(path, data=None, token=None, method='GET'):
    url = f"{BASE_URL}{path}"
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f"Bearer {token}"
    body = json.dumps(data).encode('utf-8') if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, json.loads(res.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8')
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {'raw': raw}

def run_tests():
    print("=" * 70)
    print("BALANCEVAULT: ACCOUNT HOLDER DIRECT CREATION PREVENTION & APPROVAL TEST")
    print("=" * 70)

    # 1. Register a fresh separate Account Holder test account
    test_email = f"holder_{int(time.time())}@balancevault.com"
    test_pass = "TestPassword@123"
    print(f"\n[Step 1] Registering fresh Account Holder: {test_email}...")
    st, res = make_req('/api/auth/register', {
        'email': test_email,
        'password': test_pass,
        'fullName': 'Nithin Pakki TestHolder'
    }, method='POST')
    print(f" -> Status: {st}, Response: {res}")
    assert st == 201, f"Expected 201, got {st}"
    holder_token = res.get('token')
    holder_id = res.get('user', {}).get('id')
    assert holder_token, "Missing auth token for holder"
    print(f" -> Authenticated User ID: {holder_id}, Role: {res.get('user', {}).get('role')}")

    # 2. Verify Backend Protection: Account Holder attempts DIRECT account creation
    print("\n[Step 2] Testing direct account creation (POST /api/accounts) with Account Holder token...")
    st, res = make_req('/api/accounts', {
        'name': 'nithin pakki bypass test',
        'type': 'ESCROW',
        'initialBalance': 2200000.55,
        'currency': 'USD'
    }, token=holder_token, method='POST')
    print(f" -> Status: {st}, Response: {res}")
    assert st == 403, f"SECURITY FAILURE: Direct account creation returned {st} instead of 403 Forbidden!"
    print(" -> SUCCESS: Backend strictly rejected direct account creation with HTTP 403 Forbidden!")

    # 3. Submit Account Opening Proposal via Account Request API (POST /api/account-requests)
    print("\n[Step 3] Submitting Account Opening Proposal (POST /api/account-requests)...")
    st, res = make_req('/api/account-requests', {
        'accountName': 'nithin pakki',
        'accountType': 'ESCROW',
        'requestedBalance': 2200000.55,
        'currency': 'USD',
        'reason': 'Segregated escrow holding for asset settlement'
    }, token=holder_token, method='POST')
    print(f" -> Status: {st}, Response: {res}")
    assert st in (200, 201), f"Expected 200/201, got {st}"
    req_data = res.get('request', {})
    req_id = req_data.get('id') or res.get('requestId')
    req_status = req_data.get('status')
    assert req_status == 'PENDING', f"Expected status PENDING, got {req_status}"
    print(f" -> SUCCESS: Proposal submitted! Request ID: {req_id}, Status: {req_status}")

    # 4. Check PostgreSQL Database: Verify NO Account and NO LedgerEntry created yet
    print("\n[Step 4] Checking PostgreSQL database state...")
    db = get_db()
    try:
        # Check AccountRequest
        db_reqs = db.run('SELECT id, "accountName", "accountType", "requestedBalance", status, "createdAccountId" FROM "AccountRequest" WHERE "accountName" = :name', name='nithin pakki')
        print(f" -> DB AccountRequest records found: {len(db_reqs)}")
        if db_reqs:
            for r in db_reqs:
                print(f"    Record: id={r[0]}, name={r[1]}, type={r[2]}, balance={r[3]}, status={r[4]}, createdAccountId={r[5]}")
                assert r[4] == 'PENDING', f"Expected PENDING in DB, got {r[4]}"
                assert r[5] is None, f"Expected createdAccountId to be None, got {r[5]}"

        # Check Account: MUST NOT EXIST YET
        db_accs = db.run('SELECT id, "accountNumber", name, balance FROM "Account" WHERE name = :name', name='nithin pakki')
        print(f" -> DB Accounts matching 'nithin pakki': {len(db_accs)}")
        assert len(db_accs) == 0, f"SECURITY FAILURE: Account record exists before admin approval: {db_accs}"
        print(" -> VERIFIED: Zero accounts exist for this request.")

        # Check LedgerEntry: MUST NOT EXIST YET
        db_ledger = db.run('SELECT COUNT(*) FROM "LedgerEntry" le JOIN "Account" a ON le."accountId" = a.id WHERE a.name = :name', name='nithin pakki')
        print(f" -> DB Ledger entries for 'nithin pakki': {db_ledger[0][0]}")
        assert db_ledger[0][0] == 0, "SECURITY FAILURE: Ledger entries exist before admin approval!"
        print(" -> VERIFIED: Zero ledger entries posted before approval.")
    finally:
        db.close()

    # 5. Login as Administrator and approve the request
    print("\n[Step 5] Logging in as Admin (admin@balancevault.com)...")
    mfa_code = generate_totp_code('3132333435363738393031323334353637383930', int(time.time() / 30))
    st, res = make_req('/api/auth/login', {
        'email': 'admin@balancevault.com',
        'password': 'Admin@123',
        'mfaCode': mfa_code
    }, method='POST')
    assert st == 200, f"Admin login failed: {st} {res}"
    admin_token = res.get('token')
    print(f" -> Admin logged in successfully! Role: {res.get('user', {}).get('role')}")

    print(f"\n[Step 6] Admin approving request {req_id}...")
    st, res = make_req(f'/api/admin/account-requests/{req_id}/approve', {
        'remarks': 'KYC and external funds verified for escrow operations'
    }, token=admin_token, method='POST')
    print(f" -> Status: {st}, Response: {res}")
    assert st == 200, f"Approval failed: {st} {res}"
    prov_acc = res.get('account', {})
    acc_id = prov_acc.get('id')
    acc_num = prov_acc.get('accountNumber')
    print(f" -> SUCCESS: Request approved! Account provisioned: {acc_num} (ID: {acc_id})")

    # 6. Verify duplicate approval rejection
    print("\n[Step 7] Testing duplicate approval prevention (concurrency defense)...")
    st, res = make_req(f'/api/admin/account-requests/{req_id}/approve', {
        'remarks': 'Duplicate attempt'
    }, token=admin_token, method='POST')
    print(f" -> Status: {st}, Response: {res}")
    assert st in (400, 409), f"Expected 400 or 409 Conflict, got {st}"
    print(" -> SUCCESS: Duplicate approval was rejected!")

    # 7. Check local ledger
    print("\n[Step 8] Verifying double-entry ledger balance integrity...")
    st, res = make_req('/api/ledger')
    print(f" -> Status: {st}, Balanced: {res.get('balanced')}, Total Debits: {res.get('totalDebits')}, Total Credits: {res.get('totalCredits')}")
    assert res.get('balanced') is True, "Ledger is not balanced!"

    print("\n" + "=" * 70)
    print("ALL VERIFICATIONS COMPLETED SUCCESSFULLY WITH ZERO DEFECTS!")
    print("=" * 70)

if __name__ == '__main__':
    run_tests()
