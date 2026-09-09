
// ─────────────────────────────────────────────────────────────────────────────
// County narrative prose — excerpt + paragraph breaks
//
// The DHSES County Database's four narrative fields are the county's own
// description of itself, and they arrive as ONE unbroken run of 450-1,100
// characters with no newline in them (checked directly: `geography_topography`
// 452 chars, `demographics_population_centers` 758,
// `major_industries_economic_drivers_and_notable_infrastructure` 810, and
// `climate_assessment_narrative` — a lexical column, so already *capable* of
// carrying breaks — is a single paragraph node). Rendered raw they are a wall
// of text in four places on the plan home, and each card already links to the
// page that carries the field in full.
//
// So this does two things, and both are author-configurable per column:
//   · EXCERPT to whole sentences within a character budget (`proseMaxChars`)
//   · BREAK the kept sentences into N balanced paragraphs (`proseParagraphs`)
//
// It also repairs three artifacts that are in the SOURCE DATA, not the design:
// a stray trailing `?` on every text field, seven non-breaking spaces mid
// sentence, and doubled spaces. Those are worth fixing on the DHSES rows too —
// this only keeps them off the page in the meantime.
//
// ── Why a column type and not a `formatFn` ───────────────────────────────────
// `formatFn` cannot carry prose. Card.jsx's generic branch is
// `formatFunctions[attr.formatFn](value, isDollar).replaceAll(' ', '')` — it
// strips EVERY space (right for `1.2M`, fatal for a sentence) and it calls
// `.replaceAll` on the result, so a formatFn cannot return elements either.
// Only `icon`, `color` and `combine` are special-cased past that line. A prose
// transform that emits multiple <p> is a rendering change, which is what a
// column type is for — and a theme-registered one needs no library change at
// all (`siteConfig.jsx` auto-registers `theme.columnTypes`).
// ─────────────────────────────────────────────────────────────────────────────

// \u00A0 written as an escape, not a literal: a raw NBSP in source is an
// "irregular whitespace" lint error and is invisible to the next reader.
const NBSP = /\u00A0/g;

// A lexical column (climate_assessment_narrative) hands us a document, not a
// string. Walk it for text nodes rather than special-casing the caller.
const lexicalToText = (node) => {
  if (!node || typeof node !== "object") return "";
  if (typeof node.text === "string") return node.text;
  const kids = node.children || node.root?.children || (node.root ? [node.root] : []);
  return kids.map(lexicalToText).join("");
};

/** Normalise any of the four narrative fields to clean plain text. */
export const countyProseText = (value) => {
  const raw = value?.value ?? value;
  if (raw === null || raw === undefined) return "";
  let s;
  if (typeof raw === "string") {
    // a lexical doc can also arrive stringified
    const t = raw.trim();
    if (t.startsWith("{") && t.includes('"root"')) {
      try { s = lexicalToText(JSON.parse(t)); } catch { s = raw; }
    } else s = raw;
  } else s = lexicalToText(raw);

  return String(s)
    .replace(NBSP, " ")
    .replace(/\s+/g, " ")
    // the source's stray trailing `?` — only when it stands alone after a
    // space or directly after a sentence terminator, so a real question keeps
    // its mark.
    .replace(/(?:\s+\?|(?<=[.!])\?)\s*$/, "")
    .trim();
};

// Split on a terminator followed by whitespace AND an opening character, so
// "(i.e., 32°F)" and "NY-17." don't fragment a sentence.
const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z"'(“])/;

/**
 * Excerpt to whole sentences within `maxChars`, then group them into
 * `paragraphs` balanced blocks.
 * @returns {{paragraphs: string[], truncated: boolean}}
 */
export const countyProseParagraphs = (value, { maxChars = 440, paragraphs = 2 } = {}) => {
  const text = countyProseText(value);
  if (!text) return { paragraphs: [], truncated: false };

  const sentences = text.split(SENTENCE_SPLIT).filter(Boolean);

  // Keep whole sentences while they fit; always keep at least the first, or a
  // one-sentence field longer than the budget would render empty.
  const kept = [];
  let used = 0;
  for (const s of sentences) {
    const cost = used === 0 ? s.length : s.length + 1;
    if (kept.length && used + cost > maxChars) break;
    kept.push(s);
    used += cost;
  }
  const truncated = kept.length < sentences.length;

  const n = Math.max(1, Math.min(paragraphs, kept.length));
  if (n === 1) return { paragraphs: [kept.join(" ")], truncated };

  // Balance by length, not by sentence count: two sentences of 40 and 300
  // characters are not a two-paragraph card.
  //
  // Break BEFORE the sentence that would overshoot, not after it. Breaking
  // after (the obvious `curLen >= target` form) puts the straddling sentence in
  // the first block every time, which on a 4-sentence field gave a 342/88 split
  // where 180/250 was available.
  const target = used / n;
  const out = [];
  let cur = [];
  let curLen = 0;
  kept.forEach((s, i) => {
    const remainingAfter = kept.length - i - 1;
    const blocksLeft = n - out.length - 1;
    const overshootsFurther =
      Math.abs(curLen + s.length - target) > Math.abs(curLen - target);
    if (
      cur.length && out.length < n - 1 && overshootsFurther &&
      1 + remainingAfter >= blocksLeft         // this one + the rest can still fill every block
    ) {
      out.push(cur.join(" "));
      cur = [];
      curLen = 0;
    }
    cur.push(s);
    curLen += curLen ? s.length + 1 : s.length;
  });
  if (cur.length) out.push(cur.join(" "));
  return { paragraphs: out, truncated };
};

/**
 * The rendered block. Used by the `county_prose` column type AND directly by
 * mnyHeader, so the header note and the three profile cards excerpt and break
 * identically.
 */
export const CountyProse = ({
  value,
  proseMaxChars,
  proseParagraphs,
  className = "",
  paragraphClassName = "",
  truncationMark = " …",
}) => {
  const { paragraphs, truncated } = countyProseParagraphs(value, {
    maxChars: Number(proseMaxChars) || undefined,
    paragraphs: Number(proseParagraphs) || undefined,
  });
  if (!paragraphs.length) return null;
  return (
    <div className={`w-full flex flex-col gap-2 ${className}`}>
      {paragraphs.map((p, i) => (
        <p key={i} className={paragraphClassName}>
          {p}
          {truncated && i === paragraphs.length - 1 ? truncationMark : null}
        </p>
      ))}
    </div>
  );
};

// Card cells are read-only for this column (the field is edited on the DHSES
// row, not on the page), so Edit and View are the same component — the cell
// keeps its look instead of falling back to the registry's DefaultComp.
export const countyProseColumnType = {
  ViewComp: CountyProse,
  EditComp: CountyProse,
};

export default countyProseColumnType;
