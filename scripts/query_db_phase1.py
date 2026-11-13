import ssl
import json
import pg8000.native

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

conn = pg8000.native.Connection(
    user='bv_app_user',
    password='BvVaultSupabase2026SecurePass',
    host='db.zyqihrtlajbcxrtykvcx.supabase.co',
    port=5432,
    database='postgres',
    ssl_context=ctx
)

print('=== PostgreSQL AccountRequest Records ===')
query = 'SELECT id, "userId", "accountName", "accountType", "requestedBalance", status, "adminRemarks", "reviewedById", "reviewedAt", "createdAccountId", "createdAt" FROM "AccountRequest" ORDER BY "createdAt" DESC'
reqs = conn.run(query)
print(f"Total AccountRequest records: {len(reqs)}")
for r in reqs:
    print({
        'id': r[0],
        'userId': r[1],
        'accountName': r[2],
        'accountType': r[3],
        'requestedBalance': float(r[4]) if r[4] is not None else None,
        'status': r[5],
        'adminRemarks': r[6],
        'reviewedById': r[7],
        'reviewedAt': str(r[8]),
        'createdAccountId': r[9],
        'createdAt': str(r[10])
    })

print('\n=== PostgreSQL Accounts ===')
acc_query = 'SELECT id, "accountNumber", name, type, balance, status, "createdAt" FROM "Account" ORDER BY "createdAt" DESC'
accs = conn.run(acc_query)
print(f"Total Account records: {len(accs)}")
for a in accs:
    print({
        'id': a[0],
        'accountNumber': a[1],
        'name': a[2],
        'type': a[3],
        'balance': float(a[4]) if a[4] is not None else None,
        'status': a[5],
        'createdAt': str(a[6])
    })

conn.close()
