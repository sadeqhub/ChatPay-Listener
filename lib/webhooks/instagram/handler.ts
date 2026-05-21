import prisma from '@/lib/db';
import { messageQueue } from '@/lib/queue';
import { ParsedInboundMessage } from './parse';

const INSTAGRAM = 'Instagram' as const;

export async function processInboundMessages(
  messages: ParsedInboundMessage[],
): Promise<void> {
  for (const inbound of messages) {
    await processOneInbound(inbound);
  }
}

async function processOneInbound(inbound: ParsedInboundMessage): Promise<void> {
  const channelAccount = await prisma.channelAccount.findFirst({
    where: {
      platform: INSTAGRAM,
      externalAccountId: inbound.merchantIgId,
    },
  });

  if (!channelAccount) {
    console.warn(
      'No ChannelAccount for Instagram merchant',
      inbound.merchantIgId,
    );
    return;
  }

  let conversation = await prisma.conversation.findFirst({
    where: {
      storeId: channelAccount.storeId,
      senderId: inbound.customerIgsid,
      platform: INSTAGRAM,
    },
  });

  if (conversation) {
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });
  } else {
    conversation = await prisma.conversation.create({
      data: {
        storeId: channelAccount.storeId,
        userId: channelAccount.userId,
        senderId: inbound.customerIgsid,
        recipientId: inbound.merchantIgId,
        platform: INSTAGRAM,
      },
    });
  }

  const existing = await prisma.message.findFirst({
    where: {
      conversationId: conversation.id,
      messageId: inbound.metaMid,
    },
    select: { id: true },
  });

  if (existing) {
    return;
  }

  const savedMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      storeId: channelAccount.storeId,
      userId: channelAccount.userId,
      senderId: inbound.customerIgsid,
      recipientId: inbound.merchantIgId,
      messageId: inbound.metaMid,
      text: inbound.text,
      timestamp: inbound.timestamp,
    },
  });

  await messageQueue.add('process-message', {
    conversationId: conversation.id,
    messageId: savedMessage.id,
  });
}
