import prisma from './db';

const INSTAGRAM = 'Instagram' as const;

export type InboxConversation = {
  id: string;
  participantLabel: string;
  participantId: string;
  snippet?: string;
  updatedTime?: string;
};

export type InboxMessage = {
  id: string;
  text: string;
  fromLabel: string;
  isFromBusiness: boolean;
  createdTime?: string;
};

export type StoreMeta = {
  storeId: string;
  storeTitle?: string;
  connected: boolean;
  igId?: string;
  connectUrl?: string;
};

function labelForSender(senderId: string, igId?: string | null): string {
  if (igId && senderId === igId) return 'You';
  return `Customer ${senderId.slice(-6)}`;
}

export async function getStoreMeta(storeId: string, connectUrl: string): Promise<StoreMeta> {
  const account = await prisma.channelAccount.findFirst({
    where: { storeId, platform: INSTAGRAM },
    include: { store: { select: { title: true } } },
  });

  return {
    storeId,
    storeTitle: account?.store?.title,
    connected: Boolean(account?.accessToken && account.externalAccountId),
    igId: account?.externalAccountId ?? undefined,
    connectUrl,
  };
}

export async function listDbConversations(storeId: string): Promise<InboxConversation[]> {
  const rows = await prisma.conversation.findMany({
    where: { storeId, platform: INSTAGRAM },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  return rows.map((row) => {
    const last = row.messages[0];
    return {
      id: row.id,
      participantId: row.senderId,
      participantLabel: labelForSender(row.senderId, row.recipientId),
      snippet: last?.text,
      updatedTime: (last?.createdAt ?? row.updatedAt).toISOString(),
    };
  });
}

export async function getDbThread(
  storeId: string,
  conversationId: string,
  merchantIgId?: string | null,
): Promise<{ conversation: InboxConversation; messages: InboxMessage[] } | null> {
  const row = await prisma.conversation.findFirst({
    where: { id: conversationId, storeId, platform: INSTAGRAM },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!row) return null;

  const messages: InboxMessage[] = row.messages.map((m) => {
    const isFromBusiness = m.senderId !== row.senderId;
    return {
      id: m.id,
      text: m.text,
      fromLabel: isFromBusiness ? 'You' : labelForSender(m.senderId, row.recipientId),
      isFromBusiness,
      createdTime: m.createdAt.toISOString(),
    };
  });

  const last = row.messages[row.messages.length - 1];
  return {
    conversation: {
      id: row.id,
      participantId: row.senderId,
      participantLabel: labelForSender(row.senderId, row.recipientId),
      snippet: last?.text,
      updatedTime: (last?.createdAt ?? row.updatedAt).toISOString(),
    },
    messages,
  };
}

export async function saveOutboundMessage(opts: {
  storeId: string;
  conversationId: string;
  userId: string;
  senderId: string;
  recipientId: string;
  text: string;
  messageId: string;
}): Promise<void> {
  const ts = String(Date.now());
  await prisma.message.create({
    data: {
      conversationId: opts.conversationId,
      storeId: opts.storeId,
      userId: opts.userId,
      senderId: opts.senderId,
      recipientId: opts.recipientId,
      messageId: opts.messageId,
      text: opts.text,
      timestamp: ts,
    },
  });
  await prisma.conversation.update({
    where: { id: opts.conversationId },
    data: { updatedAt: new Date() },
  });
}
