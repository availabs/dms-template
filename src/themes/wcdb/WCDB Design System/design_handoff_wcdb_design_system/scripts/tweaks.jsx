// WCDB Tweaks: mode (dark/light), accent, type direction, density

const { useEffect } = React;

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "mode": "dark",
  "accent": "monochrome",
  "typeDirection": "hanssen",
  "density": "cozy"
}/*EDITMODE-END*/;

const ACCENTS = {
  monochrome: { name: 'Monochrome', accent: '#f5f5f5', accentInk: '#0a0a0a' },
  ember:      { name: 'Ember',       accent: '#FF4A1C', accentInk: '#0a0a0a' },
  acid:       { name: 'Acid',        accent: '#E6FF3A', accentInk: '#0a0a0a' },
  signal:     { name: 'Signal Blue', accent: '#3DB9FF', accentInk: '#0a0a0a' },
};

const TYPE_DIRECTIONS = {
  hanssen:    { name: 'Hanssen', display: "'Instrument Serif', serif", sans: "'Geist', 'Inter', sans-serif", mono: "'Geist Mono', ui-monospace, monospace" },
  editorial:  { name: 'Editorial', display: "'Fraunces', 'Times New Roman', serif", sans: "'Geist', sans-serif", mono: "'JetBrains Mono', monospace" },
  broadcast:  { name: 'Broadcast', display: "'Oswald', sans-serif", sans: "'Inter', sans-serif", mono: "'IBM Plex Mono', monospace" },
  mono:       { name: 'Mono-fwd', display: "'Instrument Serif', serif", sans: "'IBM Plex Mono', monospace", mono: "'IBM Plex Mono', monospace" },
};

function applyTweaks(t) {
  document.documentElement.setAttribute('data-mode', t.mode);
  document.documentElement.setAttribute('data-density', t.density);

  const accent = ACCENTS[t.accent] || ACCENTS.monochrome;
  // monochrome respects current mode; others override
  if (t.accent !== 'monochrome') {
    document.documentElement.style.setProperty('--accent', accent.accent);
    document.documentElement.style.setProperty('--accent-ink', accent.accentInk);
    document.documentElement.style.setProperty('--accent-soft', accent.accent + '14');
  } else {
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-ink');
    document.documentElement.style.removeProperty('--accent-soft');
  }

  const td = TYPE_DIRECTIONS[t.typeDirection] || TYPE_DIRECTIONS.hanssen;
  document.documentElement.style.setProperty('--font-display', td.display);
  document.documentElement.style.setProperty('--font-sans', td.sans);
  document.documentElement.style.setProperty('--font-mono', td.mono);
}

function WCDBTweaks() {
  const [tweaks, setTweak] = useTweaks(DEFAULTS);

  useEffect(() => { applyTweaks(tweaks); }, [tweaks]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="Mode">
        <TweakRadio
          value={tweaks.mode}
          onChange={(v) => setTweak('mode', v)}
          options={[{ label: 'Dark', value: 'dark' }, { label: 'Light', value: 'light' }]}
        />
      </TweakSection>

      <TweakSection title="Accent">
        <TweakSelect
          value={tweaks.accent}
          onChange={(v) => setTweak('accent', v)}
          options={Object.entries(ACCENTS).map(([k, v]) => ({ label: v.name, value: k }))}
        />
      </TweakSection>

      <TweakSection title="Type">
        <TweakSelect
          value={tweaks.typeDirection}
          onChange={(v) => setTweak('typeDirection', v)}
          options={Object.entries(TYPE_DIRECTIONS).map(([k, v]) => ({ label: v.name, value: k }))}
        />
      </TweakSection>

      <TweakSection title="Density">
        <TweakRadio
          value={tweaks.density}
          onChange={(v) => setTweak('density', v)}
          options={[
            { label: 'Compact',     value: 'compact' },
            { label: 'Cozy',        value: 'cozy' },
            { label: 'Comfortable', value: 'comfortable' },
          ]}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

// Apply defaults immediately so SSR-ish first paint is correct
applyTweaks(DEFAULTS);

Object.assign(window, { WCDBTweaks });
