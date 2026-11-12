import { Request, Response, NextFunction } from 'express';

export function applySecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  // 1. Remove leaking server identification
  res.removeHeader('X-Powered-By');
  res.setHeader('Server', 'BalanceVault-Secure-Gateway');

  // 2. HTTP Strict Transport Security (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // 3. Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 4. Clickjacking Prevention
  res.setHeader('X-Frame-Options', 'DENY');

  // 5. Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 6. Restrict hardware API access (Permissions Policy)
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');

  // 7. Content Security Policy (CSP)
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "connect-src 'self' http://localhost:* ws://localhost:*",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
  res.setHeader('Content-Security-Policy', cspDirectives);

  // 8. Prevent caching on sensitive authentication and ledger endpoints
  if (req.originalUrl.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}
