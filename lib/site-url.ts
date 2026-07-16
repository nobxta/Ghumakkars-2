export const PRODUCTION_SITE_URL = 'https://www.ghumakkars.in';

export function getSiteUrl() {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');

  if (!configured || configured === 'https://ghumakkars.in') {
    return PRODUCTION_SITE_URL;
  }

  return configured;
}
