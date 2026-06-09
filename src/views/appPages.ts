import { escapeHtml } from './chatpayAuthPages';

const APP_STYLES = `
  :root {
    --bg: #f3f3f5;
    --surface: #ffffff;
    --text: #111111;
    --muted: #6b7280;
    --border: #e8e8ec;
    --teal: #2db8a8;
    --radius-lg: 20px;
    --radius-md: 14px;
    --radius-pill: 999px;
    --shadow: 0 1px 2px rgba(0,0,0,0.04);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
  }
  .app-shell { max-width: 1320px; margin: 0 auto; padding: 20px 24px 100px; }
  .main-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 28px;
    flex-wrap: wrap;
  }
  .nav-tabs { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .nav-tabs button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: var(--radius-pill);
    border: none;
    background: transparent;
    color: var(--muted);
    font-size: 0.92rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }
  .nav-tabs button.active {
    background: var(--surface);
    color: var(--text);
    font-weight: 600;
    box-shadow: var(--shadow);
    border: 1px solid var(--border);
  }
  .nav-tabs button:disabled { opacity: 0.5; cursor: wait; }
  .nav-actions { display: flex; align-items: center; gap: 10px; }
  .btn-store {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: var(--radius-pill);
    background: var(--teal);
    color: #fff;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.92rem;
    border: none;
  }
  .page-head { margin-bottom: 20px; }
  .page-head h1 { margin: 0 0 6px; font-size: 2rem; font-weight: 700; letter-spacing: -0.03em; }
  .page-head p { margin: 0; color: var(--muted); font-size: 0.95rem; }
  .layout { display: grid; grid-template-columns: 1fr 300px; gap: 20px; align-items: start; }
  @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
  }
  .sidebar-card { padding: 18px; margin-bottom: 14px; }
  .store-row { display: flex; gap: 12px; align-items: center; margin-bottom: 14px; }
  .store-avatar {
    width: 44px; height: 44px; border-radius: 50%; background: #eef6ff;
    display: grid; place-items: center; font-weight: 700; color: #2563eb; flex-shrink: 0;
  }
  .store-row h3 { margin: 0 0 2px; font-size: 0.95rem; }
  .store-row p { margin: 0; font-size: 0.82rem; color: var(--muted); }
  .sidebar-label { font-size: 0.78rem; color: var(--muted); margin: 0 0 6px; }
  .sidebar-value { font-size: 0.88rem; margin: 0 0 12px; }
  .ig-connected {
    display: flex; align-items: center; gap: 10px; padding: 12px;
    background: #f8fafc; border-radius: var(--radius-md); margin-top: 8px;
  }
  .ig-dot {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045);
    display: grid; place-items: center; color: #fff; font-size: 0.7rem; font-weight: 700;
  }
  .btn-dark {
    display: block; width: 100%; padding: 12px 16px; border-radius: var(--radius-pill);
    background: #111; color: #fff; text-align: center; text-decoration: none;
    font-weight: 600; font-size: 0.9rem; border: none; cursor: pointer;
  }
  .btn-outline {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 10px 16px; border-radius: var(--radius-pill); border: 1px solid var(--border);
    background: var(--surface); color: var(--text); text-decoration: none; font-size: 0.88rem; font-weight: 600;
    cursor: pointer; font-family: inherit;
  }
  .inbox-layout { display: grid; grid-template-columns: 300px 1fr; min-height: 520px; overflow: hidden; }
  @media (max-width: 800px) { .inbox-layout { grid-template-columns: 1fr; } }
  .panel-head { padding: 16px 18px; border-bottom: 1px solid var(--border); font-weight: 600; font-size: 0.92rem; }
  .conv-item {
    display: block; width: 100%; text-align: left; padding: 14px 18px; border: none; border-bottom: 1px solid var(--border);
    background: transparent; color: inherit; cursor: pointer; transition: background 0.12s; font-family: inherit;
  }
  .conv-item:hover, .conv-item.active { background: #f8f9fb; }
  .conv-item h3 { margin: 0 0 4px; font-size: 0.92rem; font-weight: 600; }
  .conv-item p { margin: 0; font-size: 0.82rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .conv-item time { font-size: 0.72rem; color: var(--muted); }
  .thread-messages {
    padding: 20px; display: flex; flex-direction: column; gap: 12px;
    min-height: 380px; max-height: 500px; overflow-y: auto;
  }
  .bubble { max-width: 72%; padding: 12px 16px; border-radius: 18px; font-size: 0.92rem; line-height: 1.45; }
  .bubble.them { align-self: flex-start; background: #f0f1f4; }
  .bubble.us { align-self: flex-end; background: #111; color: #fff; }
  .bubble-meta { font-size: 0.72rem; opacity: 0.65; margin-top: 4px; }
  .send-bar {
    display: flex; gap: 10px; padding: 14px 18px; border-top: 1px solid var(--border); background: #fafafa;
  }
  .send-bar input {
    flex: 1; padding: 12px 16px; border: 1px solid var(--border); border-radius: var(--radius-pill);
    font-size: 0.92rem; outline: none; background: #fff;
  }
  .send-bar input:focus { border-color: #111; }
  .send-bar button {
    padding: 12px 22px; border-radius: var(--radius-pill); background: #111; color: #fff;
    border: none; font-weight: 600; cursor: pointer; font-size: 0.92rem;
  }
  .alert { padding: 12px 16px; border-radius: var(--radius-md); margin-bottom: 16px; font-size: 0.88rem; }
  .alert.ok { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
  .alert.err { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
  .empty { padding: 48px 20px; text-align: center; color: var(--muted); font-size: 0.92rem; }
  .connect-card { padding: 48px 32px; text-align: center; }
  .connect-icon {
    width: 64px; height: 64px; margin: 0 auto 20px; border-radius: 18px;
    background: linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045);
    display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.1rem; font-weight: 700;
  }
  .connect-card h2 { margin: 0 0 10px; font-size: 1.5rem; }
  .connect-card p { margin: 0 auto 24px; max-width: 420px; color: var(--muted); line-height: 1.55; }
  .dock {
    position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%);
    display: flex; align-items: center; gap: 6px; padding: 8px 12px;
    background: rgba(255,255,255,0.95); border: 1px solid var(--border);
    border-radius: var(--radius-pill); box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  }
  .dock button, .dock a {
    display: grid; place-items: center; min-width: 72px; padding: 8px 10px;
    border-radius: var(--radius-pill); text-decoration: none; font-size: 0.75rem;
    color: var(--muted); border: none; background: transparent; cursor: pointer; font-family: inherit;
  }
  .dock button.active, .dock a.active { background: #111; color: #fff; }
  .stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
  @media (max-width: 800px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
  .stat { padding: 16px 18px; }
  .stat label { display: block; font-size: 0.78rem; color: var(--muted); margin-bottom: 6px; }
  .stat strong { font-size: 1.25rem; letter-spacing: -0.02em; }
  .stat span { display: block; font-size: 0.75rem; color: var(--muted); margin-top: 4px; }
  .panel-loading { padding: 48px 20px; text-align: center; color: var(--muted); }
  .chart-placeholder {
    height: 280px; margin-top: 16px; border-top: 1px solid var(--border);
    display: flex; align-items: flex-end; justify-content: space-between;
    padding: 24px 20px 16px; gap: 8px;
  }
  .chart-bar { flex: 1; background: #e8f7f5; border-radius: 6px 6px 0 0; min-height: 8px; }
  .live-badge {
    display: inline-block; padding: 2px 8px; border-radius: var(--radius-pill);
    background: #ecfdf5; color: #047857; font-size: 0.75rem; font-weight: 600;
  }
`;

export type AppTab = 'today' | 'insights' | 'messages' | 'developers';

type Profile = { pageName: string; igUsername?: string; igId: string; pageId: string };

type Conversation = {
  id: string;
  participantLabel: string;
  snippet?: string;
  updatedTime?: string;
};

type Message = {
  text: string;
  fromLabel: string;
  isFromBusiness: boolean;
  createdTime?: string;
};

function igSidebar(profile?: Profile): string {
  if (!profile) {
    return `<p class="sidebar-label">Instagram</p><p class="sidebar-value">Not connected</p>`;
  }
  const handle = profile.igUsername ? `@${profile.igUsername}` : profile.pageName;
  return `<p class="sidebar-label">Instagram</p>
    <div class="ig-connected">
      <div class="ig-dot">IG</div>
      <div>
        <strong style="font-size:0.88rem;">${escapeHtml(handle)}</strong>
        <p style="margin:2px 0 0;font-size:0.75rem;color:var(--muted);">ID ${escapeHtml(profile.igId)}</p>
      </div>
    </div>`;
}

function flashHtml(flash?: { type: 'ok' | 'err'; message: string }): string {
  return flash ? `<div class="alert ${flash.type}">${escapeHtml(flash.message)}</div>` : '';
}

function todayDateLine(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function renderTodayPanel(opts: {
  conversationCount: number;
  flash?: { type: 'ok' | 'err'; message: string };
}): { title: string; html: string } {
  return {
    title: 'Today',
    html: `${flashHtml(opts.flash)}
      <div class="page-head">
        <h1>What's Happening Today?</h1>
        <p>${escapeHtml(todayDateLine())}</p>
      </div>
      <div class="stat-row">
        <div class="card stat"><label>Sales</label><strong>0 IQD</strong><span>0% vs yesterday</span></div>
        <div class="card stat"><label>Orders</label><strong>0</strong><span>0% vs yesterday</span></div>
        <div class="card stat"><label>Messages</label><strong>${opts.conversationCount}</strong><span>Open conversations</span></div>
        <div class="card stat"><label>Visitors</label><strong>0</strong><span>0% vs yesterday</span></div>
      </div>
      <div class="card" style="padding:20px;">
        <strong>Orders</strong>
        <div class="chart-placeholder">
          ${[40, 20, 55, 30, 48, 25].map((h) => `<div class="chart-bar" style="height:${h}%;"></div>`).join('')}
        </div>
      </div>`,
  };
}

export function renderInsightsPanel(): { title: string; html: string } {
  return {
    title: 'Insights',
    html: `<div class="page-head">
        <h1>Insights</h1>
        <p>Performance overview for your store.</p>
      </div>
      <div class="stat-row">
        <div class="card stat"><label>Conversion rate</label><strong>-</strong><span>0% vs yesterday</span></div>
        <div class="card stat"><label>Revenue</label><strong>0 IQD</strong><span>This week</span></div>
        <div class="card stat"><label>Orders</label><strong>0</strong><span>This week</span></div>
        <div class="card stat"><label>Visitors</label><strong>0</strong><span>This week</span></div>
      </div>
      <div class="card connect-card">
        <h2>More insights coming soon</h2>
        <p>Detailed analytics will appear here as your store activity grows.</p>
      </div>`,
  };
}

export function renderDevelopersPanel(opts: {
  connectUrl: string;
  reconnectUrl: string;
  connected: boolean;
}): { title: string; html: string } {
  const cta = opts.connected
    ? `<button type="button" class="btn-dark" data-tab="messages">Open Messages</button>`
    : `<a class="btn-dark" href="${escapeHtml(opts.connectUrl)}">Connect Instagram</a>`;

  return {
    title: 'Integrations',
    html: `<div class="page-head">
        <h1>Integrations</h1>
        <p>Connect channels and manage your store messaging.</p>
      </div>
      <section class="card connect-card">
        <div class="connect-icon">IG</div>
        <h2>Instagram Direct Messages</h2>
        <p>Connect your Instagram Professional account to read and reply to customer messages from Wayl.</p>
        ${cta}
        ${opts.connected ? `<br /><a class="btn-outline" href="${escapeHtml(opts.reconnectUrl)}" style="margin-top:14px;">Reconnect account</a>` : ''}
      </section>`,
  };
}

function conversationButtons(
  conversations: Conversation[],
  activeConversationId?: string,
): string {
  if (conversations.length === 0) {
    return '<div class="empty">No conversations yet. When customers message you on Instagram, they will appear here.</div>';
  }
  return conversations
    .map(
      (c) =>
        `<button type="button" class="conv-item${c.id === activeConversationId ? ' active' : ''}" data-conversation="${escapeHtml(c.id)}">
          <h3>${escapeHtml(c.participantLabel)}</h3>
          <p>${escapeHtml(c.snippet || 'View conversation')}</p>
          ${c.updatedTime ? `<time>${escapeHtml(new Date(c.updatedTime).toLocaleString())}</time>` : ''}
        </button>`,
    )
    .join('');
}

export function renderMessagesPanel(opts: {
  conversations: Conversation[];
  flash?: { type: 'ok' | 'err'; message: string };
  activeConversationId?: string;
  accountLabel?: string;
}): { title: string; html: string } {
  const convHtml = conversationButtons(opts.conversations, opts.activeConversationId);
  const threadPane = opts.activeConversationId
    ? '<div class="panel-loading">Loading conversation...</div>'
    : '<div class="empty">Select a conversation to view and reply.</div>';

  return {
    title: 'Messages',
    html: `${flashHtml(opts.flash)}
      <div class="page-head">
        <h1>Messages</h1>
        <p>${escapeHtml(todayDateLine())} · <span class="live-badge">Live</span></p>
      </div>
      <div class="stat-row">
        <div class="card stat"><label>Open conversations</label><strong>${opts.conversations.length}</strong></div>
        <div class="card stat"><label>Channel</label><strong>Instagram</strong></div>
        <div class="card stat"><label>Status</label><strong>Connected</strong></div>
        <div class="card stat"><label>Account</label><strong>${escapeHtml(opts.accountLabel || 'Connected')}</strong></div>
      </div>
      <div class="card inbox-layout">
        <div>
          <div class="panel-head">Inbox</div>
          <div id="conv-list">${convHtml}</div>
        </div>
        <div id="thread-pane">${threadPane}</div>
      </div>`,
  };
}

export function renderThreadPanel(opts: {
  conversationId: string;
  participantLabel: string;
  messages: Message[];
  conversations: Conversation[];
  flash?: { type: 'ok' | 'err'; message: string };
}): { title: string; html: string } {
  const convHtml = conversationButtons(opts.conversations, opts.conversationId);
  const bubbles = opts.messages
    .map(
      (m) =>
        `<div class="bubble ${m.isFromBusiness ? 'us' : 'them'}">
          ${escapeHtml(m.text)}
          <div class="bubble-meta">${escapeHtml(m.fromLabel)}${m.createdTime ? ` · ${escapeHtml(new Date(m.createdTime).toLocaleString())}` : ''}</div>
        </div>`,
    )
    .join('');

  return {
    title: opts.participantLabel,
    html: `${flashHtml(opts.flash)}
      <div class="page-head">
        <h1>Messages</h1>
        <p>${escapeHtml(todayDateLine())}</p>
      </div>
      <div class="card inbox-layout">
        <div>
          <div class="panel-head">Inbox</div>
          <div id="conv-list">${convHtml}</div>
        </div>
        <div id="thread-pane">
          <div class="panel-head">${escapeHtml(opts.participantLabel)}</div>
          <div class="thread-messages" id="thread-messages">${bubbles || '<div class="empty">No messages yet.</div>'}</div>
          <form class="send-bar" data-send-form data-conversation-id="${escapeHtml(opts.conversationId)}">
            <input type="text" name="message" placeholder="Write a reply..." required autocomplete="off" />
            <button type="submit">Send</button>
          </form>
        </div>
      </div>`,
  };
}

export function renderNotConnectedPanel(opts: { connectUrl: string }): { title: string; html: string } {
  return {
    title: 'Messages',
    html: `<div class="page-head">
        <h1>Messages</h1>
        <p>Connect Instagram to manage customer conversations.</p>
      </div>
      <section class="card connect-card">
        <div class="connect-icon">IG</div>
        <h2>Instagram not connected</h2>
        <p>Link your Instagram Professional account to read and reply to Direct Messages.</p>
        <a class="btn-dark" href="${escapeHtml(opts.connectUrl)}">Connect Instagram</a>
      </section>`,
  };
}

function appScript(storeId: string, initialTab: AppTab, initialConversation?: string): string {
  const safeStoreId = JSON.stringify(storeId);
  const safeTab = JSON.stringify(initialTab);
  const safeConversation = JSON.stringify(initialConversation || '');

  return `<script>
(function () {
  var storeId = ${safeStoreId};
  var activeTab = ${safeTab};
  var activeConversation = ${safeConversation};
  var cache = Object.create(null);
  var loading = false;

  function storeQs() {
    return storeId ? '?storeId=' + encodeURIComponent(storeId) : '';
  }

  function appUrl(tab, conversation) {
    var qs = storeQs();
    var params = [];
    if (tab && tab !== 'today') params.push('tab=' + encodeURIComponent(tab));
    if (conversation) params.push('conversation=' + encodeURIComponent(conversation));
    var suffix = params.length ? (qs ? qs + '&' : '?') + params.join('&') : qs;
    return '/inbox' + suffix;
  }

  function cacheKey(tab, conversation) {
    return tab + ':' + (conversation || '');
  }

  function setNav(tab) {
    document.querySelectorAll('[data-tab]').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('[data-dock]').forEach(function (el) {
      var dockTab = el.getAttribute('data-dock');
      el.classList.toggle('active', dockTab === tab || (dockTab === 'home' && (tab === 'today' || tab === 'messages')));
    });
  }

  function bindPanel(root) {
    root.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        if (btn.tagName === 'BUTTON') e.preventDefault();
        var tab = btn.getAttribute('data-tab');
        if (tab) navigate(tab);
      });
    });

    root.querySelectorAll('[data-conversation]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openConversation(btn.getAttribute('data-conversation'));
      });
    });

    var form = root.querySelector('[data-send-form]');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = form.querySelector('input[name="message"]');
        var text = input && input.value ? input.value.trim() : '';
        if (!text) return;
        var convId = form.getAttribute('data-conversation-id');
        var btn = form.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;
        fetch('/api/messages/' + encodeURIComponent(convId) + '/send' + storeQs(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        })
          .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
          .then(function (result) {
            if (!result.ok) throw new Error(result.data.error || 'Send failed');
            if (input) input.value = '';
            delete cache[cacheKey('messages', convId)];
            openConversation(convId, { flash: { type: 'ok', message: 'Message sent.' } });
          })
          .catch(function (err) {
            alert(err.message || 'Send failed');
          })
          .finally(function () {
            if (btn) btn.disabled = false;
          });
      });
    }
  }

  function renderPanel(html) {
    var main = document.getElementById('app-main');
    if (!main) return;
    main.innerHTML = html;
    bindPanel(main);
    scrollThreadToBottom();
  }

  function scrollThreadToBottom() {
    var el = document.getElementById('thread-messages');
    if (!el) return;
    function scroll() {
      el.scrollTop = el.scrollHeight;
    }
    scroll();
    requestAnimationFrame(function () {
      scroll();
      requestAnimationFrame(scroll);
    });
  }

  function fetchPanel(tab, conversation, flash) {
    var key = cacheKey(tab, conversation);
    if (cache[key] && !flash) {
      renderPanel(cache[key]);
      setNav(tab);
      return Promise.resolve();
    }

    var url = conversation
      ? '/api/panels/messages/' + encodeURIComponent(conversation) + storeQs()
      : '/api/panels/' + encodeURIComponent(tab) + storeQs();

    if (flash) {
      url += (url.indexOf('?') >= 0 ? '&' : '?') + 'flash=' + encodeURIComponent(flash.message) + '&flashType=' + encodeURIComponent(flash.type);
    }

    loading = true;
    document.querySelectorAll('.nav-tabs button[data-tab]').forEach(function (btn) {
      btn.disabled = true;
    });

    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!flash) cache[key] = data.html;
        document.title = data.title + ' · Wayl';
        renderPanel(data.html);
        setNav(tab);
      })
      .finally(function () {
        loading = false;
        document.querySelectorAll('.nav-tabs button[data-tab]').forEach(function (btn) {
          btn.disabled = false;
        });
      });
  }

  function navigate(tab, conversation, flash, push) {
    if (loading) return;
    activeTab = tab;
    activeConversation = conversation || '';
    if (push !== false) {
      history.pushState({ tab: tab, conversation: activeConversation }, '', appUrl(tab, activeConversation));
    }
    return fetchPanel(tab, activeConversation, flash);
  }

  function openConversation(id, opts) {
    opts = opts || {};
    activeTab = 'messages';
    activeConversation = id;
    history.pushState({ tab: 'messages', conversation: id }, '', appUrl('messages', id));
    return fetchPanel('messages', id, opts.flash);
  }

  document.querySelectorAll('.nav-tabs button[data-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      navigate(btn.getAttribute('data-tab'), '', undefined, true);
    });
  });

  document.querySelectorAll('[data-dock]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var dock = btn.getAttribute('data-dock');
      if (dock === 'home') navigate('today');
      else if (dock === 'manage') navigate('messages');
      else if (dock === 'developers') navigate('developers');
    });
  });

  document.querySelectorAll('[data-sidebar-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      navigate(btn.getAttribute('data-sidebar-tab'));
    });
  });

  window.addEventListener('popstate', function (e) {
    var state = e.state || {};
    navigate(state.tab || 'today', state.conversation || '', undefined, false);
  });

  if (activeConversation) {
    setNav('messages');
    bindPanel(document.getElementById('app-main'));
    scrollThreadToBottom();
    history.replaceState({ tab: 'messages', conversation: activeConversation }, '', appUrl('messages', activeConversation));
  } else {
    setNav(activeTab);
    bindPanel(document.getElementById('app-main'));
  }
})();
</script>`;
}

export function renderAppShell(opts: {
  storeId: string;
  storeTitle?: string;
  initialTab: AppTab;
  initialConversation?: string;
  initialPanelHtml: string;
  initialTitle: string;
  profile?: Profile;
  connectUrl: string;
}): string {
  const storeSlug = opts.storeTitle || 'Store';
  const tabs: AppTab[] = ['today', 'insights', 'messages', 'developers'];

  const navButtons = tabs
    .map(
      (tab) =>
        `<button type="button" data-tab="${tab}" class="${opts.initialTab === tab ? 'active' : ''}">${tab === 'developers' ? 'Developers' : tab.charAt(0).toUpperCase() + tab.slice(1)}</button>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.initialTitle)} · Wayl</title>
  <style>${APP_STYLES}</style>
</head>
<body>
  <div class="app-shell">
    <nav class="main-nav">
      <div class="nav-tabs">${navButtons}</div>
      <div class="nav-actions">
        <a class="btn-store" href="https://wayl.io" target="_blank" rel="noopener">Go to Store</a>
      </div>
    </nav>
    <div class="layout">
      <main id="app-main">${opts.initialPanelHtml}</main>
      <aside>
        <div class="card sidebar-card">
          <div class="store-row">
            <div class="store-avatar">${escapeHtml(storeSlug.slice(0, 1).toUpperCase())}</div>
            <div>
              <h3>${escapeHtml(storeSlug)}</h3>
              <p>${escapeHtml(`${storeSlug.toLowerCase().replace(/\s+/g, '')}.thewayl.com`)}</p>
            </div>
          </div>
          ${igSidebar(opts.profile)}
        </div>
        <div class="card sidebar-card">
          <p class="sidebar-label">Quick links</p>
          <button type="button" class="btn-outline" data-sidebar-tab="developers" style="width:100%;margin-bottom:8px;">Integrations</button>
          <a class="btn-outline" href="https://wayl.io" target="_blank" rel="noopener" style="width:100%;">Settings</a>
        </div>
      </aside>
    </div>
  </div>
  <nav class="dock">
    <button type="button" data-dock="home" class="${opts.initialTab === 'today' || opts.initialTab === 'messages' ? 'active' : ''}">Home</button>
    <a href="https://wayl.io" target="_blank" rel="noopener">Store</a>
    <button type="button" data-dock="manage">Manage</button>
    <button type="button" data-dock="developers">Menu</button>
  </nav>
  ${appScript(opts.storeId, opts.initialTab, opts.initialConversation)}
</body>
</html>`;
}

export function renderAppError(title: string, message: string): string {
  return renderAppShell({
    storeId: '',
    initialTab: 'messages',
    initialTitle: title,
    initialPanelHtml: `<section class="card connect-card">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      <button type="button" class="btn-dark" data-tab="today">Back to dashboard</button>
    </section>`,
    connectUrl: '/oauth.php',
  });
}
