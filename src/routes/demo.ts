import { Router, Request, Response } from 'express';
import prisma from '../services/db';
import {
  fetchConnectedProfile,
  fetchConversations,
  fetchThreadMessages,
  sendInstagramMessage,
} from '../services/instagramGraph';
import {
  renderDemoError,
  renderDemoLanding,
  renderInboxPage,
  renderThreadPage,
} from '../views/demoPages';

const router = Router();
const INSTAGRAM = 'Instagram' as const;

const DEFAULT_STORE_ID = 'cmh0sk1c4002nokyu506e8nvr';

function resolveStoreId(req: Request): string {
  const fromQuery = typeof req.query.storeId === 'string' ? req.query.storeId.trim() : '';
  return fromQuery || process.env.OAUTH_STORE_ID?.trim() || DEFAULT_STORE_ID;
}

async function loadChannelAccount(storeId: string) {
  return prisma.channelAccount.findFirst({
    where: { storeId, platform: INSTAGRAM },
    include: { store: { select: { title: true } } },
  });
}

function connectUrl(storeId: string): string {
  const userId = process.env.OAUTH_USER_ID?.trim() || 'cmh0siw57002ewm2g3nd94tkb';
  return `/oauth.php?storeId=${encodeURIComponent(storeId)}&userId=${encodeURIComponent(userId)}&demo=1`;
}

router.get('/demo', async (req: Request, res: Response): Promise<void> => {
  const storeId = resolveStoreId(req);
  const account = await loadChannelAccount(storeId);

  res.status(200).type('html').send(
    renderDemoLanding({
      connectUrl: connectUrl(storeId),
      storeId,
      connected: Boolean(account?.accessToken && account.externalAccountId),
    }),
  );
});

router.get('/demo/inbox', async (req: Request, res: Response): Promise<void> => {
  const storeId = resolveStoreId(req);
  const account = await loadChannelAccount(storeId);

  if (!account?.accessToken) {
    res.redirect(302, connectUrl(storeId));
    return;
  }

  try {
    const profile = await fetchConnectedProfile(
      account.accessToken,
      account.externalAccountId ?? undefined,
    );
    const conversations = await fetchConversations(
      profile.pageId,
      account.accessToken,
      profile.igId,
    );

    const connected = req.query.connected === '1';
    const flash = connected
      ? { type: 'ok' as const, message: 'Instagram account connected. Select a conversation and send a message.' }
      : undefined;

    res.status(200).type('html').send(
      renderInboxPage({
        profile,
        conversations,
        storeId,
        flash,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load inbox';
    res.status(500).type('html').send(renderDemoError('Inbox unavailable', message));
  }
});

router.get('/demo/conversations/:conversationId', async (req: Request, res: Response): Promise<void> => {
  const storeId = resolveStoreId(req);
  const conversationId = String(req.params.conversationId);
  const account = await loadChannelAccount(storeId);

  if (!account?.accessToken) {
    res.redirect(302, connectUrl(storeId));
    return;
  }

  try {
    const profile = await fetchConnectedProfile(
      account.accessToken,
      account.externalAccountId ?? undefined,
    );
    const conversations = await fetchConversations(
      profile.pageId,
      account.accessToken,
      profile.igId,
    );
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) {
      res.status(404).type('html').send(renderDemoError('Conversation not found', conversationId));
      return;
    }

    const businessIds = new Set([profile.pageId, profile.igId, account.externalAccountId || '']);
    const messages = await fetchThreadMessages(conversationId, account.accessToken, businessIds);

    const sent = typeof req.query.sent === 'string' ? req.query.sent : undefined;

    res.status(200).type('html').send(
      renderThreadPage({
        profile,
        conversationId,
        participantLabel: conv.participantLabel,
        participantId: conv.participantId,
        messages,
        storeId,
        sentText: sent,
        flash: sent
          ? {
              type: 'ok',
              message:
                'Message sent successfully from ChatPay. Switch to the Instagram app to confirm the same text appears in this thread.',
            }
          : undefined,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load conversation';
    res.status(500).type('html').send(renderDemoError('Thread unavailable', message));
  }
});

router.post('/demo/conversations/:conversationId/send', async (req: Request, res: Response): Promise<void> => {
  const storeId = resolveStoreId(req);
  const conversationId = String(req.params.conversationId);
  const text = typeof req.body.message === 'string' ? req.body.message.trim() : '';

  if (!text) {
    res.redirect(302, `/demo/conversations/${encodeURIComponent(conversationId)}?storeId=${encodeURIComponent(storeId)}`);
    return;
  }

  const account = await loadChannelAccount(storeId);
  if (!account?.accessToken) {
    res.redirect(302, connectUrl(storeId));
    return;
  }

  try {
    const profile = await fetchConnectedProfile(
      account.accessToken,
      account.externalAccountId ?? undefined,
    );
    const conversations = await fetchConversations(
      profile.pageId,
      account.accessToken,
      profile.igId,
    );
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv?.participantId) {
      res.status(400).type('html').send(renderDemoError('Send failed', 'Could not resolve recipient.'));
      return;
    }

    await sendInstagramMessage(profile.pageId, account.accessToken, conv.participantId, text);

    res.redirect(
      302,
      `/demo/conversations/${encodeURIComponent(conversationId)}?storeId=${encodeURIComponent(storeId)}&sent=${encodeURIComponent(text)}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Send failed';
    res.status(500).type('html').send(renderDemoError('Send failed', message));
  }
});

export default router;
