/* WCDB design-system mockup runtime — dev scaffolding only.
 *
 * Sibling of `ds-nav.js`: one shared file, included by every page, never
 * pasted into one. It exists so the static mockups can demonstrate two
 * behaviours that are real in the live theme but would otherwise need a build
 * step to show:
 *
 *   1. THEME MODE — mirrors `src/themes/wcdb/ThemeModeToggle.jsx` exactly:
 *      same `wcdb-mode` localStorage key, same `data-mode` attribute on
 *      <html>, same `wcdb:mode-change` event, same Moon-in-dark /
 *      Sun-in-light glyph swap. A reviewer can click the toggle in the nav
 *      and see the brand in both modes, which is the whole point of shipping
 *      a two-mode token set.
 *
 *   2. ON-AIR PHOTO — swaps the home page's hero photograph on each load, so
 *      the panel gets exercised against varied real content instead of one
 *      lucky crop. In the live site this image comes from the show record;
 *      here it is a rotation over the station's own picture library.
 *
 * Include as the second-to-last line before </body> (ds-nav.js is last):
 *
 *     <script src="../mockup.js"></script>
 *
 * NEITHER behaviour belongs in `wcdb_theme.js`. The mode toggle is already a
 * real theme widget; this is only the static stand-in for it.
 */
(function () {
  'use strict';

  /* ── 1 · on-air photo rotation ─────────────────────────────────────────
   * Add or change a photo with ONE line here. Provenance and the selection
   * criteria (they have to survive being a dark, scrimmed, full-bleed panel)
   * are in assets/photos/README.md. */
  var PHOTOS = [
    { f: 'live-spring-show-2024.jpg',        alt: 'WCDB Spring Show 2024' },
    { f: 'live-spring-show-2023.jpg',        alt: 'WCDB Spring Show 2023' },
    { f: 'live-fall-show-2023.jpg',          alt: 'WCDB Fall Show 2023' },
    { f: 'live-battle-of-the-bands-2024.jpg', alt: 'Battle of the Bands 2024' },
    { f: 'in-studio-thelastmiller.jpg',      alt: 'thelastmiller, live in studio' },
  ];

  function rotatePhotos() {
    var slots = document.querySelectorAll('[data-mockup-photo]');
    if (!slots.length) return;
    for (var i = 0; i < slots.length; i++) {
      var el = slots[i];
      // Depth comes from the element's own src, so this holds from pages/ or
      // any nested folder without the script knowing where it is.
      var base = (el.getAttribute('src') || '').replace(/[^/]*$/, '');
      var pick = PHOTOS[Math.floor(Math.random() * PHOTOS.length)];
      el.setAttribute('src', base + pick.f);
      el.setAttribute('alt', pick.alt);
    }
  }

  /* ── 2 · theme mode ────────────────────────────────────────────────────
   * Kept deliberately identical to ThemeModeToggle.jsx. If that component
   * changes, change this with it. */
  var STORAGE_KEY = 'wcdb-mode';

  var MOON = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  var SUN  = '<circle cx="12" cy="12" r="4"/>' +
             '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41' +
             'M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>';

  function initialMode() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') return stored;
    } catch (e) { /* private mode, file:// — fall through */ }
    var attr = document.documentElement.getAttribute('data-mode');
    return attr === 'light' ? 'light' : 'dark';
  }

  function apply(mode) {
    document.documentElement.setAttribute('data-mode', mode);
    try { window.localStorage.setItem(STORAGE_KEY, mode); } catch (e) { /* ignore */ }

    // Repaint every toggle on the page: the glyph shows the mode you are IN
    // (moon while dark), matching the live widget.
    var btns = document.querySelectorAll('[data-mockup-theme-toggle]');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var svg = b.querySelector('svg');
      if (svg) svg.innerHTML = mode === 'dark' ? MOON : SUN;
      var label = mode === 'dark' ? 'Light mode' : 'Dark mode';
      b.setAttribute('aria-label', label);
      b.setAttribute('title', label);
    }
    window.dispatchEvent(new CustomEvent('wcdb:mode-change', { detail: { mode: mode } }));
  }

  function initTheme() {
    apply(initialMode());
    var btns = document.querySelectorAll('[data-mockup-theme-toggle]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function (e) {
        e.preventDefault();
        var now = document.documentElement.getAttribute('data-mode') === 'light' ? 'light' : 'dark';
        apply(now === 'dark' ? 'light' : 'dark');
      });
    }
  }

  // Set the stored mode the moment this file executes, before waiting on
  // DOMContentLoaded — otherwise a reviewer who chose light mode gets a flash
  // of the dark palette on every navigation.
  document.documentElement.setAttribute('data-mode', initialMode());

  /* ── 3 · dialogs ───────────────────────────────────────────────────────
   * Admin surfaces have real modal states (add a DJ, confirm a publish), and a
   * static screenshot of one hides the page behind it. So the mockups open for
   * real: mark the trigger `data-mockup-dialog-open="<id>"`, the container
   * `data-mockup-dialog="<id>"`, and anything that dismisses it
   * `data-mockup-dialog-close`. Backdrop click and Escape close too.
   * Scaffolding, exactly like the nav widget — the live app uses the Dialog
   * primitive. */
  function setDialog(el, open) {
    el.style.display = open ? '' : 'none';
    el.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.documentElement.style.overflow = open ? 'hidden' : '';
  }

  function initDialogs() {
    var dialogs = document.querySelectorAll('[data-mockup-dialog]');
    if (!dialogs.length) return;
    for (var i = 0; i < dialogs.length; i++) setDialog(dialogs[i], false);

    document.addEventListener('click', function (e) {
      var open = e.target.closest && e.target.closest('[data-mockup-dialog-open]');
      if (open) {
        e.preventDefault();
        var id = open.getAttribute('data-mockup-dialog-open');
        var d = document.querySelector('[data-mockup-dialog="' + id + '"]');
        if (d) setDialog(d, true);
        return;
      }
      var close = e.target.closest && e.target.closest('[data-mockup-dialog-close]');
      var backdrop = e.target.hasAttribute && e.target.hasAttribute('data-mockup-dialog');
      if (close || backdrop) {
        var host = close ? close.closest('[data-mockup-dialog]') : e.target;
        if (host) { e.preventDefault(); setDialog(host, false); }
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      for (var j = 0; j < dialogs.length; j++) {
        if (dialogs[j].style.display !== 'none') setDialog(dialogs[j], false);
      }
    });
  }

  function start() { rotatePhotos(); initTheme(); initDialogs(); }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
