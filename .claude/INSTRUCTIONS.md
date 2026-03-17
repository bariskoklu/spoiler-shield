# Spoiler Shield — Chrome Extension

## Language Rule

**All code, comments, UI text, and documentation must be in English.** This includes variable names, CSS comments, console logs, popup labels, overlay text, and this instructions file. The only exception is preset spoiler words that are intentionally in other languages (e.g., Turkish spoiler keywords).

---

## Project Summary

A Chrome extension to protect users from YouTube spoilers. Uses an overlay approach to fully cover matching video cards — thumbnail, title, description, hover preview are all hidden at once.

**No AI, fully local, zero cost.**

---

## Core Decisions

- **Manifest V3**
- No external dependencies, vanilla JS
- Settings stored via Chrome Storage API
- No tokens/API costs — all matching is client-side
- **Overlay approach:** Instead of hiding individual elements, a solid overlay covers the entire video card. Works regardless of YouTube DOM changes.

---

## Protection System

### Built-in Presets

Default protections that can be toggled on/off individually:

#### 1. Score Protection
Catches score patterns: "3-1", "4:0", "2 - 1" etc.
- Regex: `\b\d{1,2}\s*[-–:]\s*\d{1,2}\b`
- Single toggle on/off

#### 2. Spoiler Words
Common spoiler keywords — the full word list is shown to the user in the popup:
- EN: wins, loses, winner, loser, eliminated, champion, defeated, victory, clutch, final score, playoff, semifinals, finals
- TR: kazandı, kaybetti, şampiyon, elendi, finale kaldı, yenildi, galip
- Single toggle on/off

### User Inputs

#### 1. Channel Blocking
- User enters a channel name
- **Exact match** (case-insensitive `===`) — no fuzzy/includes matching
- ALL videos from that channel are hidden
- Use case: Block "beIN SPORTS" on match day, remove after watching

#### 2. Custom Keywords
- User enters a word
- **Match type** is selected per keyword:
  - **Exact (Whole Word):** Only matches as a standalone word. "win" won't match "winner", but matches "big win". Uses `\b` word boundary regex.
  - **Contains:** Matches anywhere in the title. "win" matches "winner" too.
- Each keyword can be enabled/disabled and deleted individually

---

## Overlay Display

Matching video cards are fully covered with an overlay:

```
┌─────────────────────────────────┐
│                                 │
│       🛡️ Spoiler Shield         │
│   [censored title or info]     │
│     Channel Name • Date         │
│          [Show]                 │
│                                 │
└─────────────────────────────────┘
```

- **Overlay:** `position: absolute; inset: 0` solid div on top of the renderer
- **All children:** `visibility: hidden` — thumbnail, title, description, hover preview all hidden
- **Keyword match:** Censored title shown (matched words replaced with █ blocks)
- **Channel block:** Only channel name + date shown
- **Show button:** Reveals content, "Hide" button appears at bottom-right
- **Hide button:** Re-hides the content

---

## Popup UI Structure

### Header
- Logo + "Spoiler Shield" title
- Master toggle (extension on/off)

### Built-in Protection Section
- **Score Protection** — toggle + description
- **Spoiler Words** — toggle + full word list visible as tags

### My Keywords Section
- User-added keyword list
- Each keyword: checkbox + word + match type badge (Exact/Contains) + delete button
- Add form: input + match type dropdown + Add button

### Blocked Channels Section
- Blocked channel list
- Each channel: checkbox + name + Channel badge + delete button
- Add form: input + Add button

---

## Technical Architecture

### File Structure
```
spoiler-shield/
├── manifest.json
├── content.js             # DOM scanning, matching, overlay hiding
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic — CRUD, storage
├── styles/
│   └── spoiler.css        # Overlay, badge, reveal styles
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Content Script Flow
1. Loads at `document_start`, waits for body, starts observers
2. Loads settings from Chrome Storage
3. Scans video renderers (`ytd-rich-item-renderer`, `ytd-video-renderer`, etc.)
4. Extracts title + channel name (homepage and search use different DOM structures)
5. Matching: presets + user keywords + channel blocks
6. Places overlay on matching videos
7. MutationObserver + `yt-navigate-finish` + periodic scan for dynamic content

### CSS Approach
- `.ss-hidden` → added to renderer, children get `visibility: hidden`
- `.ss-overlay` → solid background overlay, `position: absolute; inset: 0`
- `.ss-revealed` → overlay hidden, children visible again
- `.ss-rehide-btn` → "Hide" button at bottom-right when revealed

### Storage Schema
```json
{
  "ss_preset_scores": true,
  "ss_preset_keywords": true,
  "ss_keywords": [
    { "id": "kw-123", "word": "taric", "wholeWord": true, "enabled": true },
    { "id": "kw-456", "word": "tft", "wholeWord": false, "enabled": true }
  ],
  "ss_channels": [
    { "id": "ch-123", "name": "beIN SPORTS Türkiye", "enabled": true }
  ],
  "ss_enabled": true
}
```

### Channel Matching
- **Exact match** (case-insensitive): `channelName.toLowerCase() === storedName.toLowerCase()`
- No fuzzy/includes matching

### Keyword Matching
- **Whole Word:** `new RegExp('\\b' + escaped + '\\b', 'i')` — word boundary
- **Contains:** `title.toLowerCase().includes(keyword.toLowerCase())`

---

## Notes
- YouTube DOM structure differs between homepage and search — separate selectors exist for both
- Homepage: `yt-lockup-metadata-view-model` classes, `aria-label` attribute
- Search/sidebar: classic `#video-title`, `#channel-name` IDs
- Overlay approach abstracts all DOM differences — just covers the entire card
- Content script: 80ms debounce + 3s periodic scan
