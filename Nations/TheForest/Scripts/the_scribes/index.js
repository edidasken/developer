/* ══════════════════════════════════════════════════════════════════════════════
   THE SCRIBES — Router (public API)
   "Then every scribe instructed unto the kingdom of heaven is like
    unto a man that is an householder." — Matthew 13:52

   The Scribes records the way. Tiny client-side router with three jobs:
     1. Map URL ↔ view name (the_path).
     2. Track history (the_chronicle).
     3. Surface a ⌘K command palette (the_herald).

   This file is the GATE — only this index is imported by the rest of the app.
   ══════════════════════════════════════════════════════════════════════════════ */

import { parse, build } from './the_path.js';
import { push, replace as historyReplace, current as historyCurrent } from './the_chronicle.js';
import { wakeHerald, registerCommand } from './the_herald.js';
import { NC_APPS } from '../the_app_switcher.js';

const _registry = new Map();   // name -> () => Promise<viewModule>
const _loaded   = new Map();   // name -> viewModule
let   _active   = null;        // { name, params, unmount }
let   _mountSlot = null;

export function setMountSlot(el) { _mountSlot = el; }

export function register(name, loader, opts = {}) {
  _registry.set(name, loader);
  // Make it discoverable from ⌘K with optional title/route metadata.
  if (opts.command) registerCommand({ id: 'goto:' + name, label: opts.command, run: () => go(name) });
}

export async function go(name, params = {}, { replace = false } = {}) {
  if (!_registry.has(name)) {
    console.warn('[the_scribes] unknown view:', name);
    return;
  }
  if (_active && _active.unmount) {
    try { _active.unmount(); } catch (_) { /* ignore */ }
  }

  const url = build(name, params);
  if (replace) historyReplace(url, { name, params });
  else         push(url, { name, params });

  const mod = await _load(name);
  if (!_mountSlot) {
    console.warn('[the_scribes] no mount slot — call setMountSlot first');
    return;
  }
  let html = '';
  try { html = mod.render ? mod.render(params) : ''; } catch (e) { console.error('[the_scribes] render error in', name, e); }
  _mountSlot.innerHTML = html;
  let unmount = null;
  try { unmount = mod.mount ? mod.mount(_mountSlot, { params, go }) : null; } catch (e) { console.error('[the_scribes] mount error in', name, e); }
  if (mod.title) document.title = mod.title + ' · FlockOS';

  _active = { name, params, unmount };
}

export function current() {
  return _active ? { name: _active.name, params: _active.params } : null;
}

/** Re-run the current view's render + mount cycle in place. */
export async function reload() {
  if (!_active) return;
  await go(_active.name, _active.params, { replace: true });
}

async function _load(name) {
  if (_loaded.has(name)) return _loaded.get(name);
  const mod = await _registry.get(name)();
  _loaded.set(name, mod);
  return mod;
}

/* ── Browser back/forward ────────────────────────────────────────────────── */
window.addEventListener('popstate', (e) => {
  const state = e.state || parse(location.pathname + location.search);
  if (state && state.name && _registry.has(state.name)) {
    go(state.name, state.params || {}, { replace: true });
  }
});

/* ── Boot the command palette once at module load ────────────────────────── */
wakeHerald({ navigate: go });

/* Register all FlockOS modules (NC_APPS) as palette commands so the search
   surfaces every app in the suite. Resolved against current page so the
   right church deployment is reached. */
try {
  (NC_APPS || []).forEach((app) => {
    if (!app || !app.href) return;
    registerCommand({
      id: 'app:' + app.id,
      label: 'Open ' + app.name + (app.sub ? ' — ' + app.sub : ''),
      run: () => {
        try {
          const target = new URL(app.href, new URL('./', location.href)).href;
          window.location.href = target;
        } catch (_) { window.location.href = app.href; }
      }
    });
  });
} catch (_) { /* graceful */ }

export { historyCurrent };
