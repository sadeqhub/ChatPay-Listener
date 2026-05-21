import {
  InstagramMessagingEvent,
  InstagramWebhookEntry,
  InstagramWebhookPayload,
} from './types';

export interface ParsedInboundMessage {
  merchantIgId: string;
  customerIgsid: string;
  metaMid: string;
  text: string;
  timestamp: string;
}

function extractText(event: InstagramMessagingEvent): string | null {
  if (event.message?.text) {
    return event.message.text;
  }
  if (event.postback) {
    return event.postback.payload ?? event.postback.title ?? null;
  }
  return null;
}

function shouldSkipEvent(event: InstagramMessagingEvent): boolean {
  if (event.standby !== undefined) return true;
  if (event.reaction !== undefined && !event.message && !event.postback) {
    return true;
  }
  if (!event.message && !event.postback) return true;

  const message = event.message;
  if (!message) return false;

  if (message.is_echo || message.is_deleted || message.is_unsupported) {
    return true;
  }
  return !message.text;
}

export function parseInstagramWebhook(
  payload: InstagramWebhookPayload,
): ParsedInboundMessage[] {
  if (payload.object !== 'instagram' || !payload.entry?.length) {
    return [];
  }

  const results: ParsedInboundMessage[] = [];

  for (const entry of payload.entry) {
    results.push(...parseEntry(entry));
  }

  return results;
}

function parseEntry(entry: InstagramWebhookEntry): ParsedInboundMessage[] {
  const results: ParsedInboundMessage[] = [];
  const entryMerchantId = entry.id;

  for (const event of entry.messaging ?? []) {
    if (shouldSkipEvent(event)) {
      continue;
    }

    const customerIgsid = event.sender?.id;
    const merchantIgId = event.recipient?.id ?? entryMerchantId;
    const text = extractText(event);
    const metaMid =
      event.message?.mid ?? event.postback?.mid ?? `postback-${event.timestamp}`;

    if (!customerIgsid || !merchantIgId || !text) {
      continue;
    }

    results.push({
      merchantIgId,
      customerIgsid,
      metaMid,
      text,
      timestamp: String(event.timestamp ?? entry.time ?? Date.now()),
    });
  }

  return results;
}
