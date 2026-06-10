import React from 'react';
import Create from './create';

const pages = {
  defaultPages: ['table'],            // inherit the built-in Table page (metadata.columns is written)
  sourceCreate: {
    name: 'Create',
    component: Create,
  },
};

export default pages;
