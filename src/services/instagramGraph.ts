const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';

type GraphError = { message: string; code?: number };

async function graphGet<T>(path: string, accessToken: string): Promise<T> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`);
  url.searchParams.set('access_token', accessToken);
  const response = await fetch(url);
  const body = (await response.json()) as T & { error?: GraphError };
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || `Graph GET failed (${response.status})`);
  }
  return body;
}

async function graphPost<T>(
  path: string,
  accessToken: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`);
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

export async function fetchConversations(
  pageId: string,
  accessToken: string,
  igId: string,
): Promise<ConversationSummary[]> {
  const result = await graphGet<{
    data: Array<{
      id: string;
      updated_time?: string;
      snippet?: string;
      participants?: { data: Array<{ id: string; username?: string; name?: string }> };
    }>;
  }>(
    `${pageId}/conversations?platform=instagram&fields=participants,updated_time,snippet`,
    accessToken,
  );

  return (result.data ?? []).map((conv) => {
    const participants = conv.participants?.data ?? [];
    const customer = participants.find((p) => p.id !== pageId && p.id !== igId) ?? participants[0];
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
  });
}

export async function fetchThreadMessages(
  conversationId: string,
  accessToken: string,
  businessIds: Set<string>,
): Promise<ThreadMessage[]> {
  const result = await graphGet<{
    messages?: {
      data: Array<{
        id: string;
        message?: string;
        created_time?: string;
        from?: { id: string; username?: string; name?: string };
      }>;
    };
  }>(`${conversationId}?fields=messages{message,from,created_time,id}`, accessToken);

  return (result.messages?.data ?? [])
    .filter((m) => m.message)
    .map((m) => {
      const fromId = m.from?.id || '';
      const fromLabel = m.from?.username
        ? `@${m.from.username}`
        : m.from?.name || fromId;
      return {
        id: m.id,
        text: m.message || '',
        fromId,
        fromLabel,
        createdTime: m.created_time,
        isFromBusiness: businessIds.has(fromId),
      };
    })
    .reverse();
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
