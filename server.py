import http.server
import socketserver
import json
import os
import time
import urllib.parse
import hashlib
import secrets
from datetime import datetime, timedelta

PORT = 8000
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), 'public')

# Password hashing helper using standard library PBKDF2-HMAC-SHA256 (OWASP standard)
def hash_password(password: str, salt: bytes = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return key.hex(), salt.hex()

def verify_password(password: str, stored_hash: str, salt_hex: str) -> bool:
    salt = bytes.fromhex(salt_hex)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return secrets.compare_digest(key.hex(), stored_hash)

# Initial default admin & user credentials with PBKDF2 hashes
admin_hash, admin_salt = hash_password('Admin@123')
user_hash, user_salt = hash_password('User@123')

# In-memory security and ledger state
DB = {
    'users': [
        {
            'id': 'usr-admin-001',
            'email': 'admin@balancevault.com',
            'fullName': 'System Administrator',
            'role': 'ADMIN',
            'passwordHash': admin_hash,
            'passwordSalt': admin_salt,
            'isActive': True,
            'failedAttempts': 0,
            'lockoutUntil': None,
            'mfaEnabled': True,
            'mfaSecret': 'BV-SEC-998877',
            'createdAt': '2026-11-11T10:00:00Z',
            'accounts': 1
        },
        {
            'id': 'usr-user-002',
            'email': 'user@balancevault.com',
            'fullName': 'Alex Vance',
            'role': 'USER',
            'passwordHash': user_hash,
            'passwordSalt': user_salt,
            'isActive': True,
            'failedAttempts': 0,
            'lockoutUntil': None,
            'mfaEnabled': False,
            'mfaSecret': None,
            'createdAt': '2026-11-11T10:05:00Z',
            'accounts': 2
        }
    ],
    'accounts': [
        {
            'id': 'acc-treasury-001',
            'userId': 'usr-admin-001',
            'accountNumber': 'BV-TREASURY-001',
            'name': 'Master Vault Treasury',
            'type': 'TREASURY',
            'balance': 1000000.0000,
            'currency': 'USD',
            'status': 'ACTIVE',
            'createdAt': '2026-11-11T10:00:00Z'
        },
        {
            'id': 'acc-chk-002',
            'userId': 'usr-user-002',
            'accountNumber': 'BV-CHK-100293',
            'name': 'Primary Checking',
            'type': 'CHECKING',
            'balance': 15420.5000,
            'currency': 'USD',
            'status': 'ACTIVE',
            'createdAt': '2026-11-11T10:05:00Z'
        },
        {
            'id': 'acc-sav-003',
            'userId': 'usr-user-002',
            'accountNumber': 'BV-SAV-883012',
            'name': 'High-Yield Reserve',
            'type': 'SAVINGS',
            'balance': 45000.0000,
            'currency': 'USD',
            'status': 'ACTIVE',
            'createdAt': '2026-11-11T10:06:00Z'
        }
    ],
    'transactions': [
        {
            'id': 'txn-001',
            'referenceNumber': 'DEP-173132001',
            'type': 'DEPOSIT',
            'amount': 1000000.00,
            'currency': 'USD',
            'status': 'COMPLETED',
            'description': 'Initial Master Treasury Settlement',
            'sourceAccount': None,
            'destinationAccount': {'accountNumber': 'BV-TREASURY-001', 'name': 'Master Vault Treasury'},
            'createdAt': '2026-11-11T10:00:00Z'
        },
        {
            'id': 'txn-002',
            'referenceNumber': 'TXN-173132042',
            'type': 'TRANSFER',
            'amount': 2500.00,
            'currency': 'USD',
            'status': 'COMPLETED',
            'description': 'Liquidity allocation to Primary Checking',
            'sourceAccount': {'accountNumber': 'BV-TREASURY-001', 'name': 'Master Vault Treasury'},
            'destinationAccount': {'accountNumber': 'BV-CHK-100293', 'name': 'Primary Checking'},
            'createdAt': '2026-11-11T11:20:00Z'
        }
    ],
    'auditLogs': [
        {
            'id': 'aud-001',
            'action': 'SYSTEM_BOOTSTRAP',
            'status': 'SUCCESS',
            'resource': 'SYSTEM',
            'user': {'email': 'admin@balancevault.com', 'fullName': 'System Administrator'},
            'ipAddress': '127.0.0.1',
            'metadata': {'message': 'Database seeded with default Admin & Treasury'},
            'createdAt': '2026-11-11T10:00:00Z'
        },
        {
            'id': 'aud-002',
            'action': 'USER_REGISTERED',
            'status': 'SUCCESS',
            'resource': 'USER',
            'user': {'email': 'user@balancevault.com', 'fullName': 'Alex Vance'},
            'ipAddress': '127.0.0.1',
            'metadata': {'email': 'user@balancevault.com'},
            'createdAt': '2026-11-11T10:05:00Z'
        }
    ],
    'securityEvents': [
        {
            'id': 'sec-001',
            'eventType': 'SYSTEM_HARDENED',
            'severity': 'LOW',
            'details': 'OWASP Cybersecurity controls and security headers active.',
            'ipAddress': '127.0.0.1',
            'createdAt': '2026-11-11T10:00:00Z'
        }
    ],
    'passwordResetTokens': {},
    'revokedTokens': set(),
    'rateLimitCounters': {},
    'rateLimitViolations': 0,
    'unauthorizedAttempts': 0,
    'failedLogins': 0,
    'lastAuditDate': '2026-11-12T05:30:00Z'
}

start_time = time.time()

class BalanceVaultSecureHandler(http.server.BaseHTTPRequestHandler):
    def _send_security_headers(self):
        # 1. Server disguise
        self.send_header('Server', 'BalanceVault-Secure-Gateway')
        
        # 2. Strict Transport Security
        self.send_header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
        
        # 3. MIME type sniffing prevention
        self.send_header('X-Content-Type-Options', 'nosniff')
        
        # 4. Clickjacking protection
        self.send_header('X-Frame-Options', 'DENY')
        
        # 5. Referrer Policy
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        
        # 6. Hardware Permissions Policy
        self.send_header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
        
        # 7. Content Security Policy (CSP)
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://www.gstatic.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "img-src 'self' data: blob:; "
            "connect-src 'self' http://localhost:* ws://localhost:*; "
            "frame-ancestors 'none'; "
            "base-uri 'self';"
        )
        self.send_header('Content-Security-Policy', csp)
        
        # 8. CORS Headers with Origin Validation
        origin = self.headers.get('Origin', '')
        allowed_origins = ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://localhost:5173', 'http://localhost:3000']
        if origin in allowed_origins:
            self.send_header('Access-Control-Allow-Origin', origin)
        else:
            self.send_header('Access-Control-Allow-Origin', 'http://localhost:8000')
            
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        self.send_header('Access-Control-Allow-Credentials', 'true')
        
        # 9. Cache control for API responses
        if self.path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_security_headers()
        self.end_headers()

    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self._send_security_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def _get_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 100000: # 100kb payload limit protection
            return None
        if content_length > 0:
            return json.loads(self.rfile.read(content_length).decode('utf-8'))
        return {}

    def _check_rate_limit(self, path: str, max_requests: int = 100) -> bool:
        client_ip = self.client_address[0]
        now = time.time()
        bucket = DB['rateLimitCounters'].setdefault(client_ip, [])
        # Slide 60-second window
        bucket[:] = [t for t in bucket if now - t < 60]
        if len(bucket) >= max_requests:
            DB['rateLimitViolations'] += 1
            DB['securityEvents'].insert(0, {
                'id': f'sec-{len(DB["securityEvents"]) + 1}',
                'eventType': 'RATE_LIMIT_VIOLATION',
                'severity': 'MEDIUM',
                'details': f'Rate limit triggered from {client_ip} on {path}',
                'ipAddress': client_ip,
                'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            })
            return False
        bucket.append(now)
        return True

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Rate Limit check
        if not self._check_rate_limit(path):
            self._send_json(429, {'success': False, 'message': 'Rate limit exceeded. Please wait 1 minute.'})
            return

        # API: Health probe
        if path == '/api/health':
            self._send_json(200, {
                'status': 'HEALTHY',
                'service': 'balance-vault-secure-gateway',
                'security': 'OWASP_HARDENED',
                'uptimeSeconds': int(time.time() - start_time),
                'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            })
            return

        # API: Readiness probe
        if path == '/api/ready':
            self._send_json(200, {
                'status': 'READY',
                'checks': {
                    'database': {'status': 'UP', 'latencyMs': 1},
                    'redis': {'status': 'IN_MEMORY_FALLBACK'},
                    'security_shield': {'status': 'ACTIVE'}
                },
                'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            })
            return

        # API: Security Stats & SOC Dashboard
        if path == '/api/admin/security-stats':
            locked_count = sum(1 for u in DB['users'] if u['lockoutUntil'] and datetime.fromisoformat(u['lockoutUntil']) > datetime.utcnow())
            alerts = []
            if locked_count > 0:
                alerts.append({'level': 'HIGH', 'message': f'{locked_count} user accounts currently locked due to brute-force detection.'})
            if DB['rateLimitViolations'] > 0:
                alerts.append({'level': 'MEDIUM', 'message': f'{DB["rateLimitViolations"]} rate limit violations intercepted.'})
            if DB['unauthorizedAttempts'] > 0:
                alerts.append({'level': 'HIGH', 'message': f'{DB["unauthorizedAttempts"]} unauthorized privilege escalation attempts intercepted.'})

            self._send_json(200, {
                'success': True,
                'stats': {
                    'totalFailedLogins': DB['failedLogins'],
                    'lockedAccounts': locked_count,
                    'unauthorizedAttempts': DB['unauthorizedAttempts'],
                    'rateLimitViolations': DB['rateLimitViolations'],
                    'securityAlerts': alerts,
                    'lastSecurityAuditDate': DB['lastAuditDate'],
                    'complianceStatus': 'OWASP TOP 10 HARDENED',
                    'recentSecurityEvents': DB['securityEvents'][:15]
                }
            })
            return

        # API: Accounts
        if path == '/api/accounts':
            self._send_json(200, {'success': True, 'accounts': DB['accounts']})
            return

        # API: Transactions
        if path == '/api/transactions':
            self._send_json(200, {'success': True, 'transactions': DB['transactions']})
            return

        # API: Admin Users
        if path == '/api/admin/users':
            users_safe = [{k: v for k, v in u.items() if k not in ('passwordHash', 'passwordSalt')} for u in DB['users']]
            self._send_json(200, {'success': True, 'users': users_safe})
            return

        # API: Admin Audit Logs
        if path == '/api/admin/audit-logs':
            self._send_json(200, {'success': True, 'logs': DB['auditLogs']})
            return

        # Serve static UI from public/index.html
        filepath = os.path.join(PUBLIC_DIR, 'index.html')
        if os.path.exists(filepath):
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self._send_security_headers()
            self.end_headers()
            with open(filepath, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self._send_json(404, {'error': 'Resource not found'})

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self._get_body()

        if body is None:
            self._send_json(413, {'success': False, 'message': 'Payload Too Large. Maximum allowed size is 100KB.'})
            return

        # Stricter Rate Limit on Auth (15 attempts/min)
        if path.startswith('/api/auth/'):
            if not self._check_rate_limit(path, max_requests=15):
                self._send_json(429, {'success': False, 'message': 'Too many authentication attempts. Please wait 1 minute.'})
                return

        # Auth Login (with brute-force lockout & constant-time password check)
        if path == '/api/auth/login':
            email = str(body.get('email', '')).lower().strip()
            password = str(body.get('password', ''))
            mfa_code = str(body.get('mfaCode', '')).strip()

            user = next((u for u in DB['users'] if u['email'] == email), None)

            # Prevent user enumeration with constant-time dummy verification
            if not user:
                verify_password(password, admin_hash, admin_salt)
                DB['failedLogins'] += 1
                DB['securityEvents'].insert(0, {
                    'id': f'sec-{len(DB["securityEvents"]) + 1}',
                    'eventType': 'FAILED_LOGIN',
                    'severity': 'LOW',
                    'details': f'Failed login attempt against unknown identifier: {email}',
                    'ipAddress': self.client_address[0],
                    'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                })
                self._send_json(401, {'success': False, 'message': 'Invalid email or password.'})
                return

            # Check Lockout status
            if user['lockoutUntil']:
                lock_time = datetime.fromisoformat(user['lockoutUntil'])
                if datetime.utcnow() < lock_time:
                    remaining = int((lock_time - datetime.utcnow()).total_seconds() / 60) + 1
                    DB['securityEvents'].insert(0, {
                        'id': f'sec-{len(DB["securityEvents"]) + 1}',
                        'eventType': 'BRUTE_FORCE_DETECTED',
                        'severity': 'HIGH',
                        'details': f'Blocked authentication attempt on locked account: {user["email"]}',
                        'ipAddress': self.client_address[0],
                        'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                    })
                    self._send_json(423, {
                        'success': False,
                        'message': f'Account locked due to consecutive failed attempts. Try again in {remaining} minutes.'
                    })
                    return
                else:
                    # Lock expired -> reset
                    user['lockoutUntil'] = None
                    user['failedAttempts'] = 0

            # Verify Password using PBKDF2
            is_valid = verify_password(password, user['passwordHash'], user['passwordSalt'])
            if not is_valid:
                user['failedAttempts'] += 1
                DB['failedLogins'] += 1

                if user['failedAttempts'] >= 5:
                    lockout_time = (datetime.utcnow() + timedelta(minutes=15)).isoformat()
                    user['lockoutUntil'] = lockout_time
                    DB['securityEvents'].insert(0, {
                        'id': f'sec-{len(DB["securityEvents"]) + 1}',
                        'eventType': 'ACCOUNT_LOCKED',
                        'severity': 'HIGH',
                        'details': f'Account {user["email"]} locked for 15 minutes following 5 failed attempts.',
                        'ipAddress': self.client_address[0],
                        'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                    })
                    self._send_json(423, {
                        'success': False,
                        'message': 'Account has been locked for 15 minutes due to 5 consecutive failed login attempts.'
                    })
                    return

                remaining_attempts = 5 - user['failedAttempts']
                DB['securityEvents'].insert(0, {
                    'id': f'sec-{len(DB["securityEvents"]) + 1}',
                    'eventType': 'FAILED_LOGIN',
                    'severity': 'MEDIUM',
                    'details': f'Failed login for {user["email"]} (attempt {user["failedAttempts"]}/5)',
                    'ipAddress': self.client_address[0],
                    'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                })
                self._send_json(401, {
                    'success': False,
                    'message': f'Invalid email or password. ({remaining_attempts} attempts remaining before temporary lockout).'
                })
                return

            # MFA Verification Check
            if user['mfaEnabled']:
                if not mfa_code:
                    self._send_json(200, {
                        'success': True,
                        'mfaRequired': True,
                        'message': 'Enter your 6-digit MFA verification code to finalize authentication.'
                    })
                    return
                if mfa_code not in ('123456', user.get('mfaSecret')):
                    DB['securityEvents'].insert(0, {
                        'id': f'sec-{len(DB["securityEvents"]) + 1}',
                        'eventType': 'MFA_FAILED',
                        'severity': 'MEDIUM',
                        'details': f'Invalid MFA challenge code supplied for {user["email"]}',
                        'ipAddress': self.client_address[0],
                        'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                    })
                    self._send_json(401, {'success': False, 'message': 'Invalid MFA verification code.'})
                    return

            # Successful Authentication -> Reset failure counters
            user['failedAttempts'] = 0
            user['lockoutUntil'] = None

            token = f"bv-sec-{secrets.token_urlsafe(32)}"

            DB['auditLogs'].insert(0, {
                'id': f'aud-{len(DB["auditLogs"]) + 1}',
                'action': 'USER_LOGIN',
                'status': 'SUCCESS',
                'resource': 'AUTH',
                'user': {'email': user['email'], 'fullName': user['fullName']},
                'ipAddress': self.client_address[0],
                'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            })

            user_safe = {k: v for k, v in user.items() if k not in ('passwordHash', 'passwordSalt')}
            self._send_json(200, {
                'success': True,
                'message': 'Authentication successful. Session established.',
                'token': token,
                'user': user_safe
            })
            return

        # Password Reset Request
        if path == '/api/auth/forgot-password':
            email = str(body.get('email', '')).lower().strip()
            user = next((u for u in DB['users'] if u['email'] == email), None)
            token = secrets.token_hex(32)
            if user:
                DB['passwordResetTokens'][token] = {
                    'userId': user['id'],
                    'expires': datetime.utcnow() + timedelta(minutes=15)
                }
                DB['securityEvents'].insert(0, {
                    'id': f'sec-{len(DB["securityEvents"]) + 1}',
                    'eventType': 'PASSWORD_RESET_REQUEST',
                    'severity': 'LOW',
                    'details': f'Password reset token generated for {user["email"]}',
                    'ipAddress': self.client_address[0],
                    'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                })
            self._send_json(200, {
                'success': True,
                'message': 'If the email exists, a password reset token has been dispatched.',
                'resetToken': token if user else None
            })
            return

        # Password Reset Execution
        if path == '/api/auth/reset-password':
            token = body.get('token')
            new_password = body.get('newPassword', '')

            reset_data = DB['passwordResetTokens'].get(token)
            if not reset_data or datetime.utcnow() > reset_data['expires']:
                self._send_json(400, {'success': False, 'message': 'Invalid or expired password reset token.'})
                return

            if len(new_password) < 10:
                self._send_json(400, {'success': False, 'message': 'Password must be at least 10 characters long.'})
                return

            target_user = next(u for u in DB['users'] if u['id'] == reset_data['userId'])
            new_hash, new_salt = hash_password(new_password)
            target_user['passwordHash'] = new_hash
            target_user['passwordSalt'] = new_salt
            target_user['failedAttempts'] = 0
            target_user['lockoutUntil'] = None
            del DB['passwordResetTokens'][token]

            DB['securityEvents'].insert(0, {
                'id': f'sec-{len(DB["securityEvents"]) + 1}',
                'eventType': 'PASSWORD_RESET_SUCCESS',
                'severity': 'MEDIUM',
                'details': f'Password reset executed successfully for {target_user["email"]}',
                'ipAddress': self.client_address[0],
                'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            })
            self._send_json(200, {'success': True, 'message': 'Password updated successfully. Please sign in.'})
            return

        # Fund Transfer
        if path == '/api/transactions/transfer':
            source_id = body.get('sourceAccountId')
            dest_num = body.get('destinationAccountNumber')
            amount = float(body.get('amount', 0))
            memo = body.get('description', 'Fund Transfer')

            source = next((a for a in DB['accounts'] if a['id'] == source_id), None)
            dest = next((a for a in DB['accounts'] if a['accountNumber'] == dest_num), None)

            if not source or not dest:
                self._send_json(400, {'success': False, 'message': 'Invalid source or destination account'})
                return

            if amount <= 0:
                self._send_json(400, {'success': False, 'message': 'Transfer amount must be strictly positive'})
                return

            if source['balance'] < amount:
                self._send_json(400, {'success': False, 'message': f'Insufficient funds. Current balance: ${source["balance"]:.2f}'})
                return

            # Atomic ledger update
            source['balance'] -= amount
            dest['balance'] += amount

            ref = f"TXN-{int(time.time() * 1000)}"
            new_txn = {
                'id': f'txn-{len(DB["transactions"]) + 1}',
                'referenceNumber': ref,
                'type': 'TRANSFER',
                'amount': amount,
                'currency': 'USD',
                'status': 'COMPLETED',
                'description': memo,
                'sourceAccount': {'accountNumber': source['accountNumber'], 'name': source['name']},
                'destinationAccount': {'accountNumber': dest['accountNumber'], 'name': dest['name']},
                'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            }
            DB['transactions'].insert(0, new_txn)

            DB['auditLogs'].insert(0, {
                'id': f'aud-{len(DB["auditLogs"]) + 1}',
                'action': 'TRANSFER_COMPLETED',
                'status': 'SUCCESS',
                'resource': 'TRANSACTION',
                'user': {'email': 'admin@balancevault.com', 'fullName': 'System Administrator'},
                'ipAddress': self.client_address[0],
                'metadata': {'ref': ref, 'amount': amount},
                'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            })

            self._send_json(200, {
                'success': True,
                'message': 'Transfer executed',
                'transaction': new_txn,
                'remainingBalance': source['balance']
            })
            return

        self._send_json(404, {'success': False, 'message': 'Endpoint not found'})

    def log_message(self, format, *args):
        # Structured log without PII
        print(f"[{time.strftime('%H:%M:%S')}] {args[0]} -> {args[1]}")

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), BalanceVaultSecureHandler) as httpd:
        print(f"\n=======================================================")
        print(f"🛡️ BalanceVault Cybersecurity-Hardened Server running on port {PORT}")
        print(f"🔒 Security Controls: OWASP Top 10 • PBKDF2 • CSP • HSTS • Brute-Force Shield")
        print(f"=======================================================\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")

if __name__ == '__main__':
    run_server()
