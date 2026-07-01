# CLAUDE.md

Guidance for working in this repository.

## What this is
WebBiz — a single-page, dependency-free business manager for a website/freelance
business. Pure HTML/CSS/vanilla JS. No build step, no backend. All data lives in
the browser's `localStorage` under the key `webbiz.data.v1`.

## Architecture
- `js/store.js` — the only place that reads/writes data. Exposes `window.Store`.
  Every mutation persists immediately. All money math (totals, tax, outstanding,
  monthly series) lives here.
- `js/ui.js` — `window.UI`: formatting (`money`, `date`), modal open/close, toast,
  HTML escaping (`UI.esc` — always use it when injecting user text into HTML).
- `js/views.js` — render functions on `window.Views` for dashboard, income,
  expenses, debts, clients, notes. Each returns an HTML string and calls
  `UI.setTopbar(...)` to set page-level action buttons.
- `js/invoice.js` — invoice list, builder, PDF/print preview, settings (extends
  `window.Views`).
- `js/app.js` — `window.App`: navigation, the render loop, and a SINGLE delegated
  click handler on `document.body` that dispatches on `data-action`. Add new
  buttons by giving them `data-action`/`data-id`/`data-type` and a `case` here.

## Conventions
- Scripts are plain `<script>` (NOT ES modules) so the app works over `file://`.
  Keep it that way — modules break double-click-to-open.
- No external/CDN dependencies. The app must run fully offline. Charts are pure
  CSS. Don't add libraries.
- Always escape user-provided strings with `UI.esc()` before putting them in HTML.
- After any data change, call `App.render()` to refresh the current view.
- The `[hidden]` attribute is force-hidden via CSS (`[hidden]{display:none!important}`)
  because component rules use `display:grid/flex`. Toggle visibility with the
  `hidden` attribute, not by editing display.

## Testing
There is no test framework. Verify changes with a headless browser smoke test
against `file:///.../index.html` (Playwright/Chromium is available in this env):
load the page, drive the flows, assert no console/page errors, and check
persistence survives a reload.
