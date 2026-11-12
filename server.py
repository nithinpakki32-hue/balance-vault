import http.server
import socketserver
import json
import os
import time
import urllib.parse

PORT = 8000
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), 'public')

# In-memory database seeded with default Admin & Demo accounts
DB = {
    'users': [
        {
            'id': 'usr-admin-001',
            'email': 'admin@balancevault.com',
            'fullName': 'System Administrator',
            'role': 'ADMIN',
            'isActive': True,
            'createdAt': '2026-11-11T10:00:00Z',
            'accounts': 1
        },
        {
            'id': 'usr-user-002',
            'email': 'user@balancevault.com',
            'fullName': 'Alex Vance',
            'role': 'USER',
            'isActive': True,
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
    ]
}

start_time = time.time()

class BalanceVaultHandler(http.server.BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def _get_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            return json.loads(self.rfile.read(content_length).decode('utf-8'))
        return {}

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # API: Health probe
        if path == '/api/health':
            self._send_json(200, {
                'status': 'HEALTHY',
                'service': 'balance-vault-local-runner',
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
                    'redis': {'status': 'IN_MEMORY_FALLBACK'}
                },
                'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
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
            self._send_json(200, {'success': True, 'users': DB['users']})
            return

        # API: Admin Audit Logs
        if path == '/api/admin/audit-logs':
            self._send_json(200, {'success': True, 'logs': DB['auditLogs']})
            return

        # Serve static UI
        filepath = os.path.join(PUBLIC_DIR, 'index.html')
        if os.path.exists(filepath):
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self._send_cors_headers()
            self.end_headers()
            with open(filepath, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self._send_json(404, {'error': 'Frontend file not found'})

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self._get_body()

        # Auth Login
        if path == '/api/auth/login':
            email = body.get('email', '')
            user = next((u for u in DB['users'] if u['email'] == email), None)
            if user:
                self._send_json(200, {
                    'success': True,
                    'token': 'demo-jwt-token-local',
                    'user': user
                })
            else:
                self._send_json(401, {'success': False, 'message': 'Invalid credentials'})
            return

        # Auth Register
        if path == '/api/auth/register':
            email = body.get('email', '')
            name = body.get('fullName', 'New User')
            new_user = {
                'id': f'usr-{len(DB["users"]) + 1}',
                'email': email,
                'fullName': name,
                'role': 'USER',
                'isActive': True,
                'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'accounts': 1
            }
            DB['users'].append(new_user)
            self._send_json(201, {
                'success': True,
                'token': 'demo-jwt-token-local',
                'user': new_user
            })
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

            if source['balance'] < amount:
                self._send_json(400, {'success': False, 'message': 'Insufficient funds'})
                return

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
                'ipAddress': '127.0.0.1',
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
        # Clean logging
        print(f"[{time.strftime('%H:%M:%S')}] {args[0]} -> {args[1]}")

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), BalanceVaultHandler) as httpd:
        print(f"\n=======================================================")
        print(f"🚀 BalanceVault Local Server running at http://localhost:{PORT}")
        print(f"🏥 Health Probe: http://localhost:{PORT}/api/health")
        print(f"🚥 Readiness:    http://localhost:{PORT}/api/ready")
        print(f"=======================================================\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")

if __name__ == '__main__':
    run_server()
