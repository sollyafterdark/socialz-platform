import LayoutContext from './layout.context';

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useCallback: (callback: unknown) => callback,
}));
jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  FetchWrapperComponent: () => null,
}));
jest.mock('@gitroom/react/helpers/delete.dialog', () => ({ deleteDialog: jest.fn() }));
jest.mock('@gitroom/frontend/app/(app)/auth/return.url.component', () => ({
  useReturnUrl: () => ({ getAndClear: () => undefined }),
}));
jest.mock('@gitroom/react/helpers/variable.context', () => ({
  useVariables: () => ({ backendUrl: '/api', isGeneral: true, isSecured: true }),
}));

const originalWindow = global.window;
afterEach(() => { global.window = originalWindow; });

it.each([
  [401, {}, '/auth/logout'],
  [200, { logout: 'true' }, '/auth/logout'],
  [400, {}, 'https://socialz.example.com/auth/login'],
])('routes status %s through server logout only when needed', async (status, headers, expected) => {
  global.window = { location: { href: 'https://socialz.example.com/auth/login', pathname: '/auth/login' } } as Window & typeof globalThis;
  const outer = LayoutContext({ children: 'content' }) as any;
  const wrapper = outer.type(outer.props);
  await wrapper.props.afterRequest('/user/self', {}, new Response('', { status, headers }));
  expect(window.location.href).toBe(expected);
});
