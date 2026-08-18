#!/usr/bin/env node
/* Build `posts.csv` — the station blog.
 *
 *   node scripts/wcdb-migrate/extract-posts.mjs
 *
 * There is no legacy blog dataset anywhere (neither env has one), so this is a
 * NEW dataset seeded from the design's own copy — the same call the events
 * migration made: seed from the mockup rather than ship an empty table behind a
 * public page, so the page can be judged against real rows on day one.
 *
 * `blog.html` carries six posts (one featured + a five-card grid) with a
 * kicker line of `Category · Date` (and, on the featured one, `· By Author`),
 * a title, and body copy. Everything else the schema needs — slug, status,
 * author_dj_id — is derived or left for the editor.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, 'out');
const PAGE = resolve(HERE, '../../src/themes/wcdb/WCDB Design System/dms_design_system/pages/blog.html');

// The mockup dates carry no year; the design is set in the 2026 term.
const YEAR = 2026;
const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
// The design writes the category both ways ("Dispatch" on the featured card,
// "Dispatches" in the grid). One vocabulary, or the filter bar cannot work.
const CATEGORIES = { dispatch: 'Dispatches', dispatches: 'Dispatches', interviews: 'Interviews', interview: 'Interviews', 'liner notes': 'Liner notes', 'studio diary': 'Studio diary' };
const category = (raw) => CATEGORIES[raw.toLowerCase().trim()] || raw.trim();

const html = readFileSync(PAGE, 'utf8');
const strip = (s) => s.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/\s+class="[^"]*"/g, '');
const clean = (s) => s.replace(/&amp;/g, '&').replace(/&middot;/g, '·').replace(/&mdash;/g, '—')
  .replace(/&ndash;/g, '–').replace(/&rsquo;/g, '’').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const posts = [];

/* featured — kicker, h2, and TWO body paragraphs */
{
  const seg = strip(html.slice(html.indexOf('card:featured'), html.indexOf('card:filter-bar')));
  const kicker = clean((seg.match(/<div>\s*([A-Z][^<>]*·[^<>]*)<\/div>/) || [])[1] || '');
  const title = clean((seg.match(/<h2>\s*([\s\S]*?)<\/h2>/) || [])[1] || '');
  const paras = [...seg.matchAll(/<p>\s*([\s\S]*?)<\/p>/g)].map((m) => clean(m[1]));
  const [cat, date, by] = kicker.split('·').map((x) => x.trim());
  posts.push({
    category: category(cat), date, author_name: (by || '').replace(/^By\s+/i, ''),
    title, excerpt: paras[0] || '', body: paras.join('\n\n'), featured: 'true',
  });
}

/* the grid — kicker, h3, one excerpt each */
{
  const seg = strip(html.slice(html.indexOf('card:blog-grid'), html.indexOf('card:archive')));
  for (const m of seg.matchAll(/<div>\s*([A-Z][^<>]*·[^<>]*?)\s*<\/div>\s*<h3>\s*([\s\S]*?)<\/h3>\s*<p>\s*([\s\S]*?)<\/p>/g)) {
    const [cat, date] = clean(m[1]).split('·').map((x) => x.trim());
    posts.push({
      category: category(cat), date, author_name: '',
      title: clean(m[2]), excerpt: clean(m[3]), body: clean(m[3]), featured: 'false',
    });
  }
}

const rows = posts.map((p, i) => {
  const [mon, day] = (p.date || '').split(/\s+/);
  const published_at = MONTHS[mon] ? `${YEAR}-${MONTHS[mon]}-${String(day).padStart(2, '0')}` : '';
  return {
    post_id: i + 1,
    slug: slugify(p.title),
    title: p.title,
    category: p.category,
    published_at,
    author_name: p.author_name,
    author_dj_id: '',          // the editor picks a DJ; the design names only one author
    excerpt: p.excerpt,
    body: p.body,
    image: '',                 // the design draws initials art, not a photo
    featured: p.featured,
    // Seeded content is LIVE content: these are the posts the design shows on a
    // public page, so they are published, and the admin's draft/published
    // control has something real to switch.
    status: 'published',
  };
});

const COLUMNS = ['post_id', 'slug', 'title', 'category', 'published_at', 'author_name',
  'author_dj_id', 'excerpt', 'body', 'image', 'featured', 'status'];
const esc = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, 'posts.csv'),
  [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => esc(r[c])).join(','))].join('\n') + '\n');

console.log(`posts.csv · ${rows.length} posts`);
for (const r of rows) console.log(`  ${r.published_at || '????-??-??'}  ${r.category.padEnd(13)} ${r.featured === 'true' ? '★ ' : '  '}${r.title}`);
const slugs = new Set(rows.map((r) => r.slug));
if (slugs.size !== rows.length) console.log('  ⚠  duplicate slugs — they are the public URL, fix before publishing');
