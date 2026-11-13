import urllib.request
import ssl
import re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = 'https://balance-vault-lac.vercel.app/'
print(f"Checking {url}...")

req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx) as res:
    html = res.read().decode('utf-8')
    print('HTML Length:', len(html))
    print('Title:', re.findall(r'<title>(.*?)</title>', html))
    scripts = re.findall(r'src=["\'](/assets/.*?)["\']', html)
    print('Scripts found in index.html:', scripts)

for s in scripts:
    s_req = urllib.request.Request(f'https://balance-vault-lac.vercel.app{s}', headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(s_req, context=ctx) as s_res:
        js = s_res.read().decode('utf-8')
        print(f"Script {s}: length={len(js)}")
        print(" -> Has 'account-requests':", 'account-requests' in js)
        print(" -> Has 'requestAccount':", 'requestAccount' in js)
        print(" -> Has 'Open Account':", 'Open Account' in js)
        print(" -> Has 'Double-Entry':", 'Double-Entry' in js)

print("\nChecking /api/health...")
h_req = urllib.request.Request('https://balance-vault-lac.vercel.app/api/health')
with urllib.request.urlopen(h_req, context=ctx) as h_res:
    print('Health response:', h_res.read().decode('utf-8'))
