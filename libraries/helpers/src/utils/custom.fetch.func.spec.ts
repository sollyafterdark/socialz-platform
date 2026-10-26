import { customFetch } from './custom.fetch.func';

const originalFetch = global.fetch;
const originalWindow = global.window;
const originalDocument = global.document;
let fetchMock: jest.Mock;
beforeEach(() => {
  global.window = { location: { href: 'https://socialz.example.com/launches' } } as Window & typeof globalThis;
  global.document = { cookie: 'auth=legacy; maria_auth=foreign; socialz_auth=local; socialz_showorg=org; socialz_impersonate=target' } as Document;
  fetchMock = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));
  global.fetch = fetchMock;
});
afterEach(() => {
  global.fetch = originalFetch;
  global.window = originalWindow;
  global.document = originalDocument;
});

it('uses browser cookies in HTTPS mode without copying readable cookies into headers', async () => {
  Object.defineProperty(global.document, 'cookie', { get: () => { throw new Error('Secure mode must not read document.cookie'); } });
  await customFetch({ baseUrl: '/api' })('/user/self');
  const options = fetchMock.mock.calls[0][1];
  expect(options.credentials).toBe('include');
  expect(options.headers.auth).toBeUndefined();
  expect(options.headers.showorg).toBeUndefined();
  expect(options.headers.impersonate).toBeUndefined();
});

it('uses exact Socialz cookie names in the optional non-secure mode', async () => {
  await customFetch({ baseUrl: '/api' }, undefined, undefined, false)('/user/self');
  expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ auth: 'local', showorg: 'org', impersonate: 'target' });
});

it('ignores similarly named cookies and generic legacy cookies', async () => {
  global.document = { cookie: 'auth=legacy; maria_auth=foreign; other_socialz_auth=lookalike' } as Document;
  await customFetch({ baseUrl: '/api' }, undefined, undefined, false)('/user/self');
  expect(fetchMock.mock.calls[0][1].headers.auth).toBeUndefined();
});

it('preserves explicit server and mobile authentication headers', async () => {
  await customFetch({ baseUrl: '/api' }, 'server-session', 'server-org')('/user/self');
  expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ auth: 'server-session', showorg: 'server-org' });
});
