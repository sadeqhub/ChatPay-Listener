import crypto from 'crypto';
import { Response, NextFunction } from 'express';
import { RawBodyRequest } from './rawBody';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyMetaSignature(
  req: RawBodyRequest,
  res: Response,
  next: NextFunction,
): void {
  const secret = process.env.META_APP_SECRET;
  if (!secret) {
    console.error('META_APP_SECRET is not configured');
    res.sendStatus(500);
    return;
  }

  const signature = req.get('x-hub-signature-256');
  if (!signature?.startsWith('sha256=') || !req.rawBody) {
    res.sendStatus(401);
    return;
  }

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');

  if (!safeEqual(signature, expected)) {
    res.sendStatus(401);
    return;
  }

  next();
}
