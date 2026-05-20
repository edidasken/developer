/* ════════════════════════════════════════════════════════════════════════════
   THE QUILL — Shared Rich Text Formatter
   "My tongue is the pen of a ready writer." — Psalm 45:1

   Mounts a compact sticky toolbar + right-side Format panel to any
   contenteditable element. Used by FlockDocs, FlockShamar, and any future
   text-editing surface in FlockOS.

   Usage:
     import { mountQuill } from '../Scripts/the_quill.js';
     const q = mountQuill(editorEl, {
       mode:       'document',  // 'document' (FlockDocs) | 'note' (Shamar)
       pageEl:     null,        // the .fd-editor-page element (document mode)
       onBack:     null,        // fn() — back button (document mode)
       statusEl:   null,        // element showing save status text
       toolbar:    null,        // existing toolbar host element to render into
     });
     q.destroy();               // clean up listeners
   ════════════════════════════════════════════════════════════════════════════ */

/* ── CSS (injected once) ─────────────────────────────────────────────────── */
(function _injectQuillCSS() {
  if (document.getElementById('quill-styles')) return;
  const s = document.createElement('style');
  s.id = 'quill-styles';
  s.textContent = `
/* ── Compact Toolbar ─────────────────────────────────────────────────── */
.quill-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 12px;
  background: var(--fd-panel, #1b264f);
  border-bottom: 1px solid rgba(255,255,255,0.10);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 80;
  overflow-x: auto;
  scrollbar-width: none;
}
.quill-bar::-webkit-scrollbar { display: none; }

.quill-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: rgba(255,255,255,0.65);
  cursor: pointer;
  font: 600 14px/1 var(--font-ui, system-ui);
  transition: background .12s, color .12s;
  flex-shrink: 0;
}
.quill-btn svg { width: 17px; height: 17px; }
.quill-btn:hover { background: rgba(255,255,255,0.10); color: #fff; }
.quill-btn.is-active { background: rgba(215,186,109,0.20); color: var(--fd-gold,#d7ba6d); }
.quill-btn:disabled { opacity: 0.3; pointer-events: none; }

.quill-sep {
  width: 1px;
  height: 22px;
  background: rgba(255,255,255,0.12);
  margin: 0 5px;
  flex-shrink: 0;
}

.quill-style-pill {
  height: 28px;
  padding: 0 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.18);
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.80);
  font: 500 12px/1 var(--font-ui, system-ui);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all .12s;
}
.quill-style-pill:hover { background: rgba(255,255,255,0.13); border-color: rgba(255,255,255,0.30); }

.quill-spacer { flex: 1; }

.quill-format-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 12px;
  border-radius: 15px;
  border: 1px solid rgba(215,186,109,0.40);
  background: rgba(215,186,109,0.12);
  color: var(--fd-gold,#d7ba6d);
  font: 600 12px/1 var(--font-ui, system-ui);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all .12s;
}
.quill-format-btn:hover { background: rgba(215,186,109,0.22); border-color: rgba(215,186,109,0.65); }
.quill-format-btn svg { width: 14px; height: 14px; }

/* ── Format Panel ────────────────────────────────────────────────────── */
.quill-panel-backdrop {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  z-index: 3000;
}
.quill-panel-backdrop.is-open { display: block; }

.quill-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 288px;
  max-width: 90vw;
  background: var(--fd-panel, #1b264f);
  border-left: 1px solid rgba(255,255,255,0.10);
  box-shadow: -4px 0 24px rgba(0,0,0,0.35);
  z-index: 3001;
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform .25s cubic-bezier(.2,.8,.2,1);
  overflow: hidden;
}
.quill-panel.is-open { transform: translateX(0); }

.quill-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.10);
  flex-shrink: 0;
}
.quill-panel-title {
  font: 600 15px/1 var(--font-ui, system-ui);
  color: #fff;
}
.quill-panel-close {
  width: 28px; height: 28px;
  border-radius: 8px; border: none;
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.7);
  cursor: pointer; font-size: 16px; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  transition: background .12s;
}
.quill-panel-close:hover { background: rgba(255,255,255,0.15); color: #fff; }

.quill-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0 40px;
}

.quill-section {
  padding: 0 18px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  margin-bottom: 4px;
}
.quill-section:last-child { border-bottom: none; }

.quill-section-label {
  font: 600 10px/1 var(--font-ui, system-ui);
  letter-spacing: .08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.40);
  padding: 12px 0 10px;
}

/* Row of panel buttons */
.quill-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

/* Panel icon button */
.quill-pbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px; height: 34px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.75);
  cursor: pointer;
  font: 600 13px/1 var(--font-ui, system-ui);
  transition: all .12s;
}
.quill-pbtn svg { width: 16px; height: 16px; }
.quill-pbtn:hover { background: rgba(255,255,255,0.13); color: #fff; border-color: rgba(255,255,255,0.25); }
.quill-pbtn.is-active { background: rgba(215,186,109,0.20); color: var(--fd-gold,#d7ba6d); border-color: rgba(215,186,109,0.40); }

/* Wide panel button */
.quill-pbtn-wide {
  flex: 1;
  height: 34px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.75);
  cursor: pointer;
  font: 500 12px/1 var(--font-ui, system-ui);
  padding: 0 10px;
  transition: all .12s;
  white-space: nowrap;
  text-align: left;
  display: flex; align-items: center; gap: 6px;
}
.quill-pbtn-wide:hover { background: rgba(255,255,255,0.11); color: #fff; }
.quill-pbtn-wide.is-active { background: rgba(215,186,109,0.18); color: var(--fd-gold,#d7ba6d); border-color: rgba(215,186,109,0.38); }
.quill-pbtn-wide svg { width: 15px; height: 15px; flex-shrink: 0; }

/* Panel select */
.quill-pselect {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 8px;
  background: rgba(255,255,255,0.07);
  color: #fff;
  font: 500 13px/1 var(--font-ui, system-ui);
  cursor: pointer;
  outline: none;
  margin-bottom: 8px;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='rgba(255,255,255,.5)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
  transition: border-color .12s;
}
.quill-pselect:hover { border-color: rgba(255,255,255,0.28); }

/* Panel number input (margins) */
.quill-num-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 8px;
}
.quill-num-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.quill-num-label {
  font: 500 10px/1 var(--font-ui, system-ui);
  color: rgba(255,255,255,0.50);
  text-transform: uppercase;
  letter-spacing: .05em;
}
.quill-num-input {
  height: 32px;
  padding: 0 10px;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 7px;
  background: rgba(255,255,255,0.07);
  color: #fff;
  font: 500 13px/1 var(--font-ui, system-ui);
  outline: none;
  text-align: center;
  transition: border-color .12s;
}
.quill-num-input:hover, .quill-num-input:focus { border-color: rgba(215,186,109,0.50); }

/* Color swatch row */
.quill-color-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.quill-color-swatch {
  width: 26px; height: 26px;
  border-radius: 6px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: transform .12s, border-color .12s;
}
.quill-color-swatch:hover { transform: scale(1.15); }
.quill-color-swatch.is-active { border-color: #fff; }
.quill-color-picker-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.quill-color-native {
  width: 34px; height: 34px;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  background: rgba(255,255,255,0.07);
  cursor: pointer;
  padding: 4px;
  flex-shrink: 0;
}
.quill-color-label {
  font: 500 12px/1 var(--font-ui, system-ui);
  color: rgba(255,255,255,0.65);
}
`;
  document.head.appendChild(s);
})();

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function _svg(path, extra = '') {
  return `<svg width="17" height="17" fill="currentColor" viewBox="0 0 24 24" ${extra}>${path}</svg>`;
}
function _q(sel, root = document) { return root.querySelector(sel); }
function _exec(cmd, val = null) {
  document.execCommand(cmd, false, val);
}
function _isActive(cmd) {
  try { return document.queryCommandState(cmd); } catch { return false; }
}
function _queryVal(cmd) {
  try { return document.queryCommandValue(cmd); } catch { return ''; }
}

const STYLE_LABELS = {
  p: 'Normal', h1: 'Heading 1', h2: 'Heading 2',
  h3: 'Heading 3', h4: 'Heading 4', blockquote: 'Quote', pre: 'Code'
};
const TEXT_COLORS  = ['#000000','#1b264f','#b42318','#0b6eb3','#2d6a2d','#7c3aed','#b45309','#374151','#6b7280'];
const HILIGHT_COLORS = ['transparent','#fff475','#a7ffeb','#cbf0f8','#d7aefb','#f28b82','#ccff90','#fdcfe8','#fbbc04'];

/* ── Main export ─────────────────────────────────────────────────────────── */
export function mountQuill(target, opts = {}) {
  if (!target) return { destroy: () => {} };
  const mode      = opts.mode   || 'note';
  const pageEl    = opts.pageEl || null;
  const onBack    = opts.onBack || null;
  const statusEl  = opts.statusEl || null;
  const toolbarHost = opts.toolbar || null;   // existing element to render bar into

  /* ── Build toolbar HTML ── */
  const barHTML = `
    ${onBack ? `<button class="quill-btn" id="qb-back" title="Back">
      ${_svg('<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" fill="none"/>')}
    </button><span class="quill-sep"></span>` : ''}

    <button class="quill-btn" id="qb-bold"   title="Bold (Ctrl+B)"><b>B</b></button>
    <button class="quill-btn" id="qb-italic" title="Italic (Ctrl+I)"><i>I</i></button>
    <button class="quill-btn" id="qb-under"  title="Underline (Ctrl+U)"><u>U</u></button>
    <span class="quill-sep"></span>
    <button class="quill-style-pill" id="qb-style-pill" title="Paragraph style">Normal</button>
    <span class="quill-sep"></span>
    <div class="quill-spacer"></div>
    <button class="quill-format-btn" id="qb-format">
      ${_svg('<path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" fill="currentColor"/>','width="14" height="14"')}
      Format
    </button>
  `;

  let bar;
  if (toolbarHost) {
    toolbarHost.classList.add('quill-bar');
    toolbarHost.innerHTML = barHTML;
    bar = toolbarHost;
  } else {
    bar = document.createElement('div');
    bar.className = 'quill-bar';
    bar.innerHTML = barHTML;
    target.parentElement.insertBefore(bar, target);
  }

  /* ── Build panel HTML ── */
  const isDoc = mode === 'document';

  const panelHTML = `
    <div class="quill-panel-head">
      <span class="quill-panel-title">Format</span>
      <button class="quill-panel-close" id="qp-close">✕</button>
    </div>
    <div class="quill-panel-body">

      <!-- TEXT -->
      <div class="quill-section">
        <div class="quill-section-label">Text</div>

        <select class="quill-pselect" id="qp-font">
          <option value="Arial">Arial</option>
          <option value="Calibri">Calibri</option>
          <option value="Courier New">Courier New</option>
          <option value="Georgia">Georgia</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Noto Serif">Noto Serif</option>
          <option value="Roboto">Roboto</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Trebuchet MS">Trebuchet MS</option>
          <option value="Verdana">Verdana</option>
        </select>

        <div class="quill-row">
          <button class="quill-pbtn-wide" id="qp-fsz-down" title="Decrease font size">
            ${_svg('<path d="M19 13H5v-2h14v2z"/>','width="15" height="15"')} Smaller
          </button>
          <button class="quill-pbtn-wide" id="qp-fsz-up" title="Increase font size">
            ${_svg('<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>','width="15" height="15"')} Larger
          </button>
        </div>

        <div class="quill-row">
          <button class="quill-pbtn" id="qp-bold"   title="Bold"><b>B</b></button>
          <button class="quill-pbtn" id="qp-italic" title="Italic"><i style="font-style:italic">I</i></button>
          <button class="quill-pbtn" id="qp-under"  title="Underline"><u>U</u></button>
          <button class="quill-pbtn" id="qp-strike" title="Strikethrough"><s>S</s></button>
          <button class="quill-pbtn" id="qp-clear"  title="Clear formatting">
            ${_svg('<path d="M3.27 5L2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.27 5zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6z"/>','width="16" height="16"')}
          </button>
        </div>

        <div class="quill-section-label" style="padding-top:8px">Text Color</div>
        <div class="quill-color-row" id="qp-text-colors">
          ${TEXT_COLORS.map(c => `<div class="quill-color-swatch" data-color="${c}" style="background:${c};${c==='#000000'?'border:2px solid rgba(255,255,255,.2)':''}" title="${c}"></div>`).join('')}
        </div>
        <div class="quill-color-picker-row">
          <input type="color" class="quill-color-native" id="qp-text-color-input" value="#000000" title="Custom color">
          <span class="quill-color-label">Custom color</span>
        </div>

        <div class="quill-section-label" style="padding-top:4px">Highlight</div>
        <div class="quill-color-row" id="qp-hilight-colors">
          ${HILIGHT_COLORS.map(c => `<div class="quill-color-swatch" data-hilight="${c}" style="background:${c === 'transparent' ? 'rgba(255,255,255,.15)' : c};${c==='transparent'?'border:2px solid rgba(255,255,255,.25)':''}" title="${c === 'transparent' ? 'None' : c}"></div>`).join('')}
        </div>
      </div>

      <!-- PARAGRAPH -->
      <div class="quill-section">
        <div class="quill-section-label">Paragraph</div>

        <select class="quill-pselect" id="qp-style">
          <option value="p">Normal text</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
          <option value="blockquote">Quote</option>
          <option value="pre">Code block</option>
        </select>

        <div class="quill-row">
          <button class="quill-pbtn" id="qp-al" title="Align left">
            ${_svg('<path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z"/>')}
          </button>
          <button class="quill-pbtn" id="qp-ac" title="Center">
            ${_svg('<path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z"/>')}
          </button>
          <button class="quill-pbtn" id="qp-ar" title="Align right">
            ${_svg('<path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z"/>')}
          </button>
          <button class="quill-pbtn" id="qp-aj" title="Justify">
            ${_svg('<path d="M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zm0-6v2h18V3H3z"/>')}
          </button>
        </div>

        <div class="quill-row">
          <button class="quill-pbtn-wide" id="qp-ul" title="Bulleted list">
            ${_svg('<circle cx="4" cy="7" r="2"/><circle cx="4" cy="12" r="2"/><circle cx="4" cy="17" r="2"/><path d="M7 6h14v2H7V6zm0 5h14v2H7v-2zm0 5h14v2H7v-2z"/>')}
            Bulleted list
          </button>
          <button class="quill-pbtn-wide" id="qp-ol" title="Numbered list">
            ${_svg('<path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/>')}
            Numbered list
          </button>
        </div>

        <div class="quill-row">
          <button class="quill-pbtn" id="qp-outdent" title="Decrease indent">
            ${_svg('<path d="M11 17h10v-2H11v2zm-8-5l4 4V8l-4 4zm0 9h18v-2H3v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z"/>')}
          </button>
          <button class="quill-pbtn" id="qp-indent" title="Increase indent">
            ${_svg('<path d="M3 21h18v-2H3v2zm0-4h18v-2H3v2zM3 3v2h18V3H3zm0 6h18V7H3v2zm8 4l-4-4v8l4-4zm4 3h6v-2h-6v2zm0-4h6v-2h-6v2zm0-4h6V7h-6v2z"/>')}
          </button>
          <button class="quill-pbtn-wide" id="qp-checklist" title="Checklist">
            ${_svg('<path d="M22 5.18L10.59 16.6l-4.24-4.24 1.41-1.41 2.83 2.83 10-10L22 5.18zM12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8c1.57 0 3.04.46 4.28 1.25l1.45-1.45C16.1 2.67 14.13 2 12 2 6.48 2 2 6.48 2 12s4.48 10 10 10c1.73 0 3.36-.44 4.78-1.22l-1.5-1.5c-1 .46-2.11.72-3.28.72z"/>')}
            Checklist
          </button>
        </div>

        <div class="quill-row">
          <button class="quill-pbtn-wide" id="qp-sp-compact" title="Compact spacing">
            ${_svg('<path d="M6 7h2.5L5 3.5 1.5 7H4v10H1.5L5 20.5 8.5 17H6V7zm4-2v2h12V5H10zm0 14h12v-2H10v2zm0-6h12v-2H10v2z"/>')}
            Compact
          </button>
          <button class="quill-pbtn-wide" id="qp-sp-normal" title="Normal spacing">
            ${_svg('<path d="M6 7h2.5L5 3.5 1.5 7H4v10H1.5L5 20.5 8.5 17H6V7zm4-2v2h12V5H10zm0 14h12v-2H10v2zm0-6h12v-2H10v2z"/>')}
            Normal
          </button>
        </div>
      </div>

      <!-- INSERT -->
      <div class="quill-section">
        <div class="quill-section-label">Insert</div>
        <div class="quill-row">
          <button class="quill-pbtn-wide" id="qp-link" title="Insert link">
            ${_svg('<path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>')}
            Link
          </button>
          <button class="quill-pbtn-wide" id="qp-image" title="Insert image">
            ${_svg('<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>')}
            Image
          </button>
        </div>
        <div class="quill-row">
          <button class="quill-pbtn-wide" id="qp-table" title="Insert table">
            ${_svg('<path d="M10 10.02h5V21h-5zM17 21h3c1.1 0 2-.9 2-2v-9h-5v11zm3-18H5c-1.1 0-2 .9-2 2v3h19V5c0-1.1-.9-2-2-2zM3 19c0 1.1.9 2 2 2h3V10.02H3V19z"/>')}
            Table
          </button>
          <button class="quill-pbtn-wide" id="qp-hr" title="Horizontal rule">
            ${_svg('<path d="M19 13H5v-2h14v2z"/>')}
            Divider
          </button>
        </div>
      </div>

      ${isDoc ? `
      <!-- PAGE SETUP (document mode only) -->
      <div class="quill-section" id="qp-page-section">
        <div class="quill-section-label">Page Setup</div>

        <select class="quill-pselect" id="qp-paper">
          <option value="letter">Letter (8.5 × 11 in)</option>
          <option value="a4">A4 (8.27 × 11.69 in)</option>
          <option value="legal">Legal (8.5 × 14 in)</option>
        </select>

        <div class="quill-row" style="margin-bottom:6px">
          <button class="quill-pbtn-wide" id="qp-portrait" title="Portrait">
            ${_svg('<path d="M17 3H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H7V5h10v14z"/>')}
            Portrait
          </button>
          <button class="quill-pbtn-wide" id="qp-landscape" title="Landscape">
            ${_svg('<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>')}
            Landscape
          </button>
        </div>

        <div class="quill-section-label" style="padding-top:6px">Margins (inches)</div>
        <div class="quill-num-row">
          <div class="quill-num-wrap">
            <span class="quill-num-label">Top</span>
            <input type="number" class="quill-num-input" id="qp-mg-top" value="1" min="0" max="4" step="0.1">
          </div>
          <div class="quill-num-wrap">
            <span class="quill-num-label">Bottom</span>
            <input type="number" class="quill-num-input" id="qp-mg-bot" value="1" min="0" max="4" step="0.1">
          </div>
        </div>
        <div class="quill-num-row">
          <div class="quill-num-wrap">
            <span class="quill-num-label">Left</span>
            <input type="number" class="quill-num-input" id="qp-mg-left" value="1" min="0" max="4" step="0.1">
          </div>
          <div class="quill-num-wrap">
            <span class="quill-num-label">Right</span>
            <input type="number" class="quill-num-input" id="qp-mg-right" value="1" min="0" max="4" step="0.1">
          </div>
        </div>

        <div class="quill-section-label" style="padding-top:6px">Header &amp; Footer</div>
        <div class="quill-row">
          <button class="quill-pbtn-wide" id="qp-toggle-header" title="Toggle header">
            ${_svg('<path d="M20 4H4c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 6H4V6h16v4zm0 6H4c-1.1 0-2 .9-2 2v2h20v-2c0-1.1-.9-2-2-2z"/>')}
            Header
          </button>
          <button class="quill-pbtn-wide" id="qp-toggle-footer" title="Toggle footer">
            ${_svg('<path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4v-4h16v4zm0-6H4V6h16v8z"/>')}
            Footer
          </button>
        </div>
      </div>
      ` : ''}

    </div>
  `;

  const backdrop = document.createElement('div');
  backdrop.className = 'quill-panel-backdrop';
  const panel = document.createElement('div');
  panel.className = 'quill-panel';
  panel.innerHTML = panelHTML;
  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  /* ── Open / Close panel ── */
  function openPanel()  { panel.classList.add('is-open'); backdrop.classList.add('is-open'); }
  function closePanel() { panel.classList.remove('is-open'); backdrop.classList.remove('is-open'); }

  /* ── Update toolbar state from selection ── */
  function _updateBar() {
    _q('#qb-bold',   bar)?.classList.toggle('is-active', _isActive('bold'));
    _q('#qb-italic', bar)?.classList.toggle('is-active', _isActive('italic'));
    _q('#qb-under',  bar)?.classList.toggle('is-active', _isActive('underline'));
    // Style pill
    const tag = document.queryCommandValue('formatBlock').toLowerCase().replace(/[<>]/g,'') || 'p';
    const pill = _q('#qb-style-pill', bar);
    if (pill) pill.textContent = STYLE_LABELS[tag] || 'Normal';
    // Panel mirrors
    _q('#qp-bold',   panel)?.classList.toggle('is-active', _isActive('bold'));
    _q('#qp-italic', panel)?.classList.toggle('is-active', _isActive('italic'));
    _q('#qp-under',  panel)?.classList.toggle('is-active', _isActive('underline'));
    _q('#qp-strike', panel)?.classList.toggle('is-active', _isActive('strikethrough'));
    _q('#qp-al', panel)?.classList.toggle('is-active', _isActive('justifyLeft'));
    _q('#qp-ac', panel)?.classList.toggle('is-active', _isActive('justifyCenter'));
    _q('#qp-ar', panel)?.classList.toggle('is-active', _isActive('justifyRight'));
    _q('#qp-aj', panel)?.classList.toggle('is-active', _isActive('justifyFull'));
    const styleEl = _q('#qp-style', panel);
    if (styleEl) styleEl.value = tag;
    const fontEl = _q('#qp-font', panel);
    if (fontEl) {
      const f = _queryVal('fontName').replace(/["']/g,'');
      if (f) fontEl.value = f;
    }
  }

  /* ── Wire toolbar buttons ── */
  function _barClick(e) {
    const btn = e.target.closest('[id^="qb-"]');
    if (!btn) return;
    target.focus();
    switch (btn.id) {
      case 'qb-back':   onBack?.(); break;
      case 'qb-bold':   _exec('bold');      break;
      case 'qb-italic': _exec('italic');    break;
      case 'qb-under':  _exec('underline'); break;
      case 'qb-style-pill': openPanel(); break;
      case 'qb-format': openPanel(); break;
    }
    _updateBar();
  }
  bar.addEventListener('click', _barClick);

  /* ── Wire panel buttons ── */
  function _panelClick(e) {
    const btn = e.target.closest('[id^="qp-"]');
    if (!btn) return;
    const restore = () => { target.focus(); _updateBar(); };

    switch (btn.id) {
      case 'qp-close':    closePanel(); return;
      case 'qp-bold':     _exec('bold');           restore(); break;
      case 'qp-italic':   _exec('italic');         restore(); break;
      case 'qp-under':    _exec('underline');      restore(); break;
      case 'qp-strike':   _exec('strikethrough');  restore(); break;
      case 'qp-clear':    _exec('removeFormat');   restore(); break;
      case 'qp-fsz-up': {
        const sz = parseInt(_queryVal('fontSize') || '3') + 1;
        _exec('fontSize', Math.min(sz, 7)); restore(); break;
      }
      case 'qp-fsz-down': {
        const sz = parseInt(_queryVal('fontSize') || '3') - 1;
        _exec('fontSize', Math.max(sz, 1)); restore(); break;
      }
      case 'qp-al': _exec('justifyLeft');   restore(); break;
      case 'qp-ac': _exec('justifyCenter'); restore(); break;
      case 'qp-ar': _exec('justifyRight');  restore(); break;
      case 'qp-aj': _exec('justifyFull');   restore(); break;
      case 'qp-ul': _exec('insertUnorderedList'); restore(); break;
      case 'qp-ol': _exec('insertOrderedList');   restore(); break;
      case 'qp-outdent': _exec('outdent'); restore(); break;
      case 'qp-indent':  _exec('indent');  restore(); break;
      case 'qp-checklist': _insertChecklist(target); restore(); break;
      case 'qp-link':  _insertLink(target); restore(); break;
      case 'qp-image': _insertImage(target); restore(); break;
      case 'qp-table': _insertTable(target); restore(); break;
      case 'qp-hr':    _exec('insertHorizontalRule'); restore(); break;
      case 'qp-sp-compact': _setSpacing(target, 0); restore(); break;
      case 'qp-sp-normal':  _setSpacing(target, 8); restore(); break;
      // Page setup
      case 'qp-portrait':  _setOrientation('portrait',  pageEl); break;
      case 'qp-landscape': _setOrientation('landscape', pageEl); break;
      case 'qp-toggle-header': _toggleZone('header', pageEl); break;
      case 'qp-toggle-footer': _toggleZone('footer', pageEl); break;
    }
  }

  function _panelChange(e) {
    const el = e.target;
    if (!el.id) return;
    if (el.id === 'qp-style') {
      target.focus();
      _exec('formatBlock', el.value);
      _updateBar();
    }
    if (el.id === 'qp-font') {
      target.focus();
      _exec('fontName', el.value);
    }
    if (el.id === 'qp-paper') { _setPaper(el.value, pageEl); }
    // Margins
    if (['qp-mg-top','qp-mg-bot','qp-mg-left','qp-mg-right'].includes(el.id) && pageEl) {
      const v = parseFloat(el.value) || 1;
      const pxPerIn = 96;
      const map = { 'qp-mg-top':'paddingTop','qp-mg-bot':'paddingBottom','qp-mg-left':'paddingLeft','qp-mg-right':'paddingRight' };
      pageEl.style[map[el.id]] = (v * pxPerIn) + 'px';
      _savePageSetup(pageEl);
    }
  }

  function _panelColorClick(e) {
    const sw = e.target.closest('.quill-color-swatch');
    if (!sw) return;
    target.focus();
    if (sw.dataset.color !== undefined) {
      _exec('foreColor', sw.dataset.color);
      _q('#qp-text-color-input', panel).value = sw.dataset.color;
    }
    if (sw.dataset.hilight !== undefined) {
      const c = sw.dataset.hilight;
      if (c === 'transparent') _exec('removeFormat');
      else _exec('hiliteColor', c);
    }
    _updateBar();
  }

  panel.addEventListener('click', _panelClick);
  panel.addEventListener('change', _panelChange);
  panel.addEventListener('click', _panelColorClick);

  // Native color inputs
  const textColorInput = _q('#qp-text-color-input', panel);
  textColorInput?.addEventListener('input', (e) => {
    target.focus();
    _exec('foreColor', e.target.value);
  });

  backdrop.addEventListener('click', closePanel);

  /* ── Selection changes ── */
  const _onSel = () => {
    const node = document.getSelection()?.anchorNode;
    if (!node) return;
    if (target.contains(node)) _updateBar();
  };
  document.addEventListener('selectionchange', _onSel);
  target.addEventListener('keyup', _updateBar);

  /* ── Style pill: click opens panel ── */
  // (handled in _barClick above)

  /* ── Page setup persistence ── */
  function _savePageSetup(page) {
    if (!page) return;
    try {
      const key = 'quill_page_' + (page.id || 'default');
      localStorage.setItem(key, JSON.stringify({
        pt: page.style.paddingTop,
        pb: page.style.paddingBottom,
        pl: page.style.paddingLeft,
        pr: page.style.paddingRight,
        w: page.style.width,
        minH: page.style.minHeight,
      }));
    } catch (_) {}
  }

  function _restorePageSetup(page) {
    if (!page) return;
    try {
      const key = 'quill_page_' + (page.id || 'default');
      const d = JSON.parse(localStorage.getItem(key) || 'null');
      if (!d) return;
      if (d.pt)   page.style.paddingTop    = d.pt;
      if (d.pb)   page.style.paddingBottom = d.pb;
      if (d.pl)   page.style.paddingLeft   = d.pl;
      if (d.pr)   page.style.paddingRight  = d.pr;
      if (d.w)    page.style.width         = d.w;
      if (d.minH) page.style.minHeight     = d.minH;
      // Sync inputs
      const pxToIn = px => (parseFloat(px) / 96).toFixed(1);
      const T = _q('#qp-mg-top',   panel);
      const B = _q('#qp-mg-bot',   panel);
      const L = _q('#qp-mg-left',  panel);
      const R = _q('#qp-mg-right', panel);
      if (T && d.pt) T.value = pxToIn(d.pt);
      if (B && d.pb) B.value = pxToIn(d.pb);
      if (L && d.pl) L.value = pxToIn(d.pl);
      if (R && d.pr) R.value = pxToIn(d.pr);
    } catch (_) {}
  }

  if (pageEl) _restorePageSetup(pageEl);

  /* ── Return API ── */
  return {
    bar,
    panel,
    openPanel,
    closePanel,
    update: _updateBar,
    destroy() {
      bar.removeEventListener('click', _barClick);
      panel.removeEventListener('click', _panelClick);
      panel.removeEventListener('change', _panelChange);
      panel.removeEventListener('click', _panelColorClick);
      document.removeEventListener('selectionchange', _onSel);
      target.removeEventListener('keyup', _updateBar);
      backdrop.remove();
      panel.remove();
      if (!toolbarHost) bar.remove();
    }
  };
}

/* ── Insert helpers ─────────────────────────────────────────────────────── */
function _insertLink(target) {
  const url = prompt('Enter URL:');
  if (url) _exec('createLink', url);
}

function _insertImage(target) {
  const url = prompt('Enter image URL (or leave blank to upload):');
  if (url) _exec('insertImage', url);
}

function _insertTable(target) {
  let rows = 3, cols = 3;
  const spec = prompt('Rows x Columns (e.g. 3x3):', '3x3');
  if (spec) { const p = spec.split('x'); rows = parseInt(p[0])||3; cols = parseInt(p[1])||3; }
  const cells = Array.from({length: cols}, () => '<td style="border:1px solid #ccc;padding:6px 10px;min-width:60px;">&nbsp;</td>').join('');
  const trows = Array.from({length: rows}, () => `<tr>${cells}</tr>`).join('');
  const html = `<table style="border-collapse:collapse;width:100%;margin:16px 0;">${trows}</table>`;
  _exec('insertHTML', html);
}

function _insertChecklist(target) {
  _exec('insertHTML', '<div style="display:flex;align-items:center;gap:8px;margin:4px 0;"><input type="checkbox" style="width:16px;height:16px;cursor:pointer;"> <span contenteditable="true" style="flex:1;outline:none;">Item</span></div>');
}

function _setSpacing(target, marginPx) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  let node = sel.anchorNode;
  while (node && node !== target) {
    if (['P','H1','H2','H3','H4','LI'].includes(node.nodeName)) {
      node.style.marginBottom = marginPx + 'px';
      break;
    }
    node = node.parentNode;
  }
}

/* ── Page layout helpers ────────────────────────────────────────────────── */
const PAPER_SIZES = {
  letter:  { w: 816,  h: 1056 },
  a4:      { w: 794,  h: 1123 },
  legal:   { w: 816,  h: 1344 },
};

function _setPaper(size, pageEl) {
  if (!pageEl) return;
  const p = PAPER_SIZES[size] || PAPER_SIZES.letter;
  pageEl.style.width    = p.w + 'px';
  pageEl.style.minHeight = p.h + 'px';
  _savePageSetup(pageEl);
}

function _setOrientation(dir, pageEl) {
  if (!pageEl) return;
  const curW = parseFloat(pageEl.style.width) || 816;
  const curH = parseFloat(pageEl.style.minHeight) || 1056;
  if (dir === 'landscape' && curW < curH) {
    pageEl.style.width     = curH + 'px';
    pageEl.style.minHeight = curW + 'px';
  } else if (dir === 'portrait' && curW > curH) {
    pageEl.style.width     = curH + 'px';
    pageEl.style.minHeight = curW + 'px';
  }
  _savePageSetup(pageEl);
}

function _toggleZone(which, pageEl) {
  if (!pageEl) return;
  const id = `quill-${which}`;
  let zone = pageEl.querySelector('#' + id);
  if (zone) {
    zone.remove();
    return;
  }
  zone = document.createElement('div');
  zone.id = id;
  zone.contentEditable = 'true';
  zone.dataset.placeholder = which === 'header' ? 'Header — click to edit' : 'Footer — click to edit';
  Object.assign(zone.style, {
    position: 'absolute',
    left: '0', right: '0',
    [which === 'header' ? 'top' : 'bottom']: '0',
    minHeight: '40px',
    padding: '8px ' + (pageEl.style.paddingLeft || '96px'),
    borderBottom: which === 'header' ? '1px dashed #ccc' : 'none',
    borderTop:    which === 'footer' ? '1px dashed #ccc' : 'none',
    fontSize: '11px',
    color: '#666',
    outline: 'none',
    fontFamily: 'inherit',
  });
  zone.textContent = '';
  // Show placeholder via CSS if empty
  const zStyle = document.createElement('style');
  zStyle.textContent = `#${id}:empty::before{content:attr(data-placeholder);color:#aaa;pointer-events:none;}`;
  document.head.appendChild(zStyle);
  if (which === 'header') pageEl.insertBefore(zone, pageEl.firstChild);
  else pageEl.appendChild(zone);
  // Make page position:relative for absolute zones
  pageEl.style.position = 'relative';
}
