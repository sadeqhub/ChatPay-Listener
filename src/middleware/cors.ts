import { Request, Response, NextFunction } from 'express';
import { allowedCorsOrigins } from '../lib/publicUrl';

export function corsForWebApp(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get('origin');
  const allowed = allowedCorsOrigins();

  if (origin && allowed.some((entry) => entry === origin.replace(/\/$/, ''))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
}
