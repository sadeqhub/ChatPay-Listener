const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

type GraphError = { message: string; code?: number };
type GraphPage<T> = {
  data?: T[];
  paging?: { next?: string; cursors?: { after?: string } };
  error?: GraphError;
};

async function graphFetch<T>(urlOrPath: string, accessToken: string): Promise<T> {
  const url = urlOrPath.startsWith('http')
    ? new URL(urlOrPath)
    : new URL(`${GRAPH_BASE}/${urlOrPath.replace(/^\//, '')}`);

  if (!urlOrPath.startsWith('http')) {
    url.searchParams.set('access_token', accessToken);
  }

  const response = await fetch(url);
  const body = (await response.json()) as T & { error?: GraphError };
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || `Graph request failed (${response.status})`);
  }
  return body;
}

async function graphGet<T>(path: string, accessToken: string): Promise<T> {
  return graphFetch<T>(path, accessToken);
}

async function graphGetAllPages<T>(
  path: string,
  accessToken: string,
  maxPages = 5,
): Promise<T[]> {
  const items: T[] = [];
  let nextPath: string | undefined = path;

  for (let page = 0; page < maxPages && nextPath; page += 1) {
    const body: GraphPage<T> = await graphFetch<GraphPage<T>>(nextPath, accessToken);
    if (body.data?.length) items.push(...body.data);
    nextPath = body.paging?.next;
  }

  return items;
}

async function graphPost<T>(
  path: string,
  accessToken: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}/${path.replace(/^\//, '')}`);
  url.searchParams.set('access_token', accessToken);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as T & { error?: GraphError };
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || `Graph POST failed (${response.status})`);
  }
  return body;
}

export type ConnectedProfile = {
  pageId: string;
  pageName: string;
  igId: string;
  igUsername?: string;
};

export type ConversationSummary = {
  id: string;
  updatedTime?: string;
  participantId: string;
  participantLabel: string;
  snippet?: string;
};

export type ThreadMessage = {
  id: string;
  text: string;
  fromId: string;
  fromLabel: string;
  createdTime?: string;
  isFromBusiness: boolean;
};

type RawParticipant = { id: string; username?: string; name?: string };

type RawConversation = {
  id: string;
  updated_time?: string;
  snippet?: string;
  participants?: { data: RawParticipant[] };
};

function mapConversation(
  conv: RawConversation,
  pageId: string,
  igId: string,
  preferredCustomerId?: string,
): ConversationSummary {
  const participants = conv.participants?.data ?? [];
  const businessIds = new Set([pageId, igId].filter(Boolean));

  let customer =
    (preferredCustomerId
      ? participants.find((p) => p.id === preferredCustomerId)
      : undefined) ??
    participants.find((p) => !businessIds.has(p.id)) ??
    participants[0];

  const label = customer?.username
    ? `@${customer.username}`
    : customer?.name || customer?.id || 'Customer';

  return {
    id: conv.id,
    updatedTime: conv.updated_time,
    participantId: customer?.id || '',
    participantLabel: label,
    snippet: conv.snippet,
  };
}

export async function fetchConnectedProfile(
  accessToken: string,
  igIdFallback?: string,
): Promise<ConnectedProfile> {
  const me = await graphGet<{
    id: string;
    name?: string;
    instagram_business_account?: { id: string; username?: string };
  }>('me?fields=id,name,instagram_business_account{id,username}', accessToken);

  return {
    pageId: me.id,
    pageName: me.name || me.id,
    igId: me.instagram_business_account?.id || igIdFallback || '',
    igUsername: me.instagram_business_account?.username,
  };
}

export async function findConversationForCustomer(
  pageId: string,
  accessToken: string,
  igId: string,
  customerIgsid: string,
): Promise<ConversationSummary | null> {
  const fields = 'id,participants,updated_time,snippet';
  const owners = [pageId, igId].filter(Boolean);

  for (const ownerId of owners) {
    try {
      const direct = await graphGet<GraphPage<RawConversation>>(
        `${ownerId}/conversations?platform=instagram&user_id=${encodeURIComponent(customerIgsid)}&fields=${fields}&limit=5`,
        accessToken,
      );
      if (direct.data?.[0]) {
        return mapConversation(direct.data[0], pageId, igId, customerIgsid);
      }
    } catch (err) {
      console.warn(
        '[instagramGraph] user_id conversation lookup failed',
        ownerId,
        err instanceof Error ? err.message : err,
      );
    }
  }

  for (const ownerId of owners) {
    try {
      const all = await graphGetAllPages<RawConversation>(
        `${ownerId}/conversations?platform=instagram&fields=${fields}&limit=50`,
        accessToken,
        5,
      );
      const match = all.find((conv) => {
        const ids = (conv.participants?.data ?? []).map((p) => p.id);
        return ids.includes(customerIgsid);
      });
      if (match) {
        return mapConversation(match, pageId, igId, customerIgsid);
      }
    } catch (err) {
      console.warn(
        '[instagramGraph] paginated conversation lookup failed',
        ownerId,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return null;
}

export async function fetchConversations(
  pageId: string,
  accessToken: string,
  igId: string,
): Promise<ConversationSummary[]> {
  const rows = await graphGetAllPages<RawConversation>(
    `${pageId}/conversations?platform=instagram&fields=participants,updated_time,snippet,id&limit=50`,
    accessToken,
    5,
  );

  return rows.map((conv) => mapConversation(conv, pageId, igId));
}

type RawGraphMessage = {
  id: string;
  message?: string;
  created_time?: string;
  from?: RawParticipant;
};

function mapGraphMessage(m: RawGraphMessage, businessIds: Set<string>): ThreadMessage | null {
  if (!m.message?.trim()) return null;
  const fromId = m.from?.id || '';
  const fromLabel = m.from?.username
    ? `@${m.from.username}`
    : m.from?.name || fromId || 'Unknown';
  return {
    id: m.id,
    text: m.message,
    fromId,
    fromLabel,
    createdTime: m.created_time,
    isFromBusiness: businessIds.has(fromId),
  };
}

async function fetchMessageDetails(
  messageId: string,
  accessToken: string,
  businessIds: Set<string>,
): Promise<ThreadMessage | null> {
  try {
    const m = await graphGet<RawGraphMessage>(
      `${messageId}?fields=id,message,from{id,username,name},created_time`,
      accessToken,
    );
    return mapGraphMessage(m, businessIds);
  } catch (err) {
    console.warn(
      '[instagramGraph] message detail fetch failed',
      messageId,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function fetchThreadMessages(
  conversationId: string,
  accessToken: string,
  businessIds: Set<string>,
): Promise<ThreadMessage[]> {
  const messageFields = 'id,message,from{id,username,name},created_time';
  const fromEdge = await graphGetAllPages<RawGraphMessage>(
    `${conversationId}/messages?fields=${messageFields}&limit=50`,
    accessToken,
    5,
  );

  let mapped = fromEdge
    .map((m) => mapGraphMessage(m, businessIds))
    .filter((m): m is ThreadMessage => m !== null);

  if (mapped.length === 0) {
    const conv = await graphGet<{
      messages?: { data: Array<{ id: string; created_time?: string }> };
    }>(`${conversationId}?fields=messages{id,created_time}`, accessToken);

    const refs = conv.messages?.data ?? [];
    const detailed = await Promise.all(
      refs.slice(0, 25).map((ref) => fetchMessageDetails(ref.id, accessToken, businessIds)),
    );
    mapped = detailed.filter((m): m is ThreadMessage => m !== null);
  }

  mapped.sort((a, b) => {
    const ta = a.createdTime ? Date.parse(a.createdTime) : 0;
    const tb = b.createdTime ? Date.parse(b.createdTime) : 0;
    return ta - tb;
  });

  return mapped;
}

export async function sendInstagramMessage(
  pageId: string,
  accessToken: string,
  recipientId: string,
  text: string,
): Promise<{ messageId?: string }> {
  const payload = {
    recipient: { id: recipientId },
    message: { text },
  };

  const paths = ['me/messages', `${pageId}/messages`];
  let lastError: Error | null = null;

  for (const path of paths) {
    try {
      const result = await graphPost<{ message_id?: string; id?: string }>(
        path,
        accessToken,
        payload,
      );
      return { messageId: result.message_id || result.id };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Send failed');
    }
  }

  throw lastError ?? new Error('Send failed');
}
