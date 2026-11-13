import urllib.request
import urllib.error
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

base = 'https://balance-vault-lac.vercel.app'

print("1. Checking Health...")
req = urllib.request.Request(f'{base}/api/health')
with urllib.request.urlopen(req, context=ctx, timeout=10) as res:
    print('Health:', res.status, json.loads(res.read().decode()))

print("\n2. Logging in as user@balancevault.com...")
login_req = urllib.request.Request(
    f'{base}/api/auth/login',
    data=json.dumps({'email': 'user@balancevault.com', 'password': 'User@123'}).encode(),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(login_req, context=ctx, timeout=10) as res:
    user_data = json.loads(res.read().decode())
    user_token = user_data['token']
    print('User logged in:', user_data['user']['role'])

print("\n3. Testing direct account creation (POST /api/accounts) with user token...")
try:
    acc_req = urllib.request.Request(
        f'{base}/api/accounts',
        data=json.dumps({'name': 'test direct bypass', 'type': 'ESCROW', 'initialBalance': 1000}).encode(),
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {user_token}'}
    )
    urllib.request.urlopen(acc_req, context=ctx, timeout=10)
    print('FAILURE: User was allowed to directly create account!')
except urllib.error.HTTPError as e:
    print('SUCCESS: POST /api/accounts correctly rejected with HTTP', e.code, json.loads(e.read().decode()))

print("\n4. Submitting account request proposal (POST /api/account-requests)...")
prop_req = urllib.request.Request(
    f'{base}/api/account-requests',
    data=json.dumps({
        'accountName': 'nithin pakki live',
        'accountType': 'ESCROW',
        'requestedBalance': 2200000.55,
        'currency': 'USD',
        'reason': 'Segregated escrow holding'
    }).encode(),
    headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {user_token}'}
)
try:
    with urllib.request.urlopen(prop_req, context=ctx, timeout=10) as res:
        prop_data = json.loads(res.read().decode())
        print('SUCCESS: POST /api/account-requests accepted with HTTP', res.status)
        print('Request ID:', prop_data.get('requestId'), 'Status:', prop_data.get('request', {}).get('status'))
except urllib.error.HTTPError as e:
    print('FAILED with HTTP', e.code)
    print('Headers:', dict(e.headers))
    print('Body:', e.read().decode())
