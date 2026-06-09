import { Router, Request, Response } from 'express';
import prisma from '../services/db';
import { fetchConnectedProfile, sendInstagramMessage } from '../services/instagramGraph';
import {
  getDbThread,
  getStoreMeta,
  listDbConversations,
  saveOutboundMessage,
} from '../services/inboxStore';
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
import { absoluteApiPath, webAppBase } from '../lib/publicUrl';

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

function connectUrl(storeId: string): string {
  const userId = process.env.OAUTH_USER_ID?.trim() || 'cmh0siw57002ewm2g3nd94tkb';
  return absoluteApiPath(
    `/oauth.php?storeId=${encodeURIComponent(storeId)}&userId=${encodeURIComponent(userId)}`,
  );
}

function reconnectUrl(storeId: string): string {
  return connectUrl(storeId);
}

function inboxPath(query: Record<string, string>): string {
  const qs = new URLSearchParams(query).toString();
  return `/inbox${qs ? `?${qs}` : ''}`;
}

function redirectToWebApp(res: Response, query: Record<string, string>): boolean {
  const web = webAppBase();
  if (!web) return false;
  res.redirect(302, `${web}${inboxPath(query)}`);
  return true;
}

function storeQuery(storeId: string): string {
  return `storeId=${encodeURIComponent(storeId)}`;
}

function accountLabel(igId?: string): string {
  return igId ? `IG ${igId.slice(-8)}` : 'Connected';
}

async function loadPanel(
  tab: AppTab,
  storeId: string,
  connected: boolean,
  igId: string | undefined,
  conversationId?: string,
  flash?: { type: 'ok' | 'err'; message: string },
) {
  if (tab === 'developers') {
    return renderDevelopersPanel({
      connectUrl: connectUrl(storeId),
      reconnectUrl: reconnectUrl(storeId),
      connected,
    });
  }

  if (tab === 'insights') {
    return renderInsightsPanel();
  }

  if (tab === 'today') {
    const conversations = connected ? await listDbConversations(storeId) : [];
    return renderTodayPanel({
      conversationCount: conversations.length,
      flash,
    });
  }

  if (!connected) {
    return renderNotConnectedPanel({ connectUrl: connectUrl(storeId) });
  }

  const conversations = await listDbConversations(storeId);

  if (conversationId) {
    const thread = await getDbThread(storeId, conversationId, igId);
    if (!thread) {
      throw new Error('Conversation not found');
    }

    return renderThreadPanel({
      conversationId,
      participantLabel: thread.conversation.participantLabel,
      messages: thread.messages,
      conversations,
      flash,
    });
  }

  return renderMessagesPanel({
    conversations,
    flash,
    accountLabel: accountLabel(igId),
  });
}

async function resolveShellState(req: Request) {
  const storeId = resolveStoreId(req);
  let tab = resolveTab(req);
  const conversationId = resolveConversation(req);

  let flash = parseFlash(req);
  if (req.query.connected === '1' && !flash) {
    flash = { type: 'ok' as const, message: 'Instagram account connected successfully.' };
    tab = 'messages';
  }

  const meta = await getStoreMeta(storeId, connectUrl(storeId));
  const panel = await loadPanel(
    tab,
    storeId,
    meta.connected,
    meta.igId,
    conversationId,
    flash,
  );

  return {
    storeId: meta.storeId,
    storeTitle: meta.storeTitle,
    tab,
    conversationId,
    profile: meta.igId ? { pageName: 'Instagram', igId: meta.igId, pageId: meta.igId } : null,
    connected: meta.connected,
    connectUrl: meta.connectUrl ?? connectUrl(storeId),
    panel,
  };
}

async function sendStoreMessage(
  storeId: string,
  conversationId: string,
  text: string,
): Promise<void> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, storeId, platform: INSTAGRAM },
  });
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const account = await prisma.channelAccount.findFirst({
    where: { storeId, platform: INSTAGRAM },
  });
  if (!account?.accessToken) {
    throw new Error('Instagram not connected');
  }

  const profile = await fetchConnectedProfile(
    account.accessToken,
    account.externalAccountId ?? undefined,
  );

  const result = await sendInstagramMessage(
    profile.pageId,
    account.accessToken,
    conversation.senderId,
    text,
  );

  await saveOutboundMessage({
    storeId,
    conversationId,
    userId: account.userId,
    senderId: profile.igId || profile.pageId,
    recipientId: conversation.senderId,
    text,
    messageId: result.messageId || `out-${Date.now()}`,
  });
}

async function handleAppShell(req: Request, res: Response): Promise<void> {
  try {
    const state = await resolveShellState(req);

    res.status(200).type('html').send(
      renderAppShell({
        storeId: state.storeId,
        storeTitle: state.storeTitle,
        initialTab: state.tab,
        initialConversation: state.conversationId,
        initialPanelHtml: state.panel.html,
        initialTitle: state.panel.title,
        profile: state.profile ?? undefined,
        connectUrl: state.connectUrl,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load dashboard';
    res.status(500).type('html').send(renderAppError('Dashboard unavailable', message));
  }
}

router.get('/inbox', (req: Request, res: Response): void => {
  const storeId = resolveStoreId(req);
  const query = Object.fromEntries(
    Object.entries(req.query).map(([key, value]) => [key, String(value)]),
  ) as Record<string, string>;
  if (!query.storeId) query.storeId = storeId;
  if (redirectToWebApp(res, query)) return;
  void handleAppShell(req, res);
});

router.get('/api/app/meta', async (req: Request, res: Response): Promise<void> => {
  const storeId = resolveStoreId(req);
  const meta = await getStoreMeta(storeId, connectUrl(storeId));
  res.json({
    ...meta,
    profile: meta.igId ? { pageName: 'Instagram', igId: meta.igId, pageId: meta.igId } : null,
  });
});

router.get('/api/app/bootstrap', async (req: Request, res: Response): Promise<void> => {
  try {
    const state = await resolveShellState(req);
    res.json({
      storeId: state.storeId,
      storeTitle: state.storeTitle,
      tab: state.tab,
      conversationId: state.conversationId ?? null,
      profile: state.profile,
      connected: state.connected,
      connectUrl: state.connectUrl,
      panel: state.panel,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load dashboard';
    res.status(500).json({ error: message });
  }
});

router.get('/api/inbox/live', async (req: Request, res: Response): Promise<void> => {
  const storeId = resolveStoreId(req);
  const conversationId =
    typeof req.query.conversation === 'string' ? req.query.conversation.trim() : undefined;

  try {
    if (conversationId) {
      const account = await prisma.channelAccount.findFirst({
        where: { storeId, platform: INSTAGRAM },
        select: { externalAccountId: true },
      });
      const thread = await getDbThread(storeId, conversationId, account?.externalAccountId);
      res.json({
        serverTime: new Date().toISOString(),
        conversations: [],
        messages: [],
        thread: thread
          ? {
              conversationId,
              participantLabel: thread.conversation.participantLabel,
              messages: thread.messages,
            }
          : null,
      });
      return;
    }

    const conversations = await listDbConversations(storeId);
    res.json({
      serverTime: new Date().toISOString(),
      conversations,
      messages: [],
      thread: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Live update failed';
    res.status(500).json({ error: message });
  }
});

router.get('/api/panels/:tab', async (req: Request, res: Response): Promise<void> => {
  const storeId = resolveStoreId(req);
  const tab = String(req.params.tab) as AppTab;
  const flash = parseFlash(req);

  if (!['today', 'insights', 'messages', 'developers'].includes(tab)) {
    res.status(404).json({ error: 'Unknown panel' });
    return;
  }

  try {
    const meta = await getStoreMeta(storeId, connectUrl(storeId));
    const panel = await loadPanel(tab, storeId, meta.connected, meta.igId, undefined, flash);
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
    const meta = await getStoreMeta(storeId, connectUrl(storeId));
    const panel = await loadPanel(
      'messages',
      storeId,
      meta.connected,
      meta.igId,
      conversationId,
      flash,
    );
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
    if (message === 'Conversation not found' || message === 'Could not resolve recipient') {
      res.status(400).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

router.get('/integrations', (req, res) => {
  const storeId = resolveStoreId(req);
  const query = { storeId, tab: 'developers' };
  if (redirectToWebApp(res, query)) return;
  res.redirect(302, `/inbox?${storeQuery(storeId)}&tab=developers`);
});

router.get('/inbox/conversations/:conversationId', (req, res) => {
  const storeId = resolveStoreId(req);
  const query: Record<string, string> = {
    storeId,
    tab: 'messages',
    conversation: String(req.params.conversationId),
  };
  if (req.query.sent === '1') {
    query.flash = 'Message sent.';
    query.flashType = 'ok';
  }
  if (redirectToWebApp(res, query)) return;
  res.redirect(302, `/inbox?${new URLSearchParams(query).toString()}`);
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
    if (message === 'Conversation not found') {
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
