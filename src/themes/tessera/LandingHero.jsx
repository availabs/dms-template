import React from 'react';
import { ThemeContext, getComponentTheme } from '../../dms/packages/dms/src/ui/useTheme';
import { EditorMockup } from './EditorMockup';
import { landingHeroTheme } from './LandingHero.theme';
import { startHeroSketch } from './LandingHero.sketch';

const isJson = (str) => {
  try { JSON.parse(str); } catch (e) { return false; }
  return true;
};

// The one custom section on the marketing site: the entire landing hero —
// copy + caret, CTAs, beta stats, the mid-drag editor illustration
// (EditorMockup), and the animated sketch layer on the band behind it all.
// It's custom (rather than assembled from platform sections) because the
// canvas animation and the copy it must avoid have to live in one component.
export function LandingHero({
  eyebrow, title, subtitle, lede = [], ctas = [], footnote,
  stats = [], editor, caption, sketch = true,
}) {
  const { theme: themeFromContext = {}, UI } = React.useContext(ThemeContext) || {};
  const t = { ...landingHeroTheme, ...getComponentTheme(themeFromContext, 'pages.landingHero') };
  const Icon = UI?.Icon;
  const rootRef = React.useRef(null);
  const copyRef = React.useRef(null);
  const editorRef = React.useRef(null);

  // The sketch canvas belongs to the BAND (full-bleed, behind the content
  // box), not to this section — inserted as the band's first child so it
  // paints under the content, exactly like the mockup's #t6-hero-sketch.
  React.useEffect(() => {
    if (!sketch || !rootRef.current) return;
    const band = rootRef.current.closest('.t6-band-sheet');
    if (!band) return;
    const canvas = document.createElement('canvas');
    canvas.className = 't6-hero-sketch';
    canvas.setAttribute('aria-hidden', 'true');
    band.insertBefore(canvas, band.firstChild);
    const stop = startHeroSketch(canvas, band, () => [copyRef.current, editorRef.current]);
    return () => { stop(); canvas.remove(); };
  }, [sketch]);

  return (
    <div ref={rootRef} className={t.wrapper}>
      <section ref={copyRef} className={t.copyCol}>
        {eyebrow && <p className={t.eyebrow}>{eyebrow}</p>}
        <h1 className={t.heading}>
          <span className={t.title}>{title}</span>
          <span className={t.subtitle}>{subtitle}</span>
        </h1>
        {lede.length > 0 && (
          <p className={t.lede}>
            {lede.map((run, i) => run.href
              ? <a key={i} href={run.href} className={t.ledeLink}>{run.text}</a>
              : run.mark
                ? <span key={i} className={t.ledeMark}>{run.text}</span>
                : <React.Fragment key={i}>{run.text}</React.Fragment>
            )}
          </p>
        )}
        {ctas.length > 0 && (
          <div className={t.ctaRow}>
            {ctas.map((cta, i) => (
              <a key={i} href={cta.href || '#'} className={cta.style === 'secondary' ? t.ctaSecondary : t.ctaPrimary}>
                {cta.text}
                {cta.icon && Icon && <Icon icon={cta.icon} className={t.ctaIcon} />}
              </a>
            ))}
          </div>
        )}
        {footnote && <p className={t.footnote}>{footnote}</p>}
      </section>

      {stats.length > 0 && (
        <section className={t.statsCol}>
          <div className={t.statsStack}>
            {stats.map((s, i) => (
              <div key={i} className={s.accent ? t.statAccent : t.stat}>
                <p className={t.statValue}>{s.value}</p>
                <p className={t.statLabel}>{s.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {editor && (
        <section ref={editorRef} className={t.editorCol}>
          <EditorMockup {...editor} />
          {caption && <p className={t.caption}>{caption}</p>}
        </section>
      )}
    </div>
  );
}

export const LandingHeroEdit = ({ value }) => {
  const data = value && typeof value === 'object'
    ? value['element-data']
    : (value && isJson(value) ? JSON.parse(value) : {});
  const parsed = typeof data === 'string' && isJson(data) ? JSON.parse(data) : (data || {});
  return <LandingHero {...parsed} />;
};

export const LandingHeroView = ({ value }) => {
  const data = value && typeof value === 'object'
    ? value['element-data']
    : (value && isJson(value) ? JSON.parse(value) : {});
  const parsed = typeof data === 'string' && isJson(data) ? JSON.parse(data) : (data || {});
  return <LandingHero {...parsed} />;
};
