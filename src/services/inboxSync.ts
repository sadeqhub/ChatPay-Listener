import prisma from './db';
import {
  fetchConnectedProfile,
  fetchConversations,
  fetchThreadMessages,
  ThreadMessage,
} from './instagramGraph';
import { getDbThread } from './inboxStore';

const INSTAGRAM = 'Instagram' as const;

export type SyncResult = {
  imported: number;
  skipped: number;
  graphMessageCount: number;
  graphConversationId: string;
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

async function upsertGraphMessage(opts: {
  conversationId: string;
  storeId: string;
  userId: string;
  customerSenderId: string;
  merchantIgId: string;
  graphMessage: ThreadMessage;
}): Promise<boolean> {
  const existing = await prisma.message.findFirst({
    where: {
      conversationId: opts.conversationId,
      messageId: opts.graphMessage.id,
    },
    select: { id: true },
  });

  if (existing) return false;

  const isFromBusiness = opts.graphMessage.isFromBusiness;
  const createdAt = parseGraphTime(opts.graphMessage.createdTime);

  await prisma.message.create({
    data: {
      conversationId: opts.conversationId,
      storeId: opts.storeId,
      userId: opts.userId,
      senderId: opts.graphMessage.fromId,
      recipientId: isFromBusiness ? opts.customerSenderId : opts.merchantIgId,
      messageId: opts.graphMessage.id,
      text: opts.graphMessage.text,
      timestamp: opts.graphMessage.createdTime ?? String(Date.now()),
      ...(createdAt ? { createdAt } : {}),
    },
  });

  return true;
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

  const graphConversations = await fetchConversations(
    profile.pageId,
    account.accessToken,
    profile.igId,
  );

  const graphConv = graphConversations.find(
    (c) => c.participantId === conversation.senderId,
  );

  if (!graphConv) {
    throw new Error('No matching Instagram thread for this customer');
  }

  const businessIds = new Set([
    profile.pageId,
    profile.igId,
    account.externalAccountId || '',
  ]);

  const graphMessages = await fetchThreadMessages(
    graphConv.id,
    account.accessToken,
    businessIds,
  );

  let imported = 0;
  let skipped = 0;

  for (const graphMessage of graphMessages) {
    const created = await upsertGraphMessage({
      conversationId: conversation.id,
      storeId: conversation.storeId,
      userId: conversation.userId,
      customerSenderId: conversation.senderId,
      merchantIgId: profile.igId || account.externalAccountId || profile.pageId,
      graphMessage,
    });
    if (created) imported += 1;
    else skipped += 1;
  }

  if (imported > 0) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });
  }

  return {
    imported,
    skipped,
    graphMessageCount: graphMessages.length,
    graphConversationId: graphConv.id,
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
