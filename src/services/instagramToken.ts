import prisma from './db';
import { ConnectedProfile, fetchConnectedProfile } from './instagramGraph';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const INSTAGRAM_RECONNECT_MESSAGE =
  'Instagram connection needs to be refreshed. Use Connect Instagram, sign in with Facebook, and select your Page.';

export type ResolvedPageAccess = ConnectedProfile & { accessToken: string };

type GraphError = { message: string };
type DebugTokenData = {
  type?: string;
  app_id?: string;
  user_id?: string;
  profile_id?: string;
  is_valid?: boolean;
};

type PageAccount = {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id: string };
};

function isOnBehalfOfUserError(message: string): boolean {
  return (
    message.includes('Cannot call API for app') &&
    message.includes('on behalf of user')
  );
}

async function graphGet<T>(path: string, accessToken: string): Promise<T> {
  const url = new URL(`${GRAPH_BASE}/${path.replace(/^\//, '')}`);
  url.searchParams.set('access_token', accessToken);
  const response = await fetch(url);
  const body = (await response.json()) as T & { error?: GraphError };
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || `Graph request failed (${response.status})`);
  }
  return body;
}

async function debugAccessToken(token: string): Promise<DebugTokenData | null> {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;

  try {
    const body = await graphGet<{ data: DebugTokenData }>(
      `debug_token?input_token=${encodeURIComponent(token)}`,
      `${appId}|${appSecret}`,
    );
    return body.data;
  } catch (err) {
    console.warn(
      '[instagramToken] debug_token failed',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function exchangeLongLived(shortLivedToken: string): Promise<string> {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new Error('META_APP_ID and META_APP_SECRET are required');
  }

  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('fb_exchange_token', shortLivedToken);

  const response = await fetch(url);
  const body = (await response.json()) as { access_token?: string; error?: GraphError };
  if (!response.ok || body.error || !body.access_token) {
    throw new Error(body.error?.message || `Long-lived token exchange failed (${response.status})`);
  }
  return body.access_token;
}

async function fetchPageTokenFromUser(
  userAccessToken: string,
  preferredIgId?: string,
): Promise<ResolvedPageAccess | null> {
  const pages = await graphGet<{ data: PageAccount[] }>(
    'me/accounts?fields=id,name,access_token,instagram_business_account{id}',
    userAccessToken,
  );

  const linked = pages.data.filter(
    (page) => page.access_token && page.instagram_business_account?.id,
  );
  if (!linked.length) return null;

  const match =
    (preferredIgId
      ? linked.find((page) => page.instagram_business_account?.id === preferredIgId)
      : undefined) ?? linked[0];

  const shortPageToken = match.access_token;
  const igId = match.instagram_business_account?.id;
  if (!shortPageToken || !igId) return null;

  const pageAccessToken = await exchangeLongLived(shortPageToken);
  return {
    pageId: match.id,
    pageName: match.name || match.id,
    igId,
    accessToken: pageAccessToken,
  };
}

function toReconnectError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (isOnBehalfOfUserError(message)) {
    return new Error(INSTAGRAM_RECONNECT_MESSAGE);
  }
  return err instanceof Error ? err : new Error(message);
}

export async function resolvePageAccessToken(account: {
  id: string;
  accessToken: string;
  externalAccountId: string | null;
}): Promise<ResolvedPageAccess> {
  const igIdFallback = account.externalAccountId ?? undefined;
  const debug = await debugAccessToken(account.accessToken);

  console.log(
    '[instagramToken] token debug',
    JSON.stringify({
      channelAccountId: account.id,
      type: debug?.type,
      isValid: debug?.is_valid,
      profileId: debug?.profile_id,
      userId: debug?.user_id,
    }),
  );

  if (debug?.type === 'PAGE' && debug.is_valid !== false) {
    try {
      const profile = await fetchConnectedProfile(account.accessToken, igIdFallback);
      return { ...profile, accessToken: account.accessToken };
    } catch (err) {
      throw toReconnectError(err);
    }
  }

  if (debug?.type === 'USER') {
    try {
      const refreshed = await fetchPageTokenFromUser(
        account.accessToken,
        igIdFallback,
      );
      if (refreshed) {
        await prisma.channelAccount.update({
          where: { id: account.id },
          data: {
            accessToken: refreshed.accessToken,
            externalAccountId: refreshed.igId,
          },
        });
        console.log(
          '[instagramToken] upgraded user token to page token',
          JSON.stringify({
            channelAccountId: account.id,
            pageId: refreshed.pageId,
            igId: refreshed.igId,
          }),
        );
        return refreshed;
      }
    } catch (err) {
      console.warn(
        '[instagramToken] user token upgrade failed',
        err instanceof Error ? err.message : err,
      );
      throw toReconnectError(err);
    }

    throw new Error(INSTAGRAM_RECONNECT_MESSAGE);
  }

  try {
    const profile = await fetchConnectedProfile(account.accessToken, igIdFallback);
    if (profile.igId) {
      return { ...profile, accessToken: account.accessToken };
    }
  } catch (err) {
    throw toReconnectError(err);
  }

  throw new Error(INSTAGRAM_RECONNECT_MESSAGE);
}
