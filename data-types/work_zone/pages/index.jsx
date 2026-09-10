import React from 'react';
import Create from './create';

const pages = {
  // 'runs' gives authors the task/run history + live events for a 14-stage
  // pipeline that is run stage by stage. 'schedule' arrives with the
  // schedulables at phase 10.
  defaultPages: ['table', 'runs'],
  sourceCreate: {
    name: 'Create',
    component: Create,
  },
};

export default pages;
