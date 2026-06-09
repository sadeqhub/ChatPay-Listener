import { escapeHtml } from './chatpayAuthPages';

const DEMO_STYLES = `
  .demo-banner {
    background: linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045);
    color: #fff;
    padding: 12px 20px;
    border-radius: var(--radius-md);
    margin-bottom: 20px;
    font-size: 0.9rem;
    font-weight: 600;
  }
  .account-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 24px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .account-card .ig-badge {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045);
    display: grid;
    place-items: center;
    color: #fff;
    font-weight: 700;
    flex-shrink: 0;
  }
  .account-card h2 { margin: 0 0 4px; font-size: 1.1rem; }
  .account-card p { margin: 0; color: var(--muted); font-size: 0.88rem; }
  .account-card code { font-size: 0.78rem; background: #f4f4f6; padding: 2px 6px; border-radius: 4px; }
  .inbox-layout {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 16px;
    min-height: 520px;
  }
  @media (max-width: 800px) { .inbox-layout { grid-template-columns: 1fr; } }
  .inbox-list, .thread-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .panel-head {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    font-weight: 700;
    font-size: 0.95rem;
  }
  .conv-item {
    display: block;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    text-decoration: none;
    color: inherit;
    transition: background 0.12s;
  }
  .conv-item:hover, .conv-item.active { background: #f7f7f9; }
  .conv-item h3 { margin: 0 0 4px; font-size: 0.95rem; }
  .conv-item p { margin: 0; font-size: 0.82rem; color: var(--muted); }
  .conv-item time { font-size: 0.75rem; color: var(--muted); }
  .thread-messages {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 360px;
    max-height: 480px;
    overflow-y: auto;
  }
  .bubble {
    max-width: 75%;
    padding: 12px 16px;
    border-radius: 18px;
    font-size: 0.92rem;
    line-height: 1.45;
  }
  .bubble.them { align-self: flex-start; background: #f0f0f3; }
  .bubble.us { align-self: flex-end; background: #111; color: #fff; }
  .bubble-meta { font-size: 0.72rem; opacity: 0.7; margin-top: 4px; }
  .send-bar {
    display: flex;
    gap: 10px;
    padding: 16px 20px;
    border-top: 1px solid var(--border);
    background: #fafafa;
  }
  .send-bar input {
    flex: 1;
    padding: 12px 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    font-size: 0.95rem;
    outline: none;
  }
  .send-bar input:focus { border-color: #111; }
  .send-bar button {
    padding: 12px 24px;
    border-radius: var(--radius-pill);
    background: var(--primary);
    color: #fff;
    border: none;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.95rem;
  }
  .alert {
    padding: 14px 18px;
    border-radius: var(--radius-md);
    margin-bottom: 16px;
    font-size: 0.9rem;
  }
  .alert.ok { background: #ecfdf3; color: var(--success); border: 1px solid #bbf7d0; }
  .alert.err { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
  .empty { padding: 40px 20px; text-align: center; color: var(--muted); }
  .review-steps {
    list-style: none;
    padding: 0;
    margin: 0 0 24px;
    display: grid;
    gap: 8px;
  }
  .review-steps li {
    padding: 10px 14px;
    background: #f7f7f9;
    border-radius: 10px;
    font-size: 0.88rem;
    color: var(--muted);
  }
  .review-steps li.done { color: var(--success); font-weight: 600; }
`;

function demoLayout(title: string, content: string, activeTab = 'Inbox'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · ChatPay Demo</title>
  <style>
    :root {
      --bg: #ececee; --surface: #fff; --text: #111; --muted: #6b6b6f;
      --border: #e4e4e8; --primary: #111; --accent: #2f6bff;
      --success: #0d7a48; --warn: #b45309;
      --radius-lg: 24px; --radius-md: 16px; --radius-pill: 999px;
      --shadow: 0 8px 32px rgba(17,17,17,0.08);
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); }
    .shell { max-width: 1120px; margin: 0 auto; padding: 24px 20px 96px; }
    .topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; gap: 16px; }
    .topbar-left { display: flex; align-items: center; gap: 12px; }
    .logo-grid { width: 36px; height: 36px; border-radius: 10px; background: var(--surface); border: 1px solid var(--border); display: grid; grid-template-columns: repeat(2,6px); gap: 4px; place-content: center; }
    .logo-grid span { width: 6px; height: 6px; border-radius: 2px; background: #111; }
    .topbar h1 { margin: 0; font-size: 1.35rem; font-weight: 700; }
    .topbar .meta { font-size: 0.85rem; color: var(--muted); }
    .pill-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: var(--radius-pill); border: 1px solid var(--border); background: var(--surface); color: var(--text); text-decoration: none; font-size: 0.9rem; font-weight: 600; }
    .pill-btn.accent { background: var(--accent); border-color: var(--accent); color: #fff; }
    .toolbar-tabs { display: flex; gap: 8px; padding: 6px; background: #f7f7f9; border: 1px solid var(--border); border-radius: var(--radius-pill); margin-bottom: 20px; width: fit-content; }
    .toolbar-tabs a { padding: 8px 14px; border-radius: var(--radius-pill); font-size: 0.85rem; color: var(--muted); text-decoration: none; }
    .toolbar-tabs a.active { background: var(--surface); color: var(--text); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow); }
    .hero-card { text-align: center; padding: 48px 32px; }
    .hero-icon { width: 72px; height: 72px; margin: 0 auto 20px; border-radius: 20px; background: linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 2rem; font-weight: 700; }
    .hero-card h2 { margin: 0 0 10px; font-size: 1.75rem; }
    .hero-card p { margin: 0 auto 24px; max-width: 480px; color: var(--muted); line-height: 1.55; }
    .btn-primary { display: inline-flex; align-items: center; gap: 10px; padding: 14px 28px; border-radius: var(--radius-pill); background: var(--primary); color: #fff; text-decoration: none; font-weight: 600; border: none; cursor: pointer; font-size: 1rem; }
    .btn-secondary { display: inline-flex; margin-top: 12px; padding: 10px 18px; border-radius: var(--radius-pill); border: 1px solid var(--border); background: var(--surface); color: var(--text); text-decoration: none; font-size: 0.9rem; font-weight: 600; }
    ${DEMO_STYLES}
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="topbar-left">
        <div class="logo-grid"><span></span><span></span><span></span><span></span></div>
        <div>
          <h1>ChatPay Inbox</h1>
          <div class="meta">Wayl · Instagram customer messaging</div>
        </div>
      </div>
      <a class="pill-btn accent" href="https://wayl.io" target="_blank" rel="noopener">Go to Store</a>
    </header>
    <nav class="toolbar-tabs">
      <a href="/demo" class="${activeTab === 'Home' ? 'active' : ''}">Overview</a>
      <a href="/demo/inbox" class="${activeTab === 'Inbox' ? 'active' : ''}">Inbox</a>
    </nav>
    ${content}
  </div>
</body>
</html>`;
}

export function renderDemoLanding(opts: {
  connectUrl: string;
  storeId?: string;
  connected?: boolean;
}): string {
  const steps = [
    { label: '1. Connect Instagram via Meta Login', done: opts.connected },
    { label: '2. Select Instagram Business account', done: opts.connected },
    { label: '3. Open conversation in ChatPay Inbox', done: false },
    { label: '4. Send message from app UI', done: false },
    { label: '5. Verify message in native Instagram app', done: false },
  ];

  const stepsHtml = steps
    .map((s) => `<li class="${s.done ? 'done' : ''}">${escapeHtml(s.label)}</li>`)
    .join('');

  const cta = opts.connected
    ? `<a class="btn-primary" href="/demo/inbox${opts.storeId ? `?storeId=${encodeURIComponent(opts.storeId)}` : ''}">Open Inbox</a>`
    : `<a class="btn-primary" href="${escapeHtml(opts.connectUrl)}">Connect Instagram</a>`;

  return demoLayout(
    'App Review Demo',
    `<div class="demo-banner">Meta App Review demo · Record this flow for instagram_business_basic &amp; instagram_business_manage_messages</div>
    <section class="card hero-card">
      <div class="hero-icon">◎</div>
      <h2>ChatPay Instagram Inbox</h2>
      <p>Businesses connect their Instagram Professional account and manage customer Direct Messages from one centralized inbox.</p>
      <ul class="review-steps">${stepsHtml}</ul>
      ${cta}
      <br /><a class="btn-secondary" href="/oauth.php${opts.storeId ? `?storeId=${encodeURIComponent(opts.storeId)}` : ''}">Reconnect account</a>
    </section>`,
    'Home',
  );
}

export function renderInboxPage(opts: {
  profile: { pageName: string; igUsername?: string; igId: string; pageId: string };
  conversations: Array<{
    id: string;
    participantLabel: string;
    snippet?: string;
    updatedTime?: string;
  }>;
  storeId?: string;
  flash?: { type: 'ok' | 'err'; message: string };
  activeConversationId?: string;
}): string {
  const qs = opts.storeId ? `storeId=${encodeURIComponent(opts.storeId)}` : '';
  const flash = opts.flash
    ? `<div class="alert ${opts.flash.type}">${escapeHtml(opts.flash.message)}</div>`
    : '';

  const username = opts.profile.igUsername ? `@${opts.profile.igUsername}` : opts.profile.pageName;

  const convHtml =
    opts.conversations.length === 0
      ? '<div class="empty">No conversations yet. Send a DM to this Instagram account, then refresh.</div>'
      : opts.conversations
          .map(
            (c) =>
              `<a class="conv-item${c.id === opts.activeConversationId ? ' active' : ''}" href="/demo/conversations/${encodeURIComponent(c.id)}${qs ? `?${qs}` : ''}">
                <h3>${escapeHtml(c.participantLabel)}</h3>
                <p>${escapeHtml(c.snippet || 'Open conversation')}</p>
                ${c.updatedTime ? `<time>${escapeHtml(new Date(c.updatedTime).toLocaleString())}</time>` : ''}
              </a>`,
          )
          .join('');

  return demoLayout(
    'Inbox',
    `${flash}
    <section class="card account-card">
      <div style="display:flex;align-items:center;gap:14px;">
        <div class="ig-badge">IG</div>
        <div>
          <h2>Connected Instagram Account</h2>
          <p><strong>${escapeHtml(username)}</strong></p>
          <p>Account ID: <code>${escapeHtml(opts.profile.igId)}</code> · Page: ${escapeHtml(opts.profile.pageName)}</p>
        </div>
      </div>
      <a class="pill-btn" href="/oauth.php${qs ? `?${qs}` : ''}">Reconnect</a>
    </section>
    <div class="inbox-layout">
      <div class="inbox-list">
        <div class="panel-head">Conversations</div>
        ${convHtml}
      </div>
      <div class="thread-panel">
        <div class="empty">Select a conversation to view messages and reply.</div>
      </div>
    </div>`,
    'Inbox',
  );
}

export function renderThreadPage(opts: {
  profile: { pageName: string; igUsername?: string; igId: string };
  conversationId: string;
  participantLabel: string;
  participantId: string;
  messages: Array<{ text: string; fromLabel: string; isFromBusiness: boolean; createdTime?: string }>;
  storeId?: string;
  flash?: { type: 'ok' | 'err'; message: string };
  sentText?: string;
}): string {
  const qs = opts.storeId ? `storeId=${encodeURIComponent(opts.storeId)}` : '';
  const flash = opts.flash
    ? `<div class="alert ${opts.flash.type}">${escapeHtml(opts.flash.message)}</div>`
    : '';

  const sentBanner = opts.sentText
    ? `<div class="alert ok"><strong>Message sent from ChatPay:</strong> "${escapeHtml(opts.sentText)}" — open the native Instagram app to verify delivery.</div>`
    : '';

  const bubbles = opts.messages
    .map(
      (m) =>
        `<div class="bubble ${m.isFromBusiness ? 'us' : 'them'}">
          ${escapeHtml(m.text)}
          <div class="bubble-meta">${escapeHtml(m.fromLabel)}${m.createdTime ? ` · ${escapeHtml(new Date(m.createdTime).toLocaleString())}` : ''}</div>
        </div>`,
    )
    .join('');

  return demoLayout(
    'Conversation',
    `${flash}${sentBanner}
    <section class="card account-card" style="margin-bottom:16px;padding:14px 20px;">
      <p style="margin:0;font-size:0.88rem;"><strong>Thread:</strong> ${escapeHtml(opts.participantLabel)} · <a href="/demo/inbox${qs ? `?${qs}` : ''}">← Back to inbox</a></p>
    </section>
    <div class="inbox-layout">
      <div class="inbox-list">
        <div class="panel-head"><a href="/demo/inbox${qs ? `?${qs}` : ''}" style="color:inherit;text-decoration:none;">← All conversations</a></div>
      </div>
      <div class="thread-panel">
        <div class="panel-head">Chat with ${escapeHtml(opts.participantLabel)}</div>
        <div class="thread-messages">${bubbles || '<div class="empty">No messages in this thread yet.</div>'}</div>
        <form class="send-bar" method="post" action="/demo/conversations/${encodeURIComponent(opts.conversationId)}/send${qs ? `?${qs}` : ''}">
          <input type="text" name="message" placeholder="Type a reply… e.g. Hello from our CRM platform." required autocomplete="off" />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>`,
    'Inbox',
  );
}

export function renderDemoError(title: string, message: string): string {
  return demoLayout(
    title,
    `<section class="card hero-card">
      <div class="hero-icon" style="background:#b45309;">!</div>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      <a class="btn-primary" href="/demo">Back to demo</a>
    </section>`,
    'Home',
  );
}
