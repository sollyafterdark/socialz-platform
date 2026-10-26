import type { Metadata } from 'next';

// Versioned URLs replace browser caches of the original Postiz favicon.
export const socialzIcons: Metadata['icons'] = {
  icon: [
    { url: '/favicon.ico?v=socialz-blue-hour-2', sizes: 'any' },
    {
      url: '/brand/icons/favicon.svg?v=socialz-blue-hour-2',
      type: 'image/svg+xml',
      sizes: 'any',
    },
  ],
  apple: {
    url: '/brand/icons/apple-touch-icon.png',
    type: 'image/png',
    sizes: '180x180',
  },
};
