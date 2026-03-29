import type { SidebarsConfig } from '@docusaurus/types';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started',
      ],
    },
    {
      type: 'category',
      label: 'Documentation',
      items: [
        'architecture',
        'data-sources',
        'methodology',
      ],
    },
    {
      type: 'category',
      label: 'API',
      items: [
        'api-reference',
      ],
    },
    {
      type: 'category',
      label: 'Contributing',
      items: [
        'contributing',
      ],
    },
  ],
};

export default sidebars;
