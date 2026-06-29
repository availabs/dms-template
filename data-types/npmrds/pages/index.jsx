import React from 'react';
import Create from './create';

const pages = {
  defaultPages: ['table', 'schedule', 'runs'], // built-in Table + cron Schedule + Runs pages
  sourceCreate: {
    name: 'Create',
    component: Create,
  },
};

export default pages;
