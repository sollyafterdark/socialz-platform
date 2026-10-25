import localFont from 'next/font/local';

export const inter = localFont({
  src: '../../../public/brand/fonts/Inter-Variable.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
});
export const sora = localFont({
  src: '../../../public/brand/fonts/Sora-Variable.woff2',
  weight: '100 800',
  style: 'normal',
  display: 'swap',
  variable: '--socialz-heading-font',
});
