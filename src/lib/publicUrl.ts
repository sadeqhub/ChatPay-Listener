export function publicApiBase(): string {
  const fromEnv = process.env.PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway) return `https://${railway.replace(/\/$/, '')}`;

  return '';
}

export function webAppBase(): string {
  const fromEnv = process.env.WEB_APP_URL?.trim();
  return fromEnv ? fromEnv.replace(/\/$/, '') : '';
}

export function absoluteApiPath(path: string): string {
  const base = publicApiBase();
  return base ? `${base}${path}` : path;
}

export function inboxAppUrl(storeId: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ storeId, tab: 'messages', connected: '1', ...extra });
  const path = `/inbox?${params.toString()}`;
  const web = webAppBase();
  return web ? `${web}${path}` : path;
}

export function allowedCorsOrigins(): string[] {
  const raw = process.env.WEB_APP_URL?.trim();
  if (!raw) return [];
  return raw.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
}
