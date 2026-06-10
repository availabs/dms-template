import React from 'react';
import Create from './create';

const pages = {
  defaultPages: ['table', 'map', 'metadata'], // worker writes metadata.columns + a PG geometry table
  sourceCreate: {
    name: 'Create',
    component: Create,
  },
};

export default pages;
