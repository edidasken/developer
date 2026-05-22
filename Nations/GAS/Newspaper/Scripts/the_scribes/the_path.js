/* ══════════════════════════════════════════════════════════════════════════════
   THE PATH — URL ↔ view-name parsing for the_scribes
   "Make straight paths for your feet." — Hebrews 12:13
   ══════════════════════════════════════════════════════════════════════════════ */

/** Build a URL for a view. Keeps ?covenant=new and any other reserved params. */
export function build(name, params = {}) {
  const url = new URL(location.href);
  url.searchParams.set('view', name);
  // Drop any previous view-specific params we don't recognise here — views
  // pass their own through the params object on each navigation.
  const reserved = new Set(['covenant', 'view', 'church']);
  for (const k of Array.from(url.searchParams.keys())) {
    if (!reserved.has(k)) url.searchParams.delete(k);
  }
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    url.searchParams.set(k, String(v));
  }
  return url.pathname + '?' + url.searchParams.toString() + url.hash;
}

/** Parse a path+search into { name, params }. */
export function parse(href) {
  const url = new URL(href, location.origin);
  const name = url.searchParams.get('view') || 'the_good_shepherd';
  const params = {};
  for (const [k, v] of url.searchParams.entries()) {
    if (k === 'view' || k === 'covenant' || k === 'church') continue;
    params[k] = v;
  }
  return { name, params };
}
