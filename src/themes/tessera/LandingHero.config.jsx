import { LandingHeroEdit, LandingHeroView } from './LandingHero';

export default {
  name: 'Landing Hero',
  type: 'LandingHero',
  useDataSource: false,
  useDataWrapper: false,
  themeKey: 'pages.landingHero',

  defaultState: {
    title: '',
    subtitle: '',
    stats: [],
    ctas: [],
    sketch: true,
  },

  controls: {},

  EditComp: LandingHeroEdit,
  ViewComp: LandingHeroView,
};
