// Lexical root builders for the Suffolk annex load.
// Extends delaware/context/lexical.mjs with bold runs and nested lists.
//
// Column values are a lexical ROOT object: {"root":{children:[...],type:"root",...}}
// (NOT the {text:{root}} wrapper used by page components).

function textNode(text, format = 0) {
  return { detail: 0, format, mode: 'normal', style: '', text, type: 'text', version: 1 };
}

/** runs: string | [{t, b?}]  -> array of text nodes (b=true => bold, format bit 1) */
function runNodes(runs) {
  if (typeof runs === 'string') return runs ? [textNode(runs)] : [];
  return runs.filter(r => r && r.t).map(r => textNode(r.t, r.b ? 1 : 0));
}

export function paragraph(runs) {
  const children = runNodes(runs);
  return {
    children,
    direction: children.length ? 'ltr' : null,
    format: '', indent: 0, type: 'paragraph', version: 1, textFormat: 0, textStyle: '',
  };
}

export function heading(text, tag = 'h3') {
  return { children: [textNode(text)], direction: 'ltr', format: '', indent: 0, type: 'heading', version: 1, tag };
}

function listItem(runs, value) {
  return { children: runNodes(runs), direction: 'ltr', format: '', indent: 0, type: 'listitem', version: 1, value };
}

/** A listitem whose only child is a nested list — the canonical @lexical/list nesting shape. */
function nestedListItem(list, value) {
  return { children: [list], direction: 'ltr', format: '', indent: 0, type: 'listitem', version: 1, value };
}

/**
 * items: array of  runs  |  {runs, children:[...items]}
 * Nested children become a sibling listitem holding a nested list, per @lexical/list.
 */
export function buildList(items, ordered = false) {
  const children = [];
  let value = 1;
  for (const item of items) {
    const isObj = item && !Array.isArray(item) && typeof item === 'object' && 'runs' in item;
    const runs = isObj ? item.runs : item;
    children.push(listItem(runs, value++));
    if (isObj && item.children && item.children.length) {
      children.push(nestedListItem(buildList(item.children, ordered), value++));
    }
  }
  return {
    children, direction: 'ltr', format: '', indent: 0, type: 'list', version: 1,
    listType: ordered ? 'number' : 'bullet', start: 1, tag: ordered ? 'ol' : 'ul',
  };
}

/**
 * blocks: [{t:'h', text, tag?} | {t:'p', runs} | {t:'ul'|'ol', items}]
 * Returns the full column value, root wrapper included.
 */
export function buildRoot(blocks) {
  const children = blocks.map(b => {
    if (b.t === 'h') return heading(b.text, b.tag || 'h3');
    if (b.t === 'ul') return buildList(b.items, false);
    if (b.t === 'ol') return buildList(b.items, true);
    return paragraph(b.runs !== undefined ? b.runs : b.text);
  });
  return { root: { children, direction: 'ltr', format: '', indent: 0, type: 'root', version: 1 } };
}

/** Flatten a root back to plain text — used by the read-back diff. */
export function rootToText(value) {
  const out = [];
  const walk = (n) => {
    if (!n) return;
    if (n.type === 'text') { out.push(n.text); return; }
    if (Array.isArray(n.children)) n.children.forEach(walk);
    if (['paragraph', 'heading', 'listitem'].includes(n.type)) out.push('\n');
  };
  walk(value?.root || value);
  return out.join('').replace(/\n+/g, '\n').trim();
}
