import { parse } from 'tldts';

export function getCookieUrlFromDomain(domain: string) {
  // A dedicated Socialz hostname must not issue cookies for sibling websites.
  if (process.env.COOKIE_HOST_ONLY === 'true') return undefined;
  const url = parse(domain);
  return url.domain! ? '.' + url.domain! : url.hostname!;
}
