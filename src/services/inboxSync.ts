import prisma from './db';
import {
  fetchConnectedProfile,
  fetchThreadMessages,
  findConversationForCustomer,
  ThreadMessage,
} from './instagramGraph';
import { getDbThread } from './inboxStore';

const INSTAGRAM = 'Instagram' as const;

export type SyncResult = {
  imported: number;
  updated: number;
  skipped: number;
  removed: number;
  graphMessageCount: number;
  graphConversationId: string;
  customerIgsid: string;
};

async function loadAccount(storeId: string) {
  return prisma.channelAccount.findFirst({
    where: { storeId, platform: INSTAGRAM },
  });
}

function parseGraphTime(createdTime?: string): Date | undefined {
  if (!createdTime) return undefined;
  const d = new Date(createdTime);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

async function upsertGraphMessage(
  opts: {
    conversationId: string;
    storeId: string;
    userId: string;
    customerSenderId: string;
    merchantIgId: string;
    graphMessage: ThreadMessage;
  },
  existing?: {
    id: string;
    text: string;
    timestamp: string;
    senderId: string;
    recipientId: string;
    createdAt: Date;
  },
): Promise<'created' | 'updated' | 'skipped'> {
  const isFromBusiness = opts.graphMessage.isFromBusiness;
  const createdAt = parseGraphTime(opts.graphMessage.createdTime);
  const senderId = opts.graphMessage.fromId || opts.customerSenderId;
  const recipientId = isFromBusiness ? opts.customerSenderId : opts.merchantIgId;
  const timestamp = opts.graphMessage.createdTime ?? String(Date.now());

  if (existing) {
    const needsUpdate =
      existing.text !== opts.graphMessage.text ||
      existing.timestamp !== timestamp ||
      existing.senderId !== senderId ||
      existing.recipientId !== recipientId ||
      (createdAt && existing.createdAt.getTime() !== createdAt.getTime());

    if (!needsUpdate) return 'skipped';

    await prisma.message.update({
      where: { id: existing.id },
      data: {
        text: opts.graphMessage.text,
        timestamp,
        senderId,
        recipientId,
        ...(createdAt ? { createdAt } : {}),
      },
    });
    return 'updated';
  }

  await prisma.message.create({
    data: {
      conversationId: opts.conversationId,
      storeId: opts.storeId,
      userId: opts.userId,
      senderId,
      recipientId,
      messageId: opts.graphMessage.id,
      text: opts.graphMessage.text,
      timestamp,
      ...(createdAt ? { createdAt } : {}),
    },
  });

  return 'created';
}

export async function syncConversationFromInstagram(
  storeId: string,
  conversationId: string,
): Promise<SyncResult> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, storeId, platform: INSTAGRAM },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const account = await loadAccount(storeId);
  if (!account?.accessToken) {
    throw new Error('Instagram not connected');
  }

  const profile = await fetchConnectedProfile(
    account.accessToken,
    account.externalAccountId ?? undefined,
  );

  console.log(
    '[inboxSync] start',
    JSON.stringify({
      storeId,
      conversationId,
      customerIgsid: conversation.senderId,
      pageId: profile.pageId,
      igId: profile.igId,
    }),
  );

  const graphConv = await findConversationForCustomer(
    profile.pageId,
    account.accessToken,
    profile.igId,
    conversation.senderId,
  );

  if (!graphConv) {
    throw new Error(
      `No Instagram thread found for customer ${conversation.senderId}. They may need to message you first.`,
    );
  }

  const businessIds = new Set(
    [profile.pageId, profile.igId, account.externalAccountId || ''].filter(Boolean),
  );

  let graphMessages = graphConv.messages ?? [];
  if (graphMessages.length === 0) {
    graphMessages = await fetchThreadMessages(
      graphConv.id,
      account.accessToken,
      businessIds,
    );
  }

  console.log(
    '[inboxSync] fetched',
    JSON.stringify({
      graphConversationId: graphConv.id,
      graphMessageCount: graphMessages.length,
    }),
  );

  if (graphMessages.length === 0) {
    throw new Error(
      'Instagram returned no readable messages for this thread. Meta only exposes the 20 most recent messages via API.',
    );
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let removed = 0;

  const graphMessageIds = graphMessages.map((m) => m.id);
  const merchantIgId = profile.igId || account.externalAccountId || profile.pageId;
  const upsertOpts = {
    conversationId: conversation.id,
    storeId: conversation.storeId,
    userId: conversation.userId,
    customerSenderId: conversation.senderId,
    merchantIgId,
  };

  const existingRows = await prisma.message.findMany({
    where: {
      conversationId: conversation.id,
      messageId: { in: graphMessageIds },
    },
  });
  const existingByMessageId = new Map(existingRows.map((row) => [row.messageId, row]));

  for (const graphMessage of graphMessages) {
    const result = await upsertGraphMessage(
      { ...upsertOpts, graphMessage },
      existingByMessageId.get(graphMessage.id),
    );
    if (result === 'created') imported += 1;
    else if (result === 'updated') updated += 1;
    else skipped += 1;
  }

  const stale = await prisma.message.deleteMany({
    where: {
      conversationId: conversation.id,
      messageId: { notIn: graphMessageIds },
    },
  });
  removed = stale.count;

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  return {
    imported,
    updated,
    skipped,
    removed,
    graphMessageCount: graphMessages.length,
    graphConversationId: graphConv.id,
    customerIgsid: conversation.senderId,
  };
}

export async function syncConversationAndLoadThread(
  storeId: string,
  conversationId: string,
) {
  const sync = await syncConversationFromInstagram(storeId, conversationId);
  const account = await loadAccount(storeId);
  const thread = await getDbThread(
    storeId,
    conversationId,
    account?.externalAccountId,
  );

  if (!thread) {
    throw new Error('Conversation not found after sync');
  }

  return { sync, thread };
}
