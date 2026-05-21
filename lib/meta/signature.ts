import crypto from 'crypto';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export type SignatureResult =
  | { ok: true }
  | { ok: false; status: 401 | 500; reason: string };

export function verifyMetaSignature(
  rawBody: Buffer,
  signatureHeader: string | null,
): SignatureResult {
  const secret = process.env.META_APP_SECRET;
  if (!secret) {
    return { ok: false, status: 500, reason: 'META_APP_SECRET is not configured' };
  }

  if (!signatureHeader?.startsWith('sha256=')) {
    return { ok: false, status: 401, reason: 'Missing or invalid X-Hub-Signature-256' };
  }

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  if (!safeEqual(signatureHeader, expected)) {
    return { ok: false, status: 401, reason: 'Invalid signature' };
  }

  return { ok: true };
}

export function getMetaVerifyToken(): string | undefined {
  return process.env.META_WEBHOOK_VERIFY_TOKEN ?? process.env.VERIFY_TOKEN;
}
