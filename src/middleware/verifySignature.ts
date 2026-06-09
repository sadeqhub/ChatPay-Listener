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
  if (!signature?.startsWith('sha256=')) {
    console.warn('[instagram:webhook] missing or invalid x-hub-signature-256 header');
    res.sendStatus(401);
    return;
  }

  if (!req.rawBody || req.rawBody.length === 0) {
    console.warn('[instagram:webhook] empty raw body — check middleware order (webhooks before express.json)');
    res.sendStatus(400);
    return;
  }

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');

  if (!safeEqual(signature, expected)) {
    console.warn('[instagram:webhook] signature mismatch');
    res.sendStatus(401);
    return;
  }

  next();
}
