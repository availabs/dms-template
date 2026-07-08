import { EditorMockupEdit, EditorMockupView } from './EditorMockup';

export default {
  name: 'Editor Mockup',
  type: 'EditorMockup',
  useDataSource: false,
  useDataWrapper: false,
  themeKey: 'pages.editorMockup',

  defaultState: {
    path: '',
    badge: '',
    blocks: [],
  },

  controls: {},

  EditComp: EditorMockupEdit,
  ViewComp: EditorMockupView,
};
