/* The shared PUBLIC footer — the design's INVERTED card — as a lexical
 * element-data blob. One definition, two consumers: the seed
 * (`seed-wcdb-public-pages.mjs`) stamps it onto every page it builds, and
 * `update-footer.mjs` rewrites the footer section on pages that already exist.
 *
 *  It flips the mode (a light block on the dark site) so the foot of the page
 *  reads as a separate object rather than more page — that is the section's
 *  whole visual job.
 *
 *  Three tiers, as the design lays them out: a left column carrying the
 *  station's own voice (eyebrow → headline → paragraph), two link columns to
 *  its right, then a hairline and a colophon split to the two edges.
 *
 *  NB the columns are a single 3-track grid rather than the design's
 *  `[1.4fr_1fr]` with a nested 2-up inside it: a lexical layout container
 *  inside a layout item is a nesting the editor does not handle predictably,
 *  and `1.4fr 0.5fr 0.5fr` lands in the same place visually.
 *
 *  The link lists (2026-09-13): LISTEN is Schedule and Recent spins — the
 *  live stream is the play button in the rail, and there is no shows index.
 *  STATION is Station info and DJ login; pledge / volunteer / contact pages
 *  do not exist. Each item is a lexical `button` node in the theme's
 *  `footLink` button style, so it is a real link (a `styled` paragraph alone
 *  is plain text). `/admin` is the station-admin pattern's base URL.
 */
import { lexical, styled, text, hr, lcontainer, litem } from '../wcdb-admin/lib.mjs';

// A real anchor: Lexical's link node (the editor registers it, serialised as
// `link`), inside the `footLink` styled paragraph. NOT a `button` node — that
// renders a <button> that navigates on click, which is the wrong element for
// a footer link (no href, no open-in-new-tab, nothing for a crawler).
const link = (url, label) => ({
  type: 'link', url, rel: null, target: null, title: null,
  format: '', indent: 0, direction: null, version: 1,
  children: [text(label)],
});
const footLink = (label, path) => styled('footLink', link(path, label));

export const FOOTER_MARKER = 'On air since 1977';

export const footerData = () => lexical(
  lcontainer(
    'w-full !mt-0 grid-cols-1 md:grid-cols-[1.4fr_0.5fr_0.5fr] gap-10',
    litem(
      // NOT a mailing-list pitch. The newsletter is not launching, and this
      // column previously read "Drop us your email." with no form under it —
      // an invitation the page could not accept. It now carries what a station
      // footer should: who is broadcasting, from where, and the number to
      // call. Every value is the same one `station_info` prints.
      styled('footEyebrow', text(FOOTER_MARKER)),
      styled('footHeadline', text('WCDB Albany 90.9FM')),
      styled('footBody', text('Student-run radio from SUNY Albany, broadcasting from Campus Center 316, 1400 Washington Avenue, Albany NY 12222.')),
      styled('footMeta', text('Request line (518) 442-4242')),
    ),
    litem(
      styled('footListHead', text('Listen')),
      footLink('Schedule', '/schedule'),
      footLink('Recent spins', '/playlist'),
    ),
    litem(
      styled('footListHead', text('Station')),
      footLink('Station info', '/station_info'),
      footLink('DJ login', '/admin'),
    ),
  ),
  hr(),
  lcontainer(
    'w-full !mt-0 grid-cols-2 gap-3',
    litem(styled('footColophon', text('WCDB · 90.9 FM · SUNY Albany'))),
    litem(styled('footColophonEnd', text('© 1977–2026 · A student broadcast'))),
  ),
);

/** The footer as a page-section spec for the seed's `sections` list. */
export const footer = () => ({
  kind: 'lexical', size: '12', bg: 'inverted',
  radius: { tl: true, tr: true, bl: true, br: true },
  // NO left/right padding. Section padding sits outside the card surface, so
  // `left/right: '8'` made the footer 32px narrower per side than every card
  // above it — visibly misaligned. The inset the contents need is INSIDE the
  // card, and comes from `.wcdb-inv`'s own padding in tokens.css (the marker
  // class the `inverted` background carries).
  padding: { top: '4', bottom: '4' },
  data: footerData(),
});
