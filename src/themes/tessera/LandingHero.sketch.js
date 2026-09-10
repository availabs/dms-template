/* 2D-canvas port of the design system's hero sketch layer (the three.js
   original lives in design_system_v6/pages/beta-landing.html). Wireframe
   sections trace themselves onto the sheet, assemble page layouts, get
   rearranged like sections in the editor — t6-joint squares pin each corner —
   then fade. Everything is an axis-aligned rect, so plain canvas 2D
   reproduces it without the three.js dependency.
   Decorative only. Reduced motion: one fully-drawn static frame, no loop. */

const GRID = 24;                 // matches the t6 sheet
const T = 2;                     // stroke thickness (px)
const OUT_A = 0.4, IN_A = 0.22;  // outline / inner-detail opacity
const JOINT_A = 0.55;            // corner joint square opacity
const JOINT = 7, PLUG = 5;       // t6-joint: 7px square, panel-filled
const MOVE_MS = 560;

const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const rnd = (a, b) => a + Math.random() * (b - a);

// page layouts the sections assemble, in sheet cells (1 cell = 24px).
// x/y is the built arrangement; ax/ay is where each section moves when
// the layout is rearranged (same block, new slot — a section reorder).
const BLUEPRINTS = [
  { w: 14, h: 10, blocks: [                                  // dashboard
    { x: 0, y: 0, w: 14, h: 2, ax: 0, ay: 0, kind: 'title' },
    { x: 0, y: 3, w: 4, h: 2, ax: 10, ay: 3, kind: 'plain' },
    { x: 5, y: 3, w: 4, h: 2, ax: 0, ay: 3, kind: 'plain' },
    { x: 10, y: 3, w: 4, h: 2, ax: 5, ay: 3, kind: 'plain' },
    { x: 0, y: 6, w: 8, h: 4, ax: 6, ay: 6, kind: 'table' },  // table ↔ chart
    { x: 9, y: 6, w: 5, h: 4, ax: 0, ay: 6, kind: 'chart' },
  ] },
  { w: 11, h: 10, blocks: [                                  // article: sidebar
    { x: 0, y: 0, w: 8, h: 2, ax: 3, ay: 0, kind: 'title' }, //   crosses over
    { x: 0, y: 3, w: 7, h: 7, ax: 4, ay: 3, kind: 'text' },
    { x: 8, y: 3, w: 3, h: 3, ax: 0, ay: 3, kind: 'plain' },
    { x: 8, y: 7, w: 3, h: 3, ax: 0, ay: 7, kind: 'chart' },
  ] },
  { w: 13, h: 9, blocks: [                                   // map page: map
    { x: 0, y: 0, w: 8, h: 9, ax: 5, ay: 0, kind: 'plain' }, //   flips sides
    { x: 9, y: 0, w: 4, h: 2, ax: 0, ay: 0, kind: 'title' },
    { x: 9, y: 3, w: 4, h: 2, ax: 0, ay: 3, kind: 'plain' },
    { x: 9, y: 6, w: 4, h: 3, ax: 0, ay: 6, kind: 'chart' },
  ] },
  { w: 9, h: 10, blocks: [                                   // gallery: cards
    { x: 0, y: 0, w: 9, h: 2, ax: 0, ay: 0, kind: 'title' }, //   cycle slots
    { x: 0, y: 3, w: 4, h: 3, ax: 5, ay: 3, kind: 'plain' },
    { x: 5, y: 3, w: 4, h: 3, ax: 5, ay: 7, kind: 'chart' },
    { x: 5, y: 7, w: 4, h: 3, ax: 0, ay: 7, kind: 'plain' },
    { x: 0, y: 7, w: 4, h: 3, ax: 0, ay: 3, kind: 'text' },
  ] },
  { w: 8, h: 11, blocks: [                                   // profile column
    { x: 0, y: 0, w: 8, h: 2, ax: 0, ay: 0, kind: 'title' },
    { x: 0, y: 3, w: 8, h: 4, ax: 0, ay: 3, kind: 'text' },
    { x: 0, y: 8, w: 4, h: 3, ax: 4, ay: 8, kind: 'chart' },
    { x: 5, y: 8, w: 3, h: 3, ax: 0, ay: 8, kind: 'plain' },
  ] },
];

/**
 * Start the sketch on `canvas`, sized to `band` (the hero band element).
 * `keepOutEls` returns the elements sketches must never cover (hero copy +
 * the opaque editor illustration) — measured live so it tracks the layout.
 * Returns a cleanup function.
 */
export function startHeroSketch(canvas, band, keepOutEls) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  let W = 0, H = 0;
  function resize() {
    W = band.clientWidth; H = band.clientHeight;
    canvas.width = Math.max(1, W * dpr);
    canvas.height = Math.max(1, H * dpr);
  }
  resize();

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  let ink = '#0A46D8', pap = '#F6F5F1';
  const refreshColors = () => { ink = css('--t-cobalt') || ink; pap = css('--t-paper') || pap; };
  refreshColors();

  const comps = [];

  function keepOuts() {
    const br = band.getBoundingClientRect();
    const PAD = 20;
    return keepOutEls().map((el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left - br.left - PAD, y: r.top - br.top - PAD,
               w: r.width + 2 * PAD, h: r.height + 2 * PAD };
    }).filter(Boolean);
  }
  const hits = (px, py, pw, ph, r) =>
    px < r.x + r.w && r.x < px + pw && py < r.y + r.h && r.y < py + ph;

  function spawnComp(startAt) {
    const cols = Math.floor(W / GRID), rows = Math.floor(H / GRID);
    const fits = BLUEPRINTS.filter((bp) => bp.w <= cols - 2 && bp.h <= rows - 2);
    if (!fits.length) return false;
    const bp = fits[Math.floor(Math.random() * fits.length)];
    const mirror = Math.random() < 0.5;                // flip layouts L↔R
    const avoid = keepOuts();

    let col = 0, row = 0, found = false;
    for (let tries = 0; tries < 60 && !found; tries++) {
      col = 1 + Math.floor(Math.random() * Math.max(1, cols - bp.w - 1));
      row = 1 + Math.floor(Math.random() * Math.max(1, rows - bp.h - 1));
      const px = col * GRID, py = row * GRID, pw = bp.w * GRID, ph = bp.h * GRID;
      if (avoid.some((r) => hits(px, py, pw, ph, r))) continue;
      // never stack layouts: ≥1 clear cell between live compositions
      const clear = comps.every((c) =>
        col + bp.w < c.col || c.col + c.bp.w < col || row + bp.h < c.row || c.row + c.bp.h < row);
      if (clear) found = true;
    }
    if (!found) return false;                          // top-up will retry

    const arr = Math.random() < 0.5 ? 0 : 1;           // random starting arrangement
    const speed = rnd(1250, 1850);                     // per-layout pen speed
    const stagger = rnd(0.55, 0.8);
    let cursor = startAt + rnd(0, 500);
    const blocks = bp.blocks.map((raw) => {
      const def = mirror
        ? { ...raw, x: bp.w - raw.x - raw.w, ax: bp.w - raw.ax - raw.w }
        : raw;
      const sx = arr === 0 ? def.x : def.ax, sy = arr === 0 ? def.y : def.ay;
      const nBars = 3 + Math.floor(Math.random() * 3);
      const b = {
        def, kind: def.kind,
        pw: def.w * GRID, ph: def.h * GRID,
        gx: sx * GRID, gy: sy * GRID, rot: 0,
        start: cursor, drawMs: 0,
        rand: {
          titleFr: rnd(0.32, 0.55),
          textFr: [rnd(0.85, 1), rnd(0.85, 1), rnd(0.35, 0.7)],
          bars: Array.from({ length: nBars }, () => rnd(0.25, 0.85)),
        },
      };
      b.drawMs = (2 * (b.pw + b.ph) / speed) * 1000;
      cursor += b.drawMs * stagger;                    // next section overlaps
      return b;
    });

    comps.push({
      bp, col, row, blocks, alpha: 1,
      state: 'build', until: 0, arr,
      movesLeft: 1 + Math.floor(Math.random() * 3),    // rearrange 1–3 times
      moveStart: 0, movers: [],
      buildDone: cursor + blocks[blocks.length - 1].drawMs,
    });
    return true;
  }

  // center-anchored rect, mirroring the original's place() semantics
  const rect = (cx, cy, w, h, color, a) => {
    if (w <= 0 || h <= 0 || a <= 0) return;
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = color;
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  };

  // trace the outline: a pen running the perimeter, corners overlapping
  // into little T×T joints (the tesserae)
  function drawOutline(b, p, alpha) {
    const w = b.pw, h = b.ph, per = 2 * (w + h);
    const lens = [w, h, w, h];
    const starts = [[0, 0], [w, 0], [w, h], [0, h]];
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    let acc = 0;
    for (let i = 0; i < 4; i++) {
      const vis = Math.max(0, Math.min(lens[i], p * per - acc));
      acc += lens[i];
      if (vis <= 0) continue;
      const L = vis + (vis >= lens[i] ? T : 0);
      const cx = starts[i][0] + dirs[i][0] * (vis / 2);
      const cy = starts[i][1] + dirs[i][1] * (vis / 2);
      if (dirs[i][1] === 0) rect(cx, cy, L, T, ink, OUT_A * alpha);
      else rect(cx, cy, T, L, ink, OUT_A * alpha);
    }
    // t6-joint squares pop in as the pen passes each corner
    const cornerD = [0, w, w + h, 2 * w + h];
    const corners = [[0, 0], [w, 0], [w, h], [0, h]];
    for (let i = 0; i < 4; i++) {
      if (p > 0 && p * per >= cornerD[i]) {
        rect(corners[i][0], corners[i][1], JOINT, JOINT, ink, JOINT_A * alpha);
        rect(corners[i][0], corners[i][1], PLUG, PLUG, pap, alpha);
      }
    }
  }

  // inner details per kind — randomized per block instance at spawn
  function drawInner(b, p, alpha) {
    const w = b.pw, h = b.ph, g = ease(p), r = b.rand;
    if (g <= 0) return;
    if (b.kind === 'title') {
      const len = Math.max(0, Math.min(w * r.titleFr, w - 20)) * g;
      rect(12 + len / 2, h / 2, len, 3, ink, IN_A * alpha);
    } else if (b.kind === 'text') {
      r.textFr.forEach((fr, i) => {
        const len = Math.max(0, w - 24) * fr * g;
        rect(12 + len / 2, h * (0.26 + i * 0.22), len, 2, ink, IN_A * alpha);
      });
    } else if (b.kind === 'table') {
      for (let i = 0; i < 3; i++) {
        const y = GRID * (i + 1);
        if (y >= h - 6) continue;
        rect((w * g) / 2, y, w * g, 1.5, ink, IN_A * alpha);
      }
    } else if (b.kind === 'chart') {
      const n = r.bars.length;
      const inw = w - 20, bw = Math.min(10, inw / (n * 1.8));
      r.bars.forEach((fr, i) => {
        const bh = (h - 18) * fr * g;
        const x = 10 + (inw / n) * (i + 0.5);
        rect(x, h - 8 - bh / 2, bw, bh, ink, IN_A * alpha);
      });
    }
  }

  function drawComp(c, t) {
    const rootX = c.col * GRID, rootY = c.row * GRID;
    for (const b of c.blocks) {
      const p = (t - b.start) / b.drawMs;
      ctx.save();
      ctx.translate(rootX + b.gx, rootY + b.gy);
      if (b.rot) ctx.rotate(b.rot);
      drawOutline(b, ease(p), c.alpha);
      drawInner(b, (p - 1) / 0.5, c.alpha);            // details after the outline
      ctx.restore();
    }
  }

  function startMove(c, t) {
    const to = c.arr === 0 ? ['ax', 'ay'] : ['x', 'y'];
    const from = c.arr === 0 ? ['x', 'y'] : ['ax', 'ay'];
    const moving = c.blocks.filter((b) => b.def.ax !== b.def.x || b.def.ay !== b.def.y);
    // shuffled order: a different section leads each rearrange
    const order = moving.map((_, i) => i).sort(() => Math.random() - 0.5);
    c.movers = moving.map((b, i) => ({
      b, delay: order[i] * rnd(120, 220),
      fx: b.def[from[0]] * GRID, fy: b.def[from[1]] * GRID,
      tx: b.def[to[0]] * GRID, ty: b.def[to[1]] * GRID,
    }));
    c.moveStart = t;
    c.state = 'move';
  }

  function step(c, t) {
    if (c.state === 'build') {
      if (t >= c.buildDone + 500) { c.state = 'dwell'; c.until = t + rnd(1400, 3800); }
    } else if (c.state === 'dwell') {
      if (t < c.until) return;
      if (c.movesLeft > 0) { c.movesLeft--; startMove(c, t); }
      else { c.state = 'fade'; c.until = t; }
    } else if (c.state === 'move') {
      let done = true;
      for (const m of c.movers) {
        const raw = (t - c.moveStart - m.delay) / MOVE_MS;
        if (raw < 1) done = false;
        const p = ease(raw);
        m.b.gx = m.fx + (m.tx - m.fx) * p;
        m.b.gy = m.fy + (m.ty - m.fy) * p;
        // the mid-drag tilt from the hero illustration, in miniature
        m.b.rot = (raw > 0 && raw < 1) ? Math.sin(p * Math.PI) * 0.02 : 0;
      }
      if (done) { c.arr = 1 - c.arr; c.state = 'dwell'; c.until = t + rnd(1600, 4200); }
    } else if (c.state === 'fade') {
      const p = Math.min(1, (t - c.until) / 600);
      c.alpha = 1 - p;
      if (p >= 1) comps.splice(comps.indexOf(c), 1);
    }
  }

  function render(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const c of comps) drawComp(c, t);
    ctx.globalAlpha = 1;
  }

  const targetN = () => (W > 1400 ? 2 : 1);
  let nextTopUp = 0;
  function topUp(t) {
    if (t < nextTopUp) return;
    nextTopUp = t + 2500;
    if (comps.length < targetN()) spawnComp(t + rnd(200, 900));
  }

  // colors track the sun/moon toggle
  const mo = new MutationObserver(refreshColors);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  let raf = 0, rto = 0, visible = true, disposed = false;
  let io = null, onResize = null;

  if (reduced) {
    spawnComp(0);
    render(1e9);                                       // far future: fully drawn
  } else {
    spawnComp(performance.now() + 400);
    const loop = (t) => {
      if (disposed) return;
      comps.slice().forEach((c) => step(c, t));
      topUp(t);
      render(t);
      if (visible) raf = requestAnimationFrame(loop);
    };
    io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
    });
    io.observe(band);
    raf = requestAnimationFrame(loop);
    onResize = () => {
      clearTimeout(rto);
      rto = setTimeout(() => {
        comps.length = 0;
        resize(); nextTopUp = 0;
      }, 180);
    };
    window.addEventListener('resize', onResize);
  }

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    clearTimeout(rto);
    mo.disconnect();
    if (io) io.disconnect();
    if (onResize) window.removeEventListener('resize', onResize);
  };
}
