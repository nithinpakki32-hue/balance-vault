import ssl
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

print('USERS:')
for r in conn.run('SELECT id, email, role FROM "User"'):
    print(r)

print('\nACCOUNTS:')
for r in conn.run('SELECT id, "userId", "accountNumber", name, type, balance, status FROM "Account"'):
    print(r)

print('\nACCOUNT REQUESTS:')
for r in conn.run('SELECT id, "userId", "accountName", status FROM "AccountRequest"'):
    print(r)

conn.close()
