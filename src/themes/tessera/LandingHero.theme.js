// Brand-neutral local fallback for the LandingHero section component. The
// live skin comes from theme.pages.landingHero — see tessera-theme-v6.js's
// `pagesTheme.landingHero`; this only covers keys the theme doesn't define.
export const landingHeroTheme = {
  wrapper: 'relative grid grid-cols-12 gap-0',
  copyCol: 'col-span-12 lg:col-span-9 p-3 relative',
  eyebrow: 'text-xs uppercase tracking-wide text-blue-600',
  heading: 'mt-4',
  title: 'block text-6xl font-semibold',
  subtitle: 'block mt-1 text-4xl font-semibold max-w-[16ch]',
  lede: 'text-lg text-gray-600 mt-5 max-w-[640px]',
  ledeMark: 'bg-yellow-100',
  ledeLink: 'underline hover:text-gray-900',
  ctaRow: 'mt-7 flex flex-wrap items-center gap-3',
  ctaPrimary: 'inline-flex items-center gap-2 font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md px-5 py-2.5',
  ctaSecondary: 'inline-flex items-center gap-2 font-medium text-gray-900 border border-gray-300 bg-white hover:border-gray-900 rounded-md px-5 py-2.5',
  ctaIcon: 'w-4 h-4',
  footnote: 'text-xs text-gray-400 mt-5',
  statsCol: 'col-span-12 lg:col-span-3 p-3 relative',
  statsStack: 'h-full flex lg:flex-col gap-0 lg:justify-end',
  stat: 'flex-1 lg:flex-none border-l-2 border-gray-200 pl-4 py-1 mb-0 lg:mb-5 lg:last:mb-0',
  statAccent: 'flex-1 lg:flex-none border-l-2 border-blue-600 pl-4 py-1 mb-0 lg:mb-5 lg:last:mb-0',
  statValue: 'text-3xl font-semibold tabular-nums',
  statLabel: 'text-xs text-gray-400 mt-1',
  editorCol: 'col-span-12 p-3 mt-4 relative',
  caption: 'text-xs text-gray-400 mt-4 text-center lg:text-right lg:pr-2',
};
