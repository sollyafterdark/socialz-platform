/** @jest-environment jsdom */
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { LogoutComponent } from './logout.component';

const mockFetch = jest.fn().mockResolvedValue({ ok: true });
const mockConfirm = jest.fn();
const mockCookie = jest.fn();
jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  useFetch: () => mockFetch,
}));
jest.mock('@gitroom/react/helpers/variable.context', () => ({
  useVariables: () => ({ isSecured: true }),
}));
jest.mock('@gitroom/react/helpers/delete.dialog', () => ({
  deleteDialog: (...args: any[]) => mockConfirm(...args),
}));
jest.mock('@gitroom/frontend/components/layout/layout.context', () => ({
  setCookie: (...args: any[]) => mockCookie(...args),
}));
jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: () => (_: string, text: string) => text,
}));
const originalLocation = window.location;
beforeAll(() => {
  delete (window as any).location;
  (window as any).location = { href: '/settings' };
});
afterAll(() => {
  (window as any).location = originalLocation;
});
beforeEach(() => {
  mockFetch.mockClear();
  mockCookie.mockClear();
  mockConfirm.mockReset();
  window.location.href = '/settings';
});
afterEach(cleanup);

it('cancels logout without ending the current session', async () => {
  mockConfirm.mockResolvedValue(false);
  render(React.createElement(LogoutComponent, { isIcon: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Log out of Socialz' }));
  await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
  expect(mockFetch).not.toHaveBeenCalled();
  expect(window.location.href).toBe('/settings');
});
it('uses the server logout endpoint to clear a secure session before redirecting', async () => {
  mockConfirm.mockResolvedValue(true);
  render(React.createElement(LogoutComponent, { isIcon: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Log out of Socialz' }));
  await waitFor(() => expect(window.location.href).toBe('/'));
  expect(mockFetch).toHaveBeenCalledWith('/user/logout', { method: 'POST' });
  expect(mockCookie).not.toHaveBeenCalled();
});
