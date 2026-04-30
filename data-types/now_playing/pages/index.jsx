import React from 'react';
import Create from './create';

/**
 * `defaultPages: ['table']` opts this dataType into the built-in Table
 * page from the datasets pattern's defaultPages registry. The Table
 * component reads `source.metadata.columns` (set at provision time in
 * `routes.js`) and renders the curated set of columns. See
 * `dms-template/data-types/CLAUDE.md#defaultPages-shorthand`.
 */
const pages = {
  defaultPages: ['table'],
  sourceCreate: {
    name: 'Create',
    component: Create
  }
};

export default pages;
