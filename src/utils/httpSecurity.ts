import type { Request, Response, NextFunction } from 'express';

export const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-src 'self' blob: https:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()"
} as const;

export function applyHttpSecurity(req: Request, res: Response, next: NextFunction) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    // Vite development uses inline scripts; production always gets the full policy.
    if (key !== 'Content-Security-Policy' || process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') res.setHeader(key, value);
  }
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
      const allowed = [process.env.APP_URL, process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`];
      if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') allowed.push('http://localhost:3000');
      const origins = allowed.flatMap(value => { try { return value ? [new URL(value).origin] : []; } catch { return []; } });
      if (!origins.includes(req.headers.origin)) {
        res.status(403).json({ error: 'Request origin is not allowed.' });
        return;
      }
    }
  }
  next();
}

export function handleApiError(err: any, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) { next(err); return; }
  const status = err?.type === 'entity.too.large' ? 413 : err?.type === 'entity.parse.failed' ? 400 : 500;
  res.status(status).json({ error: status === 413 ? 'Request body is too large.' : status === 400 ? 'Invalid JSON request body.' : 'Internal server error.' });
}
