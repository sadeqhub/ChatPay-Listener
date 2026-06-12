import { inboxAppUrl, webAppBase } from '../lib/publicUrl';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type LayoutOpts = {
  storeId?: string;
  activeDock?: 'home' | 'manage' | 'menu';
};

function dashboardUrl(storeId: string | undefined, tab: string): string {
  const web = webAppBase();
  const params = new URLSearchParams({ tab });
  if (storeId) params.set('storeId', storeId);
  const path = `/inbox?${params.toString()}`;
  return web ? `${web}${path}` : path;
}

function renderDock(opts: LayoutOpts = {}): string {
  const homeHref = dashboardUrl(opts.storeId, 'today');
  const manageHref = dashboardUrl(opts.storeId, 'messages');
  const menuHref = dashboardUrl(opts.storeId, 'developers');
  const active = opts.activeDock ?? 'manage';

  return `<nav class="dock" aria-label="Quick navigation">
    <a href="${escapeHtml(homeHref)}" class="${active === 'home' ? 'active' : ''}">Home</a>
    <a href="https://wayl.io" target="_blank" rel="noopener">Store</a>
    <a href="${escapeHtml(manageHref)}" class="${active === 'manage' ? 'active' : ''}">Manage</a>
    <a href="${escapeHtml(menuHref)}" class="${active === 'menu' ? 'active' : ''}">Menu</a>
  </nav>`;
}

const STYLES = `
  :root {
    --bg: #ececee;
    --surface: #ffffff;
    --text: #111111;
    --muted: #6b6b6f;
    --border: #e4e4e8;
    --primary: #111111;
    --accent: #2f6bff;
    --success: #0d7a48;
    --warn: #b45309;
    --radius-lg: 24px;
    --radius-md: 16px;
    --radius-pill: 999px;
    --shadow: 0 8px 32px rgba(17, 17, 17, 0.08);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
  }
  .shell {
    max-width: 1120px;
    margin: 0 auto;
    padding: 24px 20px 96px;
  }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
  }
  .topbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .logo-grid {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    display: grid;
    grid-template-columns: repeat(2, 6px);
    gap: 4px;
    place-content: center;
  }
  .logo-grid span {
    width: 6px;
    height: 6px;
    border-radius: 2px;
    background: #111;
  }
  .topbar h1 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .topbar .meta {
    font-size: 0.85rem;
    color: var(--muted);
  }
  .pill-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 600;
  }
  .pill-btn.accent {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .toolbar-tabs {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px;
    background: #f7f7f9;
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
  }
  .toolbar-tabs span {
    padding: 8px 14px;
    border-radius: var(--radius-pill);
    font-size: 0.85rem;
    color: var(--muted);
  }
  .toolbar-tabs span.active {
    background: var(--surface);
    color: var(--text);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
    padding: 32px;
  }
  .hero-card {
    text-align: center;
    padding: 48px 32px;
  }
  .hero-icon {
    width: 72px;
    height: 72px;
    margin: 0 auto 20px;
    border-radius: 20px;
    background: linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 2rem;
    font-weight: 700;
  }
  .hero-card h2 {
    margin: 0 0 10px;
    font-size: 1.75rem;
    letter-spacing: -0.03em;
  }
  .hero-card p {
    margin: 0 auto 28px;
    max-width: 420px;
    color: var(--muted);
    line-height: 1.55;
    font-size: 1rem;
  }
  .btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 28px;
    border-radius: var(--radius-pill);
    background: var(--primary);
    color: #fff;
    text-decoration: none;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: transform 0.15s ease, opacity 0.15s ease;
  }
  .btn-primary:hover { opacity: 0.92; transform: translateY(-1px); }
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
    padding: 10px 18px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 600;
  }
  .detail-list {
    list-style: none;
    padding: 0;
    margin: 24px 0 0;
    text-align: left;
  }
  .detail-list li {
    padding: 14px 0;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    gap: 16px;
    font-size: 0.92rem;
  }
  .detail-list li:last-child { border-bottom: none; }
  .detail-list strong { color: var(--muted); font-weight: 500; }
  .detail-list code {
    font-size: 0.82rem;
    background: #f4f4f6;
    padding: 2px 6px;
    border-radius: 6px;
    word-break: break-all;
  }
  .status-ok { color: var(--success); font-weight: 600; }
  .status-warn { color: var(--warn); font-weight: 600; }
  .page-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
    margin-top: 20px;
  }
  .page-tile {
    display: block;
    padding: 20px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: #fafafa;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .page-tile:hover {
    border-color: #111;
    box-shadow: 0 4px 16px rgba(0,0,0,0.06);
  }
  .page-tile h3 {
    margin: 0 0 8px;
    font-size: 1rem;
  }
  .page-tile p {
    margin: 0;
    font-size: 0.82rem;
    color: var(--muted);
    word-break: break-all;
  }
  .dock {
    position: fixed;
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: rgba(255,255,255,0.95);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    backdrop-filter: blur(12px);
    z-index: 20;
  }
  .dock a {
    display: grid;
    place-items: center;
    min-width: 72px;
    padding: 8px 10px;
    border-radius: var(--radius-pill);
    text-decoration: none;
    font-size: 0.75rem;
    color: var(--muted);
    border: none;
    background: transparent;
    cursor: pointer;
    font-family: inherit;
  }
  .dock a.active {
    background: #111;
    color: #fff;
  }
`;

function layout(title: string, content: string, opts: LayoutOpts = {}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · Wayl</title>
  <style>${STYLES}</style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="topbar-left">
        <div class="logo-grid" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </div>
        <div>
          <h1>Integrations</h1>
          <div class="meta">Wayl · Instagram messaging</div>
        </div>
      </div>
      <a class="pill-btn accent" href="https://wayl.io" target="_blank" rel="noopener">Go to Store</a>
    </header>
    <div class="toolbar">
      <div class="toolbar-tabs">
        <span class="active">ChatPay Bot</span>
        <span>Channels</span>
        <span>Webhooks</span>
      </div>
    </div>
    ${content}
  </div>
  ${renderDock(opts)}
</body>
</html>`;
}

export function renderConnectPage(opts: {
  loginUrl: string;
  storeLabel?: string;
  storeId?: string;
}): string {
  const storeLine = opts.storeLabel
    ? `<p class="meta" style="margin-top:-12px;margin-bottom:20px;">Store: <strong>${escapeHtml(opts.storeLabel)}</strong></p>`
    : '';
  const inboxHref = opts.storeId
    ? inboxAppUrl(opts.storeId)
    : dashboardUrl(undefined, 'messages');

  return layout(
    'Connect Instagram',
    `<section class="card hero-card">
      <div class="hero-icon" aria-hidden="true">IG</div>
      <h2>Connect Instagram</h2>
      <p>Link your Instagram Professional account so Wayl can read and send Direct Messages on behalf of your business.</p>
      ${storeLine}
      <a class="btn-primary" href="${escapeHtml(opts.loginUrl)}">
        Connect Instagram
      </a>
      <br />
      <a class="btn-secondary" href="${escapeHtml(inboxHref)}">Open Messages</a>
    </section>`,
    { storeId: opts.storeId, activeDock: 'manage' },
  );
}

export type DetailRow = {
  label: string;
  value: string;
  asCode?: boolean;
  status?: 'ok' | 'warn';
};

export function renderResultPage(opts: {
  title: string;
  subtitle: string;
  rows: DetailRow[];
  primaryAction?: { label: string; href: string };
  storeId?: string;
}): string {
  const rowsHtml = opts.rows
    .map(
      (row) =>
        `<li><strong>${escapeHtml(row.label)}</strong><span class="${row.status === 'ok' ? 'status-ok' : row.status === 'warn' ? 'status-warn' : ''}">${row.asCode ? `<code>${escapeHtml(row.value)}</code>` : escapeHtml(row.value)}</span></li>`,
    )
    .join('');

  const action = opts.primaryAction
    ? `<a class="btn-primary" href="${escapeHtml(opts.primaryAction.href)}">${escapeHtml(opts.primaryAction.label)}</a>`
    : '';

  return layout(
    opts.title,
    `<section class="card hero-card">
      <div class="hero-icon" aria-hidden="true">OK</div>
      <h2>${escapeHtml(opts.title)}</h2>
      <p>${escapeHtml(opts.subtitle)}</p>
      <ul class="detail-list">${rowsHtml}</ul>
      ${action}
    </section>`,
    { storeId: opts.storeId, activeDock: 'manage' },
  );
}

export function renderSelectPage(opts: {
  pages: Array<{ href: string; pageName: string; igId: string }>;
  storeId?: string;
}): string {
  const tiles = opts.pages
    .map(
      (page) =>
        `<a class="page-tile" href="${escapeHtml(page.href)}">
          <h3>${escapeHtml(page.pageName)}</h3>
          <p>Instagram ID: ${escapeHtml(page.igId)}</p>
        </a>`,
    )
    .join('');

  return layout(
    'Select Instagram account',
    `<section class="card">
      <h2 style="margin:0 0 8px;font-size:1.35rem;">Select Instagram Business account</h2>
      <p style="margin:0;color:var(--muted);">Choose the Facebook Page linked to the Instagram account ChatPay should manage.</p>
      <div class="page-grid">${tiles}</div>
      <p style="margin-top:24px;"><a class="btn-secondary" href="${escapeHtml(opts.storeId ? inboxAppUrl(opts.storeId) : dashboardUrl(undefined, 'messages'))}">Back to Messages</a></p>
    </section>`,
    { storeId: opts.storeId, activeDock: 'manage' },
  );
}

export function renderErrorPage(opts: {
  title: string;
  message: string;
  hintHtml?: string;
  retryHref?: string;
  storeId?: string;
}): string {
  const retryHref = opts.retryHref || '/oauth.php';
  return layout(
    opts.title,
    `<section class="card hero-card">
      <div class="hero-icon" style="background:#b45309;" aria-hidden="true">!</div>
      <h2>${escapeHtml(opts.title)}</h2>
      <p>${escapeHtml(opts.message)}</p>
      ${opts.hintHtml ?? ''}
      <a class="btn-primary" href="${escapeHtml(retryHref)}">Try again</a>
    </section>`,
    { storeId: opts.storeId, activeDock: 'manage' },
  );
}
