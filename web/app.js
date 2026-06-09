(function () {
  var config = window.WAYL_CONFIG || {};
  var API_BASE = String(config.apiBase || '').replace(/\/$/, '');
  var POLL_MS = 4000;

  if (!API_BASE) {
    document.getElementById('app-main').innerHTML =
      '<section class="card connect-card"><h2>Configuration missing</h2><p>Set API_BASE_URL in Netlify environment variables.</p></section>';
    return;
  }

  var params = new URLSearchParams(window.location.search);
  var storeId = params.get('storeId') || '';
  var activeTab = params.get('tab') || 'today';
  var activeConversation = params.get('conversation') || '';
  var cache = Object.create(null);
  var loading = false;
  var pollTimer = null;
  var lastLiveAt = new Date(0).toISOString();

  function storeQs(extra) {
    var qs = new URLSearchParams();
    if (storeId) qs.set('storeId', storeId);
    if (extra) {
      Object.keys(extra).forEach(function (k) {
        if (extra[k] !== undefined && extra[k] !== null) qs.set(k, extra[k]);
      });
    }
    var s = qs.toString();
    return s ? '?' + s : '';
  }

  function appUrl(tab, conversation) {
    var qs = new URLSearchParams();
    if (storeId) qs.set('storeId', storeId);
    if (tab && tab !== 'today') qs.set('tab', tab);
    if (conversation) qs.set('conversation', conversation);
    var s = qs.toString();
    return '/inbox' + (s ? '?' + s : '');
  }

  function apiUrl(path, extra) {
    return API_BASE + path + storeQs(extra);
  }

  function cacheKey(tab, conversation) {
    return tab + ':' + (conversation || '');
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleString();
    } catch (_e) {
      return '';
    }
  }

  function renderIgSidebar(profile, connected) {
    var el = document.getElementById('ig-sidebar');
    if (!el) return;
    if (!connected) {
      el.innerHTML = '<p class="sidebar-label">Instagram</p><p class="sidebar-value">Not connected</p>';
      return;
    }
    if (!profile) {
      el.innerHTML =
        '<p class="sidebar-label">Instagram</p><div class="ig-connected"><div class="ig-dot">IG</div><div><strong style="font-size:0.88rem;">Connected</strong></div></div>';
      return;
    }
    var handle = profile.igUsername ? '@' + profile.igUsername : profile.pageName || 'Instagram';
    el.innerHTML =
      '<p class="sidebar-label">Instagram</p>' +
      '<div class="ig-connected"><div class="ig-dot">IG</div><div><strong style="font-size:0.88rem;">' +
      escapeHtml(handle) +
      '</strong><p style="margin:2px 0 0;font-size:0.75rem;color:var(--muted);">ID ' +
      escapeHtml(profile.igId || '') +
      '</p></div></div>';
  }

  function updateSidebar(meta) {
    var title = meta.storeTitle || 'Store';
    var slug = title.toLowerCase().replace(/\s+/g, '');
    var avatar = document.getElementById('store-avatar');
    var titleEl = document.getElementById('store-title');
    var urlEl = document.getElementById('store-url');
    if (avatar) avatar.textContent = title.slice(0, 1).toUpperCase();
    if (titleEl) titleEl.textContent = title;
    if (urlEl) urlEl.textContent = slug + '.thewayl.com';
    if (meta.storeId) storeId = meta.storeId;
    renderIgSidebar(meta.profile, meta.connected);
  }

  function setNav(tab) {
    document.querySelectorAll('[data-tab]').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('[data-dock]').forEach(function (el) {
      var dockTab = el.getAttribute('data-dock');
      el.classList.toggle(
        'active',
        dockTab === tab || (dockTab === 'home' && (tab === 'today' || tab === 'messages')),
      );
    });
  }

  function convItemHtml(c, activeId) {
    return (
      '<button type="button" class="conv-item' +
      (c.id === activeId ? ' active' : '') +
      '" data-conversation="' +
      escapeHtml(c.id) +
      '"><h3>' +
      escapeHtml(c.participantLabel) +
      '</h3><p>' +
      escapeHtml(c.snippet || 'View conversation') +
      '</p>' +
      (c.updatedTime ? '<time>' + escapeHtml(formatTime(c.updatedTime)) + '</time>' : '') +
      '</button>'
    );
  }

  function messageBubbleHtml(m) {
    return (
      '<div class="bubble ' +
      (m.isFromBusiness ? 'us' : 'them') +
      '" data-message-id="' +
      escapeHtml(m.id) +
      '">' +
      escapeHtml(m.text) +
      '<div class="bubble-meta">' +
      escapeHtml(m.fromLabel) +
      (m.createdTime ? ' · ' + escapeHtml(formatTime(m.createdTime)) : '') +
      '</div></div>'
    );
  }

  function renderConversationList(conversations) {
    var list = document.getElementById('conv-list');
    if (!list) return;
    if (!conversations.length) {
      list.innerHTML =
        '<div class="empty">No conversations yet. When customers message you on Instagram, they will appear here.</div>';
      return;
    }
    list.innerHTML = conversations.map(function (c) {
      return convItemHtml(c, activeConversation);
    }).join('');
    list.querySelectorAll('[data-conversation]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openConversation(btn.getAttribute('data-conversation'));
      });
    });
  }

  function renderThreadMessages(messages) {
    var el = document.getElementById('thread-messages');
    if (!el) return;
    el.innerHTML = messages.length
      ? messages.map(messageBubbleHtml).join('')
      : '<div class="empty">No messages yet.</div>';
    el.scrollTop = el.scrollHeight;
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
        fetch(apiUrl('/api/messages/' + encodeURIComponent(convId) + '/send'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        })
          .then(function (res) {
            return res.json().then(function (data) {
              return { ok: res.ok, data: data };
            });
          })
          .then(function (result) {
            if (!result.ok) throw new Error(result.data.error || 'Send failed');
            if (input) input.value = '';
            delete cache[cacheKey('messages', convId)];
            lastLiveAt = new Date(0).toISOString();
            return openConversation(convId, { flash: { type: 'ok', message: 'Message sent.' } });
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
    syncLivePolling();
  }

  function setLoading(isLoading) {
    loading = isLoading;
    document.querySelectorAll('.nav-tabs button[data-tab]').forEach(function (btn) {
      btn.disabled = isLoading;
    });
  }

  function fetchPanel(tab, conversation, flash) {
    var key = cacheKey(tab, conversation);
    if (cache[key] && !flash) {
      renderPanel(cache[key].html);
      document.title = cache[key].title + ' · Wayl';
      setNav(tab);
      return Promise.resolve();
    }

    var path = conversation
      ? '/api/panels/messages/' + encodeURIComponent(conversation)
      : '/api/panels/' + encodeURIComponent(tab);

    var extra = {};
    if (flash) {
      extra.flash = flash.message;
      extra.flashType = flash.type;
    }

    setLoading(true);
    return fetch(apiUrl(path, extra), { headers: { Accept: 'application/json' } })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || 'Failed to load panel');
          return data;
        });
      })
      .then(function (data) {
        if (!flash) cache[key] = data;
        document.title = data.title + ' · Wayl';
        renderPanel(data.html);
        setNav(tab);
        lastLiveAt = new Date().toISOString();
      })
      .finally(function () {
        setLoading(false);
      });
  }

  function navigate(tab, conversation, flash, push) {
    if (loading) return Promise.resolve();
    activeTab = tab;
    activeConversation = conversation || '';
    if (push !== false) {
      history.pushState(
        { tab: tab, conversation: activeConversation },
        '',
        appUrl(tab, activeConversation),
      );
    }
    syncLivePolling();
    return fetchPanel(tab, activeConversation, flash);
  }

  function openConversation(id, opts) {
    opts = opts || {};
    activeTab = 'messages';
    activeConversation = id;
    history.pushState({ tab: 'messages', conversation: id }, '', appUrl('messages', id));
    syncLivePolling();
    return fetchPanel('messages', id, opts.flash);
  }

  function pollLive() {
    if (activeTab !== 'messages') return;

    var extra = { since: lastLiveAt };
    if (activeConversation) extra.conversation = activeConversation;

    fetch(apiUrl('/api/inbox/live', extra), { headers: { Accept: 'application/json' } })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || 'Live update failed');
          return data;
        });
      })
      .then(function (data) {
        lastLiveAt = data.serverTime || new Date().toISOString();

        if (data.thread && activeConversation) {
          renderThreadMessages(data.thread.messages || []);
        } else if (Array.isArray(data.conversations)) {
          renderConversationList(data.conversations);
        }
      })
      .catch(function () {
        /* ignore transient poll errors */
      });
  }

  function syncLivePolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (activeTab === 'messages') {
      pollTimer = setInterval(pollLive, POLL_MS);
    }
  }

  function loadPanelAfterMeta() {
    var extra = {};
    params.forEach(function (value, key) {
      if (key !== 'storeId') extra[key] = value;
    });

    return fetch(apiUrl('/api/app/bootstrap', extra), { headers: { Accept: 'application/json' } })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || 'Failed to load dashboard');
          return data;
        });
      })
      .then(function (data) {
        activeTab = data.tab || activeTab;
        activeConversation = data.conversationId || activeConversation;
        document.title = data.panel.title + ' · Wayl';
        renderPanel(data.panel.html);
        setNav(activeTab);
        cache[cacheKey(activeTab, activeConversation)] = data.panel;
        history.replaceState(
          { tab: activeTab, conversation: activeConversation },
          '',
          appUrl(activeTab, activeConversation),
        );
      });
  }

  function bootstrap() {
    fetch(apiUrl('/api/app/meta'), { headers: { Accept: 'application/json' } })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || 'Failed to load account');
          return data;
        });
      })
      .then(function (meta) {
        updateSidebar(meta);
        if (meta.storeId) storeId = meta.storeId;
        return loadPanelAfterMeta();
      })
      .catch(function (err) {
        document.getElementById('app-main').innerHTML =
          '<section class="card connect-card"><h2>Dashboard unavailable</h2><p>' +
          escapeHtml(err.message || 'Unknown error') +
          '</p></section>';
      });
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

  bootstrap();
})();
