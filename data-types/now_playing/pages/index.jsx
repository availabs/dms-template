import React from 'react';
import Create from './create';
import Webhook from './webhook';

/**
 * `defaultPages: ['table']` opts this dataType into the built-in Table
 * page from the datasets pattern's defaultPages registry. The Table
 * component reads `source.metadata.columns` (set at provision time in
 * `routes.js`) and renders the curated set of columns. See
 * `dms-template/data-types/CLAUDE.md#defaultPages-shorthand`.
 *
 * `webhook` is a now_playing-specific source-view page that surfaces
 * the ACR callback URL, health status, and the historical-backfill
 * trigger. The Create page navigates here after a successful provision
 * so the user has a stable URL to come back to.
 */
const pages = {
  defaultPages: ['table'],
  sourceCreate: {
    name: 'Create',
    component: Create
  },
  webhook: {
    name: 'Webhook',
    path: '/webhook',
    component: Webhook
  }
};

export default pages;
