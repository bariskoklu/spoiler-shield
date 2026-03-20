// Spoiler Shield — Content Script
(function () {
  'use strict';

  const LOG = '[SpoilerShield]';

  // ─── Constants ───

  const RENDERERS = [
    'ytd-rich-item-renderer',
    'ytd-video-renderer',
    'ytd-compact-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-reel-item-renderer'
  ].join(', ');

  // Sidebar on watch pages uses yt-lockup-view-model instead of classic renderers
  const SIDEBAR_RENDERER = 'ytd-watch-next-secondary-results-renderer yt-lockup-view-model';

  // Preset: score pattern regex
  const SCORE_REGEX = /\b\d{1,2}\s*[-\u2013:]\s*\d{1,2}\b/i;

  // Preset: spoiler words
  const SPOILER_WORDS = [
    'wins', 'loses', 'winner', 'loser', 'eliminated', 'champion',
    'defeated', 'victory', 'clutch', 'final score', 'playoff',
    'semifinals', 'finals',
    'kazand\u0131', 'kaybetti', '\u015fampiyon', 'elendi', 'finale kald\u0131',
    'yenildi', 'galip'
  ];

  // ─── State ───

  let presetScores = true;
  let presetKeywords = true;
  let keywords = [];
  let channels = [];
  let extensionEnabled = true;
  let processed = new WeakSet();
  let scanTimer = null;

  // ─── Init ───

  console.log(LOG, 'Loaded on', location.href);

  function init() {
    loadSettings();
    startObservers();
  }

  if (document.body) {
    init();
  } else {
    new MutationObserver(function check() {
      if (document.body) { this.disconnect(); init(); }
    }).observe(document.documentElement, { childList: true });
  }

  // ─── Storage ───

  function loadSettings() {
    chrome.storage.local.get(
      ['ss_preset_scores', 'ss_preset_keywords', 'ss_keywords', 'ss_channels', 'ss_enabled'],
      (r) => {
        presetScores = r.ss_preset_scores !== undefined ? r.ss_preset_scores : true;
        presetKeywords = r.ss_preset_keywords !== undefined ? r.ss_preset_keywords : true;
        keywords = r.ss_keywords || [];
        channels = r.ss_channels || [];
        extensionEnabled = r.ss_enabled !== undefined ? r.ss_enabled : true;

        if (r.ss_preset_scores === undefined) {
          chrome.storage.local.set({
            ss_preset_scores: true,
            ss_preset_keywords: true,
            ss_keywords: [],
            ss_channels: [],
            ss_enabled: true
          });
        }

        console.log(LOG, 'Loaded. Enabled:', extensionEnabled,
          'Scores:', presetScores, 'Keywords:', presetKeywords,
          'Custom:', keywords.length, 'Channels:', channels.length);
        resetAndScan();
      }
    );
  }

  chrome.storage.onChanged.addListener((changes) => {
    let rescan = false;
    if (changes.ss_preset_scores) { presetScores = changes.ss_preset_scores.newValue; rescan = true; }
    if (changes.ss_preset_keywords) { presetKeywords = changes.ss_preset_keywords.newValue; rescan = true; }
    if (changes.ss_keywords) { keywords = changes.ss_keywords.newValue || []; rescan = true; }
    if (changes.ss_channels) { channels = changes.ss_channels.newValue || []; rescan = true; }
    if (changes.ss_enabled) { extensionEnabled = changes.ss_enabled.newValue; rescan = true; }
    if (rescan) { processed = new WeakSet(); resetAndScan(); }
  });

  // ─── Observers ───

  function startObservers() {
    new MutationObserver((muts) => {
      for (const m of muts) { if (m.addedNodes.length) { debouncedScan(); return; } }
    }).observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener('yt-navigate-finish', () => {
      console.log(LOG, 'Navigation detected');
      processed = new WeakSet();
      debouncedScan();
    });

    window.addEventListener('popstate', () => { processed = new WeakSet(); debouncedScan(); });
    setInterval(scanVideos, 3000);
    console.log(LOG, 'Observers started');
  }

  // ─── Scanning ───

  function scanVideos() {
    if (!extensionEnabled) {
      document.querySelectorAll('.ss-hidden').forEach(revealAll);
      return;
    }

    // On watch pages, also scan sidebar lockup view models
    const isWatch = location.pathname === '/watch';
    const selector = isWatch ? RENDERERS + ', ' + SIDEBAR_RENDERER : RENDERERS;
    const renderers = document.querySelectorAll(selector);
    let count = 0;

    renderers.forEach((renderer) => {
      if (processed.has(renderer)) return;

      const title = getTitle(renderer);
      const channel = getChannelName(renderer);
      if (!title && !channel) return;

      processed.add(renderer);

      const titleMatch = title && matchesTitle(title);
      const channelMatch = matchesChannel(channel);

      if (titleMatch || channelMatch) {
        const date = getDateText(renderer);
        hideVideo(renderer, title, channel, date, channelMatch && !titleMatch);
        count++;
      }
    });

    if (count > 0) console.log(LOG, 'Hidden', count, 'videos');
  }

  function debouncedScan() {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(scanVideos, 80);
  }

  function resetAndScan() {
    document.querySelectorAll('.ss-hidden').forEach(revealAll);
    processed = new WeakSet();
    scanVideos();
  }

  // ─── Matching ───

  function matchesTitle(title) {
    if (!title) return false;
    const lower = title.toLowerCase();

    if (presetScores && SCORE_REGEX.test(title)) return true;

    if (presetKeywords) {
      for (const word of SPOILER_WORDS) {
        if (lower.includes(word.toLowerCase())) return true;
      }
    }

    for (const kw of keywords) {
      if (!kw.enabled) continue;
      if (kw.wholeWord) {
        try {
          const escaped = kw.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (new RegExp('\\b' + escaped + '\\b', 'i').test(title)) return true;
        } catch (e) {}
      } else {
        if (lower.includes(kw.word.toLowerCase())) return true;
      }
    }

    return false;
  }

  function matchesChannel(name) {
    if (!name) return false;
    const lower = name.toLowerCase().trim();
    for (const ch of channels) {
      if (!ch.enabled) continue;
      if (lower === ch.name.toLowerCase().trim()) return true;
    }
    return false;
  }

  function censorTitle(title) {
    let out = title;

    if (presetScores) {
      out = out.replace(SCORE_REGEX, m => '\u2588'.repeat(m.length));
    }

    if (presetKeywords) {
      for (const word of SPOILER_WORDS) {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out = out.replace(new RegExp(escaped, 'gi'), m => '\u2588'.repeat(m.length));
      }
    }

    for (const kw of keywords) {
      if (!kw.enabled) continue;
      const escaped = kw.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = kw.wholeWord ? '\\b' + escaped + '\\b' : escaped;
      try {
        out = out.replace(new RegExp(pattern, 'gi'), m => '\u2588'.repeat(m.length));
      } catch (e) {}
    }

    return out;
  }

  // ─── DOM Helpers ───

  function getTitle(el) {
    const vt = el.querySelector('#video-title');
    if (vt) { const t = vt.textContent.trim(); if (t) return t; }
    // Lockup title (homepage + watch sidebar) — match both __ and _ variants
    const lockup = el.querySelector('a[class*="lockup-metadata-view-model"][class*="title"]');
    if (lockup) {
      const a = lockup.getAttribute('aria-label');
      if (a) return a.trim();
      const t = lockup.textContent.trim();
      if (t) return t;
    }
    const span = el.querySelector('h3 span.yt-core-attributed-string');
    if (span) { const t = span.textContent.trim(); if (t) return t; }
    const h3 = el.querySelector('h3');
    if (h3) { const t = h3.textContent.trim(); if (t) return t; }
    return '';
  }

  function getChannelName(el) {
    const sels = [
      '#channel-name yt-formatted-string a',
      '#channel-name yt-formatted-string',
      'ytd-channel-name yt-formatted-string a',
      'ytd-channel-name yt-formatted-string',
      '[class*="lockup-metadata-view-model__byline"] a',
      '[class*="lockup-metadata-view-model__byline"] span.yt-core-attributed-string',
    ];
    for (const s of sels) {
      const e = el.querySelector(s);
      if (e) { const t = e.textContent.trim(); if (t && t.length < 100) return t; }
    }
    const link = el.querySelector('a[href^="/@"], a[href^="/channel/"]');
    if (link) { const t = link.textContent.trim(); if (t && t.length < 100) return t; }
    // Watch sidebar: first metadata row contains channel name
    const metaRow = el.querySelector('.yt-content-metadata-view-model__metadata-row');
    if (metaRow) {
      const s = metaRow.querySelector('span.yt-core-attributed-string');
      if (s) {
        // Get only the direct text, not nested badge/icon spans
        let name = '';
        for (const node of s.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) name += node.textContent;
        }
        name = name.trim();
        if (name && name.length < 100) return name;
      }
    }
    return '';
  }

  function getDateText(el) {
    const spans = el.querySelectorAll(
      '#metadata-line span, .inline-metadata-item, #metadata span, ' +
      '.ytd-video-meta-block span, [class*="lockup-metadata-view-model"] span, ' +
      '.yt-content-metadata-view-model__metadata-text'
    );
    for (const s of spans) {
      const t = s.textContent.trim();
      if (/\u00f6nce|ago|yay\u0131n|stream|premiered/i.test(t)) return t;
    }
    return '';
  }

  function getVideoUrl(el) {
    const link = el.querySelector('a#video-title-link, a#video-title, a[href*="/watch?v="]');
    return link ? link.href : '';
  }

  // ─── Hide / Reveal ───

  function hideVideo(renderer, title, channelName, dateText, isChannelBlock) {
    if (renderer.querySelector('.ss-overlay')) return;

    renderer.classList.add('ss-hidden');

    const videoUrl = getVideoUrl(renderer);

    const overlay = document.createElement('div');
    overlay.className = 'ss-overlay';
    if (videoUrl) overlay.style.cursor = 'pointer';

    // Clicking anywhere on overlay (except Show button) navigates to the video
    overlay.addEventListener('click', (e) => {
      if (e.target.closest('.ss-overlay-btn')) return;
      if (videoUrl) window.location.href = videoUrl;
    });

    // Channel name + date first (top priority)
    if (channelName || dateText) {
      const info = document.createElement('div');
      info.className = 'ss-overlay-info';
      info.textContent = [channelName, dateText].filter(Boolean).join(' \u2022 ');
      overlay.appendChild(info);
    }

    // Censored title for keyword/score matches
    if (!isChannelBlock && title) {
      const censored = document.createElement('div');
      censored.className = 'ss-overlay-censored';
      censored.textContent = censorTitle(title);
      overlay.appendChild(censored);
    }

    // Shield branding (small, at bottom)
    const shield = document.createElement('div');
    shield.className = 'ss-overlay-shield';
    shield.textContent = '\uD83D\uDEE1\uFE0F Spoiler Shield';
    overlay.appendChild(shield);

    const showBtn = document.createElement('button');
    showBtn.className = 'ss-overlay-btn';
    showBtn.textContent = 'Show';
    showBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      renderer.classList.add('ss-revealed');
      overlay.classList.add('ss-overlay-revealed');
      rehideBtn.style.display = '';
    });
    overlay.appendChild(showBtn);
    renderer.appendChild(overlay);

    const rehideBtn = document.createElement('button');
    rehideBtn.className = 'ss-rehide-btn';
    rehideBtn.textContent = 'Hide';
    rehideBtn.style.display = 'none';
    rehideBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      renderer.classList.remove('ss-revealed');
      overlay.classList.remove('ss-overlay-revealed');
      rehideBtn.style.display = 'none';
    });
    renderer.appendChild(rehideBtn);

    console.log(LOG, 'Hidden:', title || channelName);
  }

  function revealAll(renderer) {
    renderer.classList.remove('ss-hidden', 'ss-revealed');
    const overlay = renderer.querySelector('.ss-overlay');
    if (overlay) overlay.remove();
    const rehide = renderer.querySelector('.ss-rehide-btn');
    if (rehide) rehide.remove();
  }
})();
