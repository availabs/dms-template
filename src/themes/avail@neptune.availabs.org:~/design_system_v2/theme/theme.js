/* Re-export of the production Tessera DMS theme.
   The canonical file lives at: src/themes/tessera/tessera-theme.js
   This re-export keeps `design_system_v2/theme/` self-contained for portability —
   copy this folder into a new project and you have the theme alongside the
   docs. If the folder is moved, swap the import for an in-folder copy of the
   theme file. */

import tesseraTheme from '../../tessera-theme';

export default tesseraTheme;
