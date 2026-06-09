import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/db';
import {
  renderConnectPage,
  renderErrorPage,
  renderResultPage,
  renderSelectPage,
} from '../views/chatpayAuthPages';

const router = Router();

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const INSTAGRAM = 'Instagram' as const;

/** hurdelivery — default target when no store/user is passed in OAuth */
const DEFAULT_OAUTH_STORE_ID = 'cmhee2hx3004w915bxudirfv1';
const DEFAULT_OAUTH_USER_ID = 'cmhedz7o2008qm4i2h1nvfq6d';

/** Facebook Login — use when your app has no "Instagram" product (most webhook/messaging apps) */
const FACEBOOK_LOGIN_SCOPES = [
  'instagram_basic',
  'instagram_manage_messages',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'pages_messaging',
  'business_management',
].join(',');

/** Fields required for Messenger/Instagram DM webhooks on the Page */
const PAGE_WEBHOOK_FIELDS = [
  'messages',
  'messaging_postbacks',
  'messaging_seen',
  'message_reactions',
  'messaging_handover',
  'messaging_referral',
  'messaging_optins',
].join(',');

/** Instagram Login — only if App Dashboard has "API setup with Instagram login" */
const INSTAGRAM_BUSINESS_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
  'instagram_business_content_publish',
].join(',');

type OAuthFlow = 'facebook' | 'instagram';
type PersistContext = { storeId?: string; userId?: string };
type LinkedInstagramPage = {
  pageId: string;
  pageName?: string;
  igId: string;
  /** Long-lived Page access token — required for sending Instagram DMs via Graph */
  pageAccessToken: string;
};

function getOAuthFlow(): OAuthFlow {
  const flow = process.env.OAUTH_FLOW?.trim().toLowerCase();
  return flow === 'instagram' ? 'instagram' : 'facebook';
}

function getRedirectUri(req: Request): string {
  const configured = process.env.OAUTH_REDIRECT_URI?.trim();
  if (configured) {
    return configured;
  }
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'https')
    .split(',')[0]
    .trim();
  const host = (req.get('x-forwarded-host') || req.get('host') || '').trim();
  return `${proto}://${host}/oauth.php`;
}

function getFacebookAppId(): string | undefined {
  return (
    process.env.META_APP_ID?.trim() ||
    process.env.FACEBOOK_APP_ID?.trim() ||
    undefined
  );
}

function getFacebookAppSecret(): string | undefined {
  return process.env.META_APP_SECRET?.trim();
}

function getInstagramAppId(): string | undefined {
  return process.env.INSTAGRAM_APP_ID?.trim() || getFacebookAppId();
}

function getInstagramAppSecret(): string | undefined {
  return process.env.INSTAGRAM_APP_SECRET?.trim() || getFacebookAppSecret();
}

function normalizeAuthCode(code: string): string {
  return code.replace(/#_?$/, '');
}

function encodeState(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeState(value: string): string | null {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

function inboxRedirect(storeId: string): string {
  return `/inbox?storeId=${encodeURIComponent(storeId)}&connected=1`;
}

function buildStatePayload(
  req: Request,
  fallbackState: string,
): string {
  const storeId = typeof req.query.storeId === 'string' ? req.query.storeId.trim() : '';
  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
  const payload = {
    state: fallbackState,
    storeId: storeId || undefined,
    userId: userId || undefined,
  };
  return encodeState(JSON.stringify(payload));
}

function parsePersistContext(stateValue: string | undefined): PersistContext {
  if (!stateValue) {
    return {};
  }
  const decoded = decodeState(stateValue);
  if (!decoded) {
    return {};
  }
  try {
    const parsed = JSON.parse(decoded) as {
      state?: string;
      storeId?: string;
      userId?: string;
    };
    return {
      storeId: parsed.storeId?.trim() || undefined,
      userId: parsed.userId?.trim() || undefined,
    };
  } catch {
    return {};
  }
}

function buildFacebookAuthorizeUrl(
  appId: string,
  redirectUri: string,
  scope: string,
  state: string,
): string {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state);
  return url.toString();
}

function buildInstagramAuthorizeUrl(
  appId: string,
  redirectUri: string,
  scope: string,
  state: string,
): string {
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state);
  if (process.env.OAUTH_FORCE_REAUTH === 'true') {
    url.searchParams.set('force_reauth', 'true');
  }
  return url.toString();
}

async function graphGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url);
  const body = (await response.json()) as T & { error?: { message: string } };
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || `Graph API failed (${response.status})`);
  }
  return body;
}

type TokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

async function exchangeFacebookCode(
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const appId = getFacebookAppId();
  const appSecret = getFacebookAppSecret();
  if (!appId || !appSecret) {
    throw new Error('Set META_APP_ID and META_APP_SECRET (App settings → Basic)');
  }

  return graphGet<TokenResponse>('oauth/access_token', {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
}

async function exchangeFacebookLongLived(shortLivedToken: string): Promise<TokenResponse> {
  const appId = getFacebookAppId();
  const appSecret = getFacebookAppSecret();
  if (!appId || !appSecret) {
    throw new Error('META_APP_ID and META_APP_SECRET are required');
  }

  return graphGet<TokenResponse>('oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });
}

type PageAccount = {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id: string };
};

/** Exchange a Page token for a long-lived Page token (same endpoint as user token exchange). */
async function exchangeLongLivedPageToken(
  pageAccessToken: string,
): Promise<TokenResponse> {
  return exchangeFacebookLongLived(pageAccessToken);
}

async function findInstagramBusinessAccounts(
  userAccessToken: string,
): Promise<LinkedInstagramPage[]> {
  const pages = await graphGet<{ data: PageAccount[] }>('me/accounts', {
    access_token: userAccessToken,
    fields: 'id,name,access_token,instagram_business_account',
  });

  const linked: LinkedInstagramPage[] = [];
  for (const page of pages.data) {
    const igId = page.instagram_business_account?.id;
    const shortPageToken = page.access_token;
    if (!igId || !shortPageToken) {
      continue;
    }
    const longLivedPage = await exchangeLongLivedPageToken(shortPageToken);
    linked.push({
      pageId: page.id,
      pageName: page.name,
      igId,
      pageAccessToken: longLivedPage.access_token,
    });
  }
  return linked;
}

type SubscribedAppEntry = {
  id: string;
  subscribed_fields?: string[];
};

type WebhookSubscribeResult = {
  ok: boolean;
  message: string;
};

async function getPageSubscribedApps(
  pageId: string,
  pageAccessToken: string,
): Promise<SubscribedAppEntry[]> {
  const url = new URL(
    `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/subscribed_apps`,
  );
  url.searchParams.set('access_token', pageAccessToken);

  const response = await fetch(url);
  const body = (await response.json()) as {
    data?: SubscribedAppEntry[];
    error?: { message: string };
  };
  if (!response.ok || body.error) {
    console.warn(
      '[oauth:webhooks] GET subscribed_apps failed:',
      body.error?.message || response.status,
    );
    return [];
  }
  return body.data ?? [];
}

function pageHasMessagingWebhooks(
  apps: SubscribedAppEntry[],
  appId: string,
): SubscribedAppEntry | undefined {
  const entry = apps.find((app) => app.id === appId);
  if (!entry?.subscribed_fields?.length) {
    return undefined;
  }
  const hasMessages = entry.subscribed_fields.some(
    (field) => field === 'messages' || field.startsWith('messaging_'),
  );
  return hasMessages ? entry : undefined;
}

async function postPageSubscribedApps(
  pageId: string,
  pageAccessToken: string,
  subscribedFields: string,
): Promise<string | undefined> {
  const url = new URL(
    `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/subscribed_apps`,
  );
  url.searchParams.set('subscribed_fields', subscribedFields);
  url.searchParams.set('access_token', pageAccessToken);

  const response = await fetch(url, { method: 'POST' });
  const body = (await response.json()) as { success?: boolean; error?: { message: string } };
  if (!response.ok || body.error) {
    return body.error?.message || `subscribed_apps failed (${response.status})`;
  }
  if (!body.success) {
    return 'subscribed_apps returned without success';
  }
  return undefined;
}

/**
 * Installs this Meta app on the Page (required for webhook delivery).
 * Instagram object webhooks in the dashboard + Page subscribed_apps must both be configured.
 */
async function ensurePageWebhookSubscriptions(
  pageId: string,
  pageAccessToken: string,
): Promise<WebhookSubscribeResult> {
  const appId = getFacebookAppId();
  if (!appId) {
    return { ok: false, message: 'META_APP_ID is not configured' };
  }

  try {
    let installedApps = await getPageSubscribedApps(pageId, pageAccessToken);
    let existing = pageHasMessagingWebhooks(installedApps, appId);
    if (existing) {
      console.log('[oauth:webhooks] App already installed on Page', pageId);
      return {
        ok: true,
        message: `Webhooks active (${existing.subscribed_fields?.join(', ')})`,
      };
    }

    const attempts = [PAGE_WEBHOOK_FIELDS, 'messages'];
    let lastError: string | undefined;

    for (const fields of attempts) {
      lastError = await postPageSubscribedApps(pageId, pageAccessToken, fields);
      if (lastError) {
        console.warn(`[oauth:webhooks] POST Page ${pageId} fields=${fields}:`, lastError);
        continue;
      }

      installedApps = await getPageSubscribedApps(pageId, pageAccessToken);
      existing = pageHasMessagingWebhooks(installedApps, appId);
      if (existing) {
        console.log('[oauth:webhooks] App installed on Page after POST', pageId);
        return {
          ok: true,
          message: `Webhooks enabled (${existing.subscribed_fields?.join(', ')})`,
        };
      }
    }

    return {
      ok: false,
      message:
        lastError ??
        'App not listed on Page subscribed_apps. Re-connect after granting pages_messaging, and confirm Instagram fields are subscribed in Meta dashboard.',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'subscribed_apps failed';
    console.error('[oauth:webhooks] ensurePageWebhookSubscriptions error:', message);
    return { ok: false, message };
  }
}

type PageSelectionSession = {
  expiresIn?: number;
  pages: LinkedInstagramPage[];
  persistContext: PersistContext;
};

function encodeSelectionSession(session: PageSelectionSession): string {
  return encodeState(JSON.stringify(session));
}

function decodeSelectionSession(raw: string): PageSelectionSession | null {
  const decoded = decodeState(raw);
  if (!decoded) {
    return null;
  }
  try {
    const parsed = JSON.parse(decoded) as PageSelectionSession;
    if (!Array.isArray(parsed.pages) || parsed.pages.some((p) => !p.pageAccessToken)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

type InstagramTokenEntry = {
  access_token: string;
  user_id: string;
  permissions?: string;
};

type InstagramTokenResponse = {
  data?: InstagramTokenEntry[];
  access_token?: string;
  user_id?: string;
  error_type?: string;
  error_message?: string;
};

async function exchangeInstagramCode(
  code: string,
  redirectUri: string,
): Promise<InstagramTokenEntry> {
  const appId = getInstagramAppId();
  const appSecret = getInstagramAppSecret();
  if (!appId || !appSecret) {
    throw new Error('Set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET for OAUTH_FLOW=instagram');
  }

  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code: normalizeAuthCode(code),
  });

  const response = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const payload = (await response.json()) as InstagramTokenResponse;
  if (payload.error_message || payload.error_type) {
    throw new Error(payload.error_message || payload.error_type || 'Token exchange failed');
  }

  const entry = payload.data?.[0];
  if (entry?.access_token && entry.user_id) {
    return entry;
  }
  if (payload.access_token && payload.user_id) {
    return { access_token: payload.access_token, user_id: payload.user_id };
  }
  throw new Error('Unexpected token response from Instagram');
}

async function exchangeLongLivedInstagramToken(
  shortLivedToken: string,
): Promise<TokenResponse> {
  const appSecret = getInstagramAppSecret();
  if (!appSecret) {
    throw new Error('INSTAGRAM_APP_SECRET is not configured');
  }

  const url = new URL('https://graph.instagram.com/access_token');
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('access_token', shortLivedToken);

  const response = await fetch(url);
  const body = (await response.json()) as TokenResponse & { error?: { message: string } };
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || `Long-lived token failed (${response.status})`);
  }
  return body;
}

function resolvePersistContext(context: PersistContext): {
  storeId: string;
  userId: string;
} {
  return {
    storeId:
      context.storeId ||
      process.env.OAUTH_STORE_ID?.trim() ||
      DEFAULT_OAUTH_STORE_ID,
    userId:
      context.userId ||
      process.env.OAUTH_USER_ID?.trim() ||
      DEFAULT_OAUTH_USER_ID,
  };
}

async function maybePersistChannelAccount(
  accessToken: string,
  externalAccountId: string,
  context: PersistContext,
): Promise<{ channelAccountId: string | null; warning?: string }> {
  const { storeId, userId } = resolvePersistContext(context);

  const [store, user] = await Promise.all([
    prisma.store.findUnique({ where: { id: storeId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
  ]);

  if (!store || !user) {
    return {
      channelAccountId: null,
      warning:
        'Invalid OAuth persistence defaults: storeId/userId does not exist in this database. Set OAUTH_STORE_ID and OAUTH_USER_ID in Railway.',
    };
  }

  const existing = await prisma.channelAccount.findFirst({
    where: { storeId, platform: INSTAGRAM },
  });

  if (existing) {
    await prisma.channelAccount.update({
      where: { id: existing.id },
      data: { accessToken, externalAccountId },
    });
    return { channelAccountId: existing.id };
  }

  try {
    const created = await prisma.channelAccount.create({
      data: {
        storeId,
        userId,
        platform: INSTAGRAM,
        accessToken,
        externalAccountId,
      },
    });
    return { channelAccountId: created.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return {
        channelAccountId: null,
        warning:
          'Could not persist ChannelAccount due to foreign key mismatch. Verify OAUTH_STORE_ID and OAUTH_USER_ID against production DB.',
      };
    }
    throw error;
  }
}

function buildSuccessRows(opts: {
  pageName?: string;
  pageId?: string;
  igId?: string;
  channelAccountId?: string | null;
  persistedWarning?: string;
  webhookStatus?: WebhookSubscribeResult;
  tokenPreview?: string;
}): Array<{
  label: string;
  value: string;
  asCode?: boolean;
  status?: 'ok' | 'warn';
}> {
  const rows: Array<{
    label: string;
    value: string;
    asCode?: boolean;
    status?: 'ok' | 'warn';
  }> = [];

  if (opts.pageName) {
    rows.push({ label: 'Facebook Page', value: opts.pageName });
  }
  if (opts.igId) {
    rows.push({ label: 'Instagram account', value: opts.igId, asCode: true });
  }
  if (opts.tokenPreview) {
    rows.push({ label: 'Token', value: opts.tokenPreview, asCode: true });
  }
  if (opts.channelAccountId) {
    rows.push({
      label: 'Channel account',
      value: opts.channelAccountId,
      asCode: true,
      status: 'ok',
    });
  } else if (opts.persistedWarning) {
    rows.push({ label: 'Channel account', value: opts.persistedWarning, status: 'warn' });
  }
  if (opts.webhookStatus) {
    rows.push({
      label: 'Webhooks',
      value: opts.webhookStatus.message,
      status: opts.webhookStatus.ok ? 'ok' : 'warn',
    });
  }

  return rows;
}

async function handleOAuth(req: Request, res: Response): Promise<void> {
  const flow = getOAuthFlow();
  const stateParam = typeof req.query.state === 'string' ? req.query.state : undefined;
  const persistContext = parsePersistContext(stateParam);
  const pageIdParam = typeof req.query.pageId === 'string' ? req.query.pageId : undefined;
  const selectionSessionParam =
    typeof req.query.selection === 'string' ? req.query.selection : undefined;
  const oauthError = req.query.error;
  if (typeof oauthError === 'string') {
    const description =
      typeof req.query.error_description === 'string'
        ? req.query.error_description
        : oauthError;
    res.status(400).type('html').send(
      renderErrorPage({
        title: 'Login cancelled',
        message: description,
      }),
    );
    return;
  }

  const code = req.query.code;
  const redirectUri = getRedirectUri(req);
  const appId =
    flow === 'facebook' ? getFacebookAppId() : getInstagramAppId();

  if (flow === 'facebook' && selectionSessionParam && pageIdParam) {
    const session = decodeSelectionSession(selectionSessionParam);
    if (!session) {
      res.status(400).type('html').send(
        renderErrorPage({
          title: 'Session expired',
          message: 'Please start again and connect ChatPay Bot.',
        }),
      );
      return;
    }

    const selected = session.pages.find((page) => page.pageId === pageIdParam);
    if (!selected) {
      res.status(400).type('html').send(
        renderErrorPage({
          title: 'Invalid selection',
          message: 'That Page is no longer available. Please connect again.',
        }),
      );
      return;
    }

    const persisted = await maybePersistChannelAccount(
      selected.pageAccessToken,
      selected.igId,
      session.persistContext,
    );
    const webhookStatus = await ensurePageWebhookSubscriptions(
      selected.pageId,
      selected.pageAccessToken,
    );

    const { storeId } = resolvePersistContext(session.persistContext);
    if (persisted.channelAccountId && storeId) {
      res.redirect(302, inboxRedirect(storeId));
      return;
    }

    const tokenPreview = `${selected.pageAccessToken.slice(0, 12)}…${selected.pageAccessToken.slice(-6)}`;

    res.status(200).type('html').send(
      renderResultPage({
        title: 'ChatPay Bot connected',
        subtitle: 'Your Instagram account is linked and ready for messaging.',
        rows: buildSuccessRows({
          pageName: selected.pageName || selected.pageId,
          igId: selected.igId,
          tokenPreview,
          channelAccountId: persisted.channelAccountId,
          persistedWarning: persisted.warning,
          webhookStatus,
        }),
        primaryAction: { label: 'Open Inbox', href: storeId ? inboxRedirect(storeId) : '/inbox' },
      }),
    );
    return;
  }

  if (typeof code !== 'string' || !code) {
    if (!appId) {
      res.status(500).type('html').send(
        renderErrorPage({
          title: 'Setup incomplete',
          message:
            'Set META_APP_ID and META_APP_SECRET in Railway (Meta App settings → Basic).',
        }),
      );
      return;
    }

    const state =
      typeof req.query.state === 'string' && req.query.state ? req.query.state : 'test';
    const statePayload = buildStatePayload(req, state);
    const scope =
      typeof req.query.scope === 'string' && req.query.scope
        ? req.query.scope
        : flow === 'facebook'
          ? FACEBOOK_LOGIN_SCOPES
          : INSTAGRAM_BUSINESS_SCOPES;

    const loginUrl =
      flow === 'facebook'
        ? buildFacebookAuthorizeUrl(appId, redirectUri, scope, statePayload)
        : buildInstagramAuthorizeUrl(appId, redirectUri, scope, statePayload);

    const { storeId } = resolvePersistContext(persistContext);

    res.status(200).type('html').send(
      renderConnectPage({
        loginUrl,
        storeLabel: storeId,
      }),
    );
    return;
  }

  try {
    if (flow === 'facebook') {
      const shortLivedUser = await exchangeFacebookCode(code, redirectUri);
      const longLivedUser = await exchangeFacebookLongLived(shortLivedUser.access_token);
      const linkedPages = await findInstagramBusinessAccounts(longLivedUser.access_token);

      const expiresIn = longLivedUser.expires_in ?? shortLivedUser.expires_in;

      if (linkedPages.length > 1 && !pageIdParam) {
        const selection = encodeSelectionSession({
          expiresIn,
          pages: linkedPages,
          persistContext,
        });
        res.status(200).type('html').send(
          renderSelectPage({
            pages: linkedPages.map((page) => ({
              href: `/oauth.php?selection=${encodeURIComponent(selection)}&pageId=${encodeURIComponent(page.pageId)}`,
              pageName: page.pageName || page.pageId,
              igId: page.igId,
            })),
          }),
        );
        return;
      }

      const selected =
        (pageIdParam && linkedPages.find((page) => page.pageId === pageIdParam)) ||
        linkedPages[0];
      const persisted = selected
        ? await maybePersistChannelAccount(
            selected.pageAccessToken,
            selected.igId,
            persistContext,
          )
        : { channelAccountId: null as string | null };
      const channelAccountId = persisted.channelAccountId;
      const webhookStatus = selected
        ? await ensurePageWebhookSubscriptions(selected.pageId, selected.pageAccessToken)
        : { ok: false, message: 'No Page selected' };
      const tokenPreview = selected
        ? `${selected.pageAccessToken.slice(0, 12)}…${selected.pageAccessToken.slice(-6)}`
        : '';

      const { storeId } = resolvePersistContext(persistContext);
      if (channelAccountId && storeId && selected) {
        res.redirect(302, inboxRedirect(storeId));
        return;
      }

      res.status(200).type('html').send(
        renderResultPage({
          title: selected ? 'ChatPay Bot connected' : 'No Instagram account found',
          subtitle: selected
            ? 'Your Instagram account is linked and ready for messaging.'
            : 'Link an Instagram professional account to a Facebook Page, then try again.',
          rows: selected
            ? buildSuccessRows({
                pageName: selected.pageName || selected.pageId,
                igId: selected.igId,
                tokenPreview,
                channelAccountId,
                persistedWarning: persisted.warning,
                webhookStatus,
              })
            : [
                {
                  label: 'Tip',
                  value: 'Connect IG to a Facebook Page in Meta Business settings first.',
                  status: 'warn' as const,
                },
              ],
          primaryAction: { label: 'Open Inbox', href: storeId ? inboxRedirect(storeId) : '/inbox' },
        }),
      );
      return;
    }

    const shortLived = await exchangeInstagramCode(code, redirectUri);
    const longLived = await exchangeLongLivedInstagramToken(shortLived.access_token);
    const accessToken = longLived.access_token;
    const persisted = await maybePersistChannelAccount(
      accessToken,
      shortLived.user_id,
      persistContext,
    );
    const channelAccountId = persisted.channelAccountId;

    const { storeId } = resolvePersistContext(persistContext);
    if (channelAccountId && storeId) {
      res.redirect(302, inboxRedirect(storeId));
      return;
    }

    res.status(200).type('html').send(
      renderResultPage({
        title: 'ChatPay Bot connected',
        subtitle: 'Instagram Login completed successfully.',
        rows: buildSuccessRows({
          igId: shortLived.user_id,
          channelAccountId,
          persistedWarning: persisted.warning,
        }),
        primaryAction: { label: 'Open Inbox', href: storeId ? inboxRedirect(storeId) : '/inbox' },
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth failed';
    console.error('oauth.php error:', message);
    res.status(500).type('html').send(
      renderErrorPage({
        title: 'Connection failed',
        message,
      }),
    );
  }
}

router.get('/oauth.php', handleOAuth);
router.get('/connect', handleOAuth);

export default router;
