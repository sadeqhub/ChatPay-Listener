import { NextRequest, NextResponse } from 'next/server';
import { getMetaVerifyToken, verifyMetaSignature } from '@/lib/meta/signature';
import { processInboundMessages } from '@/lib/webhooks/instagram/handler';
import { parseInstagramWebhook } from '@/lib/webhooks/instagram/parse';
import { InstagramWebhookPayload } from '@/lib/webhooks/instagram/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');
  const verifyToken = getMetaVerifyToken();

  if (
    mode === 'subscribe' &&
    token &&
    verifyToken &&
    token === verifyToken &&
    challenge !== null
  ) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new NextResponse(null, { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = Buffer.from(await request.arrayBuffer());

    const signatureResult = verifyMetaSignature(
      rawBody,
      request.headers.get('x-hub-signature-256'),
    );

    if (!signatureResult.ok) {
      if (signatureResult.status === 500) {
        console.error(signatureResult.reason);
      }
      return new NextResponse(null, { status: signatureResult.status });
    }

    const payload = JSON.parse(rawBody.toString('utf8')) as InstagramWebhookPayload;

    if (payload.object !== 'instagram') {
      return new NextResponse(null, { status: 200 });
    }

    const inbound = parseInstagramWebhook(payload);
    await processInboundMessages(inbound);

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error('Instagram webhook error:', error);
    return new NextResponse(null, { status: 500 });
  }
}
