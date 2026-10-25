import { getCookieUrlFromDomain } from './subdomain.management';

describe('cookie isolation for a dedicated Socialz hostname', () => {
  const original = process.env.COOKIE_HOST_ONLY;
  afterEach(() => {
    if (original === undefined) delete process.env.COOKIE_HOST_ONLY;
    else process.env.COOKIE_HOST_ONLY = original;
  });

  it('omits Domain so Socialz cookies cannot be set on sibling websites', () => {
    process.env.COOKIE_HOST_ONLY = 'true';
    expect(
      getCookieUrlFromDomain('https://socialz.mpsolara.com')
    ).toBeUndefined();
  });

  it('preserves upstream parent-domain behaviour when not opted in', () => {
    delete process.env.COOKIE_HOST_ONLY;
    expect(getCookieUrlFromDomain('https://socialz.example.com')).toBe(
      '.example.com'
    );
    expect(getCookieUrlFromDomain('http://localhost:4007')).toBe('localhost');
  });
});
