import { sessionCookieNames } from '@gitroom/helpers/auth/session.cookies';
import { NextRequest } from 'next/server';
import { sign } from 'jsonwebtoken';
import { proxy } from './proxy';

jest.mock('@gitroom/helpers/utils/internal.fetch', () => ({ internalFetch: jest.fn() }));

const secret = 'socialz-test-session-key-only-not-a-runtime-secret';
const original = { ...process.env };
const request = (path: string, cookie?: string) => new NextRequest(
  `https://socialz.example.com${path}`,
  { headers: cookie === undefined ? {} : { cookie: `${sessionCookieNames.auth}=${cookie}` } }
);

beforeEach(() => {
  process.env.JWT_SECRET = secret;
  process.env.FRONTEND_URL = 'https://socialz.example.com';
  process.env.COOKIE_HOST_ONLY = 'true';
  process.env.IS_GENERAL = 'true';
  delete process.env.NOT_SECURED;
});
afterAll(() => { process.env = original; });

describe('session routing regression', () => {
  it.each([
    ['empty', ''],
    ['malformed', 'stale-session-value'],
    ['foreign', sign({ id: 'owner' }, 'another-app-key')],
    ['expired', sign({ id: 'owner', exp: 1 }, secret)],
    ['missing user id', sign({ purpose: 'email-verification' }, secret)],
  ])('keeps %s sessions on sign-in and expires only host cookies', async (_, token) => {
    const response = await proxy(request('/auth/login', token));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    for (const name of [sessionCookieNames.auth, sessionCookieNames.showorg, sessionCookieNames.impersonate]) {
      const cookie = response.cookies.get(name)!;
      expect(cookie.value).toBe('');
      expect(cookie.maxAge).toBe(-1);
      expect(cookie.domain).toBeUndefined();
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.secure).toBe(true);
    }
  });

  it('sends an invalid protected session straight to sign-in', async () => {
    const response = await proxy(request('/launches', 'stale-session-value'));
    expect(response.headers.get('location')).toBe('https://socialz.example.com/auth/login');
  });

  it('keeps a valid owner token on the normal dashboard route', async () => {
    const token = sign({ id: 'owner' }, secret);
    const response = await proxy(request('/auth/login', token));
    expect(response.headers.get('location')).toBe('https://socialz.example.com/');
    expect(response.cookies.get(sessionCookieNames.auth)).toBeUndefined();
  });

  it('allows a visitor without a cookie to sign in', async () => {
    const response = await proxy(request('/auth/login'));
    expect(response.status).toBe(200);
    expect(response.cookies.get(sessionCookieNames.auth)).toBeUndefined();
  });

  it('clears HttpOnly session state at the server logout endpoint', async () => {
    const response = await proxy(request('/auth/logout', sign({ id: 'owner' }, secret)));
    expect(response.headers.get('location')).toBe('https://socialz.example.com/auth/login');
    expect(response.cookies.get(sessionCookieNames.auth)!.maxAge).toBe(-1);
  });
});


it('ignores legacy cookies belonging to other apps', async () => {
  const response = await proxy(new NextRequest('https://socialz.example.com/auth/login', {
    headers: { cookie: 'auth=other-app; maria_auth=other-app' },
  }));
  expect(response.status).toBe(200);
  expect(response.cookies.get('auth')).toBeUndefined();
  expect(response.cookies.get('maria_auth')).toBeUndefined();
});

it('uses the Socialz token when legacy cookies are present', async () => {
  const token = sign({ id: 'owner' }, secret);
  const response = await proxy(new NextRequest('https://socialz.example.com/auth/login', {
    headers: { cookie: `auth=other-app; ${sessionCookieNames.auth}=${token}; maria_auth=other-app` },
  }));
  expect(response.headers.get('location')).toBe('https://socialz.example.com/');
});
