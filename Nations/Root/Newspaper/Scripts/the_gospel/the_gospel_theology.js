/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · THEOLOGY — Doctrine map: categories → sections → scriptures.
   "Sound doctrine that conforms to the gospel concerning the glory of the
    blessed God." — 1 Timothy 1:10-11
   ══════════════════════════════════════════════════════════════════════════════ */

import { esc, snip, emptyState, loadingCards, sectionHead, mdInline, stripHtml } from './the_gospel_shared.js';

export const name        = 'the_gospel_theology';
export const title       = 'Theology';
export const description = 'A living map of biblical doctrine — each category opens to its sections, scriptures, and applications.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18"/></svg>`;
export const accent      = '#c2410c';

let _state = { tree: [], openId: null };

export function render() {
  return /* html */`
    <section class="grow-page" data-grow="theology">
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>

      <div class="grow-split">
        <aside class="grow-split-aside">
          ${sectionHead('Categories')}
          <div class="grow-cat-list" data-bind="cats">${loadingCards(6)}</div>
        </aside>
        <article class="grow-split-main" data-bind="detail">
          <p class="grow-muted">Select a category to read its sections, supporting scriptures, and pastoral notes.</p>
        </article>
      </div>
    </section>
  `;
}

export function mount(root) {
  _load(root);
  return () => {};
}

async function _load(root) {
  const catEl = root.querySelector('[data-bind="cats"]');

  // Load from static bundle (regenerated from Firestore via export_theology_to_js.py)
  try {
    const mod = await import('../../Data/theology.js');
    _state.tree = _treeFromFlat(mod.default || []);
  } catch (e) {
    console.error('[gospel/theology] static bundle failed:', e);
  }

  if (!_state.tree.length) {
    catEl.innerHTML = emptyState({ icon: '☩', title: 'No theology entries yet', body: 'Ask your shepherd to seed the doctrine map.' });
    return;
  }
  _paint(root);
}

/** Build the categories tree from the flat static-bundle row shape. */
function _treeFromFlat(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const catTitle = r.categoryTitle || r['Category Title'] || 'General';
    if (!map.has(catTitle)) {
      map.set(catTitle, {
        id:          catTitle,
        title:       catTitle,
        subtitle:    r.categorySubtitle || r['Category Subtitle'] || '',
        description: r.categoryIntro || r['Category Intro'] || '',
        icon:        r.categoryIcon || r['Category Icon'] || '',
        colorVar:    r.categoryColor || r['Category Color'] || '',
        sections:    [],
      });
    }
    map.get(catTitle).sections.push({
      title:        r.sectionTitle || r['Section Title'] || '',
      description:  r.content || r['Content'] || '',
      summary:      r.summary || '',
      scriptures:   _refsToList(r.scriptureRefs || r['Scripture Refs'] || ''),
    });
  });
  // Sort sections by sortOrder if present, else title
  return Array.from(map.values()).map((c) => {
    c.sections.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    return c;
  });
}

function _refsToList(s) {
  if (!s) return [];
  return String(s).split(/[,;]\s*/).filter(Boolean);
}

/** Plain-English display names for academic theological category titles. */
const _FRIENDLY = {
  // Academic → Plain
  'Theology Proper':            'Who God Is',
  'Bibliology':                 'The Bible',
  'Christology':                'Who Jesus Is',
  'Pneumatology':               'The Holy Spirit',
  'Soteriology':                'Salvation',
  'Salvation & Soteriology':    'Salvation',
  'Ecclesiology':               'The Church',
  'Eschatology':                'End Times',
  'Anthropology':               'Who We Are',
  'Hamartiology':               'Sin',
  'Angelology':                 'Angels & Demons',
  'Demonology':                 'Angels & Demons',
  'Pneumatology & Gifts':       'The Holy Spirit & His Gifts',
  'Applied Theology':           'Living Out Your Faith',
  'Core Doctrine':              'What We Believe',
  'Marriage & Covenant':        'Marriage',
  'Marriage as Christ and the Church': 'Marriage',
  'The Word of God':            'The Bible',
  'Other Matters':              'Other Topics',
};

function _friendlyTitle(raw) {
  return _FRIENDLY[raw] || raw;
}

function _normalize(res) {
  // Accept either {categories:[{...sections:[]}]}, full tree, or flat list
  if (res && Array.isArray(res.categories)) return res.categories;
  const list = rows(res);
  if (list.length && list[0] && Array.isArray(list[0].sections)) return list;
  // Flat list — group by id
  return list.map((c) => ({ ...c, sections: c.sections || [] }));
}

function _paint(root) {
  const catEl = root.querySelector('[data-bind="cats"]');
  if (!_state.tree.length) {
    catEl.innerHTML = emptyState({ icon: '☩', title: 'No theology entries yet', body: 'Ask your shepherd to seed the doctrine map.' });
    return;
  }
  catEl.innerHTML = _state.tree.map((c) => {
    const color = c.colorVar || '';
    return `
    <button class="grow-cat ${_state.openId === c.id ? 'is-active' : ''}" data-cat="${esc(c.id)}"${color ? ` style="--cat-color:${esc(color)}"` : ''}>
      ${c.icon ? `<span class="grow-cat-icon">${esc(c.icon)}</span>` : ''}
      <span class="grow-cat-title">${esc(_friendlyTitle(c.title || c.name || 'Untitled'))}</span>
      ${c.sections ? `<span class="grow-cat-count">${c.sections.length}</span>` : ''}
    </button>`;
  }).join('');
  catEl.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => { _state.openId = btn.getAttribute('data-cat'); _paint(root); _paintDetail(root); });
  });
  _paintDetail(root);
}

function _paintDetail(root) {
  const detEl = root.querySelector('[data-bind="detail"]');
  if (!_state.openId) return;
  const cat = _state.tree.find((c) => c.id === _state.openId);
  if (!cat) { detEl.innerHTML = `<p class="grow-muted">Category not found.</p>`; return; }
  const sections = cat.sections || [];
  const color = cat.colorVar || accent;
  detEl.innerHTML = /* html */`
    <div class="grow-theology-hero" style="--cat-color:${esc(color)}">
      ${cat.icon ? `<span class="grow-theology-icon">${esc(cat.icon)}</span>` : ''}
      <div>
        <h2 class="grow-theology-title">${esc(_friendlyTitle(cat.title || cat.name || ''))}</h2>
        ${cat.subtitle ? `<p class="grow-theology-subtitle">${esc(cat.subtitle)}</p>` : ''}
        ${cat.description ? `<div class="grow-detail-sub">${mdInline(cat.description)}</div>` : ''}
      </div>
    </div>
    ${sections.length ? sections.map((s) => _section(s, color)).join('') : `<p class="grow-muted">No sections in this category yet.</p>`}
  `;
}

function _section(s, catColor) {
  const color = catColor || accent;
  const scriptures = (s.scriptures || []).map((r) => `<span class="grow-scripture" style="--doc-color:${esc(color)}">${esc(typeof r === 'string' ? r : (r.reference || r.ref || ''))}</span>`).join('');
  return /* html */`
    <article class="grow-doctrine" style="--doctrine-color:${esc(color)}">
      <h3 class="grow-doctrine-title">${esc(s.title || '')}</h3>
      ${s.description ? `<div class="grow-doctrine-body">${mdInline(snip(stripHtml(s.description), 600))}</div>` : ''}
      ${scriptures ? `<div class="grow-scriptures">${scriptures}</div>` : ''}
    </article>
  `;
}
