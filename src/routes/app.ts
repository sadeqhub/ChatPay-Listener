import { Router, Request, Response } from 'express';
import prisma from '../services/db';
import {
  fetchConnectedProfile,
  fetchConversations,
  fetchThreadMessages,
  sendInstagramMessage,
} from '../services/instagramGraph';
import {
  AppTab,
  renderAppError,
  renderAppShell,
  renderDevelopersPanel,
  renderInsightsPanel,
  renderMessagesPanel,
  renderNotConnectedPanel,
  renderThreadPanel,
  renderTodayPanel,
} from '../views/appPages';

const router = Router();
const INSTAGRAM = 'Instagram' as const;

const DEFAULT_STORE_ID = 'cmh0sk1c4002nokyu506e8nvr';

function resolveStoreId(req: Request): string {
  const fromQuery = typeof req.query.storeId === 'string' ? req.query.storeId.trim() : '';
  return fromQuery || process.env.OAUTH_STORE_ID?.trim() || DEFAULT_STORE_ID;
}

function resolveTab(req: Request): AppTab {
  const tab = typeof req.query.tab === 'string' ? req.query.tab.trim() : '';
  if (tab === 'today' || tab === 'insights' || tab === 'messages' || tab === 'developers') {
    return tab;
  }
  return 'today';
}

function resolveConversation(req: Request): string | undefined {
  const id = typeof req.query.conversation === 'string' ? req.query.conversation.trim() : '';
  return id || undefined;
}

function parseFlash(req: Request): { type: 'ok' | 'err'; message: string } | undefined {
  const message = typeof req.query.flash === 'string' ? req.query.flash.trim() : '';
  if (!message) return undefined;
  const type = req.query.flashType === 'err' ? 'err' : 'ok';
  return { type, message };
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

type InboxContext = {
  storeId: string;
  storeTitle?: string;
  profile: Awaited<ReturnType<typeof fetchConnectedProfile>>;
  conversations: Awaited<ReturnType<typeof fetchConversations>>;
};

async function loadInboxContext(storeId: string): Promise<InboxContext | null> {
  const account = await loadChannelAccount(storeId);
  if (!account?.accessToken) return null;

  const profile = await fetchConnectedProfile(
    account.accessToken,
    account.externalAccountId ?? undefined,
  );
  const conversations = await fetchConversations(
    profile.pageId,
    account.accessToken,
    profile.igId,
  );

  return {
    storeId,
    storeTitle: account.store?.title,
    profile,
    conversations,
  };
}

async function sendStoreMessage(
  storeId: string,
  conversationId: string,
  text: string,
): Promise<void> {
  const account = await loadChannelAccount(storeId);
  if (!account?.accessToken) {
    throw new Error('Instagram not connected');
  }

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
    throw new Error('Could not resolve recipient');
  }

  await sendInstagramMessage(profile.pageId, account.accessToken, conv.participantId, text);
}

async function loadPanel(
  tab: AppTab,
  storeId: string,
  conversationId?: string,
  flash?: { type: 'ok' | 'err'; message: string },
) {
  const ctx = await loadInboxContext(storeId);
  const connected = Boolean(ctx);

  if (tab === 'developers') {
    return renderDevelopersPanel({ connectUrl: connectUrl(storeId), connected });
  }

  if (tab === 'insights') {
    return renderInsightsPanel();
  }

  if (tab === 'today') {
    return renderTodayPanel({
      conversationCount: ctx?.conversations.length ?? 0,
      flash,
    });
  }

  if (!ctx) {
    return renderNotConnectedPanel({ connectUrl: connectUrl(storeId) });
  }

  if (conversationId) {
    const account = await loadChannelAccount(storeId);
    if (!account?.accessToken) {
      return renderNotConnectedPanel({ connectUrl: connectUrl(storeId) });
    }

    const conv = ctx.conversations.find((c) => c.id === conversationId);
    if (!conv) {
      throw new Error('Conversation not found');
    }

    const businessIds = new Set([ctx.profile.pageId, ctx.profile.igId, account.externalAccountId || '']);
    const messages = await fetchThreadMessages(conversationId, account.accessToken, businessIds);

    return renderThreadPanel({
      conversationId,
      participantLabel: conv.participantLabel,
      messages,
      conversations: ctx.conversations,
      flash,
    });
  }

  return renderMessagesPanel({
    profile: ctx.profile,
    conversations: ctx.conversations,
    flash,
  });
}

async function handleAppShell(req: Request, res: Response): Promise<void> {
  const storeId = resolveStoreId(req);
  let tab = resolveTab(req);
  const conversationId = resolveConversation(req);

  let flash = parseFlash(req);
  if (req.query.connected === '1' && !flash) {
    flash = { type: 'ok', message: 'Instagram account connected successfully.' };
    tab = 'messages';
  }

  try {
    const ctx = await loadInboxContext(storeId);
    const panel = await loadPanel(tab, storeId, conversationId, flash);

    res.status(200).type('html').send(
      renderAppShell({
        storeId,
        storeTitle: ctx?.storeTitle ?? (await loadChannelAccount(storeId))?.store?.title,
        initialTab: tab,
        initialConversation: conversationId,
        initialPanelHtml: panel.html,
        initialTitle: panel.title,
        profile: ctx?.profile,
        connectUrl: connectUrl(storeId),
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load dashboard';
    res.status(500).type('html').send(renderAppError('Dashboard unavailable', message));
  }
}

router.get('/inbox', handleAppShell);

router.get('/api/panels/:tab', async (req: Request, res: Response): Promise<void> => {
  const storeId = resolveStoreId(req);
  const tab = String(req.params.tab) as AppTab;
  const flash = parseFlash(req);

  if (!['today', 'insights', 'messages', 'developers'].includes(tab)) {
    res.status(404).json({ error: 'Unknown panel' });
    return;
  }

  try {
    const panel = await loadPanel(tab, storeId, undefined, flash);
    res.json(panel);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load panel';
    res.status(500).json({ error: message });
  }
});

router.get('/api/panels/messages/:conversationId', async (req: Request, res: Response): Promise<void> => {
  const storeId = resolveStoreId(req);
  const conversationId = String(req.params.conversationId);
  const flash = parseFlash(req);

  try {
    const panel = await loadPanel('messages', storeId, conversationId, flash);
    res.json(panel);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load conversation';
    res.status(err instanceof Error && err.message === 'Conversation not found' ? 404 : 500).json({ error: message });
  }
});

router.post('/api/messages/:conversationId/send', async (req: Request, res: Response): Promise<void> => {
  const storeId = resolveStoreId(req);
  const conversationId = String(req.params.conversationId);
  const text = typeof req.body.message === 'string' ? req.body.message.trim() : '';

  if (!text) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  try {
    await sendStoreMessage(storeId, conversationId, text);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Send failed';
    if (message === 'Instagram not connected') {
      res.status(401).json({ error: message });
      return;
    }
    if (message === 'Could not resolve recipient') {
      res.status(400).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

router.get('/integrations', (req, res) => {
  const storeId = resolveStoreId(req);
  res.redirect(302, `/inbox?${storeQuery(storeId)}&tab=developers`);
});

router.get('/inbox/conversations/:conversationId', (req, res) => {
  const storeId = resolveStoreId(req);
  const qs = new URLSearchParams({ storeId, tab: 'messages', conversation: String(req.params.conversationId) });
  if (req.query.sent === '1') {
    qs.set('flash', 'Message sent.');
    qs.set('flashType', 'ok');
  }
  res.redirect(302, `/inbox?${qs.toString()}`);
});

router.post('/inbox/conversations/:conversationId/send', async (req: Request, res: Response): Promise<void> => {
  const storeId = resolveStoreId(req);
  const conversationId = String(req.params.conversationId);
  const text = typeof req.body.message === 'string' ? req.body.message.trim() : '';

  if (!text) {
    res.redirect(302, `/inbox?${storeQuery(storeId)}&tab=messages&conversation=${encodeURIComponent(conversationId)}`);
    return;
  }

  try {
    await sendStoreMessage(storeId, conversationId, text);
    res.redirect(
      302,
      `/inbox?${storeQuery(storeId)}&tab=messages&conversation=${encodeURIComponent(conversationId)}&flash=${encodeURIComponent('Message sent.')}&flashType=ok`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Send failed';
    if (message === 'Instagram not connected') {
      res.redirect(302, `/inbox?${storeQuery(storeId)}&tab=developers`);
      return;
    }
    if (message === 'Could not resolve recipient') {
      res.status(400).type('html').send(renderAppError('Send failed', message));
      return;
    }
    res.status(500).type('html').send(renderAppError('Send failed', message));
  }
});

router.get('/demo', (req, res) => {
  const storeId = resolveStoreId(req);
  res.redirect(302, `/inbox?${storeQuery(storeId)}&tab=developers`);
});
router.get('/demo/inbox', (req, res) => {
  const storeId = resolveStoreId(req);
  const qs = new URLSearchParams(req.query as Record<string, string>);
  qs.set('storeId', storeId);
  qs.set('tab', 'messages');
  res.redirect(302, `/inbox?${qs.toString()}`);
});
router.get('/demo/conversations/:conversationId', (req, res) => {
  const storeId = resolveStoreId(req);
  const qs = new URLSearchParams(req.query as Record<string, string>);
  qs.set('storeId', storeId);
  qs.set('tab', 'messages');
  qs.set('conversation', String(req.params.conversationId));
  res.redirect(302, `/inbox?${qs.toString()}`);
});
router.post('/demo/conversations/:conversationId/send', async (req: Request, res: Response): Promise<void> => {
  const storeId = resolveStoreId(req);
  const conversationId = String(req.params.conversationId);
  const text = typeof req.body.message === 'string' ? req.body.message.trim() : '';

  if (!text) {
    res.redirect(302, `/inbox?${storeQuery(storeId)}&tab=messages&conversation=${encodeURIComponent(conversationId)}`);
    return;
  }

  try {
    await sendStoreMessage(storeId, conversationId, text);
    res.redirect(
      302,
      `/inbox?${storeQuery(storeId)}&tab=messages&conversation=${encodeURIComponent(conversationId)}&flash=${encodeURIComponent('Message sent.')}&flashType=ok`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Send failed';
    res.status(500).type('html').send(renderAppError('Send failed', message));
  }
});

export default router;
