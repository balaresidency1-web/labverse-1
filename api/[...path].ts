import type { Request, Response } from 'express';
import { app } from '../server.ts';

// Vercel routes /api/:path* here and puts the original suffix in query.path.
// Restore the Express route before passing the request to the existing app.
export default function handler(req: Request, res: Response) {
  const wildcardPath = req.query?.path;
  if (typeof wildcardPath === 'string') {
    const incomingUrl = new URL(req.url || '/', 'http://vercel.local');
    incomingUrl.searchParams.delete('path');
    const query = incomingUrl.searchParams.toString();
    req.url = `/api/${wildcardPath}${query ? `?${query}` : ''}`;
  }

  return app(req, res);
}
