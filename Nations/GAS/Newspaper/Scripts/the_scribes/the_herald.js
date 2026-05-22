/* ══════════════════════════════════════════════════════════════════════════════
   THE HERALD — ⌘K command palette + global keyboard shortcuts
   "How beautiful are the feet of those who bring good news." — Romans 10:15

   Every action in FlockOS should be reachable from here, eventually. For
   Phase I it's just a quiet ⌘K listener that opens a list of registered
   commands. UI is intentionally minimal — Adornment styles will polish it
   in a later pass.
   ══════════════════════════════════════════════════════════════════════════════ */

const _commands = []; // { id, label, run }
let _open = false;
let _root = null;

export function wakeHerald(/* opts */) {
  if (_root) return;
  document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const trigger = (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k';
    if (trigger) { e.preventDefault(); toggle(); }
    else if (_open && e.key === 'Escape') { e.preventDefault(); close(); }
  });
}

export function registerCommand(cmd) {
  if (!cmd || !cmd.id || !cmd.label || typeof cmd.run !== 'function') return;
  if (_commands.find((c) => c.id === cmd.id)) return;
  _commands.push(cmd);
}

export function toggle() { _open ? close() : open(); }

export function open() {
  if (_open) return;
  _open = true;
  _root = document.createElement('div');
  _root.className = 'herald-overlay';
  _root.setAttribute('role', 'dialog');
  _root.setAttribute('aria-label', 'Command palette');
  _root.innerHTML = `
    <div class="herald-panel">
      <input class="herald-input" type="text" placeholder="Type a command…" autocomplete="off" spellcheck="false">
      <ul class="herald-list" role="listbox"></ul>
    </div>
  `;
  _root.style.cssText = `
    position: fixed; inset: 0; z-index: 9000;
    background: rgba(20,24,40,0.45);
    display: flex; align-items: flex-start; justify-content: center;
    padding-top: 14vh;
  `;
  const panel = _root.querySelector('.herald-panel');
  panel.style.cssText = `
    background: var(--bg-raised, #fff); color: var(--ink, #1b264f);
    width: min(560px, 92vw); border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    overflow: hidden; font: 1rem/1.4 'Noto Sans', sans-serif;
  `;
  const input = _root.querySelector('.herald-input');
  input.style.cssText = `
    width: 100%; box-sizing: border-box; padding: 16px 18px;
    border: 0; outline: 0; background: transparent;
    font: inherit; color: inherit;
    border-bottom: 1px solid var(--line, #e5e7ef);
  `;
  const list = _root.querySelector('.herald-list');
  list.style.cssText = `list-style: none; margin: 0; padding: 6px 0; max-height: 50vh; overflow-y: auto;`;

  document.body.appendChild(_root);
  _renderList('');
  input.addEventListener('input', () => _renderList(input.value));
  input.focus();

  _root.addEventListener('click', (e) => { if (e.target === _root) close(); });
}

export function close() {
  if (!_open) return;
  _open = false;
  if (_root && _root.parentNode) _root.parentNode.removeChild(_root);
  _root = null;
}

function _renderList(query) {
  if (!_root) return;
  const list = _root.querySelector('.herald-list');
  const q = String(query || '').toLowerCase().trim();
  const items = _commands.filter((c) => !q || c.label.toLowerCase().includes(q));
  list.innerHTML = items.map((c, i) => `
    <li role="option" data-id="${c.id}"
        style="padding:10px 18px;cursor:pointer;${i === 0 ? 'background:var(--bg,#f7f8fb);' : ''}">
      ${_esc(c.label)}
    </li>
  `).join('') || `<li style="padding:14px 18px;color:var(--ink-muted,#7a7f96);">No matches.</li>`;
  list.querySelectorAll('li[data-id]').forEach((li) => {
    li.addEventListener('click', () => {
      const cmd = _commands.find((c) => c.id === li.dataset.id);
      close();
      if (cmd) try { cmd.run(); } catch (_) { /* graceful */ }
    });
  });
}

function _esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
