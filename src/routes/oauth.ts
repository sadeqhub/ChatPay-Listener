import { Router, Request, Response } from 'express';
import prisma from '../services/db';

const router = Router();

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const INSTAGRAM = 'Instagram' as const;

const DEFAULT_SCOPES = [
  'instagram_basic',
  'instagram_manage_messages',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'business_management',
].join(',');

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

function getAppId(): string | undefined {
  return (
    process.env.META_APP_ID?.trim() ||
    process.env.FACEBOOK_APP_ID?.trim() ||
    undefined
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  if (!response.ok || (body as { error?: { message: string } }).error) {
    const message =
      (body as { error?: { message: string } }).error?.message ||
      `Graph API request failed (${response.status})`;
    throw new Error(message);
  }
  return body;
}

type TokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

type PageAccount = {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id: string };
};

type PagesResponse = {
  data: PageAccount[];
};

type InstagramProfile = {
  id: string;
  username?: string;
};

async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const appId = getAppId();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new Error('META_APP_ID and META_APP_SECRET must be configured');
  }

  return graphGet<TokenResponse>('oauth/access_token', {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
}

async function exchangeLongLivedToken(
  shortLivedToken: string,
): Promise<TokenResponse> {
  const appId = getAppId();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new Error('META_APP_ID and META_APP_SECRET must be configured');
  }

  return graphGet<TokenResponse>('oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });
}

async function findInstagramBusinessAccount(
  userAccessToken: string,
): Promise<{ pageId: string; pageName?: string; igId: string } | null> {
  const pages = await graphGet<PagesResponse>('me/accounts', {
    access_token: userAccessToken,
    fields: 'id,name,access_token,instagram_business_account',
  });

  for (const page of pages.data) {
    const igId = page.instagram_business_account?.id;
    if (igId) {
      return { pageId: page.id, pageName: page.name, igId };
    }
  }

  return null;
}

async function fetchInstagramProfile(
  igUserId: string,
  accessToken: string,
): Promise<InstagramProfile | null> {
  try {
    return await graphGet<InstagramProfile>(igUserId, {
      access_token: accessToken,
      fields: 'id,username',
    });
  } catch {
    return null;
  }
}

async function maybePersistChannelAccount(
  accessToken: string,
  externalAccountId: string,
): Promise<string | null> {
  const storeId = process.env.OAUTH_STORE_ID?.trim();
  const userId = process.env.OAUTH_USER_ID?.trim();
  if (!storeId || !userId) {
    return null;
  }

  const existing = await prisma.channelAccount.findFirst({
    where: { storeId, platform: INSTAGRAM },
  });

  if (existing) {
    await prisma.channelAccount.update({
      where: { id: existing.id },
      data: { accessToken, externalAccountId },
    });
    return existing.id;
  }

  const created = await prisma.channelAccount.create({
    data: {
      storeId,
      userId,
      platform: INSTAGRAM,
      accessToken,
      externalAccountId,
    },
  });
  return created.id;
}

router.get('/oauth.php', async (req: Request, res: Response): Promise<void> => {
  const oauthError = req.query.error;
  if (typeof oauthError === 'string') {
    const description =
      typeof req.query.error_description === 'string'
        ? req.query.error_description
        : oauthError;
    res.status(400).type('html').send(
      `<!DOCTYPE html><html><body><h1>Facebook login cancelled</h1><p>${escapeHtml(description)}</p></body></html>`,
    );
    return;
  }

  const code = req.query.code;
  const redirectUri = getRedirectUri(req);
  const appId = getAppId();

  if (typeof code !== 'string' || !code) {
    if (!appId) {
      res
        .status(500)
        .type('html')
        .send(
          '<!DOCTYPE html><html><body><h1>OAuth not configured</h1><p>Set META_APP_ID (or FACEBOOK_APP_ID) and META_APP_SECRET.</p></body></html>',
        );
      return;
    }

    const state =
      typeof req.query.state === 'string' && req.query.state
        ? req.query.state
        : 'test';
    const scope =
      typeof req.query.scope === 'string' && req.query.scope
        ? req.query.scope
        : DEFAULT_SCOPES;

    const loginUrl = new URL(
      `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`,
    );
    loginUrl.searchParams.set('client_id', appId);
    loginUrl.searchParams.set('redirect_uri', redirectUri);
    loginUrl.searchParams.set('response_type', 'code');
    loginUrl.searchParams.set('state', state);
    loginUrl.searchParams.set('scope', scope);

    res.status(200).type('html').send(
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>Connect Facebook / Instagram</title></head>
<body>
  <h1>Test user login</h1>
  <p>Use this page when connecting a Meta test user. Register this redirect URI in your app:</p>
  <pre>${escapeHtml(redirectUri)}</pre>
  <p><a class="button" href="${escapeHtml(loginUrl.toString())}">Log in with Facebook</a></p>
</body>
</html>`,
    );
    return;
  }

  try {
    const shortLived = await exchangeCodeForToken(code, redirectUri);
    const longLived = await exchangeLongLivedToken(shortLived.access_token);
    const accessToken = longLived.access_token;

    const linked = await findInstagramBusinessAccount(accessToken);
    let channelAccountId: string | null = null;
    let username: string | undefined;

    if (linked) {
      const profile = await fetchInstagramProfile(linked.igId, accessToken);
      username = profile?.username;
      channelAccountId = await maybePersistChannelAccount(
        accessToken,
        linked.igId,
      );
    }

    const expiresIn = longLived.expires_in ?? shortLived.expires_in;
    const tokenPreview = `${accessToken.slice(0, 12)}…${accessToken.slice(-6)}`;

    res.status(200).type('html').send(
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>Login successful</title></head>
<body>
  <h1>Login successful</h1>
  <p>OAuth callback received. Use these values for webhook routing and outbound DMs.</p>
  <ul>
    <li><strong>Redirect URI used:</strong> <code>${escapeHtml(redirectUri)}</code></li>
    <li><strong>Token (preview):</strong> <code>${escapeHtml(tokenPreview)}</code></li>
    ${expiresIn ? `<li><strong>Expires in:</strong> ${expiresIn} seconds</li>` : ''}
    ${
      linked
        ? `<li><strong>Page:</strong> ${escapeHtml(linked.pageName || linked.pageId)} (<code>${escapeHtml(linked.pageId)}</code>)</li>
           <li><strong>Instagram professional account id:</strong> <code>${escapeHtml(linked.igId)}</code></li>
           ${username ? `<li><strong>Instagram username:</strong> @${escapeHtml(username)}</li>` : ''}`
        : '<li><strong>Instagram account:</strong> none found on connected Pages. Link a Page to an Instagram professional account in Meta Business settings.</li>'
    }
    ${
      channelAccountId
        ? `<li><strong>ChannelAccount saved:</strong> <code>${escapeHtml(channelAccountId)}</code></li>`
        : process.env.OAUTH_STORE_ID && process.env.OAUTH_USER_ID
          ? '<li><strong>ChannelAccount:</strong> not saved (missing Instagram link or DB error)</li>'
          : '<li><strong>ChannelAccount:</strong> not saved. Set <code>OAUTH_STORE_ID</code> and <code>OAUTH_USER_ID</code> to persist automatically.</li>'
    }
  </ul>
  <p><a href="/oauth.php">Connect another test user</a></p>
</body>
</html>`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth failed';
    console.error('oauth.php error:', message);
    res.status(500).type('html').send(
      `<!DOCTYPE html><html><body><h1>OAuth failed</h1><p>${escapeHtml(message)}</p><p>Ensure <code>${escapeHtml(redirectUri)}</code> is listed under Valid OAuth Redirect URIs in Meta.</p></body></html>`,
    );
  }
});

export default router;
