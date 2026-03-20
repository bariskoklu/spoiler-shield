// Spoiler Shield — Popup Logic
(function () {
  'use strict';

  const SPOILER_WORDS = [
    'wins', 'loses', 'winner', 'loser', 'eliminated', 'champion',
    'defeated', 'victory', 'clutch', 'final score', 'playoff',
    'semifinals', 'finals'
  ];

  // DOM refs
  const masterToggle = document.getElementById('masterToggle');
  const presetScoresToggle = document.getElementById('presetScores');
  const presetKeywordsToggle = document.getElementById('presetKeywords');
  const presetWordsList = document.getElementById('presetWordsList');
  const keywordsList = document.getElementById('keywordsList');
  const channelsList = document.getElementById('channelsList');
  const kwInput = document.getElementById('kwInput');
  const kwType = document.getElementById('kwType');
  const btnAddKw = document.getElementById('btnAddKw');
  const chInput = document.getElementById('chInput');
  const btnAddCh = document.getElementById('btnAddCh');

  let keywords = [];
  let channels = [];

  // Show preset words
  presetWordsList.innerHTML = SPOILER_WORDS.map(w => '<span>' + w + '</span>').join(' ');

  // Load from storage
  chrome.storage.local.get(
    ['ss_preset_scores', 'ss_preset_keywords', 'ss_keywords', 'ss_channels', 'ss_enabled'],
    (r) => {
      masterToggle.checked = r.ss_enabled !== undefined ? r.ss_enabled : true;
      presetScoresToggle.checked = r.ss_preset_scores !== undefined ? r.ss_preset_scores : true;
      presetKeywordsToggle.checked = r.ss_preset_keywords !== undefined ? r.ss_preset_keywords : true;
      keywords = r.ss_keywords || [];
      channels = r.ss_channels || [];

      if (r.ss_preset_scores === undefined) {
        chrome.storage.local.set({
          ss_preset_scores: true,
          ss_preset_keywords: true,
          ss_keywords: [],
          ss_channels: [],
          ss_enabled: true
        });
      }

      renderKeywords();
      renderChannels();
    }
  );

  // ─── Events ───

  masterToggle.addEventListener('change', () => {
    chrome.storage.local.set({ ss_enabled: masterToggle.checked });
  });

  presetScoresToggle.addEventListener('change', () => {
    chrome.storage.local.set({ ss_preset_scores: presetScoresToggle.checked });
  });

  presetKeywordsToggle.addEventListener('change', () => {
    chrome.storage.local.set({ ss_preset_keywords: presetKeywordsToggle.checked });
  });

  btnAddKw.addEventListener('click', addKeyword);
  kwInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addKeyword(); });

  btnAddCh.addEventListener('click', addChannel);
  chInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addChannel(); });

  // ─── Keywords ───

  function addKeyword() {
    const word = kwInput.value.trim();
    if (!word) return;

    if (keywords.some(k => k.word.toLowerCase() === word.toLowerCase())) {
      kwInput.style.borderColor = '#ff5252';
      setTimeout(() => { kwInput.style.borderColor = ''; }, 1500);
      return;
    }

    keywords.push({
      id: 'kw-' + Date.now(),
      word: word,
      wholeWord: kwType.value === 'whole',
      enabled: true
    });

    chrome.storage.local.set({ ss_keywords: keywords });
    kwInput.value = '';
    kwInput.focus();
    renderKeywords();
  }

  function renderKeywords() {
    keywordsList.innerHTML = '';

    if (keywords.length === 0) {
      keywordsList.innerHTML = '<div class="empty-state">No custom keywords yet</div>';
      return;
    }

    keywords.forEach((kw) => {
      const item = document.createElement('div');
      item.className = 'item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = kw.enabled;
      cb.addEventListener('change', () => {
        kw.enabled = cb.checked;
        chrome.storage.local.set({ ss_keywords: keywords });
      });

      const label = document.createElement('div');
      label.className = 'item-label';
      label.textContent = kw.word;
      label.title = kw.word;

      const badge = document.createElement('span');
      badge.className = 'type-badge ' + (kw.wholeWord ? 'whole' : 'contains');
      badge.textContent = kw.wholeWord ? 'Exact' : 'Contains';

      const del = document.createElement('button');
      del.className = 'item-delete';
      del.textContent = '\u00d7';
      del.addEventListener('click', () => {
        keywords = keywords.filter(k => k.id !== kw.id);
        chrome.storage.local.set({ ss_keywords: keywords });
        renderKeywords();
      });

      item.appendChild(cb);
      item.appendChild(label);
      item.appendChild(badge);
      item.appendChild(del);
      keywordsList.appendChild(item);
    });
  }

  // ─── Channels ───

  function addChannel() {
    const name = chInput.value.trim();
    if (!name) return;

    if (channels.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      chInput.style.borderColor = '#ff5252';
      setTimeout(() => { chInput.style.borderColor = ''; }, 1500);
      return;
    }

    channels.push({
      id: 'ch-' + Date.now(),
      name: name,
      enabled: true
    });

    chrome.storage.local.set({ ss_channels: channels });
    chInput.value = '';
    chInput.focus();
    renderChannels();
  }

  function renderChannels() {
    channelsList.innerHTML = '';

    if (channels.length === 0) {
      channelsList.innerHTML = '<div class="empty-state">No blocked channels yet</div>';
      return;
    }

    channels.forEach((ch) => {
      const item = document.createElement('div');
      item.className = 'item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = ch.enabled;
      cb.addEventListener('change', () => {
        ch.enabled = cb.checked;
        chrome.storage.local.set({ ss_channels: channels });
      });

      const label = document.createElement('div');
      label.className = 'item-label';
      label.textContent = ch.name;

      const badge = document.createElement('span');
      badge.className = 'type-badge channel';
      badge.textContent = 'Channel';

      const del = document.createElement('button');
      del.className = 'item-delete';
      del.textContent = '\u00d7';
      del.addEventListener('click', () => {
        channels = channels.filter(c => c.id !== ch.id);
        chrome.storage.local.set({ ss_channels: channels });
        renderChannels();
      });

      item.appendChild(cb);
      item.appendChild(label);
      item.appendChild(badge);
      item.appendChild(del);
      channelsList.appendChild(item);
    });
  }
})();
