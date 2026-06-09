import { Router, Request, Response } from 'express';
import prisma from '../services/db';
import {
  fetchConnectedProfile,
  fetchConversations,
  fetchThreadMessages,
  sendInstagramMessage,
} from '../services/instagramGraph';
import {
  renderAppError,
  renderInboxPage,
  renderIntegrationsPage,
  renderThreadPage,
} from '../views/appPages';

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
  return `/oauth.php?storeId=${encodeURIComponent(storeId)}&userId=${encodeURIComponent(userId)}`;
}

function storeQuery(storeId: string): string {
  return `storeId=${encodeURIComponent(storeId)}`;
}

async function handleInbox(req: Request, res: Response): Promise<void> {
  const storeId = resolveStoreId(req);
  const account = await loadChannelAccount(storeId);

  if (!account?.accessToken) {
    res.redirect(302, `/integrations?${storeQuery(storeId)}`);
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
      ? { type: 'ok' as const, message: 'Instagram account connected successfully.' }
      : undefined;

    res.status(200).type('html').send(
      renderInboxPage({
        profile,
        conversations,
        storeId,
        storeTitle: account.store?.title,
        flash,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load inbox';
    res.status(500).type('html').send(renderAppError('Inbox unavailable', message));
  }
}

async function handleThread(req: Request, res: Response): Promise<void> {
  const storeId = resolveStoreId(req);
  const conversationId = String(req.params.conversationId);
  const account = await loadChannelAccount(storeId);

  if (!account?.accessToken) {
    res.redirect(302, `/integrations?${storeQuery(storeId)}`);
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
      res.status(404).type('html').send(renderAppError('Conversation not found', conversationId));
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
        messages,
        conversations,
        storeId,
        storeTitle: account.store?.title,
        flash: sent ? { type: 'ok', message: 'Message sent.' } : undefined,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load conversation';
    res.status(500).type('html').send(renderAppError('Thread unavailable', message));
  }
}

async function handleSend(req: Request, res: Response): Promise<void> {
  const storeId = resolveStoreId(req);
  const conversationId = String(req.params.conversationId);
  const text = typeof req.body.message === 'string' ? req.body.message.trim() : '';

  if (!text) {
    res.redirect(302, `/inbox/conversations/${encodeURIComponent(conversationId)}?${storeQuery(storeId)}`);
    return;
  }

  const account = await loadChannelAccount(storeId);
  if (!account?.accessToken) {
    res.redirect(302, `/integrations?${storeQuery(storeId)}`);
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
      res.status(400).type('html').send(renderAppError('Send failed', 'Could not resolve recipient.'));
      return;
    }

    await sendInstagramMessage(profile.pageId, account.accessToken, conv.participantId, text);

    res.redirect(
      302,
      `/inbox/conversations/${encodeURIComponent(conversationId)}?${storeQuery(storeId)}&sent=1`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Send failed';
    res.status(500).type('html').send(renderAppError('Send failed', message));
  }
}

router.get('/integrations', async (req: Request, res: Response): Promise<void> => {
  const storeId = resolveStoreId(req);
  const account = await loadChannelAccount(storeId);

  res.status(200).type('html').send(
    renderIntegrationsPage({
      connectUrl: connectUrl(storeId),
      storeTitle: account?.store?.title,
      connected: Boolean(account?.accessToken && account.externalAccountId),
    }),
  );
});

router.get('/inbox', handleInbox);
router.get('/inbox/conversations/:conversationId', handleThread);
router.post('/inbox/conversations/:conversationId/send', handleSend);

router.get('/demo', (req, res) => {
  const storeId = resolveStoreId(req);
  res.redirect(302, `/integrations?${storeQuery(storeId)}`);
});
router.get('/demo/inbox', (req, res) => {
  const storeId = resolveStoreId(req);
  const qs = new URLSearchParams(req.query as Record<string, string>);
  qs.set('storeId', storeId);
  res.redirect(302, `/inbox?${qs.toString()}`);
});
router.get('/demo/conversations/:conversationId', (req, res) => {
  const storeId = resolveStoreId(req);
  const qs = new URLSearchParams(req.query as Record<string, string>);
  qs.set('storeId', storeId);
  res.redirect(302, `/inbox/conversations/${encodeURIComponent(String(req.params.conversationId))}?${qs.toString()}`);
});
router.post('/demo/conversations/:conversationId/send', handleSend);

export default router;
